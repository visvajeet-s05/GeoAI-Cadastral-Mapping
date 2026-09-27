import numpy as np
from osgeo import gdal
from tqdm import tqdm
from patchify import patchify
from matplotlib.pyplot import imsave
import warnings
warnings.filterwarnings("ignore")

file_path = r"D:\Projects\Indus Hackathon\Datasets\suragpur.tif"

ds = gdal.Open(file_path)
image = np.dstack((
    ds.GetRasterBand(1).ReadAsArray(),
    ds.GetRasterBand(2).ReadAsArray(),
    ds.GetRasterBand(3).ReadAsArray()
))

patch_shape = (1024, 1024, 3)
patches = patchify(image, patch_size=patch_shape, step=patch_shape[0])
patches = patches.reshape(-1, *patch_shape)

for i, patch in tqdm(enumerate(patches)):
    imsave(f"./patches/patch_{i}.png", patch)
