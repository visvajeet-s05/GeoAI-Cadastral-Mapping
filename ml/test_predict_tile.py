import cv2
import base64
import requests
import json

# Load a real SVAMITVA image (not used in training - using validation split)
# Use patch_1000.png which is likely in the validation split (indices > 552)
img = cv2.imread('../Svamitva-dataset/FilteredData/Images/patch_1000.png')
if img is None:
    # Try another one
    img = cv2.imread('../Svamitva-dataset/FilteredData/Images/patch_500.png')
if img is None:
    img = cv2.imread('../Svamitva-dataset/FilteredData/Images/patch_100.png')

print(f"Loaded image shape: {img.shape}")

# Encode as base64
_, buffer = cv2.imencode('.png', img)
img_b64 = base64.b64encode(buffer).decode('utf-8')

# Call predict_tile through the API
payload = {
    "bounds": [80.2542, 12.9818, 80.2615, 12.9875],  # Velachery area
    "image_base64": img_b64,
    "confidence_threshold": 0.5,
    "simplify_tolerance": 0.00002,
    "regularize_right_angles": True,
    "min_parcel_area_sqm": 20.0,
    "enable_uncertainty": True,
    "mc_samples": 3
}

print("Calling predict_tile...")
response = requests.post("http://localhost:3000/api/ml/predict_tile", json=payload, timeout=60)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    result = response.json()
    print(f"Success: {result.get('success')}")
    print(f"Model: {result.get('model_version')}")
    print(f"Parcels detected: {result.get('parcels_detected')}")
    print(f"Inference time: {result.get('inference_time_ms')} ms")
    print(f"Topological health: {result.get('topological_health')}")
    print(f"Metrics: {result.get('metrics')}")
    
    # Print features
    for feat in result.get('geojson', {}).get('features', []):
        props = feat['properties']
        print(f"\n  Feature: {feat['id']}")
        print(f"  Type: {props.get('classification')}")
        print(f"  Confidence: {props.get('confidence')}")
        print(f"  Area: {props.get('area_sqm')} sqm")
        print(f"  Perimeter: {props.get('perimeter_m')} m")
        print(f"  Vertices: {props.get('vertex_count')}")
        print(f"  Uncertainty: {props.get('uncertainty')}")
        print(f"  Source: {props.get('source')}")
        if 'landuse_3class' in props:
            print(f"  Landuse: {props['landuse_3class']}")
else:
    print(f"Error: {response.text}")

# Save the result
with open('predict_result.json', 'w') as f:
    json.dump(response.json() if response.status_code == 200 else {"error": response.text}, f, indent=2)
print("\nFull result saved to predict_result.json")