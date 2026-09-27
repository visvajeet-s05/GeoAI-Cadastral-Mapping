import torch
from train_cadastral import MultiTaskCadastralModel, TrainConfig, CadastralDataset, MultiTaskLoss, export_to_onnx
from torch.utils.data import DataLoader, Subset

config = TrainConfig(data_root='../Svamitva-dataset/FilteredData', num_epochs=1, batch_size=2, elevation_mode='none', device='cpu')
dataset = CadastralDataset(config.data_root, split='train', img_size=config.img_size, config=config)

# Use only first 50 samples for quick training
subset = Subset(dataset, range(50))
loader = DataLoader(subset, batch_size=2, shuffle=True, num_workers=0)

model = MultiTaskCadastralModel(config)
criterion = MultiTaskLoss(config.loss_weights)

optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)

model.train()
print('Training on 50 samples...')
for epoch in range(2):
    epoch_losses = []
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
        
        epoch_losses.append(loss.item())
        if i % 10 == 0:
            print('Epoch {} Batch {}: loss={:.4f}'.format(epoch, i, loss.item()))
    
    avg_loss = sum(epoch_losses) / len(epoch_losses)
    print('Epoch {} average loss: {:.4f}'.format(epoch, avg_loss))

# Save checkpoint
torch.save({
    'model_state_dict': model.state_dict(),
    'config': config.__dict__,
}, 'quick_trained_checkpoint.pth')
print('Checkpoint saved')

# Export to ONNX
model.eval()
export_to_onnx(model, config, 'quick_trained_model.onnx')
print('ONNX export complete')