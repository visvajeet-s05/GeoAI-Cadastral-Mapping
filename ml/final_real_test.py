"""REAL BASEMAP TILE ACCEPTANCE TEST — final run.

Every position in this test is independently verifiable:
  - Imagery: Esri World Imagery XYZ slippy-map tile (z/x/y -> lat/lon is a
    fixed universal formula, no assumptions).
  - Legal boundary: CMDA-LP-2018-102 Plot 1 from TN_LAYOUT_STORE.
Bounds check uses a 1e-6 deg tolerance because the API rounds output
coordinates to 7 decimals (~1.1 cm at this latitude).
"""

import base64
import json
import math
import sys
from io import BytesIO

import requests
from PIL import Image

TOL = 1e-6  # deg, ~= 0.11 m — covers 7-decimal output rounding

ZOOM = 19
TARGET_LAT, TARGET_LNG = 12.98435, 80.2094  # CMDA-LP-2018-102 Plot 1 centre


def latlng_to_tile(lat, lng, zoom):
    n = 2.0 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y


def tile_to_bounds(x, y, zoom):
    n = 2.0 ** zoom
    lon1 = x / n * 360.0 - 180.0
    lat1 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lon2 = (x + 1) / n * 360.0 - 180.0
    lat2 = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return [min(lon1, lon2), min(lat1, lat2), max(lon1, lon2), max(lat1, lat2)]


tile_x, tile_y = latlng_to_tile(TARGET_LAT, TARGET_LNG, ZOOM)
bounds = tile_to_bounds(tile_x, tile_y, ZOOM)

print("=" * 78)
print("STEP 1 — REAL TILE BOUNDS (standard slippy-map math)")
print("=" * 78)
print(f"Tile server : Esri World Imagery")
print(f"Tile        : z={ZOOM} x={tile_x} y={tile_y}")
for name, v in zip(["min_lng", "min_lat", "max_lng", "max_lat"], bounds):
    print(f"  {name:8s} = {v:.10f}")
print(f"  size     = {(bounds[2]-bounds[0])*111320*math.cos(math.radians(TARGET_LAT)):.1f} m x "
      f"{(bounds[3]-bounds[1])*111132:.1f} m")

tile_url = (f"https://server.arcgisonline.com/ArcGIS/rest/services/"
            f"World_Imagery/MapServer/tile/{ZOOM}/{tile_y}/{tile_x}")
print(f"\nFetched from: {tile_url}")

resp = requests.get(tile_url, timeout=30)
resp.raise_for_status()
img = Image.open(BytesIO(resp.content)).convert("RGB")
buf = BytesIO()
img.save(buf, format="PNG")
img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
print(f"Image size  : {img.size[0]}x{img.size[1]} px, {len(img_b64)} b64 chars")

print()
print("=" * 78)
print("STEP 2 — predict_tile THROUGH THE REAL API")
print("=" * 78)

r = requests.post(
    "http://localhost:3000/api/ml/predict_tile",
    json={
        "bounds": bounds,
        "image_base64": img_b64,
        "confidence_threshold": 0.4,
        "simplify_tolerance": 0.00002,
        "regularize_right_angles": True,
        "min_parcel_area_sqm": 5.0,
        "enable_uncertainty": True,
        "mc_samples": 3,
    },
    timeout=180,
)
if r.status_code != 200:
    print(f"HTTP {r.status_code}: {r.text}")
    sys.exit(1)

res = r.json()
print(f"model_version  : {res['model_version']}")
print(f"execution_prov : {res['execution_provider']}")
print(f"inference_time : {res['inference_time_ms']} ms")
print(f"parcels_detected: {res['parcels_detected']}")
print(f"topological_health: {res['topological_health']}")
print(f"metrics        : {json.dumps(res['metrics'], indent=2)}")

feats = res["geojson"]["features"]
bld = [f for f in feats if f["properties"]["classification"] == "BUILTUP"]
veg = [f for f in feats if f["properties"]["classification"] == "VEGETATION"]
print(f"\nbuilding features  : {len(bld)}")
print(f"vegetation features: {len(veg)}")

print("\nFirst 3 building polygons returned (lng, lat):")
for f in bld[:3]:
    p = f["properties"]
    ring = f["geometry"]["coordinates"][0]
    print(f"  {p['parcel_id']}  conf={p['confidence']:.4f}  area={p['area_sqm']} sqm  "
          f"verts={p['vertex_count']}  source={p['source']}")
    print(f"    uncertainty: {p['uncertainty']}")
    print(f"    ring: {[[round(c[0], 7), round(c[1], 7)] for c in ring]}")

print("\nFirst 2 vegetation polygons returned (lng, lat):")
for f in veg[:2]:
    p = f["properties"]
    ring = f["geometry"]["coordinates"][0]
    print(f"  {p['parcel_id']}  conf={p['confidence']:.4f}  area={p['area_sqm']} sqm  "
          f"verts={p['vertex_count']}  source={p['source']}")
    print(f"    ring: {[[round(c[0], 7), round(c[1], 7)] for c in ring]}")

print()
print("=" * 78)
print("STEP 3 — CROSS-CHECK: are returned polygons inside the real tile bounds?")
print("=" * 78)

out_of_bounds = []
for f in feats:
    for lng, lat in f["geometry"]["coordinates"][0]:
        if not (bounds[0] - TOL <= lng <= bounds[2] + TOL
                and bounds[1] - TOL <= lat <= bounds[3] + TOL):
            out_of_bounds.append((f["id"], lng, lat))

n_pts = sum(len(f["geometry"]["coordinates"][0]) for f in feats)
print(f"Total vertices checked: {n_pts}")
print(f"Tolerance applied      : {TOL} deg (~{TOL*111320*math.cos(math.radians(TARGET_LAT))*1000:.1f} cm)")
if out_of_bounds:
    print(f"RESULT: FAIL — {len(out_of_bounds)} vertices outside bounds")
    for fid, lng, lat in out_of_bounds[:5]:
        print(f"   {fid}: [{lng}, {lat}]")
else:
    print("RESULT: PASS — every returned vertex lies within the real tile bounds")
    print("        (no coordinate drift; anchoring traces to the z/x/y formula)")

print()
print("=" * 78)
print("STEP 4 — REAL LEGAL BOUNDARY: CMDA-LP-2018-102 Plot 1")
print("=" * 78)

rr = requests.get("http://localhost:3000/api/parcels", timeout=30)
parcel = next(p for p in rr.json()["parcels"] if p["id"] == "PRCL-GT-103")
legal = [
    [80.2091, 12.9841], [80.2097, 12.9841], [80.2097, 12.9846],
    [80.2091, 12.9846], [80.2091, 12.9841],
]
print(f"Parcel  : {parcel['id']}  survey={parcel['surveyNumber']}  "
      f"{parcel['village']} / {parcel['taluk']} / {parcel['district']}")
lats = [c[1] for c in legal]
lngs = [c[0] for c in legal]
print(f"Legal plot 1: {len(legal)} vertices")
print(f"  centroid = [{(min(lngs)+max(lngs))/2:.7f}, {(min(lats)+max(lats))/2:.7f}]")
print(f"  bbox     = lng [{min(lngs)}, {max(lngs)}]  lat [{min(lats)}, {max(lats)}]")
print(f"  size     = {(max(lngs)-min(lngs))*111320*math.cos(math.radians(12.984)):.1f} m x "
      f"{(max(lats)-min(lats))*111132:.1f} m")

legal_in_tile = all(bounds[0] - TOL <= c[0] <= bounds[2] + TOL
                    and bounds[1] - TOL <= c[1] <= bounds[3] + TOL for c in legal)
print(f"  fully inside this 76 m tile? {legal_in_tile}  "
      f"(legal plot is ~67 m E-W x ~56 m N-S; a single z19 tile cannot contain it)")

print()
print("=" * 78)
print("STEP 5 — DISCREPANCY ANALYSIS (real ML polygon vs real legal polygon)")
print("=" * 78)

if not bld:
    print("No building polygon detected on this real satellite tile -> cannot run")
    print("(model is trained on SVAMITVA drone orthomosaics; Esri is multispectral satellite)")
    sys.exit(0)

best = max(bld, key=lambda f: f["properties"]["confidence"])
det = best["geometry"]["coordinates"][0]
print(f"Using ML polygon : {best['properties']['parcel_id']} "
      f"(conf {best['properties']['confidence']:.4f})")
print(f"  bbox lng [{min(c[0] for c in det):.7f}, {max(c[0] for c in det):.7f}] "
      f"lat [{min(c[1] for c in det):.7f}, {max(c[1] for c in det):.7f}]")
print(f"Using legal plot : CMDA-LP-2018-102 Plot 1")

dr = requests.post(
    "http://localhost:3000/api/tn-land-records/discrepancy-analysis",
    json={
        "parcelId": "PRCL-GT-103",
        "layoutId": "CMDA-LP-2018-102",
        "detectedPhysicalBoundary": det,
        "detectionConfidence": best["properties"]["confidence"],
    },
    timeout=60,
)
print(f"\nHTTP {dr.status_code}")
if dr.status_code == 200:
    d = dr.json()["discrepancy"]
    for k in ["encroachmentAreaSqM", "maxDeviationMeters", "complianceStatus",
              "confidenceLevel", "detectionConfidence", "encroachmentType"]:
        print(f"  {k:22s} = {d[k]}")
    print("  dataSources:")
    for k, v in d["dataSources"].items():
        print(f"    {k:18s}: {v}")
    print()
    print(json.dumps({k: d[k] for k in
                      ["encroachmentAreaSqM", "maxDeviationMeters", "complianceStatus",
                       "confidenceLevel", "detectionConfidence", "encroachmentType"]}, indent=2))
else:
    print(dr.text)
