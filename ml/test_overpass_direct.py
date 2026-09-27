import asyncio
import httpx
import json
import math

async def test_overpass_direct():
    """Test Overpass API directly for Velachery AOI"""
    
    # Velachery bounding box (reasonable size)
    min_lon, min_lat, max_lon, max_lat = 80.20, 12.97, 80.22, 12.99
    
    query = f"""
    [out:json][timeout:25];
    (
      way["highway"]({min_lat},{min_lon},{max_lat},{max_lon});
      relation["highway"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out body;
    >;
    out skel qt;
    """
    
    OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json",
                    "User-Agent": "GeoTrace-AI/1.0"
                }
            )
            
            print(f"Status: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                
                # Process elements
                nodes = {}
                ways = []
                
                for element in data.get('elements', []):
                    if element['type'] == 'node' and 'lat' in element and 'lon' in element:
                        nodes[element['id']] = {'lat': element['lat'], 'lon': element['lon']}
                    elif element['type'] == 'way' and 'nodes' in element and 'tags' in element:
                        coords = []
                        for node_id in element['nodes']:
                            if node_id in nodes:
                                node = nodes[node_id]
                                coords.append([node['lon'], node['lat']])
                        
                        if len(coords) >= 2:
                            # Calculate length
                            length = 0
                            for i in range(len(coords) - 1):
                                lon1, lat1 = coords[i]
                                lon2, lat2 = coords[i + 1]
                                R = 6371000
                                dLat = (lat2 - lat1) * math.pi / 180
                                dLon = (lon2 - lon1) * math.pi / 180
                                a = math.sin(dLat/2)**2 + math.cos(lat1 * math.pi/180) * math.cos(lat2 * math.pi/180) * math.sin(dLon/2)**2
                                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                                length += R * c
                            
                            ways.append({
                                'id': element['id'],
                                'highway': element['tags'].get('highway', 'unknown'),
                                'name': element['tags'].get('name', ''),
                                'length_m': round(length),
                                'coords': coords
                            })
                
                print(f"Total roads found: {len(ways)}")
                if ways:
                    total_length = sum(w['length_m'] for w in ways)
                    print(f"Total length: {total_length} m")
                    
                    # Count highway types
                    highway_types = {}
                    for w in ways:
                        hw = w['highway']
                        highway_types[hw] = highway_types.get(hw, 0) + 1
                    print(f"Highway types: {highway_types}")
                    
                    print(f"\nFirst 3 roads:")
                    for i, w in enumerate(ways[:3]):
                        print(f"  {i+1}. highway={w['highway']}, name='{w['name']}', length={w['length_m']}m")
                        print(f"      First 3 coords: {w['coords'][:3]}")
                else:
                    print("No roads found in this bbox")
            else:
                print(f"Error: {response.text[:500]}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(test_overpass_direct())