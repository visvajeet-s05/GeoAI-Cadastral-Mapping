import cv2
import numpy as np
import os

# Examine BinaryMask encoding more carefully
fname = "patch_1.png"
bin_path = os.path.join("../Svamitva-dataset/FilteredData/BinaryMasks", fname)
bin_mask = cv2.imread(bin_path, cv2.IMREAD_UNCHANGED)

print(f"Shape: {bin_mask.shape}")
print(f"Dtype: {bin_mask.dtype}")
print(f"Min/Max: {bin_mask.min()}/{bin_mask.max()}")

if bin_mask.ndim == 3:
    for c in range(bin_mask.shape[2]):
        unique = np.unique(bin_mask[:,:,c])
        print(f"Channel {c} unique values: {unique}")

# The filter2Binary.py creates binary mask where mask == [0, 110, 255]
# It writes using plt.imsave which saves as RGB
# Let's check if the BinaryMask is actually the cyan mask saved as grayscale

# Load the corresponding full mask
full_path = os.path.join("../Svamitva-dataset/Full Data/Masks", fname)
full_mask = cv2.imread(full_path, cv2.IMREAD_COLOR)
full_rgb = cv2.cvtColor(full_mask, cv2.COLOR_BGR2RGB)

cyan_mask = cv2.inRange(full_rgb, (0, 110, 255), (0, 110, 255)) > 0
print(f"Cyan area in Full mask: {cyan_mask.sum():,}")

# Let's check if BinaryMask channel 0 corresponds to cyan
# Channel 0 has values 36 and 84
# Channel 1 has values 1 and 231
# Channel 2 has values 68 and 253

# Maybe channel 0 == 84 means building (cyan), 36 means non-building?
# Let's check: where channel 0 == 84 vs cyan mask
if bin_mask.ndim == 3:
    ch0_84 = (bin_mask[:,:,0] == 84)
    ch0_36 = (bin_mask[:,:,0] == 36)
    
    intersection_84 = np.logical_and(ch0_84, cyan_mask).sum()
    union_84 = np.logical_or(ch0_84, cyan_mask).sum()
    iou_84 = intersection_84 / union_84 if union_84 > 0 else 0
    
    intersection_36 = np.logical_and(ch0_36, cyan_mask).sum()
    union_36 = np.logical_or(ch0_36, cyan_mask).sum()
    iou_36 = intersection_36 / union_36 if union_36 > 0 else 0
    
    print(f"Channel 0 == 84: area={ch0_84.sum():,}, IoU with cyan={iou_84:.4f}")
    print(f"Channel 0 == 36: area={ch0_36.sum():,}, IoU with cyan={iou_36:.4f}")
    
    # Channel 1
    ch1_1 = (bin_mask[:,:,1] == 1)
    ch1_231 = (bin_mask[:,:,1] == 231)
    intersection_1 = np.logical_and(ch1_1, cyan_mask).sum()
    union_1 = np.logical_or(ch1_1, cyan_mask).sum()
    iou_1 = intersection_1 / union_1 if union_1 > 0 else 0
    print(f"Channel 1 == 1: area={ch1_1.sum():,}, IoU with cyan={iou_1:.4f}")
    
    # Channel 2
    ch2_68 = (bin_mask[:,:,2] == 68)
    ch2_253 = (bin_mask[:,:,2] == 253)
    intersection_68 = np.logical_and(ch2_68, cyan_mask).sum()
    union_68 = np.logical_or(ch2_68, cyan_mask).sum()
    iou_68 = intersection_68 / union_68 if union_68 > 0 else 0
    print(f"Channel 2 == 68: area={ch2_68.sum():,}, IoU with cyan={iou_68:.4f}")

# The BinaryMask seems to encode building vs non-building in a weird way
# Let's see what the actual values represent
print("\nFull channel analysis:")
for c in range(3):
    unique = np.unique(bin_mask[:,:,c])
    print(f"Channel {c}: {unique}")