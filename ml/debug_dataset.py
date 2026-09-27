import torch
from train_cadastral import MultiTaskCadastralModel, TrainConfig, CadastralDataset
from torch.utils.data import DataLoader, Subset

config = TrainConfig(data_root='../Svamitva-dataset/FilteredData', num_epochs=1, batch_size=2, elevation_mode='none', device='cpu')
dataset = CadastralDataset(config.data_root, split='train', img_size=config.img_size, config=config)

# Check first sample shape
sample = dataset[0]
print('Sample keys:', sample.keys())
print('Image shape:', sample['image'].shape)
print('Image dtype:', sample['image'].dtype)
print('Building shape:', sample['building'].shape)
print('Parcel shape:', sample['parcel'].shape)
print('Road shape:', sample['road'].shape)
print('Landuse shape:', sample['landuse'].shape)
print('Image range:', sample['image'].min(), '-', sample['image'].max())