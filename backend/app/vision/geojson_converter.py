"""
Pixel to Normalized GeoJSON Converter
Transforms raster pixel contours into valid geographic GeoJSON (Polygon, MultiPolygon)
features with affine calibration and coordinate reference transformations.
"""

from typing import List, Dict, Any, Tuple


class GeoJsonConverter:
    """
    Handles affine pixel-to-geocoordinate geotransformation and GeoJSON Feature generation.
    """

    def __init__(self, top_left: Tuple[float, float], bottom_right: Tuple[float, float], image_dims: Tuple[int, int]):
        """
        top_left: (lon, lat) of image top-left corner
        bottom_right: (lon, lat) of image bottom-right corner
        image_dims: (width, height) in pixels
        """
        self.min_lon = top_left[0]
        self.max_lat = top_left[1]
        self.max_lon = bottom_right[0]
        self.min_lat = bottom_right[1]

        self.width_px = image_dims[0]
        self.height_px = image_dims[1]

        self.lon_step = (self.max_lon - self.min_lon) / max(1, self.width_px)
        self.lat_step = (self.max_lat - self.min_lat) / max(1, self.height_px)

    def pixel_to_wgs84(self, px: float, py: float) -> Tuple[float, float]:
        """Maps raster (x, y) pixel coordinates to WGS84 (lon, lat)."""
        lon = self.min_lon + px * self.lon_step
        lat = self.max_lat - py * self.lat_step
        return (round(lon, 7), round(lat, 7))

    def convert_contour_to_geojson_polygon(
        self,
        pixel_ring: List[List[float]],
        properties: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Converts a single pixel contour into a valid GeoJSON Feature.
        """
        geo_coords: List[List[float]] = []
        for pt in pixel_ring:
            lon, lat = self.pixel_to_wgs84(pt[0], pt[1])
            geo_coords.append([lon, lat])

        # Ensure valid closed exterior linear ring
        if len(geo_coords) > 0 and geo_coords[0] != geo_coords[-1]:
            geo_coords.append(geo_coords[0])

        return {
            "type": "Feature",
            "properties": properties or {},
            "geometry": {
                "type": "Polygon",
                "coordinates": [geo_coords]
            }
        }

    def create_feature_collection(self, features: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Wraps GeoJSON polygon features into a standard FeatureCollection."""
        return {
            "type": "FeatureCollection",
            "crs": {
                "type": "name",
                "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": features
        }
