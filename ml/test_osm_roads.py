import asyncio
import httpx

async def test_osm_roads():
    # Start server in background
    import subprocess
    import sys
    import os
    
    server_proc = subprocess.Popen([
        sys.executable, "server.ts"
    ], cwd="D:\\Projects\\Cadastral-Mapping")
    
    # Wait for server to start
    await asyncio.sleep(5)
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Test Velachery AOI bbox
            # Velachery approx: 12.98, 80.21
            bbox = "80.20,12.97,80.22,12.99"
            response = await client.get(f"http://localhost:3000/api/osm/roads?bbox={bbox}")
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                print(f"Success: {data['success']}")
                if data['success']:
                    geo = data['data']
                    print(f"Road count: {geo['metadata']['total_roads']}")
                    print(f"Total length: {geo['metadata']['total_length_m']} m")
                    print(f"Highway types: {geo['metadata']['highway_types']}")
                    print(f"\nFirst 3 roads:")
                    for i, feat in enumerate(geo['features'][:3]):
                        print(f"  {i+1}. {feat['properties']['highway']} - {feat['properties']['name'] or 'unnamed'} - {feat['properties']['length_m']}m")
                        print(f"      Geometry (first 3 coords): {feat['geometry']['coordinates'][:3]}")
                else:
                    print(f"Error: {data}")
            else:
                print(f"Error: {response.text}")
    finally:
        server_proc.terminate()

asyncio.run(test_osm_roads())