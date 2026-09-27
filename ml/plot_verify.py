"""Visual sanity check, plotted directly in real lng/lat.

Fixed the previous attempt: tile row/column indices are now named
explicitly so a longitude-ish X index is never used as a row index.
Extent is derived from the z/x/y formula and handed to imshow, so every
polygon is drawn in the same lng/lat frame the API returned.
"""

import io
import math

import matplotlib
matplotlib.use("Agg")
import matplotlib.lines as mlines
import matplotlib.pyplot as plt
import requests
from PIL import Image

ZOOM = 19
PRED_COL, PRED_ROW = 378957, 243070   # the tile that was predicted
COL_W = PRED_COL - 1                    # west neighbour column
ROW_N = PRED_ROW - 1                    # north neighbour row
CACHE = "real_tile_b64.txt"


def tile_bounds(col, row, zoom):
    """Standard slippy-map formula -> [min_lon, min_lat, max_lon, max_lat]."""
    n = 2.0 ** zoom
    lon_w = col / n * 360.0 - 180.0
    lon_e = (col + 1) / n * 360.0 - 180.0
    lat_n = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * row / n))))
    lat_s = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (row + 1) / n))))
    return [lon_w, lat_s, lon_e, lat_n]


def fetch(col, row):
    # Esri tile endpoint is /tile/{z}/{row}/{col}
    u = (f"https://server.arcgisonline.com/ArcGIS/rest/services/"
         f"World_Imagery/MapServer/tile/{ZOOM}/{row}/{col}")
    return Image.open(io.BytesIO(requests.get(u, timeout=30).content)).convert("RGB")


# 2x2 mosaic: predicted tile is the SE quadrant.
# columns [COL_W, PRED_COL] x rows [ROW_N, PRED_ROW]
mosaic = Image.new("RGB", (512, 512))
mosaic.paste(fetch(COL_W, ROW_N), (0, 0))        # NW
mosaic.paste(fetch(PRED_COL, ROW_N), (256, 0))  # NE
mosaic.paste(fetch(COL_W, PRED_ROW), (0, 256))  # SW
mosaic.paste(fetch(PRED_COL, PRED_ROW), (256, 256))  # SE == predicted tile

b_sw = tile_bounds(COL_W, PRED_ROW, ZOOM)
b_nw = tile_bounds(COL_W, ROW_N, ZOOM)
b_se = tile_bounds(PRED_COL, PRED_ROW, ZOOM)
west, east = b_sw[0], b_se[2]
south, north = b_sw[1], b_nw[3]

pred = tile_bounds(PRED_COL, PRED_ROW, ZOOM)

with open(CACHE) as f:
    b64 = f.read().strip()
r = requests.post(
    "http://localhost:3000/api/ml/predict_tile",
    json={"bounds": pred, "image_base64": b64,
          "confidence_threshold": 0.4, "simplify_tolerance": 0.00002,
          "regularize_right_angles": True, "min_parcel_area_sqm": 5.0,
          "enable_uncertainty": True, "mc_samples": 3},
    timeout=180)
feats = r.json()["geojson"]["features"]

fig, ax = plt.subplots(figsize=(14, 14), dpi=110)
ax.imshow(mosaic, extent=[west, east, south, north], origin="upper")

ax.plot([pred[0], pred[2], pred[2], pred[0], pred[0]],
        [pred[1], pred[1], pred[3], pred[3], pred[1]],
        color="#00B0FF", lw=1.3, ls="--", alpha=0.95)

legal = [(80.2091, 12.9841), (80.2097, 12.9841), (80.2097, 12.9846),
         (80.2091, 12.9846), (80.2091, 12.9841)]
lx = [c[0] for c in legal]
ly = [c[1] for c in legal]
ax.fill(lx, ly, color="#FFD400", alpha=0.20)
ax.plot(lx, ly, color="#FFD400", lw=3.2)

nb = nv = 0
best = 0.0
for f in feats:
    ring = f["geometry"]["coordinates"][0]
    xs = [c[0] for c in ring]
    ys = [c[1] for c in ring]
    if f["properties"]["classification"] == "BUILTUP":
        nb += 1
        ax.fill(xs, ys, color="#00FF66", alpha=0.30)
        ax.plot(xs, ys, color="#00FF66", lw=1.5)
        best = max(best, f["properties"]["confidence"])
    else:
        nv += 1
        ax.fill(xs, ys, color="#FF3BD4", alpha=0.20)
        ax.plot(xs, ys, color="#FF3BD4", lw=1.3)

ax.legend(handles=[
    mlines.Line2D([], [], color="#FFD400", lw=3, label="LEGAL: CMDA-LP-2018-102 Plot 1"),
    mlines.Line2D([], [], color="#00B0FF", lw=1.3, ls="--", label="predicted tile extent"),
    mlines.Line2D([], [], color="#00FF66", lw=2, label=f"ML building polygons ({nb})"),
    mlines.Line2D([], [], color="#FF3BD4", lw=2, label=f"ML vegetation polygons ({nv})"),
], loc="upper left", fontsize=11, facecolor="#0b0f14", edgecolor="#666", labelcolor="#fff")

ax.set_xlim(west, east)
ax.set_ylim(south, north)
ax.set_xlabel("longitude (EPSG:4326)", color="#ddd")
ax.set_ylabel("latitude (EPSG:4326)", color="#ddd")
ax.tick_params(colors="#ddd")
ax.set_title(
    f"Real geolocation cross-check | Esri World Imagery z{ZOOM} | predicted tile col={PRED_COL} row={PRED_ROW}\n"
    f"predicted tile bounds = [{pred[0]:.7f}, {pred[1]:.7f}, {pred[2]:.7f}, {pred[3]:.7f}]  (z/x/y formula)\n"
    f"legal plot centroid (80.2094000, 12.9843500)   |   best ML building confidence {best:.4f}",
    fontsize=11, color="#fff", pad=14)

plt.tight_layout()
plt.savefig("verify_geolocation.png", facecolor="#0b0f14")
print("Saved verify_geolocation.png")
print(f"predicted tile bounds lng [{pred[0]:.7f}, {pred[2]:.7f}] lat [{pred[1]:.7f}, {pred[3]:.7f}]")
print(f"mosaic extent      lng [{west:.7f}, {east:.7f}] lat [{south:.7f}, {north:.7f}]")
print(f"legal plot         lng [80.2091000, 80.2097000] lat [12.9841000, 12.9846000]")
print(f"buildings={nb} vegetation={nv}")
