import os
from glob import glob
from tqdm import tqdm
import tensorflow as tf
from matplotlib import pyplot as plt


def read_image(image_path):
    image = tf.io.read_file(image_path)
    image = tf.image.decode_jpeg(image, channels=3)
    return image

def write_image(image, image_path):
    image = tf.cast(image, tf.float32)
    image = tf.clip_by_value(image, 0.0, 1.0)
    plt.imsave(image_path, image.numpy())


image_paths = glob("./data/Images/*")
mask_paths = glob("./data/masks/*")
start_index = len(image_paths) + 1

# Ensure output directories exist
os.makedirs("./FilteredData/Masks", exist_ok=True)
os.makedirs("./FilteredData/BinaryMasks", exist_ok=True)

for mask_path in mask_paths:
    mask = read_image(mask_path)

    if tf.reduce_any(tf.reduce_all(mask == [0, 110, 255], axis=-1)):
        
        mask = tf.cast(tf.reduce_all(mask == [0, 110, 255], axis=-1), tf.float32)
        write_image(mask, f"./FilteredData/BinaryMasks/{os.path.basename(mask_path)}")