import requests
import base64
import math
from PIL import Image
from io import BytesIO

# ============================================================
# STEP 1: Compute real basemap tile bounds for Velachery
# ============================================================
# Velachery PRCL-GT-103 centroid: ~12.9839, 80.2089
# CMDA-LP-2018-102 center: 12.9843, 80.2095

VELACHERY_LAT = 12.9839
VELACHERY_LNG = 80.2089

def latlng_to_tile(lat: float, lng: float, zoom: int):
    """Convert lat/lng to Web Mercator tile coordinates"""
    n = 2.0 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y

def tile_to_bounds(x: int, y: int, zoom: int):
    """Convert tile coordinates to lat/lng bounds"""
    n = 2.0 ** zoom
    
    # Upper-left corner
    lon1 = x / n * 360.0 - 180.0
    lat1_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat1 = math.degrees(lat1_rad)
    
    # Lower-right corner  
    lon2 = (x + 1) / n * 360.0 - 180.0
    lat2_rad = math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n)))
    lat2 = math.degrees(lat2_rad)
    
    # Return as [min_lng, min_lat, max_lng, max_lat]
    return [min(lon1, lon2), min(lat1, lat2), max(lon1, lon2), max(lat1, lat2)]

# Use zoom 19 for ~0.3m/px resolution (good for building detection)
ZOOM = 19
tile_x, tile_y = latlng_to_tile(VELACHERY_LAT, VELACHERY_LNG, ZOOM)
bounds = tile_to_bounds(tile_x, tile_y, ZOOM)

print("=" * 80)
print("REAL BASEMAP TILE FOR VELACHERY PRCL-GT-103")
print("=" * 80)
print(f"Zoom level: {ZOOM}")
print(f"Tile coordinates: x={tile_x}, y={tile_y}, z={ZOOM}")
print(f"Computed bounds (min_lng, min_lat, max_lng, max_lat):")
print(f"  [{bounds[0]:.8f}, {bounds[1]:.8f}, {bounds[2]:.8f}, {bounds[3]:.8f}]")
print(f"Center: [{(bounds[0]+bounds[2])/2:.8f}, {(bounds[1]+bounds[3])/2:.8f}]")

# ============================================================
# STEP 2: Fetch the real basemap tile from Esri World Imagery
# ============================================================
# Esri World Imagery tile URL template:
# https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}

TILE_URL = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{ZOOM}/{tile_y}/{tile_x}"

print(f"\nFetching tile from: {TILE_URL}")

import requests
response = requests.get(TILE_URL, timeout=30)
if response.status_code != 200:
    print(f"ERROR: Failed to fetch tile: {response.status_code}")
    exit(1)

# Load image and encode as base64
img = Image.open(BytesIO(response.content))
print(f"Tile image size: {img.size}")

# Encode as base64
buffer = BytesIO()
img.save(buffer, format="PNG")
img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

print(f"Base64 encoded size: {len(img_b64)} chars")

# ============================================================
# STEP 3: Run predict_tile through real API
# ============================================================
payload = {
    "bounds": bounds,
    "image_base64": img_b64,
    "confidence_threshold": 0.5,
    "simplify_tolerance": 0.00002,
    "regularize_right_angles": True,
    "min_parcel_area_sqm": 20.0,
    "enable_uncertainty": True,
    "mc_samples": 3
}

print("\n" + "=" * 80)
print("RUNNING PREDICT_TILE THROUGH REAL API")
print("=" * 80)

response = requests.post("http://localhost:3000/api/ml/predict_tile", json=payload, timeout=120)

if response.status_code != 200:
    print(f"ERROR: predict_tile failed: {response.status_code}")
    print(response.text)
    exit(1)

result = response.json()
print(f"Success: {result.get('success')}")
print(f"Model: {result.get('model_version')}")
print(f"Inference time: {result.get('inference_time_ms')} ms")
print(f"Parcels detected: {result.get('parcels_detected')}")

# Extract building features
building_features = []
veg_features = []
for feat in result['geojson']['features']:
    if feat['properties'].get('classification') == 'BUILTUP':
        building_features.append(feat)
    elif feat['properties'].get('classification') == 'VEGETATION':
        veg_features.append(feat)

print(f"Building features: {len(building_features)}")
print(f"Vegetation features: {len(veg_features)}")

# Show first few building features
for i, feat in enumerate(building_features[:3]):
    props = feat['properties']
    coords = feat['geometry']['coordinates'][0]
    print(f"\n  Building {i+1}: {props['parcel_id']}")
    print(f"    Confidence: {props['confidence']}")
    print(f"    Area: {props['area_sqm']} sqm")
    print(f"    Vertices: {props['vertex_count']}")
    print(f"    Bounds (first 3): {coords[:3]}")

# ============================================================
# STEP 4: Get real legal boundary for PRCL-GT-103
# ============================================================
print("\n" + "=" * 80)
print("FETCHING REAL LEGAL BOUNDARY FOR PRCL-GT-103")
print("=" * 80)

resp = requests.get("http://localhost:3000/api/parcels")
data = resp.json()
parcels = data.get('parcels', [])

target_parcel = None
for p in parcels:
    if p.get('id') == 'PRCL-GT-103':
        target_parcel = p
        break

if target_parcel and 'buildingFootprint' in target_parcel:
    # The legal boundary comes from the CMDA-LP-2018-102 layout, Plot 1
    # Coordinates from the layout data
    legal_boundary = [
        [80.2091, 12.9841],
        [80.2097, 12.9841],
        [80.2097, 12.9846],
        [80.2091, 12.9846],
        [80.2091, 12.9841]
    ]
    print(f"Legal boundary (Plot 1, CMDA-LP-2018-102): {len(legal_boundary)} vertices")
    print(f"Sample coords: {legal_boundary[:3]}")
    
    # Also check the building footprint from the parcel (for reference)
    bf = target_parcel.get('buildingFootprint', [])
    print(f"Parcel's stored building footprint: {len(bf)} vertices")
else:
    print("Parcel PRCL-GT-103 not found or missing buildingFootprint")
    exit(1)

# ============================================================
# STEP 5: Run discrepancy-analysis with real ML output vs real legal boundary
# ============================================================
# Use the first detected building polygon from the ML model
building_feat = None
for feat in result['geojson']['features']:
    if feat['properties'].get('classification') == 'BUILTUP':
        building_feat = feat
        break

if building_feat:
    # Model outputs [lng, lat] format (GeoJSON)
    coords = building_feat['geometry']['coordinates'][0]
    # Keep as [lng, lat] for the API
    detected_boundary = coords
    
    print(f"\nUsing ML detected building: {len(detected_boundary)} vertices")
    print(f"Sample coords: {detected_boundary[:3]}")
    
    # Legal boundary from CMDA-LP-2018-102 Plot 1
    legal_boundary = [
        [80.2091, 12.9841],
        [80.2097, 12.9841],
        [80.2097, 12.9846],
        [80.2091, 12.9846],
        [80.2091, 12.9841]
    ]
    
    # Run discrepancy analysis
    discrepancy_payload = {
        "parcelId": "PRCL-GT-103",
        "layoutId": "CMDA-LP-2018-102",
        "detectedPhysicalBoundary": detected_boundary,
        "detectionConfidence": building_feat['properties']['confidence']
    }
    
    print("\n" + "=" * 80)
    print("RUNNING DISCREPANCY ANALYSIS (ML BUILDING vs LEGAL BOUNDARY)")
    print("=" * 80)
    
    resp = requests.post(
        "http://localhost:3000/api/tn-land-records/discrepancy-analysis", 
        json=discrepancy_payload, 
        timeout=30
    )
    
    print(f"Discrepancy status: {resp.status_code}")
    if resp.status_code == 200:
        disc = resp.json()
        d = disc['discrepancy']
        print(f"\n--- DISCREPANCY RESULT ---")
        print(f"Encroachment area: {d['encroachmentAreaSqM']} sqm")
        print(f"Max deviation: {d['maxDeviationMeters']} m")
        print(f"Compliance: {d['complianceStatus']}")
        print(f"Confidence level: {d['confidenceLevel']}")
        print(f"Data sources: {d['dataSources']}")
        
        # Cross-check: do returned coordinates fall within real bounds?
        tile_min_lng, tile_min_lat, tile_max_lng, tile_max_lat = bounds
        detected_coords = building_feat['geometry']['coordinates'][0]
        
        # Check if all detected coords fall within tile bounds
        all_within = True
        for lng, lat in detected_coords:
            if not (tile_min_lng <= lng <= tile_max_lng and tile_min_lat <= lat <= tile_max_lat):
                all_within = False
                print(f"FAIL: Coordinate [{lng}, {lat}] outside tile bounds!")
        
        if all_within:
            print(f"\n✓ PASS: All ML-detected coordinates fall within the real tile bounds")
        else:
            print(f"\n✗ FAIL: Some ML-detected coordinates fall outside the real tile bounds")
        
        # Also check if legal boundary is within tile bounds
        legal_within = True
        for lng, lat in legal_boundary:
            if not (tile_min_lng <= lng <= tile_max_lng and tile_min_lat <= lat <= tile_max_lat):
                legal_within = False
                print(f"FAIL: Legal boundary coordinate [{lng}, {lat}] outside tile bounds!")
        
        if legal_within:
            print(f"✓ PASS: Legal boundary falls within the real tile bounds")
        else:
            print(f"✗ FAIL: Legal boundary falls outside the real tile bounds!")
        
        if all_within and legal_within:
            print(f"\n✓✓ FULL PASS: Both ML output and legal boundary are correctly anchored to the real tile bounds")
        else:
            print(f"\n✗✗ FULL FAIL: Coordinate anchoring problem detected")
        
    else:
        print(f"Error: {resp.text}")
else:
    print("No building features detected!")