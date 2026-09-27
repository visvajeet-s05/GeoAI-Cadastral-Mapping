import cv2
import numpy as np
import base64

# Test with existing exported model
from inference_server import CadastralInferenceEngine

engine = CadastralInferenceEngine('test_model.onnx')
print(f"Model loaded: in_channels={engine.in_channels}, elevation_mode={engine.elevation_mode}")

# Test on 3 validation images
val_images = ['patch_1.png', 'patch_2.png', 'patch_3.png']
for fname in val_images:
    img_path = f'../Svamitva-dataset/FilteredData/Images/{fname}'
    img = cv2.imread(img_path)
    if img is None:
        print(f"{fname}: NOT FOUND")
        continue
    
    # Resize to 512x512 as model expects
    img = cv2.resize(img, (512, 512))
    
    # Run inference
    masks = engine.run_onnx_inference(img)
    print(f"\n{fname}: masks shape={masks.shape}, range=[{masks.min():.4f}, {masks.max():.4f}]")
    
    # Test boundary refinement (vectorize_and_postprocess)
    geojson, topo, metrics = engine.vectorize_and_postprocess(
        masks=masks,
        bounds=[80.2542, 12.9818, 80.2615, 12.9875],
        confidence_threshold=0.5,
        simplify_tolerance=0.00002,
        regularize=True,
        min_area_sqm=20.0,
    )
    
    print(f"  Features: {len(geojson['features'])}")
    print(f"  Topology: {topo}")
    print(f"  Metrics: {metrics}")
    
    # Report vertex counts for building features
    for feat in geojson['features']:
        if feat['properties']['source'] == 'CV_DETECTED' and feat['properties']['classification'] != 'VEGETATION':
            print(f"    Parcel {feat['properties']['parcel_id']}: {feat['properties']['vertex_count']} vertices, area={feat['properties']['area_sqm']:.1f} sqm")