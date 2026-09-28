import torch, sys
sys.path.insert(0, 'ml')
from train_cadastral import DualHeadCadastralModel, TrainConfig

cfg = TrainConfig()
model = DualHeadCadastralModel(cfg)
sd = model.state_dict()
new_keys = set(sd.keys())

print('Current model head/dropout keys:')
for k in sorted(sd):
    if 'head' in k or 'dropout' in k:
        print(f'  {k}: {list(sd[k].shape)}')

ckpt = torch.load('ml/test_checkpoint.pth', map_location='cpu', weights_only=False)
old_keys = set(ckpt['model_state_dict'].keys())
print(f'\nOld checkpoint: {len(old_keys)} keys, New model: {len(new_keys)} keys')
print(f'Matching: {len(old_keys & new_keys)}')

in_old_not_new = sorted(old_keys - new_keys)
print(f'In old, not in new (first 8): {in_old_not_new[:8]}')
in_new_not_old = sorted(new_keys - old_keys)
print(f'In new, not in old: {in_new_not_old}')

model_head_keys = {k for k in new_keys if k.startswith('head_')}
ckpt_head_keys = {k for k in old_keys if k.startswith('head_')}
print(f'\nModel head keys: {sorted(model_head_keys)}')
print(f'Checkpoint head keys: {sorted(ckpt_head_keys)}')

hb_model = {k for k in model_head_keys if 'head_building' in k}
hb_ckpt = {k for k in ckpt_head_keys if 'head_building' in k}
print(f'head_building overlap: {len(hb_model & hb_ckpt)}/{len(hb_model)}')
hv_ckpt = {k for k in ckpt_head_keys if 'head_vegetation' in k}
print(f'head_vegetation in checkpoint: {len(hv_ckpt)}')
print(f'Has dropout in checkpoint: {len([k for k in old_keys if "dropout" in k])}')
print(f'Has dropout in model: {len([k for k in new_keys if "dropout" in k])}')

# Check base_unet overlap
bu_model = {k for k in new_keys if k.startswith('base_unet.')}
bu_ckpt = {k for k in old_keys if k.startswith('base_unet.')}
print(f'\nbase_unet overlap: {len(bu_model & bu_ckpt)}/{len(bu_model)}')
