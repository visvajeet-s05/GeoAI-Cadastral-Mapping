import requests
import json

# Test discrepancy with actual Velachery parcel data
resp = requests.get("http://localhost:3000/api/parcels")
parcels = resp.json()
print(f"Parcels type: {type(parcels)}")
print(f"Keys: {parcels.keys() if isinstance(parcels, dict) else 'N/A'}")
if isinstance(parcels, list):
    print(f"List length: {len(parcels)}")
    if parcels:
        print(f"First item type: {type(parcels[0])}")
        print(f"First item: {parcels[0]}")
elif isinstance(parcels, dict):
    print(f"Dict keys: {list(parcels.keys())[:10]}")