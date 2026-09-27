import cv2
import numpy as np
import os
import random

# Define color mapping from the dataset's own script
ORIGINAL_COLOR_MAP = {
    'Building': (255, 165, 0),  # Orange
    'Road': (255, 255, 0),      # Yellow
    'Water': (0, 0, 255),       # Blue
    'Greenery': (0, 128, 0),    # Green
    'Blank': (0, 0, 0),         # Black
}

# Actual colors found in masks
ACTUAL_COLORS = {
    'Cyan_Building': (0, 110, 255),      # Used by filter2Binary for building extraction
    'Green_Vegetation': (85, 217, 48),   # Close to Greenery
    'Red': (255, 0, 0),                  # Unknown - Road or Building?
    'YellowGreen': (200, 255, 0),        # One sample
    'LightCyan': (0, 238, 255),          # Few samples
    'Black': (0, 0, 0),                  # Blank/Background
}

# Create visual spot-check for 5 samples
mask_dir = "../Svamitva-dataset/Full Data/Masks"
img_dir = "../Svamitva-dataset/Full Data/Images"

# Pick 5 specific samples that have diverse colors
test_samples = [
    'patch_4.png',      # Has cyan, red
    'patch_6.png',      # Has cyan, green, red
    'patch_106.png',    # Has cyan, green (50/50)
    'patch_1195.png',   # Has cyan, green, red (good mix)
    'patch_1542.png',   # Has cyan, light cyan, green, red
]

os.makedirs("mask_visualizations", exist_ok=True)

for fname in test_samples:
    img_path = os.path.join(img_dir, fname)
    mask_path = os.path.join(mask_dir, fname)
    
    img = cv2.imread(img_path)
    mask = cv2.imread(mask_path, cv2.IMREAD_COLOR)
    if img is None or mask is None:
        print(f"Skipping {fname}")
        continue
    
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mask = cv2.cvtColor(mask, cv2.COLOR_BGR2RGB)
    
    # Resize mask to match image if needed
    if mask.shape[:2] != img.shape[:2]:
        mask = cv2.resize(mask, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_NEAREST)
    
    # Create binary masks for each actual color found
    cyan_mask = cv2.inRange(mask, (0, 110, 255), (0, 110, 255)) > 0
    green_mask = cv2.inRange(mask, (85, 217, 48), (85, 217, 48)) > 0
    red_mask = cv2.inRange(mask, (255, 0, 0), (255, 0, 0)) > 0
    yellow_green_mask = cv2.inRange(mask, (200, 255, 0), (200, 255, 0)) > 0
    light_cyan_mask = cv2.inRange(mask, (0, 238, 255), (0, 238, 255)) > 0
    black_mask = cv2.inRange(mask, (0, 0, 0), (0, 0, 0)) > 0
    
    # Create overlays
    def make_overlay(base_img, binary_mask, color, alpha=0.5):
        overlay = base_img.copy()
        color_arr = np.array(color, dtype=np.uint8)
        overlay[binary_mask] = (overlay[binary_mask] * (1-alpha) + color_arr * alpha).astype(np.uint8)
        return overlay
    
    # Original
    cv2.imwrite(f"mask_visualizations/{fname}_0_original.png", cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    
    # Cyan (Building per filter2Binary)
    cyan_overlay = make_overlay(img, cyan_mask, (0, 110, 255))
    cv2.imwrite(f"mask_visualizations/{fname}_1_cyan_building.png", cv2.cvtColor(cyan_overlay, cv2.COLOR_RGB2BGR))
    
    # Green (Vegetation/Greenery)
    green_overlay = make_overlay(img, green_mask, (85, 217, 48))
    cv2.imwrite(f"mask_visualizations/{fname}_2_green_vegetation.png", cv2.cvtColor(green_overlay, cv2.COLOR_RGB2BGR))
    
    # Red (Unknown - Road or Building?)
    red_overlay = make_overlay(img, red_mask, (255, 0, 0))
    cv2.imwrite(f"mask_visualizations/{fname}_3_red_unknown.png", cv2.cvtColor(red_overlay, cv2.COLOR_RGB2BGR))
    
    # All classes combined
    combined = img.copy()
    combined[cyan_mask] = (combined[cyan_mask] * 0.5 + np.array([0, 110, 255]) * 0.5).astype(np.uint8)
    combined[green_mask] = (combined[green_mask] * 0.5 + np.array([85, 217, 48]) * 0.5).astype(np.uint8)
    combined[red_mask] = (combined[red_mask] * 0.5 + np.array([255, 0, 0]) * 0.5).astype(np.uint8)
    combined[yellow_green_mask] = (combined[yellow_green_mask] * 0.5 + np.array([200, 255, 0]) * 0.5).astype(np.uint8)
    combined[light_cyan_mask] = (combined[light_cyan_mask] * 0.5 + np.array([0, 238, 255]) * 0.5).astype(np.uint8)
    cv2.imwrite(f"mask_visualizations/{fname}_4_all_classes.png", cv2.cvtColor(combined, cv2.COLOR_RGB2BGR))
    
    # Print stats
    h, w = mask.shape[:2]
    total = h * w
    print(f"{fname}:")
    print(f"  Cyan (building): {cyan_mask.sum()} ({cyan_mask.sum()/total*100:.1f}%)")
    print(f"  Green (vegetation): {green_mask.sum()} ({green_mask.sum()/total*100:.1f}%)")
    print(f"  Red (unknown): {red_mask.sum()} ({red_mask.sum()/total*100:.1f}%)")
    print(f"  YellowGreen: {yellow_green_mask.sum()} ({yellow_green_mask.sum()/total*100:.1f}%)")
    print(f"  LightCyan: {light_cyan_mask.sum()} ({light_cyan_mask.sum()/total*100:.1f}%)")
    print(f"  Black: {black_mask.sum()} ({black_mask.sum()/total*100:.1f}%)")
    
    # IoU between cyan and red (if both present)
    if cyan_mask.sum() > 0 and red_mask.sum() > 0:
        intersection = np.logical_and(cyan_mask, red_mask).sum()
        union = np.logical_or(cyan_mask, red_mask).sum()
        iou = intersection / union if union > 0 else 0
        print(f"  IoU(cyan, red): {iou:.4f}")
    print()

print("Visualizations saved to mask_visualizations/")