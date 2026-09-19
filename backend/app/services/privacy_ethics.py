"""
Privacy & Ethics Module (Mod 29)
Implements PII stripping and randomized spatial UUID mapping for corporate/government compliance.
Ensures cadastral data output sanitizes external owner references into anonymous UUIDs.
"""

import uuid
import hashlib
from typing import Dict, Any, List, Optional
from datetime import datetime


class PrivacyEthicsCompliance:
    """
    Handles PII anonymization and spatial UUID assignment for cadastral data
    in compliance with privacy regulations and ethical data handling standards.
    """

    def __init__(self, organization_code: str = "GEOTRACE"):
        self.organization_code = organization_code
        self.disclaimer_text = "PRELIMINARY BOUNDARY - NOT A LEGAL TITLE DETERMINATION"

    def anonymize_parcel_attributes(self, parcel_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Strips PII and assigns randomized spatial UUIDs to parcel data.
        
        Args:
            parcel_data: Dictionary containing parcel information with potential PII
            
        Returns:
            Anonymized parcel dictionary with spatial UUID and disclaimer
        """
        # Create a copy to avoid modifying original data
        anonymized = parcel_data.copy()
        
        # Remove PII fields
        pii_fields = [
            "owner_name", 
            "owner_national_id", 
            "ownerNationalId", 
            "tax_payer_id",
            "contact_number",
            "email",
            "residential_address"
        ]
        
        for field in pii_fields:
            anonymized.pop(field, None)
            anonymized.pop(field.replace("_", ""), None)  # Handle camelCase variants
        
        # Generate spatial UUID
        if "id" in anonymized:
            parcel_id = anonymized["id"]
        else:
            parcel_id = "UNKNOWN"
        
        # Create deterministic but anonymous spatial UUID
        spatial_uuid = self._generate_spatial_uuid(parcel_id)
        anonymized["spatial_uuid"] = spatial_uuid
        
        # Add compliance disclaimer
        anonymized["disclaimer"] = self.disclaimer_text
        anonymized["anonymization_timestamp"] = datetime.utcnow().isoformat()
        anonymized["data_classification"] = "PRELIMINARY_CADASTRAL"
        
        return anonymized

    def _generate_spatial_uuid(self, parcel_id: str) -> str:
        """
        Generates a deterministic spatial UUID based on parcel ID and organization code.
        This ensures the same parcel always gets the same UUID while maintaining anonymity.
        """
        # Create a hash from organization code and parcel ID
        hash_input = f"{self.organization_code}-{parcel_id}".encode('utf-8')
        hash_digest = hashlib.sha256(hash_input).hexdigest()
        
        # Extract first 8 characters and format as spatial UUID
        spatial_uuid = f"TN-PARCEL-{hash_digest[:8].upper()}"
        return spatial_uuid

    def anonymize_parcel_batch(self, parcel_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Batch anonymizes a list of parcels for export or analysis.
        
        Args:
            parcel_list: List of parcel dictionaries
            
        Returns:
            List of anonymized parcel dictionaries
        """
        return [self.anonymize_parcel_attributes(parcel) for parcel in parcel_list]

    def generate_section56_notice_template(
        self, 
        spatial_uuid: str, 
        encroachment_area_sqm: float,
        setback_violation_m: float,
        legal_reference: str
    ) -> str:
        """
        Generates Section 56 TN TCP Act statutory notice template.
        Used when VLM service is unavailable or as fallback.
        
        Args:
            spatial_uuid: Anonymized parcel identifier
            encroachment_area_sqm: Area of encroachment in square meters
            setback_violation_m: Setback violation in meters
            legal_reference: Government plan approval number
            
        Returns:
            Formatted statutory notice text
        """
        notice = f"""
GOVERNMENT OF TAMIL NADU
DIRECTORATE OF TOWN AND COUNTRY PLANNING
STATUTORY NOTICE UNDER SECTION 56 OF TAMIL NADU TOWN & COUNTRY PLANNING ACT, 1971

Notice Ref: TN/ENCR/{legal_reference.replace('/', '-')}/2026
To: Property Owner (Spatial UUID: {spatial_uuid})
Subject: Encroachment onto Public Right-of-Way - Approved Layout {legal_reference}

WHEREAS by virtue of comparative spatial overlay analysis, it is established that:
1. Your constructed structure extends {setback_violation_m} meters beyond the legal property line.
2. An encroachment zone measuring {encroachment_area_sqm} sq.m encroaches directly into the public carriage right-of-way.
3. This contravenes Rule 35 of the Tamil Nadu Combined Development and Building Rules (TNCDBR) 2019.

YOU ARE HEREBY DIRECTED within 15 days of receipt of this notice to:
1. Remove the unauthorized {setback_violation_m}m protrusion
2. Restore the boundary to the approved layout position
3. Submit compliance certification to the local planning authority

Failure to comply may result in action under Section 56(2) of the Act.

{self.disclaimer_text}
"""
        return notice.strip()

    def sanitize_geojson_export(self, geojson_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitizes GeoJSON export by removing PII from feature properties.
        
        Args:
            geojson_data: GeoJSON FeatureCollection or Feature dictionary
            
        Returns:
            Sanitized GeoJSON with PII removed
        """
        if geojson_data.get("type") == "FeatureCollection":
            sanitized_features = []
            for feature in geojson_data.get("features", []):
                sanitized_feature = self._sanitize_feature_properties(feature)
                sanitized_features.append(sanitized_feature)
            
            geojson_data["features"] = sanitized_features
            geojson_data["disclaimer"] = self.disclaimer_text
            geojson_data["anonymization_timestamp"] = datetime.utcnow().isoformat()
            
        elif geojson_data.get("type") == "Feature":
            geojson_data = self._sanitize_feature_properties(geojson_data)
            geojson_data["disclaimer"] = self.disclaimer_text
            geojson_data["anonymization_timestamp"] = datetime.utcnow().isoformat()
        
        return geojson_data

    def _sanitize_feature_properties(self, feature: Dict[str, Any]) -> Dict[str, Any]:
        """Helper method to sanitize individual feature properties."""
        if "properties" in feature:
            properties = feature["properties"].copy()
            
            # Remove PII from properties
            pii_properties = [
                "owner_name", "ownerName", "owner_national_id", "ownerNationalId",
                "tax_payer_id", "contact_number", "email", "residential_address"
            ]
            
            for prop in pii_properties:
                properties.pop(prop, None)
            
            # Add spatial UUID if original ID exists
            if "id" in properties:
                properties["spatial_uuid"] = self._generate_spatial_uuid(str(properties["id"]))
            
            feature["properties"] = properties
        
        return feature

    def generate_audit_log_entry(
        self, 
        action: str, 
        spatial_uuid: str, 
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates an audit log entry for privacy compliance tracking.
        
        Args:
            action: Action performed (e.g., "EXPORT", "VIEW", "MODIFY")
            spatial_uuid: Anonymized parcel identifier
            user_id: Optional user identifier for audit trail
            
        Returns:
            Audit log entry dictionary
        """
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            "spatial_uuid": spatial_uuid,
            "user_id": user_id or "ANONYMOUS",
            "compliance_framework": "GDPR-INDIAN-IT-ACT",
            "data_retention_policy": "PRELIMINARY-CADASTRAL-90-DAYS",
            "organization": self.organization_code
        }


class ReviewPrioritizer:
    """
    Module 18: Review Prioritization
    Calculates multi-criteria priority index to route ambiguous parcel boundaries to human surveyors.
    """
    
    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or {
            "uncertainty": 0.4,      # (1 - C_i*)
            "topology_error": 0.3,   # G_i
            "area": 0.2,             # S_i
            "shadow_coverage": 0.1   # I_i
        }
        self.review_queue = []
    
    def calculate_priority_score(self, parcel: Dict[str, Any], 
                                uncertainty_maps: Optional[Dict[str, Any]] = None,
                                topology_errors: Optional[Dict[str, Any]] = None,
                                iqa_metadata: Optional[Dict[str, Any]] = None) -> float:
        """
        Calculates priority score P_i for each parcel boundary.
        
        Args:
            parcel: Parcel dictionary
            uncertainty_maps: Uncertainty data
            topology_errors: Topology error data
            iqa_metadata: Image quality assessment metadata
            
        Returns:
            Priority score (higher = more urgent)
        """
        # Extract uncertainty component (1 - C_i*)
        calibrated_confidence = parcel.get("overall_uncertainty", 0.0)
        uncertainty_component = 1.0 - calibrated_confidence
        
        # Extract topology error flag (G_i)
        topology_error_flag = 0
        if topology_errors:
            parcel_id = parcel.get("id", "")
            if parcel_id in topology_errors.get("error_parcels", []):
                topology_error_flag = 1
        
        # Extract area component (S_i)
        area_sqm = parcel.get("calculatedAreaSqMeters", 0)
        # Normalize area (larger parcels = higher priority)
        area_component = min(area_sqm / 5000.0, 1.0)  # Assume 5000 m² is large
        
        # Extract shadow coverage ratio (I_i)
        shadow_coverage = 0.0
        if iqa_metadata:
            shadow_coverage = iqa_metadata.get("shadow_percentage", 0.0) / 100.0
        
        # Calculate weighted priority score
        priority_score = (
            self.weights["uncertainty"] * uncertainty_component +
            self.weights["topology_error"] * topology_error_flag +
            self.weights["area"] * area_component +
            self.weights["shadow_coverage"] * shadow_coverage
        )
        
        return priority_score
    
    def create_review_queue(self, parcels: List[Dict[str, Any]],
                           uncertainty_maps: Optional[Dict[str, Any]] = None,
                           topology_errors: Optional[Dict[str, Any]] = None,
                           iqa_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Creates ranked review queue using multi-criteria priority index.
        
        Args:
            parcels: List of parcel dictionaries
            uncertainty_maps: Uncertainty data
            topology_errors: Topology error data
            iqa_metadata: Image quality assessment metadata
            
        Returns:
            Ranked review queue sorted by priority score
        """
        review_items = []
        
        for parcel in parcels:
            priority_score = self.calculate_priority_score(
                parcel, uncertainty_maps, topology_errors, iqa_metadata
            )
            
            # Determine priority level
            if priority_score > 0.7:
                priority_level = "CRITICAL"
            elif priority_score > 0.4:
                priority_level = "HIGH"
            elif priority_score > 0.2:
                priority_level = "MEDIUM"
            else:
                priority_level = "LOW"
            
            review_item = {
                "parcel_id": parcel.get("id", ""),
                "uprn": parcel.get("uprn", ""),
                "priority_score": round(priority_score, 3),
                "priority_level": priority_level,
                "uncertainty_component": round(1.0 - parcel.get("overall_uncertainty", 0.0), 3),
                "area_sqm": parcel.get("calculatedAreaSqMeters", 0),
                "topology_error": topology_errors is not None and parcel.get("id", "") in topology_errors.get("error_parcels", []),
                "shadow_coverage": iqa_metadata.get("shadow_percentage", 0) if iqa_metadata else 0
            }
            
            review_items.append(review_item)
        
        # Sort by priority score (descending)
        review_items.sort(key=lambda x: x["priority_score"], reverse=True)
        
        self.review_queue = review_items
        return review_items
    
    def export_review_queue(self, output_path: str = "review_queue.json") -> str:
        """
        Exports review queue to JSON.
        
        Args:
            output_path: Path to output file
            
        Returns:
            Path to exported file
        """
        queue_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_items": len(self.review_queue),
            "priority_distribution": {
                "CRITICAL": sum(1 for item in self.review_queue if item["priority_level"] == "CRITICAL"),
                "HIGH": sum(1 for item in self.review_queue if item["priority_level"] == "HIGH"),
                "MEDIUM": sum(1 for item in self.review_queue if item["priority_level"] == "MEDIUM"),
                "LOW": sum(1 for item in self.review_queue if item["priority_level"] == "LOW")
            },
            "queue": self.review_queue
        }
        
        with open(output_path, 'w') as f:
            json.dump(queue_data, f, indent=2)
        
        return output_path
    
    def generate_priority_heatmap(self, parcels: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generates spatial priority heatmap data.
        
        Args:
            parcels: List of parcel dictionaries
            
        Returns:
            Heatmap data dictionary
        """
        heatmap_data = {
            "type": "FeatureCollection",
            "name": "Review_Priority_Heatmap",
            "features": []
        }
        
        for item in self.review_queue:
            parcel = next((p for p in parcels if p.get("id") == item["parcel_id"]), None)
            if parcel:
                coordinates = parcel.get("coordinates", [])
                if coordinates:
                    heatmap_data["features"].append({
                        "type": "Feature",
                        "properties": {
                            "priority_score": item["priority_score"],
                            "priority_level": item["priority_level"],
                            "parcel_id": item["parcel_id"]
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [coordinates]
                        }
                    })
        
        return heatmap_data


# Global instances
privacy_compliance = PrivacyEthicsCompliance()
review_prioritizer = ReviewPrioritizer()