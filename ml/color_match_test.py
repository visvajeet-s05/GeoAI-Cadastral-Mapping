"""Color-matching test: apply Esri tile's color statistics to SVAMITVA image
and vice versa, to isolate the spectral domain shift effect.
"""

import cv2
import numpy as np
import base64
import os
import requests

# SVAMITVA image that works well
img_path = "../Svamitva-dataset/FilteredData/Images/patch_1.png"
orig = cv2.imread(img_path)
print(f"Original SVAMITVA image: {orig.shape}, mean={orig.mean(axis=(0,1)).round(2)}, std={orig.std(axis=(0,1)).round(2)}")

# Real Esri tile
esri_path = "real_esri_tile.png"
if not os.path.exists(esri_path):
    import requests
    from PIL import Image
    from io import BytesIO
    url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/19/243070/378957"
    resp = requests.get("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/19/243070/378957", timeout=30)
    img = Image.open(BytesIO(resp.content)).convert("RGB")
    img.save(esri_path)

esri = cv2.imread(esri_path)
esri = cv2.resize(esri, (1024, 1024))  # match SVAMITVA size
print(f"Esri tile: {esri.shape}, mean={esri.mean(axis=(0,1)).round(2)}, std={esri.std(axis=(0,1)).round(2)}")

def color_match(source, target):
    """Apply target's color statistics to source (mean/std matching in LAB space)"""
    src_lab = cv2.cvtColor(source, cv2.COLOR_BGR2LAB).astype(np.float32)
    tgt_lab = cv2.cvtColor(target, cv2.COLOR_BGR2LAB).astype(np.float32)
    
    for c in range(3):
        src_mean, src_std = src_lab[:,:,c].mean(), src_lab[:,:,c].std()
        tgt_mean, tgt_std = tgt_lab[:,:,c].mean(), tgt_lab[:,:,c].std()
        src_lab[:,:,c] = (src_lab[:,:,c] - src_mean) / (src_std + 1e-6) * tgt_std + tgt_mean
    
    matched = cv2.cvtColor(src_lab.astype(np.uint8), cv2.COLOR_LAB2BGR)
    return matched

# Test 1: SVAMITVA image recolored to Esri statistics
svamitva_to_esri = color_match(orig, esri)
print(f"SVAMITVA->Esri color match: mean={svamitva_to_esri.mean(axis=(0,1)).round(2)}")

# Test 2: Esri tile recolored to SVAMITVA statistics
esri_to_svamitva = color_match(esri, orig)
print(f"Esri->SVAMITVA color match: mean={esri_to_svamitva.mean(axis=(0,1)).round(2)}")

# Save test images
cv2.imwrite("svamitva_to_esri.png", svamitva_to_esri)
cv2.imwrite("esri_to_svamitva.png", esri_to_svamitva)

# Test both through the model
VELACHERY_BOUNDS = [80.2091217, 12.9838168, 80.2098083, 12.9844859]

def test_image(img, label):
    _, buf = cv2.imencode('.png', img)
    img_b64 = base64.b64encode(buf).decode('utf-8')
    
    payload = {
        "bounds": [80.2091217, 12.9838168, 80.2098083, 12.9844859],
        "image_base64": base64.b64encode(cv2.imencode('.png', cv2.resize(img, (512,512)))[1]).decode('utf-8'),
        "confidence_threshold": 0.4,
        "simplify_tolerance": 0.00002,
        "regularize_right_angles": True,
        "min_parcel_area_sqm": 5.0,
        "enable_uncertainty": True,
        "mc_samples": 3
    }
    r = requests.post("http://localhost:8000/predict_tile", json=payload, timeout=120)
    if r.status_code == 200:
        res = r.json()
        bld = [f for f in res['geojson']['features'] if f['properties'].get('classification') == 'BUILTUP']
        veg = [f for f in res['geojson']['features'] if f['properties'].get('classification') == 'VEGETATION']
        print(f"  {label}: {len(bld)} buildings, {len(veg)} veg, avg_conf={res['metrics']['avg_confidence']:.3f}")
        return res
    return None

import base64

print("\n=== COLOR MATCHING TEST ===")
print("\n1. Original SVAMITVA patch_1.png:")
test_image(orig, "original SVAMITVA")

print("\n2. SVAMITVA recolored to Esri statistics:")
test_image(svamitva_to_esri, "SVAMITVA->Esri colors")

print("\n2b. Original Esri tile:")
test_image(esri, "original Esri")

print("\n2c. Esri recolored to SVAMITVA statistics:")
test_image(esri_to_svamitva, "Esri->SVAMITVA colors")