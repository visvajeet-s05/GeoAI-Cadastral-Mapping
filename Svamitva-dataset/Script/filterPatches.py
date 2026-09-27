import os
from tqdm import tqdm
from matplotlib.pyplot import imsave, imread
patch_folder = "./patches"
image_folder = "./Images"

for index, filename in tqdm(enumerate(os.listdir(patch_folder))):
    if filename.endswith(".png"):
        old_name = os.path.join(patch_folder, filename)
        new_name = os.path.join(image_folder, f"patch_{index+488}.png")

        try:
            img = imread(old_name)
            imsave(new_name, img)
        except:
            print(f"Error processing {old_name}")
