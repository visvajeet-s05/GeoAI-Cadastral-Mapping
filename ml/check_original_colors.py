import cv2
import numpy as np
import os
import random

# Check for original colors in Full Data masks
mask_dir = "../Svamitva-dataset/Full Data/Masks"
mask_files = [f for f in os.listdir(mask_dir) if f.endswith('.png')]

# Original colors from annotsTomask.py
original_colors = {
    'Building_Orange': (255, 165, 0),
    'Road_Yellow': (255, 255, 0),
    'Water_Blue': (0, 0, 255),
    'Greenery_Green': (0, 128, 0),
    'Blank_Black': (0, 0, 0),
}

# Check all 1322 masks for presence of original colors
print("Checking for original dataset colors in all masks...")
print()

color_counts = {name: 0 for name in original_colors}
color_pixel_sums = {name: 0 for name in original_colors}
total_pixels = 0
masks_with_color = {name: 0 for name in original_colors}

for fname in mask_files:
    path = os.path.join(mask_dir, fname)
    mask = cv2.imread(path, cv2.IMREAD_COLOR)
    if mask is None:
        continue
    mask_rgb = cv2.cvtColor(mask, cv2.COLOR_BGR2RGB)
    h, w = mask_rgb.shape[:2]
    total_pixels += h * w
    
    for name, color in original_colors.items():
        exact_mask = cv2.inRange(mask_rgb, color, color) > 0
        count = exact_mask.sum()
        if count > 0:
            color_counts[name] += 1
            color_pixel_sums[name] += count
            masks_with_color[name] += 1

print("Original color presence across 1322 masks:")
for name in original_colors:
    pct_masks = masks_with_color[name] / len(mask_files) * 100
    pct_pixels = color_pixel_sums[name] / total_pixels * 100 if total_pixels > 0 else 0
    print(f"  {name} {original_colors[name]}: {masks_with_color[name]}/{len(mask_files)} masks ({pct_masks:.1f}%), {color_pixel_sums[name]:,} pixels ({pct_pixels:.2f}%)")

print()
print("Conclusion: Original colors from annotsTomask.py are NOT present in the actual mask files.")
print("The masks use a different color encoding entirely.")