import requests
import base64
from PIL import Image
from io import BytesIO

# Test with a lower confidence threshold and check the raw model output
VELACHERY_LAT = 12.9839
VELACHERY_LNG = 80.2089

def latlng_to_tile(lat: float, lng: float, zoom: int):
    import math
    n = 2.0 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return x, y

def tile_to_bounds(x: int, y: int, zoom: int):
    import math
    n = 2.0 ** zoom
    lon1 = x / n * 360.0 - 180.0
    lat1_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat1 = math.degrees(lat1_rad)
    lon2 = (x + 1) / n * 360.0 - 180.0
    lat2_rad = math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n)))
    lat2 = math.degrees(lat2_rad)
    return [min(lon1, lon2), min(lat1, lat2), max(lon1, lon2), max(lat1, lat2)]

# Test multiple tiles around Velachery
ZOOM = 19
tile_x, tile_y = latlng_to_tile(12.9839, 80.2089, ZOOM)

# Test the exact tile and neighbors
test_tiles = [
    (tile_x, tile_y),      # center
    (tile_x - 1, tile_y),  # west
    (tile_x + 1, tile_y),  # east
    (tile_x, tile_y - 1),  # north
    (tile_x, tile_y + 1),  # south
]

for tx, ty in test_tiles:
    bounds = tile_to_bounds(tx, ty, ZOOM)
    print(f"Tile ({tx}, {ty}): bounds={bounds}")

# Test with lower confidence threshold
import requests
import base64
from PIL import Image
from io import BytesIO

# Fetch the center tile
TILE_URL = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{ZOOM}/{tile_y}/{tile_x}"
response = requests.get(TILE_URL, timeout=30)
img = Image.open(BytesIO(response.content))
buffer = BytesIO()
img.save(buffer, format="PNG")
img_b64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

bounds = tile_to_bounds(tile_x, tile_y, ZOOM)

# Test with very low confidence threshold
for conf in [0.2, 0.3, 0.4, 0.5]:
    payload = {
        "bounds": bounds,
        "image_base64": base64.b64encode(open(f"D:/Projects/Cadastral-Mapping/Svamitva-dataset/FilteredData/Images/patch_500.png", "rb").read()).decode('utf-8'),
        "confidence_threshold": conf,
        "simplify_tolerance": 0.00002,
        "regularize_right_angles": True,
        "min_parcel_area_sqm": 5.0,
        "enable_uncertainty": True,
        "mc_samples": 3
    }
    
    resp = requests.post("http://localhost:3000/api/ml/predict_tile", json=payload, timeout=60)
    if resp.status_code == 200:
        r = resp.json()
        building_count = sum(1 for f in r['geojson']['features'] if f['properties'].get('classification') == 'BUILTUP')
        veg_count = sum(1 for f in r['geojson']['features'] if f['properties'].get('classification') == 'VEGETATION')
        print(f"Conf {conf}: buildings={building_count}, veg={veg_count}")