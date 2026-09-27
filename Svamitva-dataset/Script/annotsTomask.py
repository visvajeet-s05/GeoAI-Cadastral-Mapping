import os
import numpy as np
import pandas as pd
from glob import glob
from PIL import Image
from tqdm import tqdm
import matplotlib.pyplot as plt

label_studio_annotations = r"C:\Users\shali\Downloads\annot"
annot_csv_path = r"C:\Users\shali\Downloads\annot.csv"

output_folder = "./masks"
class_mapping = {
    1: 'Building',
    2: 'Road',
    3: 'Water',
    4: 'Greenery',
    5: 'Blank'
}
name_to_class = {v: k for k, v in class_mapping.items()}
color_mapping = {
    'Building': (255, 165, 0),  # Orange
    'Road': (255, 255, 0),  # Yellow
    'Water': (0, 0, 255),    # Blue
    'Greenery': (0, 128, 0),  # Green
    'Blank': (0, 0, 0)       # Black
}

# Read the CSV File
annot_df = pd.read_csv(annot_csv_path)

# ID to Image File Name Mapping
ids_df = annot_df[['annotation_id', 'image']].copy()
ids_df['file_names'] = ids_df['image'].apply(lambda path: path.split("-")[-1])

# Load all annotation paths
mask_paths = glob(label_studio_annotations + '/*')

# Create a dictionary with IDs and respective masks
mask_dict = {id:
             [path for path in mask_paths if str(id) in path]
             for id in ids_df['annotation_id']}

# Function to create RGB mask


def create_rgb_mask(annotations, class_mapping, color_mapping, img_size):
    mask = np.zeros((img_size[1], img_size[0], 3), dtype=np.uint8)
    for annotation in annotations:
        class_name = annotation.split('-')[-2]

        # Load the mask image
        img = Image.open(annotation).convert('L')
        img_array = np.array(img)

        # Create binary mask
        binary_mask = np.where(img_array > 0, 1, 0)

        # Map binary mask to RGB
        color = color_mapping[class_name]
        for c in range(3):
            mask[:, :, c] = np.where(binary_mask == 1, color[c], mask[:, :, c])

    return mask


img_size = (512, 512)
for id, annotations in tqdm(mask_dict.items(), desc="Converting"):
    if annotations:
        rgb_mask = create_rgb_mask(
            annotations, class_mapping, color_mapping, img_size)

        # Get the respective file name
        file_name = ids_df.loc[ids_df['annotation_id']
                               == id, 'file_names'].values[0].split(".")[0]
        mask_path = os.path.join(output_folder, f"{file_name}_mask.png")

        # Save the RGB mask image
        plt.imsave(mask_path, rgb_mask)
