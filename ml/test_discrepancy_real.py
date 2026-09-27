import requests
import json

resp = requests.get("http://localhost:3000/api/parcels")
data = resp.json()
parcels = data.get('parcels', [])

print(f"Total parcels: {len(parcels)}")

# Find PRCL-GT-103
target_parcel = None
for p in parcels:
    if p.get('id') == 'PRCL-GT-103':
        target_parcel = p
        break

if target_parcel and 'buildingFootprint' in target_parcel:
    print(f"Found parcel: {target_parcel['id']}")
    print(f"Building footprint vertices: {len(target_parcel['buildingFootprint'])}")
    print(f"Sample coords: {target_parcel['buildingFootprint'][:3]}")
    
    # Use building footprint as detected boundary
    detected_boundary = target_parcel['buildingFootprint']
    
    discrepancy_payload = {
        "parcelId": "PRCL-GT-103",
        "layoutId": "TN-FMB-2022-89",
        "detectedPhysicalBoundary": detected_boundary,
        "detectionConfidence": 0.85
    }
    
    resp = requests.post("http://localhost:3000/api/tn-land-records/discrepancy-analysis", 
                        json=discrepancy_payload, timeout=30)
    
    print(f"Discrepancy status: {resp.status_code}")
    if resp.status_code == 200:
        disc = resp.json()
        d = disc['discrepancy']
        print(f"Encroachment area: {d['encroachmentAreaSqM']} sqm")
        print(f"Max deviation: {d['maxDeviationMeters']} m")
        print(f"Compliance: {d['complianceStatus']}")
        print(f"Confidence level: {d['confidenceLevel']}")
        print(f"Data sources: {json.dumps(d['dataSources'], indent=2)}")
    else:
        print(f"Error: {resp.text}")
else:
    print("Parcel not found or no building footprint")