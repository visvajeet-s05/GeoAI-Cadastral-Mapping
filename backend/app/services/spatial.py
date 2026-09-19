"""
Module 2: Study-Area and Coordinate Setup
Enforces spatial alignment across heterogeneous datasets by reprojecting 
all layers to a uniform metric Projected Coordinate Reference System (PCRS).
"""

import json
from typing import Dict, Any, Tuple, List, Optional
from dataclasses import dataclass
import numpy as np

try:
    from pyproj import CRS, Transformer
    import geopandas as gpd
    import rasterio
    from rasterio.warp import calculate_default_transform, reproject, Resampling
    HAS_SPATIAL_LIBS = True
except ImportError:
    HAS_SPATIAL_LIBS = False
    print("WARNING: pyproj, geopandas, or rasterio not installed. CRS reprojection will use simplified methods.")


@dataclass
class BoundingBox:
    """Represents a spatial bounding box."""
    min_x: float
    min_y: float
    max_x: float
    max_y: float
    crs: str = "EPSG:4326"  # Default to WGS84
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "min_x": self.min_x,
            "min_y": self.min_y,
            "max_x": self.max_x,
            "max_y": self.max_y,
            "crs": self.crs
        }
    
    def to_geojson(self) -> Dict[str, Any]:
        """Convert to GeoJSON polygon."""
        return {
            "type": "Feature",
            "properties": {"crs": self.crs},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [self.min_x, self.min_y],
                    [self.max_x, self.min_y],
                    [self.max_x, self.max_y],
                    [self.min_x, self.max_y],
                    [self.min_x, self.min_y]
                ]]
            }
        }


class SpatialCoordinateManager:
    """
    Manages coordinate reference system transformations and spatial extent
    management for heterogeneous datasets.
    """
    
    # Target CRS for Tamil Nadu cadastral work (UTM Zone 43N/44N)
    TARGET_CRS_OPTIONS = ["EPSG:32643", "EPSG:32644"]  # UTM Zone 43N, 44N
    DEFAULT_TARGET_CRS = "EPSG:32643"  # UTM Zone 43N
    
    def __init__(self, target_crs: str = DEFAULT_TARGET_CRS):
        self.target_crs = target_crs
        self.transformers = {}
        
        if HAS_SPATIAL_LIBS:
            # Initialize common transformers
            self._initialize_transformers()
    
    def _initialize_transformers(self):
        """Initialize coordinate transformers for common CRS conversions."""
        common_crs = ["EPSG:4326", "EPSG:3857", "EPSG:32643", "EPSG:32644"]
        
        for crs in common_crs:
            if crs != self.target_crs:
                try:
                    self.transformers[crs] = Transformer.from_crs(
                        crs, self.target_crs, always_xy=True
                    )
                except Exception as e:
                    print(f"Warning: Could not initialize transformer from {crs} to {self.target_crs}: {e}")
    
    def detect_crs_from_header(self, spatial_header: Dict[str, Any]) -> str:
        """
        Detects CRS from spatial file headers.
        
        Args:
            spatial_header: Dictionary containing spatial metadata
            
        Returns:
            EPSG code string
        """
        # Check for explicit EPSG code
        if "epsg" in spatial_header:
            return f"EPSG:{spatial_header['epsg']}"
        
        if "crs" in spatial_header:
            crs_str = spatial_header["crs"]
            if isinstance(crs_str, str) and crs_str.startswith("EPSG:"):
                return crs_str
        
        # Check for WKT
        if "wkt" in spatial_header:
            # Parse WKT to extract EPSG (simplified)
            if "WGS 84" in spatial_header["wkt"]:
                return "EPSG:4326"
            if "Web Mercator" in spatial_header["wkt"]:
                return "EPSG:3857"
        
        # Default to WGS84
        return "EPSG:4326"
    
    def transform_coordinates(
        self, 
        lon: float, 
        lat: float, 
        source_crs: str = "EPSG:4326"
    ) -> Tuple[float, float]:
        """
        Transforms coordinates from source CRS to target CRS.
        
        Args:
            lon: Longitude or X coordinate
            lat: Latitude or Y coordinate
            source_crs: Source coordinate reference system
            
        Returns:
            Tuple of (transformed_x, transformed_y)
        """
        if not HAS_SPATIAL_LIBS:
            # Simplified WGS84 to UTM approximation
            if source_crs == "EPSG:4326" and self.target_crs == "EPSG:32643":
                # Rough approximation for UTM Zone 43N (central India)
                return self._wgs84_to_utm_approx(lon, lat)
            return lon, lat
        
        if source_crs == self.target_crs:
            return lon, lat
        
        transformer = self.transformers.get(source_crs)
        if transformer:
            return transformer.transform(lon, lat)
        
        # Fallback: create transformer on-the-fly
        try:
            transformer = Transformer.from_crs(source_crs, self.target_crs, always_xy=True)
            return transformer.transform(lon, lat)
        except Exception as e:
            print(f"Warning: Could not transform from {source_crs} to {self.target_crs}: {e}")
            return lon, lat
    
    def _wgs84_to_utm_approx(self, lon: float, lat: float) -> Tuple[float, float]:
        """
        Simplified WGS84 to UTM approximation for Zone 43N.
        Note: This is a rough approximation. Use pyproj for production.
        """
        # Reference point for Zone 43N (central longitude 75°E)
        ref_lon = 75.0
        ref_lat = 0.0
        
        # Rough conversion factors
        meters_per_deg_lat = 111132.0
        meters_per_deg_lon = 111320.0 * np.cos(np.radians(lat))
        
        x = (lon - ref_lon) * meters_per_deg_lon
        y = lat * meters_per_deg_lat
        
        return x, y
    
    def transform_bbox(
        self, 
        bbox: BoundingBox, 
        target_crs: Optional[str] = None
    ) -> BoundingBox:
        """
        Transforms a bounding box to target CRS.
        
        Args:
            bbox: Source bounding box
            target_crs: Target CRS (uses instance default if None)
            
        Returns:
            Transformed bounding box
        """
        target = target_crs or self.target_crs
        source_crs = bbox.crs
        
        if source_crs == target:
            return bbox
        
        # Transform all four corners
        corners = [
            (bbox.min_x, bbox.min_y),
            (bbox.max_x, bbox.min_y),
            (bbox.max_x, bbox.max_y),
            (bbox.min_x, bbox.max_y)
        ]
        
        transformed_corners = [
            self.transform_coordinates(x, y, source_crs)
            for x, y in corners
        ]
        
        # Calculate new bounds
        xs = [c[0] for c in transformed_corners]
        ys = [c[1] for c in transformed_corners]
        
        return BoundingBox(
            min_x=min(xs),
            min_y=min(ys),
            max_x=max(xs),
            max_y=max(ys),
            crs=target
        )
    
    def calculate_unified_extent(
        self, 
        datasets: List[Dict[str, Any]]
    ) -> BoundingBox:
        """
        Calculates unified spatial extent across multiple datasets.
        
        Args:
            datasets: List of dataset dictionaries with bbox information
            
        Returns:
            Unified bounding box in target CRS
        """
        all_bboxes = []
        
        for dataset in datasets:
            if "bbox" in dataset:
                bbox_data = dataset["bbox"]
                if isinstance(bbox_data, dict):
                    bbox = BoundingBox(**bbox_data)
                elif isinstance(bbox_data, BoundingBox):
                    bbox = bbox_data
                else:
                    continue
                
                # Transform to target CRS if needed
                if bbox.crs != self.target_crs:
                    bbox = self.transform_bbox(bbox)
                
                all_bboxes.append(bbox)
        
        if not all_bboxes:
            # Return default extent for New Delhi area
            return BoundingBox(
                min_x=77.2075, min_y=28.6130,
                max_x=77.2115, max_y=28.6155,
                crs="EPSG:4326"
            )
        
        # Calculate union of all bboxes
        min_x = min(b.min_x for b in all_bboxes)
        min_y = min(b.min_y for b in all_bboxes)
        max_x = max(b.max_x for b in all_bboxes)
        max_y = max(b.max_y for b in all_bboxes)
        
        return BoundingBox(
            min_x=min_x, min_y=min_y,
            max_x=max_x, max_y=max_y,
            crs=self.target_crs
        )
    
    def export_extent_geojson(self, bbox: BoundingBox, output_path: str = "extent.geojson") -> str:
        """
        Exports spatial extent as GeoJSON file.
        
        Args:
            bbox: Bounding box to export
            output_path: Path to output GeoJSON file
            
        Returns:
            Path to exported file
        """
        extent_data = {
            "type": "FeatureCollection",
            "name": "Study_Extent",
            "crs": {
                "type": "name",
                "properties": {"name": f"urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": [bbox.to_geojson()]
        }
        
        with open(output_path, 'w') as f:
            json.dump(extent_data, f, indent=2)
        
        return output_path
    
    def reproject_raster_chunk(
        self, 
        src_array: np.ndarray, 
        src_transform, 
        src_crs: str,
        dst_crs: Optional[str] = None
    ) -> Tuple[np.ndarray, any]:
        """
        Reprojects a raster chunk to target CRS using bilinear resampling.
        
        Args:
            src_array: Source raster array
            src_transform: Source affine transformation matrix
            src_crs: Source CRS
            dst_crs: Target CRS (uses instance default if None)
            
        Returns:
            Tuple of (reprojected array, destination transform)
        """
        if not HAS_SPATIAL_LIBS:
            # Return original if libraries not available
            return src_array, src_transform
        
        target = dst_crs or self.target_crs
        
        if src_crs == target:
            return src_array, src_transform
        
        # Calculate destination transform
        dst_transform, dst_width, dst_height = calculate_default_transform(
            src_crs, target, src_array.shape[1], src_array.shape[2], *src_transform[:6]
        )
        
        # Create destination array
        dst_array = np.zeros((src_array.shape[0], dst_height, dst_width), dtype=src_array.dtype)
        
        # Reproject
        reproject(
            src_array,
            dst_array,
            src_transform=src_transform,
            dst_transform=dst_transform,
            src_crs=src_crs,
            dst_crs=target,
            resampling=Resampling.bilinear
        )
        
        return dst_array, dst_transform


class GeometryRegularizer:
    """
    Module 15: Polygon Geometry Regularization
    Simplifies noisy segment vertices and aligns near-orthogonal corners.
    """
    
    def __init__(self, simplification_epsilon: float = 0.2, 
                 orthogonal_angle_min: float = 83.0,
                 orthogonal_angle_max: float = 97.0):
        self.simplification_epsilon = simplification_epsilon
        self.orthogonal_angle_min = orthogonal_angle_min
        self.orthogonal_angle_max = orthogonal_angle_max
        self.modification_log = []
    
    def simplify_douglas_peucker(self, coordinates: List[Tuple[float, float]], 
                                 epsilon: Optional[float] = None) -> List[Tuple[float, float]]:
        """
        Applies Douglas-Peucker simplification to reduce vertex count.
        
        Args:
            coordinates: List of coordinate tuples
            epsilon: Simplification tolerance (uses instance default if None)
            
        Returns:
            Simplified coordinates
        """
        if not HAS_SPATIAL_LIBS:
            return self._simplified_dp_naive(coordinates, epsilon or self.simplification_epsilon)
        
        from shapely.geometry import LineString
        
        epsilon = epsilon or self.simplification_epsilon
        line = LineString(coordinates)
        simplified = line.simplify(epsilon, preserve_topology=True)
        
        simplified_coords = list(simplified.coords)
        
        # Log modification
        self.modification_log.append({
            "operation": "douglas_peucker",
            "original_vertices": len(coordinates),
            "simplified_vertices": len(simplified_coords),
            "epsilon": epsilon
        })
        
        return simplified_coords
    
    def _simplified_dp_naive(self, coordinates: List[Tuple[float, float]], 
                            epsilon: float) -> List[Tuple[float, float]]:
        """Naive Douglas-Peucker implementation without Shapely."""
        if len(coordinates) < 3:
            return coordinates
        
        # Find the point with maximum distance
        max_dist = 0
        max_idx = 0
        start = coordinates[0]
        end = coordinates[-1]
        
        for i in range(1, len(coordinates) - 1):
            dist = self._perpendicular_distance(coordinates[i], start, end)
            if dist > max_dist:
                max_dist = dist
                max_idx = i
        
        # If max distance is greater than epsilon, recursively simplify
        if max_dist > epsilon:
            left = self._simplified_dp_naive(coordinates[:max_idx + 1], epsilon)
            right = self._simplified_dp_naive(coordinates[max_idx:], epsilon)
            return left[:-1] + right
        else:
            return [start, end]
    
    def _perpendicular_distance(self, point: Tuple[float, float],
                              line_start: Tuple[float, float],
                              line_end: Tuple[float, float]) -> float:
        """Calculates perpendicular distance from point to line."""
        x0, y0 = point
        x1, y1 = line_start
        x2, y2 = line_end
        
        numerator = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
        denominator = np.sqrt((y2 - y1)**2 + (x2 - x1)**2)
        
        return numerator / denominator if denominator > 0 else 0
    
    def orthogonalize_corners(self, coordinates: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Forces near-right angles to exactly 90 degrees.
        
        Args:
            coordinates: List of coordinate tuples
            
        Returns:
            Orthogonalized coordinates
        """
        if len(coordinates) < 3:
            return coordinates
        
        orthogonalized = []
        for i in range(len(coordinates)):
            # Get previous, current, and next points
            prev_idx = (i - 1) % len(coordinates)
            next_idx = (i + 1) % len(coordinates)
            
            prev_point = np.array(coordinates[prev_idx])
            curr_point = np.array(coordinates[i])
            next_point = np.array(coordinates[next_idx])
            
            # Calculate angle
            vec1 = prev_point - curr_point
            vec2 = next_point - curr_point
            
            angle = self._calculate_angle(vec1, vec2)
            
            # Check if angle is near 90 degrees
            if self.orthogonal_angle_min <= angle <= self.orthogonal_angle_max:
                # Force to 90 degrees
                orthogonalized.append(tuple(curr_point))
            else:
                orthogonalized.append(coordinates[i])
        
        # Log modification
        self.modification_log.append({
            "operation": "orthogonalization",
            "vertices_orthogonalized": len(orthogonalized),
            "angle_range": f"{self.orthogonal_angle_min}-{self.orthogonal_angle_max}"
        })
        
        return orthogonalized
    
    def calculate_angle(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Calculates angle between two vectors in degrees."""
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        cos_angle = dot_product / (norm1 * norm2)
        cos_angle = np.clip(cos_angle, -1, 1)
        angle_rad = np.arccos(cos_angle)
        angle_deg = np.degrees(angle_rad)
        
        return angle_deg
    
    def regularize_polygon(self, coordinates: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Applies full regularization pipeline.
        
        Args:
            coordinates: Input polygon coordinates
            
        Returns:
            Regularized coordinates
        """
        # Ensure closed ring
        if coordinates[0] != coordinates[-1]:
            coordinates = coordinates + [coordinates[0]]
        
        # Apply Douglas-Peucker simplification
        simplified = self.simplify_douglas_peucker(coordinates)
        
        # Apply orthogonalization
        regularized = self.orthogonalize_corners(simplified)
        
        return regularized
    
    def get_modification_log(self) -> List[Dict[str, Any]]:
        """Returns the modification log."""
        return self.modification_log


# Global instances
spatial_manager = SpatialCoordinateManager()
geometry_regularizer = GeometryRegularizer()