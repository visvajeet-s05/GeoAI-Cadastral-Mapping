import torch
from train_cadastral import MultiTaskCadastralModel, TrainConfig, CadastralDataset, MultiTaskLoss
from torch.utils.data import DataLoader, Subset

config = TrainConfig(data_root='../Svamitva-dataset/FilteredData', num_epochs=1, batch_size=2, elevation_mode='none', device='cpu')
dataset = CadastralDataset(config.data_root, split='train', img_size=config.img_size, config=config)

# Use only first 20 samples for quick test
subset = Subset(dataset, range(20))
loader = DataLoader(subset, batch_size=2, shuffle=False, num_workers=0)

model = MultiTaskCadastralModel(config)
criterion = MultiTaskLoss(config.loss_weights)

optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

model.train()
for i, batch in enumerate(loader):
    images = batch['image']
    targets = {
        'building': batch['building'],
        'parcel': batch['parcel'],
        'road': batch['road'],
        'landuse': batch['landuse'],
    }
    
    optimizer.zero_grad()
    preds = model(images)
    loss, loss_dict = criterion(preds, targets)
    loss.backward()
    optimizer.step()
    
    print('Batch {}: loss={:.4f}, building={:.4f}, parcel={:.4f}, road={:.4f}, landuse={:.4f}'.format(
        i, loss.item(), loss_dict['building'], loss_dict['parcel'], loss_dict['road'], loss_dict['landuse']))
    if i >= 9:
        break

print('Quick training test passed')