import requests
import json

# Test 1: Health check
print("=== Health Check ===")
r = requests.get("http://localhost:3000/api/ml/health")
print(f"Status: {r.status_code}")
print(f"Response: {r.json()}")

# Test 2: Discrepancy analysis
print("\n=== Discrepancy Analysis ===")
data = {
    "parcelId": "PRCL-GT-103",
    "layoutId": "TN-FMB-2022-89",
    "detectedPhysicalBoundary": [[80.0188, 12.8705], [80.0195, 12.8705], [80.0195, 12.8712], [80.0188, 12.8712], [80.0188, 12.8705]],
    "detectionConfidence": 0.85
}
r = requests.post("http://localhost:3000/api/tn-land-records/discrepancy-analysis", json=data)
print(f"Status: {r.status_code}")
print(f"Response: {json.dumps(r.json(), indent=2)}")

# Test 3: OSM Roads
print("\n=== OSM Roads ===")
r = requests.get("http://localhost:3000/api/osm/roads?bbox=80.20,12.97,80.22,12.99")
print(f"Status: {r.status_code}")
print(f"Response: {json.dumps(r.json(), indent=2)[:1000]}")

# Test 4: Parcels list
print("\n=== Parcels List ===")
r = requests.get("http://localhost:3000/api/parcels")
print(f"Status: {r.status_code}")
print(f"Count: {len(r.json()) if isinstance(r.json(), list) else 'N/A'}")