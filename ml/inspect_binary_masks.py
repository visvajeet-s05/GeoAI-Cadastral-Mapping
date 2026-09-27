import cv2
import numpy as np
import os
import random

# Get all mask files from FilteredData/BinaryMasks
mask_dir = "../Svamitva-dataset/FilteredData/BinaryMasks"
mask_files = [f for f in os.listdir(mask_dir) if f.endswith('.png')]

# Sample 15 files
sampled = random.sample(mask_files, min(15, len(mask_files)))

print(f"Total mask files: {len(mask_files)}")
print(f"Sampled: {sampled}")
print()

for fname in sampled:
    path = os.path.join(mask_dir, fname)
    mask = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if mask is None:
        print(f"{fname}: FAILED TO READ")
        continue
    
    print(f"{fname}: shape={mask.shape}, dtype={mask.dtype}")
    if mask.ndim == 3:
        # Multi-channel
        for c in range(mask.shape[2]):
            channel = mask[:,:,c]
            unique, counts = np.unique(channel, return_counts=True)
            print(f"  Channel {c}: {list(zip(unique.tolist(), counts.tolist()))}")
    else:
        unique, counts = np.unique(mask, return_counts=True)
        print(f"  Values: {list(zip(unique.tolist(), counts.tolist()))}")
    print()