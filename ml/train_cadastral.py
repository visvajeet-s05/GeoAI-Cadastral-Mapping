#!/usr/bin/env python3
"""
GeoTrace-AI Cadastral Boundary Training Pipeline
RESCOPED: Only Building + Vegetation heads (SVAMITVA provides genuine supervision for these only)

- Building footprint: supervised by FilteredData/BinaryMasks (channel 0 == 36)
- Vegetation/Greenery: supervised by green class (RGB 85,217,48) from Full Data/Masks

REMOVED: Parcel, Road, Landuse, Boundary heads — no genuine ground truth in SVAMITVA
"""

import os
import sys
import argparse
import logging
import json
import random
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any, Literal
from dataclasses import dataclass, asdict

import numpy as np
import cv2
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import transforms
from torchvision.transforms import functional as TF
import albumentations as A
from albumentations.pytorch import ToTensorV2
from tqdm import tqdm
import segmentation_models_pytorch as smp

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("train_cadastral")

try:
    import wandb
    WANDB_AVAILABLE = True
except ImportError:
    WANDB_AVAILABLE = False

# ==============================================================================
# CONFIGURATION
# ==============================================================================

ElevationMode = Literal["none", "zero_fill", "pseudo"]

@dataclass
class TrainConfig:
    # Data paths
    data_root: str = "Svamitva-dataset/FilteredData"
    train_split: float = 0.8
    
    # Model
    encoder: str = "efficientnet-b3"
    encoder_weights: str = "imagenet"
    in_channels: int = 3  # RGB only (elevation_mode=none)
    
    # Elevation handling
    elevation_mode: ElevationMode = "none"
    
    # Training
    batch_size: int = 8
    num_epochs: int = 30
    learning_rate: float = 1e-4
    weight_decay: float = 1e-5
    num_workers: int = 4
    device: str = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Loss weights (only building + vegetation)
    loss_weights: Dict[str, float] = None
    
    # Augmentation
    img_size: int = 512
    use_albumentations: bool = True
    
    # Checkpointing
    save_dir: str = "ml/checkpoints"
    save_best_only: bool = True
    
    def __post_init__(self):
        if self.elevation_mode == "none":
            self.in_channels = 3
        elif self.elevation_mode in ("zero_fill", "pseudo"):
            self.in_channels = 5
        else:
            raise ValueError(f"Unknown elevation_mode: {self.elevation_mode}")
        
        if self.loss_weights is None:
            self.loss_weights = {
                "building": 1.0,
                "vegetation": 1.0,
                "dice": 1.0,
                "focal": 1.0,
            }

DEFAULT_CONFIG = TrainConfig()

# ==============================================================================
# DATASET
# ==============================================================================

# Actual colors found in SVAMITVA masks (from verification)
BUILDING_COLOR = (0, 110, 255)      # Cyan - used by filter2Binary.py
VEGETATION_COLOR = (85, 217, 48)    # Green - greenery/vegetation

def rgb_mask_to_binary(mask_rgb: np.ndarray, target_color: Tuple[int, int, int], tolerance: int = 30) -> np.ndarray:
    """Convert multi-class RGB mask to binary mask for a specific class color."""
    if mask_rgb.ndim == 2:
        return (mask_rgb > 0).astype(np.float32)
    diff = np.abs(mask_rgb.astype(np.int16) - np.array(target_color, dtype=np.int16))
    dist_sq = np.sum(diff**2, axis=-1)
    dist = np.sqrt(np.maximum(dist_sq, 0))
    return (dist <= tolerance).astype(np.float32)


class CadastralDataset(Dataset):
    """
    Dataset for cadastral boundary segmentation using SVAMITVA dataset structure.
    
    Only provides supervision for:
    - Building: BinaryMasks channel 0 == 36 (foreground) from FilteredData/BinaryMasks
    - Vegetation: Green class (RGB 85,217,48) from Full Data/Masks
    
    NO parcel, road, landuse, or boundary supervision — not present in SVAMITVA.
    """
    
    def __init__(
        self,
        data_root: str,
        split: str = "train",
        img_size: int = 512,
        transform=None,
        config: TrainConfig = None,
    ):
        self.data_root = Path(data_root)
        self.split = split
        self.img_size = img_size
        self.transform = transform
        self.config = config or DEFAULT_CONFIG
        
        # SVAMITVA FilteredData structure
        self.image_dir = self.data_root / "Images"
        self.full_mask_dir = self.data_root.parent / "Full Data" / "Masks"  # For vegetation
        self.binary_mask_dir = self.data_root / "BinaryMasks"  # For building
        
        # Get list of image files
        self.image_files = sorted(list(self.image_dir.glob("*.png")))
        
        if len(self.image_files) == 0:
            logger.warning(f"No images found in {self.image_dir}. Check data path.")
            raise FileNotFoundError(f"No images found in {self.image_dir}")
        
        # Train/val split
        split_idx = int(len(self.image_files) * self.config.train_split)
        if split == "train":
            self.image_files = self.image_files[:split_idx]
        else:
            self.image_files = self.image_files[split_idx:]
        
        logger.info(f"CadastralDataset {split}: {len(self.image_files)} samples "
                    f"(elevation_mode={self.config.elevation_mode}, in_channels={self.config.in_channels})")
    
    def __len__(self):
        return len(self.image_files)
    
    def _read_binary_building_mask(self, mask_path: Path) -> np.ndarray:
        """Read binary building mask from FilteredData/BinaryMasks.
        
        BinaryMasks are RGBA where channel 0 has values 36 (building) and 84 (non-building).
        We use channel 0 == 36 as the building foreground mask.
        """
        mask = cv2.imread(str(mask_path), cv2.IMREAD_UNCHANGED)
        if mask is None:
            return np.zeros((self.img_size, self.img_size), dtype=np.float32)
        
        if mask.ndim == 3:
            # Channel 0: 36=building, 84=background
            building_mask = (mask[:, :, 0] == 36).astype(np.float32)
        else:
            building_mask = (mask > 0).astype(np.float32)
        
        building_mask = cv2.resize(building_mask, (self.img_size, self.img_size), interpolation=cv2.INTER_NEAREST)
        return building_mask
    
    def _read_vegetation_mask(self, mask_path: Path) -> np.ndarray:
        """Read vegetation mask from Full Data/Masks using green color (85, 217, 48)."""
        mask_rgb = cv2.imread(str(mask_path), cv2.IMREAD_COLOR)
        if mask_rgb is None:
            return np.zeros((self.img_size, self.img_size), dtype=np.float32)
        
        mask_rgb = cv2.cvtColor(mask_rgb, cv2.COLOR_BGR2RGB)
        mask_rgb = cv2.resize(mask_rgb, (self.img_size, self.img_size), interpolation=cv2.INTER_NEAREST)
        
        # Extract vegetation class using green color (85, 217, 48)
        veg_mask = rgb_mask_to_binary(mask_rgb, VEGETATION_COLOR)
        return veg_mask
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        img_path = self.image_files[idx]
        stem = img_path.stem
        
        # Read RGB image
        rgb = cv2.imread(str(img_path))
        if rgb is None:
            raise ValueError(f"Failed to read image: {img_path}")
        rgb = cv2.cvtColor(rgb, cv2.COLOR_BGR2RGB)
        rgb = cv2.resize(rgb, (self.img_size, self.img_size), interpolation=cv2.INTER_LINEAR)
        
        # Read building mask from BinaryMasks
        building_mask = None
        if self.binary_mask_dir and (self.binary_mask_dir / f"{stem}.png").exists():
            building_mask = self._read_binary_building_mask(self.binary_mask_dir / f"{stem}.png")
        else:
            # Fallback: extract from full mask using cyan color
            full_mask_path = self.full_mask_dir / f"{stem}.png"
            if full_mask_path.exists():
                full_mask = cv2.imread(str(full_mask_path), cv2.IMREAD_COLOR)
                if full_mask is not None:
                    full_rgb = cv2.cvtColor(full_mask, cv2.COLOR_BGR2RGB)
                    full_rgb = cv2.resize(full_rgb, (self.img_size, self.img_size), interpolation=cv2.INTER_NEAREST)
                    building_mask = rgb_mask_to_binary(full_rgb, BUILDING_COLOR)
            if building_mask is None:
                building_mask = np.zeros((self.img_size, self.img_size), dtype=np.float32)
        
        # Read vegetation mask from Full Data/Masks
        veg_mask_path = self.full_mask_dir / f"{stem}.png"
        vegetation_mask = self._read_vegetation_mask(veg_mask_path) if veg_mask_path.exists() else \
            np.zeros((self.img_size, self.img_size), dtype=np.float32)
        
        # Handle elevation channels based on mode
        if self.config.elevation_mode == "none":
            image = rgb.astype(np.float32) / 255.0
        elif self.config.elevation_mode == "zero_fill":
            dsm = np.zeros((self.img_size, self.img_size), dtype=np.float32)
            dtm = np.zeros((self.img_size, self.img_size), dtype=np.float32)
            image = np.concatenate([
                rgb.astype(np.float32) / 255.0,
                dsm[..., np.newaxis],
                dtm[..., np.newaxis],
            ], axis=-1)
        elif self.config.elevation_mode == "pseudo":
            dsm = self._generate_pseudo_dsm(rgb)
            dtm = np.full((self.img_size, self.img_size), 0.5, dtype=np.float32)
            image = np.concatenate([
                rgb.astype(np.float32) / 255.0,
                dsm[..., np.newaxis],
                dtm[..., np.newaxis],
            ], axis=-1)
        else:
            raise ValueError(f"Unknown elevation_mode: {self.config.elevation_mode}")
        
        # Build target dict (ONLY building + vegetation)
        target = {
            "building": building_mask[..., np.newaxis],
            "vegetation": vegetation_mask[..., np.newaxis],
        }
        
        if self.transform:
            mask_list = [target["building"], target["vegetation"]]
            augmented = self.transform(image=image, masks=mask_list)
            image = augmented["image"]
            target["building"] = augmented["masks"][0]
            target["vegetation"] = augmented["masks"][1]
        
        # Convert to tensors
        def to_tensor(arr):
            if isinstance(arr, torch.Tensor):
                if arr.dim() == 4:
                    arr = arr.permute(2, 0, 1)
                elif arr.dim() == 3 and arr.shape[-1] in (1, 3, 4, 5):
                    arr = arr.permute(2, 0, 1)
                elif arr.dim() == 3 and arr.shape[0] in (1, 3, 4, 5):
                    pass
                return arr
            if arr.ndim == 3 and arr.shape[-1] in (1, 3, 4, 5):
                arr = arr.transpose(2, 0, 1)
            return torch.from_numpy(arr)
        
        return {
            "image": to_tensor(image).float(),
            "building": to_tensor(target["building"]).float(),
            "vegetation": to_tensor(target["vegetation"]).float(),
        }
    
    def _generate_pseudo_dsm(self, rgb: np.ndarray) -> np.ndarray:
        """Generate pseudo-DSM using brightness as height proxy."""
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32) / 255.0
        dsm = cv2.GaussianBlur(gray, (15, 15), 0)
        dsm = (dsm - dsm.min()) / (dsm.max() - dsm.min() + 1e-6)
        return dsm


# ==============================================================================
# MODEL ARCHITECTURE (2 heads only)
# ==============================================================================

class DualHeadCadastralModel(nn.Module):
    """
    Cadastral model with ONLY two supervised heads:
    1. Building footprint extraction (binary)
    2. Vegetation/Greenery segmentation (binary)
    
    NO parcel, road, landuse, or boundary heads — no ground truth in SVAMITVA.
    """
    
    def __init__(self, config: TrainConfig):
        super().__init__()
        self.config = config
        
        # Shared encoder-decoder (U-Net style) using SMP
        self.base_unet = smp.Unet(
            encoder_name=config.encoder,
            encoder_weights=config.encoder_weights,
            in_channels=config.in_channels,
            classes=16,  # Intermediate feature channels
            activation=None,
        )
        
        # Task-specific heads (ONLY 2)
        self.head_building = nn.Sequential(
            nn.Conv2d(16, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, 1),
        )
        
        self.head_vegetation = nn.Sequential(
            nn.Conv2d(16, 32, 3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 1, 1),
        )
        
        # Dropout for MC uncertainty
        self.dropout = nn.Dropout2d(p=0.1)
    
    def forward(self, x: torch.Tensor, mc_dropout: bool = False) -> Dict[str, torch.Tensor]:
        # Shared encoder-decoder
        decoder_out = self.base_unet(x)
        
        if mc_dropout:
            decoder_out = self.dropout(decoder_out)
        
        # Two supervised heads
        building_logits = self.head_building(decoder_out)
        vegetation_logits = self.head_vegetation(decoder_out)
        
        return {
            "building": building_logits,
            "vegetation": vegetation_logits,
        }


# ==============================================================================
# LOSS FUNCTIONS (2 tasks only)
# ==============================================================================

class DualTaskLoss(nn.Module):
    """Combined loss for building + vegetation segmentation."""
    
    def __init__(self, weights: Dict[str, float]):
        super().__init__()
        self.weights = weights
        
        self.bce_loss = nn.BCEWithLogitsLoss()
        self.dice_loss = smp.losses.DiceLoss(mode="binary", from_logits=True)
        self.focal_loss = smp.losses.FocalLoss(mode="binary", alpha=0.25, gamma=2.0)
    
    def forward(self, preds: Dict[str, torch.Tensor], targets: Dict[str, torch.Tensor]) -> Tuple[torch.Tensor, Dict[str, float]]:
        losses = {}
        
        # Building loss
        b_bce = self.bce_loss(preds["building"], targets["building"])
        b_dice = self.dice_loss(preds["building"], targets["building"])
        b_focal = self.focal_loss(preds["building"], targets["building"])
        losses["building"] = self.weights["building"] * (b_bce + b_dice + self.weights["focal"] * b_focal)
        
        # Vegetation loss
        v_bce = self.bce_loss(preds["vegetation"], targets["vegetation"])
        v_dice = self.dice_loss(preds["vegetation"], targets["vegetation"])
        v_focal = self.focal_loss(preds["vegetation"], targets["vegetation"])
        losses["vegetation"] = self.weights["vegetation"] * (v_bce + v_dice + self.weights["focal"] * v_focal)
        
        total_loss = sum(losses.values())
        return total_loss, {k: v.item() for k, v in losses.items()}


# ==============================================================================
# METRICS
# ==============================================================================

def compute_metrics(preds: Dict[str, torch.Tensor], targets: Dict[str, torch.Tensor]) -> Dict[str, float]:
    """Compute IoU, F1, precision, recall for building and vegetation."""
    metrics = {}
    
    for task in ["building", "vegetation"]:
        pred = (torch.sigmoid(preds[task]) > 0.5).float()
        target = targets[task]
        
        tp = (pred * target).sum().item()
        fp = (pred * (1 - target)).sum().item()
        fn = ((1 - pred) * target).sum().item()
        tn = ((1 - pred) * (1 - target)).sum().item()
        
        iou = tp / (tp + fp + fn + 1e-6)
        precision = tp / (tp + fp + 1e-6)
        recall = tp / (tp + fn + 1e-6)
        f1 = 2 * precision * recall / (precision + recall + 1e-6)
        dice = 2 * tp / (2 * tp + fp + fn + 1e-6)
        
        metrics[f"{task}_iou"] = iou
        metrics[f"{task}_f1"] = f1
        metrics[f"{task}_precision"] = precision
        metrics[f"{task}_recall"] = recall
        metrics[f"{task}_dice"] = dice
    
    return metrics


# ==============================================================================
# TRAINING LOOP
# ==============================================================================

def train_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: DualTaskLoss,
    device: str,
    epoch: int,
    config: TrainConfig,
) -> Dict[str, float]:
    model.train()
    epoch_losses = {}
    epoch_metrics = {}
    
    pbar = tqdm(loader, desc=f"Epoch {epoch} [Train]")
    for batch in pbar:
        images = batch["image"].to(device)
        targets = {
            "building": batch["building"].to(device),
            "vegetation": batch["vegetation"].to(device),
        }
        
        optimizer.zero_grad()
        
        preds = model(images)
        loss, loss_dict = criterion(preds, targets)
        
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        
        for k, v in loss_dict.items():
            epoch_losses[k] = epoch_losses.get(k, 0) + v
        
        batch_metrics = compute_metrics(preds, targets)
        for k, v in batch_metrics.items():
            epoch_metrics[k] = epoch_metrics.get(k, 0) + v
        
        pbar.set_postfix({"loss": loss.item()})
    
    n = len(loader)
    epoch_losses = {k: v / n for k, v in epoch_losses.items()}
    epoch_metrics = {k: v / n for k, v in epoch_metrics.items()}
    
    return {**epoch_losses, **epoch_metrics}


@torch.no_grad()
def validate(
    model: nn.Module,
    loader: DataLoader,
    criterion: DualTaskLoss,
    device: str,
    config: TrainConfig,
) -> Dict[str, float]:
    model.eval()
    epoch_losses = {}
    epoch_metrics = {}
    
    pbar = tqdm(loader, desc="Validation")
    for batch in pbar:
        images = batch["image"].to(device)
        targets = {
            "building": batch["building"].to(device),
            "vegetation": batch["vegetation"].to(device),
        }
        
        preds = model(images)
        loss, loss_dict = criterion(preds, targets)
        
        for k, v in loss_dict.items():
            epoch_losses[k] = epoch_losses.get(k, 0) + v
        
        batch_metrics = compute_metrics(preds, targets)
        for k, v in batch_metrics.items():
            epoch_metrics[k] = epoch_metrics.get(k, 0) + v
    
    n = len(loader)
    epoch_losses = {k: v / n for k, v in epoch_losses.items()}
    epoch_metrics = {k: v / n for k, v in epoch_metrics.items()}
    
    return {**epoch_losses, **epoch_metrics}


def train(config: TrainConfig):
    """Main training function."""
    device = torch.device(config.device)
    logger.info(f"Training on {device}")
    
    # Transforms
    if config.use_albumentations:
        if config.in_channels == 3:
            norm_mean = [0.485, 0.456, 0.406]
            norm_std = [0.229, 0.224, 0.225]
        else:
            norm_mean = [0.485, 0.456, 0.406, 0.5, 0.5]
            norm_std = [0.229, 0.224, 0.225, 0.5, 0.5]
        
        train_transform = A.Compose([
            A.RandomRotate90(p=0.5),
            A.HorizontalFlip(p=0.5),
            A.VerticalFlip(p=0.5),
            A.RandomBrightnessContrast(p=0.3),
            A.GaussNoise(p=0.2),
            A.ElasticTransform(p=0.2),
            A.GridDistortion(p=0.2),
            A.OpticalDistortion(p=0.2),
            A.ShiftScaleRotate(shift_limit=0.05, scale_limit=0.1, rotate_limit=15, p=0.5),
            A.Normalize(mean=norm_mean, std=norm_std),
            ToTensorV2(),
        ])
    else:
        train_transform = None
    
    # Datasets
    train_dataset = CadastralDataset(
        config.data_root, split="train", img_size=config.img_size,
        transform=train_transform, config=config
    )
    val_dataset = CadastralDataset(
        config.data_root, split="val", img_size=config.img_size,
        transform=None, config=config
    )
    
    train_loader = DataLoader(
        train_dataset, batch_size=config.batch_size, shuffle=True,
        num_workers=config.num_workers, pin_memory=True, drop_last=True
    )
    val_loader = DataLoader(
        val_dataset, batch_size=config.batch_size, shuffle=False,
        num_workers=config.num_workers, pin_memory=True
    )
    
    # Model (2 heads only)
    model = DualHeadCadastralModel(config).to(device)
    logger.info(f"Model parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    # Optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=config.learning_rate,
        weight_decay=config.weight_decay,
    )
    
    # Scheduler
    scheduler = torch.optim.lr_scheduler.CosineAnnealingWarmRestarts(
        optimizer, T_0=10, T_mult=2, eta_min=1e-6
    )
    
    # Loss
    criterion = DualTaskLoss(config.loss_weights).to(device)
    
    # Checkpointing
    save_dir = Path(config.save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)
    
    best_val_loss = float("inf")
    
    # Wandb
    if WANDB_AVAILABLE:
        wandb.init(project="geotrace-cadastral", config=config.__dict__)
        wandb.watch(model)
    
    # Training loop with early stopping
    patience = 10
    patience_counter = 0
    
    for epoch in range(1, config.num_epochs + 1):
        train_metrics = train_epoch(model, train_loader, optimizer, criterion, config.device, epoch, config)
        val_metrics = validate(model, val_loader, criterion, config.device, config)
        
        scheduler.step()
        
        # Logging
        log_str = f"Epoch {epoch}/{config.num_epochs} | "
        log_str += f"Train Loss: {train_metrics.get('building', 0) + train_metrics.get('vegetation', 0):.4f} | "
        log_str += f"Val Loss: {val_metrics.get('building', 0) + val_metrics.get('vegetation', 0):.4f} | "
        log_str += f"Building IoU: {val_metrics.get('building_iou', 0):.4f} | "
        log_str += f"Vegetation IoU: {val_metrics.get('vegetation_iou', 0):.4f} | "
        log_str += f"Building Dice: {val_metrics.get('building_dice', 0):.4f} | "
        log_str += f"Vegetation Dice: {val_metrics.get('vegetation_dice', 0):.4f}"
        logger.info(log_str)
        
        if WANDB_AVAILABLE:
            wandb.log({**{f"train/{k}": v for k, v in train_metrics.items()}, 
                       **{f"val/{k}": v for k, v in val_metrics.items()},
                       "epoch": epoch, "lr": optimizer.param_groups[0]["lr"]})
        
        # Save checkpoint on best validation loss
        val_total_loss = val_metrics.get("building", 0) + val_metrics.get("vegetation", 0)
        
        if val_total_loss < best_val_loss:
            best_val_loss = val_total_loss
            patience_counter = 0
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "config": config.__dict__,
                "val_metrics": val_metrics,
            }
            torch.save(checkpoint, save_dir / "best_model.pth")
            logger.info(f"Saved best model (val_loss={val_total_loss:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                logger.info(f"Early stopping at epoch {epoch} (no improvement for {patience} epochs)")
                break
        
        if not config.save_best_only:
            torch.save({
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "config": config.__dict__,
            }, save_dir / f"epoch_{epoch}.pth")
    
    logger.info("Training complete!")
    if WANDB_AVAILABLE:
        wandb.finish()
    
    # Save model card with final validation metrics
    save_model_card(config, val_metrics, save_dir)
    
    return model


# ==============================================================================
# MODEL CARD GENERATION
# ==============================================================================

def save_model_card(config: TrainConfig, val_metrics: Dict[str, float], save_dir: Path):
    """Save model card documenting training configuration and known limitations."""
    model_card = {
        "model_name": "GeoTrace-AI Cadastral Dual-Head Segmentation",
        "architecture": f"SMP Unet + {config.encoder}",
        "encoder_weights": config.encoder_weights,
        "input_channels": config.in_channels,
        "input_modality": "RGB only",
        "elevation_mode": config.elevation_mode,
        "tasks": {
            "building": "Building footprint extraction (binary) — supervised by FilteredData/BinaryMasks (channel 0==36)",
            "vegetation": "Vegetation/Greenery segmentation (binary) — supervised by green RGB (85,217,48) from Full Data/Masks",
        },
        "explicitly_removed_tasks": {
            "parcel": "NO ground truth in SVAMITVA — sourced from legal FMB/TSLR records instead",
            "road": "NO consistent ground truth — red class in SVAMITVA is mixed building/road",
            "landuse": "NO 5-class supervision — only building/vegetation/blank exist",
            "boundary": "NO boundary annotations — derived post-hoc from building mask",
        },
        "image_size": config.img_size,
        "training_data": {
            "dataset": "SVAMITVA Drone Aerial Images (FilteredData + Full Data)",
            "num_train_samples": len(train_dataset) if 'train_dataset' in globals() else None,
            "num_val_samples": len(val_dataset) if 'val_dataset' in globals() else None,
            "split": config.train_split,
        },
        "limitations": [
            "TRAINED ON RGB ONLY: No real DSM/DTM elevation data available in SVAMITVA dataset.",
            "Parcel boundaries are NOT predicted by this model — sourced from legal FMB/TSLR records via discrepancy-analysis endpoint.",
            "Road networks are NOT predicted by this model — sourced from OpenStreetMap via Overpass API.",
            "Land-use classification is a 3-class DERIVED map (built-up / vegetation / open), not a 5-class prediction.",
            "Boundary refinement is post-processing on building mask, not a model head.",
            "Model may not generalize to different geographic regions, sensor types, or GSD without fine-tuning.",
        ],
        "validation_metrics": val_metrics,
        "training_config": asdict(config),
    }
    
    if "loss_weights" in model_card["training_config"]:
        model_card["training_config"]["loss_weights"] = dict(model_card["training_config"]["loss_weights"])
    
    card_path = save_dir / "model_card.json"
    with open(card_path, "w") as f:
        json.dump(model_card, f, indent=2)
    
    logger.info(f"Model card saved to {card_path}")
    return card_path


# ==============================================================================
# EXPORT TO ONNX
# ==============================================================================

def export_to_onnx(model: nn.Module, config: TrainConfig, output_path: str):
    """Export trained model to ONNX format for inference server."""
    model.eval()
    
    dummy_input = torch.randn(1, config.in_channels, config.img_size, config.img_size)
    
    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        export_params=True,
        opset_version=17,
        do_constant_folding=True,
        input_names=["input_orthomosaic"],
        output_names=["building", "vegetation"],
        dynamic_axes={
            "input_orthomosaic": {0: "batch_size", 2: "height", 3: "width"},
            "building": {0: "batch_size", 2: "height", 3: "width"},
            "vegetation": {0: "batch_size", 2: "height", 3: "width"},
        },
    )
    
    logger.info(f"Model exported to {output_path}")


# ==============================================================================
# MAIN
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description="Train Cadastral Dual-Head Model (Building + Vegetation)")
    parser.add_argument("--data_root", type=str, default="Svamitva-dataset/FilteredData", help="Path to dataset root")
    parser.add_argument("--batch_size", type=int, default=8, help="Batch size")
    parser.add_argument("--epochs", type=int, default=30, help="Number of epochs")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--img_size", type=int, default=512, help="Image size")
    parser.add_argument("--encoder", type=str, default="efficientnet-b3", help="Encoder backbone")
    parser.add_argument("--device", type=str, default="cuda", help="Device (cuda/cpu)")
    parser.add_argument("--save_dir", type=str, default="ml/checkpoints", help="Checkpoint directory")
    parser.add_argument("--elevation_mode", type=str, default="none", choices=["none", "zero_fill", "pseudo"], 
                        help="Elevation handling")
    parser.add_argument("--export_onnx", action="store_true", help="Export to ONNX after training")
    parser.add_argument("--wandb", action="store_true", help="Use Weights & Biases logging")
    args = parser.parse_args()
    
    config = TrainConfig(
        data_root=args.data_root,
        batch_size=args.batch_size,
        num_epochs=args.epochs,
        learning_rate=args.lr,
        img_size=args.img_size,
        encoder=args.encoder,
        device=args.device,
        save_dir=args.save_dir,
        elevation_mode=args.elevation_mode,
    )
    
    # Train
    model = train(config)
    
    # Save model card
    save_dir = Path(config.save_dir)
    save_model_card(config, {}, save_dir)
    
    # Export to ONNX
    if args.export_onnx:
        export_path = save_dir / "cadastral_dualhead.onnx"
        export_to_onnx(model, config, str(export_path))


if __name__ == "__main__":
    main()