import requests
import base64

# Select a tile that fully covers the CMDA-LP-2018-102 Plot 1 legal boundary
# Legal boundary: lng 80.2091-80.2097, lat 12.9841-12.9846
# Use tile at zoom 19 that covers this area

import math

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

# Find tile that covers the legal boundary center
center_lat = (12.9841 + 12.9846) / 2  # 12.98435
center_lng = (80.2091 + 80.2097) / 2  # 80.2094
ZOOM = 19

tile_x, tile_y = latlng_to_tile(center_lat, center_lng, ZOOM)
bounds = tile_to_bounds(tile_x, tile_y, ZOOM)

print(f"Selected tile: ({tile_x}, {tile_y}, z={ZOOM})")
print(f"Tile bounds: {bounds}")

# Verify legal boundary falls within
legal_boundary = [
    [80.2091, 12.9841],
    [80.2097, 12.9841],
    [80.2097, 12.9846],
    [80.2091, 12.9846],
    [80.2091, 12.9841]
]

print("\nLegal boundary check:")
for lng, lat in legal_boundary:
    within = bounds[0] <= lng <= bounds[2] and bounds[1] <= lat <= bounds[3]
    status = "IN" if within else "OUT"
    print(f"  [{lng}, {lat}]: {status}")