import requests
import json

resp = requests.get("http://localhost:3000/api/parcels")
data = resp.json()
parcels = data.get('parcels', [])

# Print all parcels with their layout info
for p in parcels:
    print(f"Parcel: {p['id']}, Survey: {p.get('surveyNumber')}, Village: {p.get('village')}, Taluk: {p.get('taluk')}, District: {p.get('district')}")
    if 'buildingFootprint' in p:
        print(f"  Has building footprint: {len(p['buildingFootprint'])} vertices")