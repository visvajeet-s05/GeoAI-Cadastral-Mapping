"""Cache the real Esri tile as base64 so the plot script and the test use
byte-identical imagery."""
import base64
import io
import requests
from PIL import Image

ZOOM, TX, TY = 19, 378957, 243070
url = (f"https://server.arcgisonline.com/ArcGIS/rest/services/"
       f"World_Imagery/MapServer/tile/{ZOOM}/{TY}/{TX}")
img = Image.open(io.BytesIO(requests.get(url, timeout=30).content)).convert("RGB")
buf = io.BytesIO()
img.save(buf, format="PNG")
with open("real_tile_b64.txt", "w") as f:
    f.write(base64.b64encode(buf.getvalue()).decode("utf-8"))
print("cached", img.size, "->", len(buf.getvalue()), "bytes")
