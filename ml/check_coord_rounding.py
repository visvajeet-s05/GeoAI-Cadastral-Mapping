"""Quantify whether the out-of-bounds coordinates are a real georeferencing bug
or a floating-point rounding artifact in the bounds check itself."""

import math

# Tile bounds computed from slippy-map formula (z=19, x=378957, y=243070)
n = 2.0 ** 19
x, y = 378957, 243070

lon1 = x / n * 360.0 - 180.0
lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
lon2 = (x + 1) / n * 360.0 - 180.0
lat2 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))

bounds = [min(lon1, lon2), min(lat1, lat2), max(lon1, lon2), max(lat1, lat2)]
print("Unrounded tile bounds (full float64 precision):")
for name, v in zip(["min_lng", "min_lat", "max_lng", "max_lat"], bounds):
    print(f"  {name}: {v!r}")

print("\nRounded to 7 decimals (what pixel_to_geographic emits):")
for name, v in zip(["min_lng", "min_lat", "max_lng", "max_lat"], bounds):
    print(f"  {name}: {round(v, 7)}")

# The coordinates the API actually returned
returned = [
    (80.2091217, 12.9841749),
    (80.2091217, 12.9840233),
    (80.2095039, 12.9844859),
    (80.2091955, 12.9844859),
]

print("\nDelta of each 'failing' coordinate vs the exact tile edge:")
for lng, lat in returned:
    d_lng_min = lng - bounds[0]
    d_lat_max = lat - bounds[3]
    print(f"  [{lng}, {lat}]")
    print(f"    lng - min_lng = {d_lng_min:+.3e} deg  ({d_lng_min * 111320 * math.cos(math.radians(lat)) * 1000:+.4f} mm)")
    print(f"    lat - max_lat = {d_lat_max:+.3e} deg  ({d_lat_max * 111132 * 1000:+.4f} mm)")

print("\nInterpretation:")
print("  The API rounds coordinates to 7 decimal places (pixel_to_geographic).")
print("  Tile bounds are float64 and NOT rounded in the check.")
print("  1e-7 deg ~= 1.1 cm at this latitude, so rounding can push a")
print("  boundary-exact coordinate up to ~1 cm outside the unrounded box.")
print("  A coordinate sitting exactly on the tile edge is CORRECT, not an error.")
