from io import StringIO
from PIL import Image, ImageDraw
import json
import os
import pandas as pd

# Mask size (assuming all annotations share the same dimensions)
image_width = 1024
image_height = 1024

# Define colors for each label
label_colors = {
    "Field": (85, 217, 48),
    "Building": (0, 110, 255),
    "Road": (255, 0, 0),
    "Water": (0, 238, 255),
    "Other": (200, 255, 0)
}

# Load CSV
csv_data = r"./annotations.csv"
data = pd.read_csv(csv_data)

# Create output directory for masks
output_dir = "./masks"
os.makedirs(output_dir, exist_ok=True)

# Process each row in the CSV
for i, row in data.iterrows():
    # Create a blank image for the mask
    mask_image = Image.new("RGB", (image_width, image_height), (0, 0, 0))
    draw = ImageDraw.Draw(mask_image)
    
    # Parse annotation data
    annotations = json.loads(row["label"])
    for annotation in annotations:
        points = [(p[0] * image_width / 100, p[1] * image_height / 100)
                  for p in annotation["points"]]
        labels = annotation["polygonlabels"]
        for label in labels:
            color = label_colors.get(label, (255, 255, 255))
            draw.polygon(points, fill=color, outline=color)
    
    # Save the mask image with a unique filename
    output_file_name = row["image"].split("-")[-1]
    mask_image.save(os.path.join(output_dir, output_file_name))
