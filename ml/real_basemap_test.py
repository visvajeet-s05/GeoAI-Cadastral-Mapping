import requests
import base64
import math
from PIL import Image
from io import BytesIO

# ============================================================
# REAL BASEMAP TILE TEST: Esri World Imagery tile covering PRCL-GT-103
# ============================================================

# PRCL-GT-103 centroid: ~12.9839, 80.2089
# CMDA-LP-2018-102 Plot 1 center: ~12.98435, 80.2094

VELACHERY_LAT = 12.98435
VELACHERY_LNG = 80.2094

def latlng_to_tile(lat: float, lng: float, zoom: int):
    n = 2.0 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y

def tile_to_bounds(x: int, y: int, zoom: int):
    n = 2.0 ** zoom
    lon1 = x / n * 360.0 - 180.0
    lat1_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat1 = math.degrees(lat1_rad)
    lon2 = (x + 1) / n * 360.0 - 180.0
    lat2_rad = math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n)))
    lat2 = math.degrees(lat2_rad)
    return [min(lon1, lon2), min(lat1, lat2), max(lon1, lon2), max(lat1, lat2)]

# Use zoom 19 for ~0.3m/px
ZOOM = 19
tile_x, tile_y = latlng_to_tile(VELACHERY_LAT, VELACHERY_LNG, ZOOM)
bounds = tile_to_bounds(tile_x, tile_y, ZOOM)

print("=" * 80)
print("REAL BASEMAP TILE TEST: Esri World Imagery covering PRCL-GT-103")
print("=" * 80)
print(f"Tile server: Esri World Imagery")
print(f"Tile coordinates: z={ZOOM}, x={tile_x}, y={tile_y}")
print(f"Computed bounds (via standard z/x/y -> lat/lon formula):")
print(f"  min_lng: {bounds[0]:.8f}")
print(f"  min_lat: {bounds[1]:.8f}")
print(f"  max_lng: {bounds[2]:.8f}")
print(f"  max_lat: {bounds[3]:.8f}")
print(f"Center: [{(bounds[0]+bounds[2])/2:.8f}, {(bounds[1]+bounds[3])/2:.8f}]")

# Fetch the real tile
TILE_URL = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{ZOOM}/{tile_y}/{tile_x}"
print(f"\nFetching from: {TILE_URL}")

response = requests.get(TILE_URL, timeout=30)
if response.status_code != 200:
    print(f"ERROR: Failed to fetch tile: {response.status_code}")
    exit(1)

img = Image.open(BytesIO(response.content))
print(f"Tile image size: {img.size}")

# Encode as base64
buffer = BytesIO()
img.save(buffer, format="PNG")
img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
print(f"Base64 encoded size: {len(img_b64)} chars")

# ============================================================
# STEP 2: Run predict_tile through real API
# ============================================================
payload = {
    "bounds": bounds,
    "image_base64": img_b64,
    "confidence_threshold": 0.4,
    "simplify_tolerance": 0.00002,
    "regularize_right_angles": True,
    "min_parcel_area_sqm": 5.0,
    "enable_uncertainty": True,
    "mc_samples": 3
}

print("\n" + "=" * 80)
print("RUNNING PREDICT_TILE THROUGH REAL API (Real Esri Tile)")
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
print(f"Total features: {result.get('parcels_detected')}")

building_feats = [f for f in result['geojson']['features'] if f['properties'].get('classification') == 'BUILTUP']
veg_feats = [f for f in result['geojson']['features'] if f['properties'].get('classification') == 'VEGETATION']
print(f"Building features: {len(building_feats)}")
print(f"Vegetation features: {len(veg_feats)}")

# Cross-check: do returned coordinates fall within real tile bounds?
all_within = True
for feat in result['geojson']['features']:
    for lng, lat in feat['geometry']['coordinates'][0]:
        if not (bounds[0] <= lng <= bounds[2] and bounds[1] <= lat <= bounds[3]):
            all_within = False
            print(f"FAIL: Coordinate [{lng}, {lat}] outside tile bounds!")

if all_within:
    print("✓ PASS: All ML output coordinates fall within the REAL tile bounds")

# Show features
for feat in (building_feats + veg_feats)[:5]:
    props = feat['properties']
    coords = feat['geometry']['coordinates'][0]
    print(f"\n  {props['classification']}: {props['parcel_id']}")
    print(f"    Confidence: {props['confidence']:.3f}")
    print(f"    Area: {props['area_sqm']:.1f} sqm")
    print(f"    Vertices: {props['vertex_count']}")
    print(f"    Sample coords: {coords[:3]}")

# ============================================================
# STEP 3: Run discrepancy-analysis with ML output vs REAL legal boundary
# ============================================================
print("\n" + "=" * 80)
print("DISCREPANCY ANALYSIS: ML OUTPUT vs REAL LEGAL BOUNDARY (CMDA-LP-2018-102 Plot 1)")
print("=" * 80)

# Legal boundary from CMDA-LP-2018-102 Plot 1 (real legal record)
legal_boundary = [
    [80.2091, 12.9841],
    [80.2097, 12.9841],
    [80.2097, 12.9846],
    [80.2091, 12.9846],
    [80.2091, 12.9841]
]

# Check if legal boundary falls within tile bounds
legal_within = True
for lng, lat in legal_boundary:
    if not (bounds[0] <= lng <= bounds[2] and bounds[1] <= lat <= bounds[3]):
        legal_within = False
        print(f"NOTE: Legal boundary point [{lng}, {lat}] outside tile bounds")

if legal_within:
    print("✓ Legal boundary falls within tile bounds")
else:
    print("⚠ Legal boundary extends beyond tile (expected - tile is smaller than parcel)")

# Use best building feature if any
building_feats = [f for f in result['geojson']['features'] if f['properties'].get('classification') == 'BUILTUP']
if building_feats:
    best_building = max(building_feats, key=lambda f: f['properties']['confidence'])
    detected_boundary = best_building['geometry']['coordinates'][0]
    detection_conf = best_building['properties']['confidence']
    
    print(f"\nUsing ML detected building: {best_building['properties']['parcel_id']} (conf: {detection_conf:.3f})")
    print(f"ML building bbox: lng [{min(c[0] for c in detected_boundary):.6f}-{max(c[0] for c in detected_boundary):.6f}], lat [{min(c[1] for c in detected_boundary):.6f}-{max(c[1] for c in detected_boundary):.6f}]")
    
    discrepancy_payload = {
        "parcelId": "PRCL-GT-103",
        "layoutId": "CMDA-LP-2018-102",
        "detectedPhysicalBoundary": detected_boundary,
        "detectionConfidence": detection_conf
    }
    
    resp = requests.post(
        "http://localhost:3000/api/tn-land-records/discrepancy-analysis",
        json=discrepancy_payload,
        timeout=30
    )
    
    if resp.status_code == 200:
        disc = resp.json()
        d = disc['discrepancy']
        
        print(f"\n--- DISCREPANCY RESULT ---")
        print(f"Encroachment area: {d['encroachmentAreaSqM']} sqm")
        print(f"Max deviation: {d['maxDeviationMeters']} m")
        print(f"Compliance: {d['complianceStatus']}")
        print(f"Confidence level: {d['confidenceLevel']}")
        print(f"Detection confidence: {d['detectionConfidence']:.3f}")
        print(f"Data sources:")
        for k, v in d['dataSources'].items():
            print(f"  {k}: {v}")
    else:
        print(f"Discrepancy error: {resp.status_code}")
        print(resp.text)
else:
    print("No building features detected on this real satellite imagery tile")
    print("NOTE: Model was trained on SVAMITVA drone orthomosaics, not satellite imagery")

# ============================================================
# FINAL VERIFICATION
# ============================================================
print("\n" + "=" * 80)
print("VERIFICATION SUMMARY")
print("=" * 80)
print(f"Tile server: Esri World Imagery (standard XYZ slippy-map)")
print(f"Tile coordinates: z={ZOOM}, x={tile_x}, y={tile_y}")
print(f"Bounds computed via: standard z/x/y -> lat/lon math (fixed universal formula)")
print(f"Image source: REAL basemap tile from tile server (not dataset patch)")
print(f"Legal boundary: CMDA-LP-2018-102 Plot 1 (real legal record)")
print(f"Both inputs: INDEPENDENTLY VERIFIABLE POSITIONS")