"""
Module 3: Image Quality Assessment (IQA)
Module 4: Image Preprocessing and Tiling
Module 5: Reference Label and Ground-Truth Preparation
Module 6: Multi-Task Feature and Boundary-Evidence Extraction
Module 7: Multi-Cue Evidence Fusion
Module 8: Candidate Boundary Generation
Module 27: Synthetic Data and Data Augmentation
"""

import cv2
import numpy as np
from typing import Dict, Any, List, Tuple, Optional
from dataclasses import dataclass
import json
from pathlib import Path

try:
    import albumentations as A
    HAS_ALBUMENTATIONS = True
except ImportError:
    HAS_ALBUMENTATIONS = False
    print("WARNING: albumentations not installed. Data augmentation will use OpenCV only.")


@dataclass
class TileMetadata:
    """Metadata for image tiles."""
    tile_id: str
    row: int
    col: int
    width: int
    height: int
    affine_matrix: List[List[float]]
    overlap: int
    gsd: float
    quality_score: float


class ImageQualityAssessment:
    """
    Module 3: Image Quality Assessment
    Quantifies physical and radiometric degradation across input tiles.
    """
    
    def __init__(self):
        self.quality_index = {}
    
    def calculate_gsd(self, affine_matrix: List[List[float]], sensor_width_mm: float = 13.2, 
                     focal_length_mm: float = 8.8, image_width_px: int = 4000) -> float:
        """
        Calculates Ground Sampling Distance (GSD) from affine transform.
        
        Args:
            affine_matrix: Affine transformation matrix
            sensor_width_mm: Sensor width in mm
            focal_length_mm: Focal length in mm
            image_width_px: Image width in pixels
            
        Returns:
            GSD in meters per pixel
        """
        # Extract pixel scale from affine matrix
        pixel_scale_x = abs(affine_matrix[0][0])
        pixel_scale_y = abs(affine_matrix[1][1])
        
        # Average pixel scale in meters
        avg_pixel_scale = (pixel_scale_x + pixel_scale_y) / 2.0
        
        return avg_pixel_scale
    
    def calculate_laplacian_variance(self, image: np.ndarray) -> float:
        """
        Calculates image sharpness using variance of Laplacian operator.
        
        Args:
            image: Input image (grayscale or BGR)
            
        Returns:
            Sharpness score (higher = sharper)
        """
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = laplacian.var()
        
        return variance
    
    def calculate_rms_contrast(self, image: np.ndarray) -> float:
        """
        Calculates Root-Mean-Square contrast across color channels.
        
        Args:
            image: Input image
            
        Returns:
            RMS contrast value
        """
        if len(image.shape) == 3:
            # Calculate per-channel contrast
            contrasts = []
            for channel in cv2.split(image):
                mean = np.mean(channel)
                squared_diff = np.square(channel - mean)
                rms = np.sqrt(np.mean(squared_diff))
                contrasts.append(rms)
            return np.mean(contrasts)
        else:
            mean = np.mean(image)
            squared_diff = np.square(image - mean)
            return np.sqrt(np.mean(squared_diff))
    
    def detect_shadow_mask(self, image: np.ndarray, v_threshold: float = 0.25, 
                          s_threshold: float = 0.20) -> np.ndarray:
        """
        Detects shadow regions using HSV color-space thresholding.
        
        Args:
            image: Input BGR image
            v_threshold: Value threshold (brightness)
            s_threshold: Saturation threshold
            
        Returns:
            Binary shadow mask (1 = shadow, 0 = non-shadow)
        """
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        
        # Normalize to 0-1 range
        v_norm = v.astype(float) / 255.0
        s_norm = s.astype(float) / 255.0
        
        # Shadow thresholding
        shadow_mask = (v_norm < v_threshold) & (s_norm < s_threshold)
        
        return shadow_mask.astype(np.uint8)
    
    def assess_tile_quality(self, image: np.ndarray, affine_matrix: List[List[float]], 
                           tile_id: str) -> Dict[str, Any]:
        """
        Comprehensive quality assessment for a single tile.
        
        Args:
            image: Input image tile
            affine_matrix: Affine transformation matrix
            tile_id: Tile identifier
            
        Returns:
            Quality assessment dictionary
        """
        gsd = self.calculate_gsd(affine_matrix)
        sharpness = self.calculate_laplacian_variance(image)
        contrast = self.calculate_rms_contrast(image)
        shadow_mask = self.detect_shadow_mask(image)
        shadow_percentage = np.sum(shadow_mask) / shadow_mask.size * 100
        
        # Calculate overall quality score (0-1)
        # Normalize metrics
        normalized_sharpness = min(sharpness / 500.0, 1.0)  # Assume 500 is good sharpness
        normalized_contrast = min(contrast / 50.0, 1.0)  # Assume 50 is good contrast
        shadow_penalty = shadow_percentage / 100.0
        
        quality_score = (normalized_sharpness * 0.4 + 
                        normalized_contrast * 0.4 - 
                        shadow_penalty * 0.2)
        quality_score = max(0.0, min(1.0, quality_score))
        
        quality_data = {
            "tile_id": tile_id,
            "gsd_meters_per_pixel": gsd,
            "sharpness_laplacian_variance": sharpness,
            "rms_contrast": contrast,
            "shadow_percentage": shadow_percentage,
            "overall_quality_score": quality_score,
            "quality_rating": "GOOD" if quality_score > 0.7 else ("MODERATE" if quality_score > 0.4 else "POOR")
        }
        
        self.quality_index[tile_id] = quality_data
        return quality_data


class ImagePreprocessor:
    """
    Module 4: Image Preprocessing and Tiling
    Prepares high-resolution orthomosaics for deep learning inference.
    """
    
    def __init__(self, tile_size: int = 512, overlap: int = 64):
        self.tile_size = tile_size
        self.overlap = overlap
        self.tiles = []
        self.tile_index = {}
    
    def apply_clahe(self, image: np.ndarray, clip_limit: float = 2.0, 
                   tile_grid_size: Tuple[int, int] = (8, 8)) -> np.ndarray:
        """
        Applies Contrast-Limited Adaptive Histogram Equalization.
        
        Args:
            image: Input image
            clip_limit: CLAHE clip limit
            tile_grid_size: Grid size for CLAHE
            
        Returns:
            CLAHE-enhanced image
        """
        if len(image.shape) == 3:
            # Convert to LAB color space
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            
            # Apply CLAHE to L channel
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
            l = clahe.apply(l)
            
            # Merge and convert back
            lab = cv2.merge([l, a, b])
            return cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        else:
            clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
            return clahe.apply(image)
    
    def generate_tiles(self, image: np.ndarray, affine_matrix: List[List[float]], 
                     gsd: float) -> List[TileMetadata]:
        """
        Slices large orthomosaics into tiles with overlap.
        
        Args:
            image: Input image
            affine_matrix: Affine transformation matrix
            gsd: Ground sampling distance
            
        Returns:
            List of tile metadata
        """
        height, width = image.shape[:2]
        self.tiles = []
        
        step = self.tile_size - self.overlap
        tile_id_counter = 0
        
        for row in range(0, height - self.tile_size + 1, step):
            for col in range(0, width - self.tile_size + 1, step):
                # Extract tile
                tile_y_end = min(row + self.tile_size, height)
                tile_x_end = min(col + self.tile_size, width)
                
                tile = image[row:tile_y_end, col:tile_x_end]
                
                # Calculate tile-specific affine matrix
                tile_affine = self._calculate_tile_affine(
                    affine_matrix, col, row, self.tile_size, self.tile_size
                )
                
                tile_id = f"tile_{tile_id_counter:04d}"
                metadata = TileMetadata(
                    tile_id=tile_id,
                    row=row,
                    col=col,
                    width=tile.shape[1],
                    height=tile.shape[0],
                    affine_matrix=tile_affine,
                    overlap=self.overlap,
                    gsd=gsd,
                    quality_score=0.0  # Will be filled by IQA
                )
                
                self.tiles.append(metadata)
                self.tile_index[tile_id] = {
                    "tile_data": tile,
                    "metadata": metadata
                }
                
                tile_id_counter += 1
        
        return self.tiles
    
    def _calculate_tile_affine(self, parent_affine: List[List[float]], 
                               offset_x: int, offset_y: int, 
                               tile_width: int, tile_height: int) -> List[List[float]]:
        """
        Calculates affine transformation matrix for a tile.
        
        Args:
            parent_affine: Parent image affine matrix
            offset_x: X offset in pixels
            offset_y: Y offset in pixels
            tile_width: Tile width
            tile_height: Tile height
            
        Returns:
            Tile-specific affine matrix
        """
        # Transform offset to geographic coordinates
        geo_offset_x = parent_affine[0][0] * offset_x + parent_affine[0][1] * offset_y + parent_affine[0][2]
        geo_offset_y = parent_affine[1][0] * offset_x + parent_affine[1][1] * offset_y + parent_affine[1][2]
        
        # Create tile affine (same scale, different origin)
        tile_affine = [
            [parent_affine[0][0], parent_affine[0][1], geo_offset_x],
            [parent_affine[1][0], parent_affine[1][1], geo_offset_y],
            [0, 0, 1]
        ]
        
        return tile_affine
    
    def export_tile_index(self, output_path: str = "tile_index.json") -> str:
        """
        Exports tile index to JSON.
        
        Args:
            output_path: Path to output file
            
        Returns:
            Path to exported file
        """
        index_data = {
            "tile_size": self.tile_size,
            "overlap": self.overlap,
            "total_tiles": len(self.tiles),
            "tiles": [
                {
                    "tile_id": t.tile_id,
                    "row": t.row,
                    "col": t.col,
                    "width": t.width,
                    "height": t.height,
                    "affine_matrix": t.affine_matrix,
                    "gsd": t.gsd,
                    "quality_score": t.quality_score
                }
                for t in self.tiles
            ]
        }
        
        with open(output_path, 'w') as f:
            json.dump(index_data, f, indent=2)
        
        return output_path


class LabelPreparator:
    """
    Module 5: Reference Label and Ground-Truth Preparation
    Generates multi-class raster ground-truth masks with uncertainty flagging.
    """
    
    LABEL_CLASSES = {
        0: "background",
        1: "building_footprint",
        2: "road_margin",
        3: "physical_fence_wall",
        4: "open_land",
        5: "uncertain_boundary"
    }
    
    def __init__(self):
        self.label_quality = {}
    
    def rasterize_vector_labels(self, vector_shapes: List[Dict[str, Any]], 
                                tile_extent: Tuple[int, int, int, int],
                                output_shape: Tuple[int, int]) -> np.ndarray:
        """
        Rasterizes vector ground-truth into multi-class masks.
        
        Args:
            vector_shapes: List of vector shape dictionaries
            tile_extent: (min_x, min_y, max_x, max_y) in geographic coordinates
            output_shape: (height, width) of output raster
            
        Returns:
            Multi-class label raster
        """
        label_raster = np.zeros(output_shape, dtype=np.uint8)
        
        for shape in vector_shapes:
            class_id = shape.get("class_id", 0)
            confidence = shape.get("confidence", 1.0)
            
            # If confidence is low, mark as uncertain
            if confidence < 0.5:
                class_id = 5  # uncertain_boundary
            
            # Rasterize shape (simplified - in production use rasterio.features.rasterize)
            # This is a placeholder for the actual rasterization logic
            # For now, we'll create a simple geometric rasterization
            
            coords = shape.get("coordinates", [])
            if coords:
                # Convert geographic coordinates to pixel coordinates
                # This would be the actual rasterization logic
                pass
        
        return label_raster
    
    def generate_label_quality_metadata(self, vector_shapes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generates label quality metadata with uncertainty flagging.
        
        Args:
            vector_shapes: List of vector shapes
            
        Returns:
            Label quality metadata dictionary
        """
        quality_metadata = {
            "total_shapes": len(vector_shapes),
            "certain_shapes": 0,
            "uncertain_shapes": 0,
            "class_distribution": {},
            "overall_confidence": 0.0
        }
        
        total_confidence = 0.0
        
        for shape in vector_shapes:
            class_id = shape.get("class_id", 0)
            confidence = shape.get("confidence", 1.0)
            
            class_name = self.LABEL_CLASSES.get(class_id, "unknown")
            quality_metadata["class_distribution"][class_name] = \
                quality_metadata["class_distribution"].get(class_name, 0) + 1
            
            if confidence < 0.5:
                quality_metadata["uncertain_shapes"] += 1
            else:
                quality_metadata["certain_shapes"] += 1
            
            total_confidence += confidence
        
        if vector_shapes:
            quality_metadata["overall_confidence"] = total_confidence / len(vector_shapes)
        
        return quality_metadata


class DataAugmentation:
    """
    Module 27: Synthetic Data and Data Augmentation
    Applies synthetic visual corruptions to validate uncertainty estimation.
    """
    
    def __init__(self):
        if HAS_ALBUMENTATIONS:
            self.augmentation_pipeline = A.Compose([
                A.RandomBrightnessContrast(p=0.5),
                A.GaussianBlur(p=0.3),
                A.MotionBlur(p=0.3),
                A.RandomGamma(p=0.3),
                A.CLAHE(p=0.3),
                A.GaussNoise(p=0.2),
            ])
        else:
            self.augmentation_pipeline = None
    
    def apply_synthetic_corruptions(self, image: np.ndarray, 
                                   corruption_types: List[str] = None) -> Dict[str, np.ndarray]:
        """
        Applies synthetic transformations for stress testing.
        
        Args:
            image: Input image
            corruption_types: List of corruption types to apply
            
        Returns:
            Dictionary of corrupted images
        """
        if corruption_types is None:
            corruption_types = ["shadow", "blur", "noise", "line_break"]
        
        corrupted_images = {}
        
        if "shadow" in corruption_types:
            corrupted_images["shadow"] = self._add_synthetic_shadows(image)
        
        if "blur" in corruption_types:
            corrupted_images["blur"] = self._add_motion_blur(image)
        
        if "noise" in corruption_types:
            corrupted_images["noise"] = self._add_gaussian_noise(image)
        
        if "line_break" in corruption_types:
            corrupted_images["line_break"] = self._add_line_breaks(image)
        
        return corrupted_images
    
    def _add_synthetic_shadows(self, image: np.ndarray) -> np.ndarray:
        """Adds synthetic shadow regions."""
        h, w = image.shape[:2]
        shadow = image.copy()
        
        # Create random shadow polygons
        num_shadows = np.random.randint(1, 4)
        for _ in range(num_shadows):
            center_x = np.random.randint(0, w)
            center_y = np.random.randint(0, h)
            radius = np.random.randint(20, 100)
            
            mask = np.zeros((h, w), dtype=np.uint8)
            cv2.circle(mask, (center_x, center_y), radius, 255, -1)
            
            # Darken shadowed regions
            shadow[mask > 0] = (shadow[mask > 0] * 0.5).astype(np.uint8)
        
        return shadow
    
    def _add_motion_blur(self, image: np.ndarray) -> np.ndarray:
        """Adds motion blur to simulate UAV motion."""
        kernel_size = 15
        kernel = np.zeros((kernel_size, kernel_size))
        kernel[int((kernel_size-1)/2), :] = np.ones(kernel_size)
        kernel = kernel / kernel_size
        
        return cv2.filter2D(image, -1, kernel)
    
    def _add_gaussian_noise(self, image: np.ndarray) -> np.ndarray:
        """Adds Gaussian noise."""
        noise = np.random.normal(0, 25, image.shape).astype(np.int16)
        noisy = np.clip(image.astype(np.int16) + noise, 0, 255).astype(np.uint8)
        return noisy
    
    def _add_line_breaks(self, image: np.ndarray) -> np.ndarray:
        """Adds synthetic line breaks to test edge detection."""
        broken = image.copy()
        h, w = image.shape[:2]
        
        # Add random white lines to break boundaries
        num_breaks = np.random.randint(3, 8)
        for _ in range(num_breaks):
            x1 = np.random.randint(0, w)
            y1 = np.random.randint(0, h)
            x2 = np.random.randint(0, w)
            y2 = np.random.randint(0, h)
            
            cv2.line(broken, (x1, y1), (x2, y2), (255, 255, 255), 3)
        
        return broken
    
    def apply_augmentation_pipeline(self, image: np.ndarray) -> np.ndarray:
        """
        Applies Albumentations augmentation pipeline if available.
        
        Args:
            image: Input image
            
        Returns:
            Augmented image
        """
        if self.augmentation_pipeline:
            augmented = self.augmentation_pipeline(image=image)
            return augmented["image"]
        else:
            # Fallback to simple augmentation
            return self._add_gaussian_noise(image)


# Global instances
iqa_assessor = ImageQualityAssessment()
image_preprocessor = ImagePreprocessor()
label_preparator = LabelPreparator()
data_augmentor = DataAugmentation()