import requests
import json

# Check available layouts
resp = requests.get("http://localhost:3000/api/tn-land-records/layouts")
layouts = resp.json()
print(f"Layouts: {json.dumps(layouts, indent=2)}")