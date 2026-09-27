import cv2
import numpy as np
import json
import requests
import base64

# Load the prediction result
with open('predict_result.json') as f:
    result = json.load(f)

# Load the original image
img = cv2.imread('../Svamitva-dataset/FilteredData/Images/patch_500.png')
if img is None:
    img = cv2.imread('../Svamitva-dataset/FilteredData/Images/patch_100.png')

print(f"Image shape: {img.shape}")

# Create overlay
overlay = img.copy()

# Draw building features (BUILTUP) in red
building_count = 0
veg_count = 0
for feat in result['geojson']['features']:
    props = feat['properties']
    coords = feat['geometry']['coordinates'][0]
    
    # Convert geographic coords to pixel coords
    # bounds: [80.2542, 12.9818, 80.2615, 12.9875]
    min_lon, min_lat, max_lon, max_lat = 80.2542, 12.9818, 80.2615, 12.9875
    h, w = img.shape[:2]
    
    pixel_coords = []
    for lng, lat in coords:
        px = int((lng - min_lon) / (max_lon - min_lon) * w)
        py = int((max_lat - lat) / (max_lat - min_lat) * h)
        pixel_coords.append([px, py])
    
    pixel_coords = np.array(pixel_coords, dtype=np.int32)
    
    if props.get('classification') == 'BUILTUP':
        cv2.polylines(overlay, [pixel_coords], True, (0, 0, 255), 2)
        cv2.fillPoly(overlay, [pixel_coords], (0, 0, 255))
        building_count += 1
    elif props.get('classification') == 'VEGETATION':
        cv2.polylines(overlay, [pixel_coords], True, (0, 255, 0), 1)
        cv2.fillPoly(overlay, [pixel_coords], (0, 255, 0))
        veg_count += 1

# Blend
alpha = 0.4
output = cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0)

# Add legend
cv2.putText(output, f'Buildings: {building_count}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
cv2.putText(output, f'Vegetation: {veg_count}', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

cv2.imwrite('overlay_result.png', output)
print(f"Overlay saved. Buildings: {building_count}, Vegetation: {veg_count}")

# Now run discrepancy analysis with the first building polygon
# Get the first building feature
building_feat = None
for feat in result['geojson']['features']:
    if feat['properties'].get('classification') == 'BUILTUP':
        building_feat = feat
        break

if building_feat:
    # Get the building polygon coordinates - model outputs [lng, lat] format
    coords = building_feat['geometry']['coordinates'][0]
    
    # Keep as [lng, lat] format for the server (GeoJSON format)
    detected_boundary = coords
    
    print(f"Running discrepancy analysis with building polygon: {len(detected_boundary)} vertices")
    print(f"Sample coords: {detected_boundary[:3]}")
    
    discrepancy_payload = {
        "parcelId": "PRCL-GT-103",
        "layoutId": "TN-FMB-2022-89",
        "detectedPhysicalBoundary": detected_boundary,
        "detectionConfidence": building_feat['properties']['confidence']
    }
    
    resp = requests.post("http://localhost:3000/api/tn-land-records/discrepancy-analysis", 
                        json=discrepancy_payload, timeout=30)
    
    print(f"Discrepancy status: {resp.status_code}")
    if resp.status_code == 200:
        disc = resp.json()
        print(f"Encroachment area: {disc['discrepancy']['encroachmentAreaSqM']} sqm")
        print(f"Max deviation: {disc['discrepancy']['maxDeviationMeters']} m")
        print(f"Compliance: {disc['discrepancy']['complianceStatus']}")
        print(f"Confidence level: {disc['discrepancy']['confidenceLevel']}")
        print(f"Data sources: {json.dumps(disc['discrepancy']['dataSources'], indent=2)}")
    else:
        print(f"Error: {resp.text}")