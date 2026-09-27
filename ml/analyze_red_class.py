import cv2
import numpy as np
import os

# Check what the red color (255, 0, 0) represents by looking at the images
img_dir = "../Svamitva-dataset/Full Data/Images"
mask_dir = "../Svamitva-dataset/Full Data/Masks"

test_samples = ['patch_4.png', 'patch_6.png', 'patch_1195.png', 'patch_1542.png']

for fname in test_samples:
    img_path = os.path.join(img_dir, fname)
    mask_path = os.path.join(mask_dir, fname)
    
    img = cv2.imread(img_path)
    mask = cv2.imread(mask_path, cv2.IMREAD_COLOR)
    if img is None or mask is None:
        continue
    
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mask = cv2.cvtColor(mask, cv2.COLOR_BGR2RGB)
    
    red_mask = cv2.inRange(mask, (255, 0, 0), (255, 0, 0)) > 0
    cyan_mask = cv2.inRange(mask, (0, 110, 255), (0, 110, 255)) > 0
    
    # Find contours of red regions
    red_contours, _ = cv2.findContours(red_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cyan_contours, _ = cv2.findContours(cyan_mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    print(f"{fname}:")
    print(f"  Red regions: {len(red_contours)} contours, area={red_mask.sum():,}")
    print(f"  Cyan regions: {len(cyan_contours)} contours, area={cyan_mask.sum():,}")
    
    # Check if red regions look like roads (long, thin) or buildings (compact)
    for i, cnt in enumerate(red_contours):
        area = cv2.contourArea(cnt)
        if area > 100:
            x, y, w, h = cv2.boundingRect(cnt)
            aspect = max(w, h) / max(1, min(w, h))
            print(f"  Red contour {i}: area={area:.0f}, bbox={w}x{h}, aspect={aspect:.1f} {'(road-like)' if aspect > 3 else '(building-like)'}")
    
    print()