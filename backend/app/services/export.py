"""
Module 22: GIS Export and Visualization
Converts validated database records into standard GIS file formats.
"""

import json
from typing import Dict, Any, List, Optional
from pathlib import Path
import datetime

try:
    import geopandas as gpd
    from shapely.geometry import shape, mapping
    HAS_GEOSPATIAL_LIBS = True
except ImportError:
    HAS_GEOSPATIAL_LIBS = False
    print("WARNING: geopandas not installed. Export will use JSON-only formats.")


class GISExportEngine:
    """
    Module 22: GIS Export Engine
    Exports vector layers into standard spatial formats with schema validation.
    """
    
    SUPPORTED_FORMATS = ["geojson", "shapefile", "geopackage", "geoparquet"]
    
    def __init__(self):
        self.export_history = []
    
    def export_geojson(self, parcels: List[Dict[str, Any]], 
                      output_path: str = "parcels.geojson",
                      crs: str = "EPSG:4326") -> str:
        """
        Exports parcels to GeoJSON format.
        
        Args:
            parcels: List of parcel dictionaries
            output_path: Path to output GeoJSON file
            crs: Coordinate reference system
            
        Returns:
            Path to exported file
        """
        features = []
        
        for parcel in parcels:
            coordinates = parcel.get("coordinates", [])
            if not coordinates:
                continue
            
            # Ensure closed ring
            if coordinates[0] != coordinates[-1]:
                coordinates = coordinates + [coordinates[0]]
            
            feature = {
                "type": "Feature",
                "id": parcel.get("id", "unknown"),
                "properties": {
                    "uprn": parcel.get("uprn", ""),
                    "geo_trace_card_number": parcel.get("geoTraceCardNumber", ""),
                    "svamitva_card_number": parcel.get("svamitvaCardNumber", ""),
                    "owner_name": parcel.get("ownerName", ""),
                    "land_type": parcel.get("landType", ""),
                    "status": parcel.get("status", ""),
                    "calculated_area_sq_meters": parcel.get("calculatedAreaSqMeters", 0),
                    "perimeter_meters": parcel.get("perimeterMeters", 0),
                    "centroid": parcel.get("centroid", {}),
                    "epistemic_uncertainty": parcel.get("epistemicUncertainty", 0),
                    "aleatoric_uncertainty": parcel.get("aleatoricUncertainty", 0),
                    "overall_uncertainty": parcel.get("overallUncertainty", 0),
                    "structure_count": parcel.get("structureCount", 0),
                    "compliance_score": parcel.get("complianceScore", 0),
                    "encroachment_detected": parcel.get("encroachmentDetected", False),
                    "current_hash": parcel.get("currentHash", ""),
                    "spatial_uuid": parcel.get("spatial_uuid", ""),
                    "disclaimer": parcel.get("disclaimer", "")
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [coordinates]
                }
            }
            features.append(feature)
        
        geojson_data = {
            "type": "FeatureCollection",
            "name": "GeoTrace_Cadastral_Survey_Parcels",
            "crs": {
                "type": "name",
                "properties": {"name": f"urn:ogc:def:crs:OGC:1.3:CRS84"}
            },
            "features": features,
            "export_timestamp": datetime.datetime.utcnow().isoformat(),
            "export_format": "GeoJSON",
            "coordinate_reference_system": crs
        }
        
        with open(output_path, 'w') as f:
            json.dump(geojson_data, f, indent=2)
        
        self.export_history.append({
            "format": "geojson",
            "path": output_path,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "feature_count": len(features)
        })
        
        return output_path
    
    def export_shapefile(self, parcels: List[Dict[str, Any]], 
                       output_path: str = "parcels.shp",
                       crs: str = "EPSG:4326") -> str:
        """
        Exports parcels to ESRI Shapefile format.
        
        Args:
            parcels: List of parcel dictionaries
            output_path: Path to output shapefile (without extension)
            crs: Coordinate reference system
            
        Returns:
            Path to exported file
        """
        if not HAS_GEOSPATIAL_LIBS:
            raise ImportError("geopandas is required for Shapefile export")
        
        # Convert to GeoDataFrame
        features = []
        for parcel in parcels:
            coordinates = parcel.get("coordinates", [])
            if not coordinates:
                continue
            
            if coordinates[0] != coordinates[-1]:
                coordinates = coordinates + [coordinates[0]]
            
            properties = {
                "uprn": parcel.get("uprn", ""),
                "geo_trace_card": parcel.get("geoTraceCardNumber", ""),
                "svamitva_card": parcel.get("svamitvaCardNumber", ""),
                "owner_name": parcel.get("ownerName", ""),
                "land_type": parcel.get("landType", ""),
                "status": parcel.get("status", ""),
                "area_sqm": parcel.get("calculatedAreaSqMeters", 0),
                "perimeter_m": parcel.get("perimeterMeters", 0),
                "epistemic_unc": parcel.get("epistemicUncertainty", 0),
                "aleatoric_unc": parcel.get("aleatoricUncertainty", 0),
                "overall_unc": parcel.get("overallUncertainty", 0),
                "structure_count": parcel.get("structureCount", 0),
                "compliance_score": parcel.get("complianceScore", 0),
                "encroachment": parcel.get("encroachmentDetected", False),
                "current_hash": parcel.get("currentHash", ""),
                "spatial_uuid": parcel.get("spatial_uuid", "")
            }
            
            features.append({
                "geometry": {"type": "Polygon", "coordinates": [coordinates]},
                "properties": properties
            })
        
        # Create GeoDataFrame
        gdf = gpd.GeoDataFrame.from_features(features, crs=crs)
        
        # Export
        gdf.to_file(output_path, driver='ESRI Shapefile')
        
        self.export_history.append({
            "format": "shapefile",
            "path": output_path,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "feature_count": len(features)
        })
        
        return output_path
    
    def export_geopackage(self, parcels: List[Dict[str, Any]], 
                         output_path: str = "parcels.gpkg",
                         crs: str = "EPSG:4326") -> str:
        """
        Exports parcels to GeoPackage format.
        
        Args:
            parcels: List of parcel dictionaries
            output_path: Path to output GeoPackage file
            crs: Coordinate reference system
            
        Returns:
            Path to exported file
        """
        if not HAS_GEOSPATIAL_LIBS:
            raise ImportError("geopandas is required for GeoPackage export")
        
        # Convert to GeoDataFrame (similar to shapefile)
        features = []
        for parcel in parcels:
            coordinates = parcel.get("coordinates", [])
            if not coordinates:
                continue
            
            if coordinates[0] != coordinates[-1]:
                coordinates = coordinates + [coordinates[0]]
            
            properties = {
                "uprn": parcel.get("uprn", ""),
                "geo_trace_card": parcel.get("geoTraceCardNumber", ""),
                "svamitva_card": parcel.get("svamitvaCardNumber", ""),
                "owner_name": parcel.get("ownerName", ""),
                "land_type": parcel.get("landType", ""),
                "status": parcel.get("status", ""),
                "area_sqm": parcel.get("calculatedAreaSqMeters", 0),
                "perimeter_m": parcel.get("perimeterMeters", 0),
                "epistemic_unc": parcel.get("epistemicUncertainty", 0),
                "aleatoric_unc": parcel.get("aleatoricUncertainty", 0),
                "overall_unc": parcel.get("overallUncertainty", 0),
                "structure_count": parcel.get("structureCount", 0),
                "compliance_score": parcel.get("complianceScore", 0),
                "encroachment": parcel.get("encroachmentDetected", False),
                "current_hash": parcel.get("currentHash", ""),
                "spatial_uuid": parcel.get("spatial_uuid", "")
            }
            
            features.append({
                "geometry": {"type": "Polygon", "coordinates": [coordinates]},
                "properties": properties
            })
        
        # Create GeoDataFrame
        gdf = gpd.GeoDataFrame.from_features(features, crs=crs)
        
        # Export to GeoPackage
        gdf.to_file(output_path, driver='GPKG')
        
        self.export_history.append({
            "format": "geopackage",
            "path": output_path,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "feature_count": len(features)
        })
        
        return output_path
    
    def export_geoparquet(self, parcels: List[Dict[str, Any]], 
                        output_path: str = "parcels.parquet",
                        crs: str = "EPSG:4326") -> str:
        """
        Exports parcels to GeoParquet format.
        
        Args:
            parcels: List of parcel dictionaries
            output_path: Path to output GeoParquet file
            crs: Coordinate reference system
            
        Returns:
            Path to exported file
        """
        if not HAS_GEOSPATIAL_LIBS:
            raise ImportError("geopandas is required for GeoParquet export")
        
        # Convert to GeoDataFrame
        features = []
        for parcel in parcels:
            coordinates = parcel.get("coordinates", [])
            if not coordinates:
                continue
            
            if coordinates[0] != coordinates[-1]:
                coordinates = coordinates + [coordinates[0]]
            
            properties = {
                "uprn": parcel.get("uprn", ""),
                "geo_trace_card": parcel.get("geoTraceCardNumber", ""),
                "svamitva_card": parcel.get("svamitvaCardNumber", ""),
                "owner_name": parcel.get("ownerName", ""),
                "land_type": parcel.get("landType", ""),
                "status": parcel.get("status", ""),
                "area_sqm": parcel.get("calculatedAreaSqMeters", 0),
                "perimeter_m": parcel.get("perimeterMeters", 0),
                "epistemic_unc": parcel.get("epistemicUncertainty", 0),
                "aleatoric_unc": parcel.get("aleatoricUncertainty", 0),
                "overall_unc": parcel.get("overallUncertainty", 0),
                "structure_count": parcel.get("structureCount", 0),
                "compliance_score": parcel.get("complianceScore", 0),
                "encroachment": parcel.get("encroachmentDetected", False),
                "current_hash": parcel.get("currentHash", ""),
                "spatial_uuid": parcel.get("spatial_uuid", "")
            }
            
            features.append({
                "geometry": {"type": "Polygon", "coordinates": [coordinates]},
                "properties": properties
            })
        
        # Create GeoDataFrame
        gdf = gpd.GeoDataFrame.from_features(features, crs=crs)
        
        # Export to GeoParquet
        gdf.to_parquet(output_path)
        
        self.export_history.append({
            "format": "geoparquet",
            "path": output_path,
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "feature_count": len(features)
        })
        
        return output_path
    
    def validate_export_schema(self, parcels: List[Dict[str, Any]], 
                              format_type: str) -> Dict[str, Any]:
        """
        Validates export schema to ensure valid projections, attributes, and geometry types.
        
        Args:
            parcels: List of parcel dictionaries
            format_type: Export format type
            
        Returns:
            Validation result
        """
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "format": format_type
        }
        
        # Check required fields
        required_fields = ["id", "coordinates", "landType", "status"]
        for parcel in parcels:
            for field in required_fields:
                if field not in parcel:
                    validation_result["is_valid"] = False
                    validation_result["errors"].append(
                        f"Parcel {parcel.get('id', 'unknown')} missing required field: {field}"
                    )
        
        # Validate coordinate format
        for parcel in parcels:
            coords = parcel.get("coordinates", [])
            if coords:
                if not isinstance(coords, list) or len(coords) < 4:
                    validation_result["is_valid"] = False
                    validation_result["errors"].append(
                        f"Parcel {parcel.get('id', 'unknown')} has invalid coordinates"
                    )
                
                # Check coordinate pairs
                for coord in coords:
                    if not isinstance(coord, (list, tuple)) or len(coord) != 2:
                        validation_result["is_valid"] = False
                        validation_result["errors"].append(
                            f"Parcel {parcel.get('id', 'unknown')} has invalid coordinate format"
                        )
        
        # Format-specific validation
        if format_type == "shapefile":
            # Shapefile has field name length limits (10 characters)
            warning_fields = []
            for parcel in parcels:
                for key in parcel.keys():
                    if len(key) > 10:
                        warning_fields.append(key)
            
            if warning_fields:
                validation_result["warnings"].append(
                    f"Shapefile field names truncated: {', '.join(set(warning_fields))}"
                )
        
        return validation_result
    
    def generate_thematic_map(self, parcels: List[Dict[str, Any]], 
                             output_path: str = "thematic_map.pdf",
                             attribute: str = "landType") -> str:
        """
        Generates thematic PDF map layout.
        
        Args:
            parcels: List of parcel dictionaries
            output_path: Path to output PDF
            attribute: Attribute to use for theming
            
        Returns:
            Path to generated map
        """
        # This would require matplotlib/QGIS API integration
        # For now, we'll create a placeholder file
        map_data = {
            "title": "GeoTrace-AI Cadastral Thematic Map",
            "attribute": attribute,
            "parcels": len(parcels),
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "note": "Full thematic map generation requires matplotlib/QGIS integration"
        }
        
        with open(output_path.replace('.pdf', '.json'), 'w') as f:
            json.dump(map_data, f, indent=2)
        
        return output_path.replace('.pdf', '.json')


# Global instance
gis_export_engine = GISExportEngine()