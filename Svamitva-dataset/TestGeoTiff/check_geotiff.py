import rasterio

for f in ['amora.tif', 'guha.tif', 'lalpur.tif', 'uplarshi.tif']:
    with rasterio.open(f) as ds:
        print(f'{f}:')
        print(f'  bounds: {ds.bounds}')
        print(f'  crs: {ds.crs}')
        print(f'  size: {ds.width}x{ds.height}')
        print()