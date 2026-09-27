import torch
from train_cadastral import MultiTaskCadastralModel, TrainConfig, CadastralDataset
from torch.utils.data import DataLoader, Subset

config = TrainConfig(data_root='../Svamitva-dataset/FilteredData', num_epochs=1, batch_size=2, elevation_mode='none', device='cpu')
dataset = CadastralDataset(config.data_root, split='train', img_size=config.img_size, config=config)

# Use only first 10 samples for quick test
subset = Subset(dataset, range(10))
loader = DataLoader(subset, batch_size=2, shuffle=False, num_workers=0)

model = MultiTaskCadastralModel(config)

model.train()
for i, batch in enumerate(loader):
    images = batch['image']
    out = model(images)
    print('Batch {}: image={}, building={}, landuse={}'.format(i, images.shape, out["building"].shape, out["landuse"].shape))
    if i >= 2:
        break
print('Quick forward pass test passed')