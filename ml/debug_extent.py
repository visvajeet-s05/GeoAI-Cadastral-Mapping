import math

ZOOM, TX, TY = 19, 378957, 243070


def tile_to_bounds(x, y, zoom):
    n = 2.0 ** zoom
    lon1 = x / n * 360.0 - 180.0
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lon2 = (x + 1) / n * 360.0 - 180.0
    lat2 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return [min(lon1, lon2), min(lat1, lat2), max(lon1, lon2), max(lat1, lat2)]


W, N, C = TX - 1, TY - 1, TX
print("tile            min_lon        min_lat        max_lon        max_lat")
for name, (x, y) in [("NW (W,N)", (W, N)), ("NE (C,N)", (C, N)),
                     ("SW (W,C)", (W, C)), ("SE (C,C)", (C, C))]:
    b = tile_to_bounds(x, y, ZOOM)
    print(f"{name:10s} {b[0]:14.8f} {b[1]:14.8f} {b[2]:14.8f} {b[3]:14.8f}")

west = tile_to_bounds(W, C, ZOOM)[0]
east = tile_to_bounds(C, C, ZOOM)[2]
south = tile_to_bounds(W, C, ZOOM)[1]
north = tile_to_bounds(W, N, ZOOM)[3]
print()
print(f"west  = {west}")
print(f"east  = {east}")
print(f"south = {south}")
print(f"north = {north}")
