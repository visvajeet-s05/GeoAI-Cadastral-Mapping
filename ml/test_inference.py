import base64
import cv2
import numpy as np
from inference_server import CadastralInferenceEngine

engine = CadastralInferenceEngine('test_model.onnx')

# Load a real image from the dataset
img = cv2.imread('../Svamitva-dataset/FilteredData/Images/patch_1.png')
print('Loaded image:', img.shape)

# Encode as base64
_, buffer = cv2.imencode('.png', img)
img_b64 = base64.b64encode(buffer).decode('utf-8')

# Run inference
masks = engine.run_onnx_inference(img)
print('Masks shape:', masks.shape)
print('Masks range:', masks.min(), '-', masks.max())

# Run vectorization
geojson, topo, metrics = engine.vectorize_and_postprocess(
    masks=masks,
    bounds=[80.2542, 12.9818, 80.2615, 12.9875],
    confidence_threshold=0.5,
    simplify_tolerance=0.00002,
    regularize=True,
    min_area_sqm=20.0,
)

print('Features detected:', len(geojson["features"]))
print('Topological health:', topo)
print('Metrics:', metrics)
for feat in geojson['features'][:3]:
    props = feat['properties']
    print('  Parcel:', props['parcel_id'], 'Area:', props['area_sqm'], 'Conf:', props['confidence'], 'Uncertainty:', props['uncertainty'])