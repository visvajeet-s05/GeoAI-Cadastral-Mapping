import os
import cv2

# Check data pairing between FilteredData/BinaryMasks and Full Data/Masks
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
binary_dir = os.path.join(base_dir, "Svamitva-dataset", "FilteredData", "BinaryMasks")
full_mask_dir = os.path.join(base_dir, "Svamitva-dataset", "Full Data", "Masks")
images_dir = os.path.join(base_dir, "Svamitva-dataset", "FilteredData", "Images")

binary_files = set(f for f in os.listdir(binary_dir) if f.endswith('.png'))
full_mask_files = set(f for f in os.listdir(full_mask_dir) if f.endswith('.png'))
image_files = set(f for f in os.listdir(images_dir) if f.endswith('.png'))

print(f"BinaryMasks: {len(binary_files)} files")
print(f"Full Data/Masks: {len(full_mask_files)} files")
print(f"FilteredData/Images: {len(image_files)} files")

# Check overlap
common_binary_full = binary_files.intersection(full_mask_files)
common_binary_images = binary_files.intersection(image_files)
common_full_images = full_mask_files.intersection(image_files)

print(f"\nBinaryMasks + Full Data/Masks: {len(common_binary_full)} files")
print(f"BinaryMasks + Images: {len(common_binary_images)} files")
print(f"Full Data/Masks + Images: {len(common_full_images)} files")

# Check if all image files have corresponding binary masks
missing_binary = image_files - binary_files
missing_full = image_files - full_mask_files
print(f"\nImages missing BinaryMasks: {len(missing_binary)}")
print(f"Images missing Full Data Masks: {len(missing_full)}")

# Sample 10 files and check dimensions
print("\n--- Sample 10 paired files dimensions ---")
sample_files = list(common_binary_full)[:10]
for fname in sample_files:
    bin_path = os.path.join(binary_dir, fname)
    full_path = os.path.join(full_mask_dir, fname)
    img_path = os.path.join(images_dir, fname)
    
    bin_mask = cv2.imread(bin_path, cv2.IMREAD_UNCHANGED)
    full_mask = cv2.imread(full_path, cv2.IMREAD_COLOR)
    img = cv2.imread(img_path)
    
    bin_shape = bin_mask.shape if bin_mask is not None else "FAILED"
    full_shape = full_mask.shape if full_mask is not None else "FAILED"
    img_shape = img.shape if img is not None else "FAILED"
    
    print(f"{fname}: Image={img_shape}, BinaryMask={bin_shape}, FullMask={full_shape}")