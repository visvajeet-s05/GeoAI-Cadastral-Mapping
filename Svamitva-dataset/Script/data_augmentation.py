import os
import shutil
from glob import glob
from matplotlib import pyplot as plt
import tensorflow as tf
from tqdm import tqdm


def augmentations(image, mask):
    # Convert image and mask to float32
    image = tf.cast(image, tf.float32)
    mask = tf.cast(mask, tf.float32)
    # Normalize the image and mask
    image = image / 255.0
    mask = mask / 255.0

    # Combine image and mask to ensure same augmentations
    combined = tf.concat([image, mask], axis=-1)
    combined = tf.image.rot90(combined, tf.random.uniform(
        shape=[], minval=0, maxval=4, dtype=tf.int32))
    combined = tf.image.random_flip_left_right(combined)

    # Split image and mask
    image = combined[:, :, :3]
    mask = combined[:, :, 3:]

    # Only image augmentation
    image = tf.image.random_brightness(image, 0.2)
    image = tf.image.random_contrast(image, 0.2, 0.5)
    image = tf.image.random_saturation(image, 0.2, 0.5)
    image = tf.image.random_hue(image, 0.2)

    return image, mask


def read_image(image_path):
    image = tf.io.read_file(image_path)
    image = tf.image.decode_jpeg(image, channels=3)
    return image


def read_mask(mask_path):
    mask = tf.io.read_file(mask_path)
    mask = tf.image.decode_jpeg(mask, channels=3)
    return mask


def write_image(image, image_path):
    image = tf.cast(image, tf.float32)
    image = tf.clip_by_value(image, 0.0, 1.0)
    plt.imsave(image_path, image.numpy())


image_paths = glob("./data/Images/*")
mask_paths = glob("./data/masks/*")
start_index = len(image_paths) + 1

# Ensure output directories exist
os.makedirs("./FilteredData/Images", exist_ok=True)
os.makedirs("./FilteredData/Masks", exist_ok=True)

for index, (image_path, mask_path) in tqdm(enumerate(zip(image_paths, mask_paths)), desc="Filtering Data"):
    mask = read_mask(mask_path)

    # Check if any pixel matches the specific color
    if tf.reduce_any(tf.reduce_all(mask == [0, 110, 255], axis=-1)):
        # Copy image and mask to the filtered directory
        shutil.copyfile(
            image_path, f"./FilteredData/Images/{os.path.basename(image_path)}")
        shutil.copyfile(
            mask_path, f"./FilteredData/Masks/{os.path.basename(mask_path)}")
