import cv2
import numpy as np
import os
import random

# Compare BinaryMasks (building footprints) with cyan building masks from Full Data
# Sample a few and compute IoU
binary_dir = "../Svamitva-dataset/FilteredData/BinaryMasks"
full_mask_dir = "../Svamitva-dataset/Full Data/Masks"

# Get matching files
binary_files = set(f for f in os.listdir(binary_dir) if f.endswith('.png'))
full_files = set(f for f in os.listdir(full_mask_dir) if f.endswith('.png'))
common = list(binary_files & full_files)
sampled = random.sample(common, min(10, len(common)))

print("Comparing BinaryMasks (building footprints) with cyan regions in Full Data masks:")
print()

for fname in sampled:
    # Load binary mask (building footprint)
    bin_path = os.path.join(binary_dir, fname)
    bin_mask = cv2.imread(bin_path, cv2.IMREAD_UNCHANGED)
    if bin_mask is None:
        continue
    # BinaryMasks are RGBA - channel 0 has 36/84, let's use channel 0 > 50 as building
    if bin_mask.ndim == 3:
        building_bin = bin_mask[:,:,0] > 50  # threshold
    else:
        building_bin = bin_mask > 0
    
    # Load full mask and extract cyan (building per filter2Binary)
    full_path = os.path.join(full_mask_dir, fname)
    full_mask = cv2.imread(full_path, cv2.IMREAD_COLOR)
    if full_mask is None:
        continue
    full_rgb = cv2.cvtColor(full_mask, cv2.COLOR_BGR2RGB)
    cyan_mask = cv2.inRange(full_rgb, (0, 110, 255), (0, 110, 255)) > 0
    
    # Resize if needed
    if building_bin.shape != cyan_mask.shape:
        building_bin = cv2.resize(building_bin.astype(np.uint8), (cyan_mask.shape[1], cyan_mask.shape[0]), interpolation=cv2.INTER_NEAREST) > 0
    
    # Compute IoU
    intersection = np.logical_and(building_bin, cyan_mask).sum()
    union = np.logical_or(building_bin, cyan_mask).sum()
    iou = intersection / union if union > 0 else 0
    
    bin_area = building_bin.sum()
    cyan_area = cyan_mask.sum()
    
    print(f"{fname}: BinaryMask area={bin_area:,}, Cyan area={cyan_area:,}, IoU={iou:.4f}")

print()
print("If IoU is high, BinaryMasks match cyan regions (both represent buildings).")
print("If IoU is low, they represent different things.")