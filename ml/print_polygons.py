import requests
import json

# Get the parcel data (detected building footprint)
resp = requests.get("http://localhost:3000/api/parcels")
data = resp.json()
parcels = data.get('parcels', [])

target_parcel = None
for p in parcels:
    if p.get('id') == 'PRCL-GT-103':
        target_parcel = p
        break

if target_parcel and 'buildingFootprint' in target_parcel:
    detected_boundary = target_parcel['buildingFootprint']
    
    # Compute centroid of detected boundary
    lats = [c[1] for c in detected_boundary]
    lngs = [c[0] for c in detected_boundary]
    centroid_detected = [sum(lngs)/len(lngs), sum(lats)/len(lats)]
    bbox_detected = [min(lngs), min(lats), max(lngs), max(lats)]
    
    print("=" * 80)
    print("DETECTED BUILDING FOOTPRINT (from ML model, after pixel-to-geo transform)")
    print("=" * 80)
    print(f"CRS: EPSG:4326 (WGS84 lat/lng)")
    print(f"Vertex count: {len(detected_boundary)}")
    print(f"Centroid (lng, lat): [{centroid_detected[0]:.8f}, {centroid_detected[1]:.8f}]")
    print(f"Bounding Box (min_lng, min_lat, max_lng, max_lat):")
    print(f"  min_lng: {bbox_detected[0]:.8f}")
    print(f"  min_lat: {bbox_detected[1]:.8f}")
    print(f"  max_lng: {bbox_detected[2]:.8f}")
    print(f"  max_lat: {bbox_detected[3]:.8f}")
    print()
    print("All vertices (lng, lat):")
    for i, (lng, lat) in enumerate(detected_boundary):
        print(f"  {i}: [{lng:.8f}, {lat:.8f}]")
    
    # Now get the legal boundary from CMDA-LP-2018-102
    print("\n" + "=" * 80)
    print("LEGAL BOUNDARY (CMDA-LP-2018-102, Plot 1)")
    print("=" * 80)
    
    # The layout has multiple legal boundaries; Plot 1 is the first one
    legal_coords = [
        [80.2091, 12.9841],
        [80.2097, 12.9841],
        [80.2097, 12.9846],
        [80.2091, 12.9846],
        [80.2091, 12.9841]
    ]
    
    lats = [c[1] for c in legal_coords]
    lngs = [c[0] for c in legal_coords]
    centroid_legal = [sum(lngs)/len(lngs), sum(lats)/len(lats)]
    bbox_legal = [min(lngs), min(lats), max(lngs), max(lats)]
    
    print(f"CRS: EPSG:4326 (WGS84 lat/lng)")
    print(f"Vertex count: {len(legal_coords)}")
    print(f"Centroid (lng, lat): [{centroid_legal[0]:.8f}, {centroid_legal[1]:.8f}]")
    print(f"Bounding Box (min_lng, min_lat, max_lng, max_lat):")
    print(f"  min_lng: {bbox_legal[0]:.8f}")
    print(f"  min_lat: {bbox_legal[1]:.8f}")
    print(f"  max_lng: {bbox_legal[2]:.8f}")
    print(f"  max_lat: {bbox_legal[3]:.8f}")
    print()
    print("All vertices (lng, lat):")
    for i, (lng, lat) in enumerate(legal_coords):
        print(f"  {i}: [{lng:.8f}, {lat:.8f}]")
    
    # Side-by-side comparison
    print("\n" + "=" * 80)
    print("SIDE-BY-SIDE COMPARISON")
    print("=" * 80)
    print(f"{'Metric':<30} {'Detected (ML)':<25} {'Legal (CMDA Plot 1)':<25}")
    print("-" * 80)
    print(f"{'Centroid (lng, lat)':<30} [{centroid_detected[0]:.6f}, {centroid_detected[1]:.6f}]  [{centroid_legal[0]:.6f}, {centroid_legal[1]:.6f}]")
    print(f"{'BBox min_lng':<30} {bbox_detected[0]:.6f}                      {bbox_legal[0]:.6f}")
    print(f"{'BBox min_lat':<30} {bbox_detected[1]:.6f}                      {bbox_legal[1]:.6f}")
    print(f"{'BBox max_lng':<30} {bbox_detected[2]:.6f}                      {bbox_legal[2]:.6f}")
    print(f"{'BBox max_lat':<30} {bbox_detected[3]:.6f}                      {bbox_legal[3]:.6f}")
    print(f"{'Vertex count':<30} {len(detected_boundary)}                            {len(legal_coords)}")
    print(f"{'Area (approx sqm)':<30} ~177                          3080")
    print()
    print("NOTE: The detected building footprint is a SMALLER polygon (individual building)")
    print("      inside the LARGER legal parcel boundary (Plot 1). This is expected.")
    print("      Discrepancy analysis computes E = B_detected \\ L_legal = encroachment area")

else:
    print("Parcel not found")