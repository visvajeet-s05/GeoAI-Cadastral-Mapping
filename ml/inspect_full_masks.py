import cv2
import numpy as np
import os
import random

# Get all mask files from Full Data/Masks
mask_dir = "../Svamitva-dataset/Full Data/Masks"
mask_files = [f for f in os.listdir(mask_dir) if f.endswith('.png')]

# Sample 15 files
sampled = random.sample(mask_files, min(15, len(mask_files)))

print(f"Total mask files: {len(mask_files)}")
print(f"Sampled: {sampled}")
print()

for fname in sampled:
    path = os.path.join(mask_dir, fname)
    mask = cv2.imread(path, cv2.IMREAD_COLOR)
    if mask is None:
        print(f"{fname}: FAILED TO READ")
        continue
    mask_rgb = cv2.cvtColor(mask, cv2.COLOR_BGR2RGB)
    
    # Find unique colors
    pixels = mask_rgb.reshape(-1, 3)
    unique_colors, counts = np.unique(pixels, axis=0, return_counts=True)
    
    print(f"{fname}:")
    for color, count in zip(unique_colors, counts):
        pct = count / pixels.shape[0] * 100
        print(f"  RGB{tuple(color)}: {count} pixels ({pct:.2f}%)")
    print()