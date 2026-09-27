import asyncio
import httpx
import json
import math

async def test_overpass_simple():
    """Test Overpass API with very simple query"""
    
    # Very small test query
    query = """
    [out:json][timeout:10];
    way["highway"](12.98,80.21,12.99,80.22);
    out count;
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
                print(f"Response: {json.dumps(data, indent=2)}")
            else:
                print(f"Error: {response.text[:500]}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(test_overpass_simple())