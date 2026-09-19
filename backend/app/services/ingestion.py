"""
Module 1: Data and Licence Management
Handles legal compliance, provenance tracking, and cryptographic integrity verification
for all ingested spatial rasters and vector boundaries.
"""

import hashlib
import json
import os
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path


class DataLicenceManager:
    """
    Manages SHA-256 hashing, licence validation, and provenance tracking
    for all ingested spatial data (rasters and vectors).
    """

    GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"

    def __init__(self, licence_schema_path: str = "config/licence_schema.json"):
        self.licence_schema_path = licence_schema_path
        self.licence_manifest = {}
        self.dataset_integrity_log = {}

    def compute_file_hash(self, file_path: str) -> str:
        """
        Computes SHA-256 hash of a file for integrity verification.
        
        Args:
            file_path: Path to the file to hash
            
        Returns:
            SHA-256 hash string (64 hex characters)
        """
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            # Read in chunks to handle large files
            for chunk in iter(lambda: f.read(8192), b""):
                sha256_hash.update(chunk)
        return sha256.hexdigest()

    def compute_bytes_hash(self, data: bytes) -> str:
        """
        Computes SHA-256 hash of byte data (for in-memory raster data).
        
        Args:
            data: Byte data to hash
            
        Returns:
            SHA-256 hash string (64 hex characters)
        """
        return hashlib.sha256(data).hexdigest()

    def validate_licence_compliance(self, licence_metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates licence metadata against structured licence schema.
        
        Args:
            licence_metadata: Dictionary containing licence information
            
        Returns:
            Validation result with compliance status and details
        """
        required_fields = [
            "licence_type", "source", "access_permissions", 
            "expiry_date", "attribution", "commercial_use_allowed"
        ]
        
        validation_result = {
            "is_compliant": True,
            "missing_fields": [],
            "warnings": [],
            "licence_type": licence_metadata.get("licence_type", "UNKNOWN")
        }
        
        for field in required_fields:
            if field not in licence_metadata:
                validation_result["is_compliant"] = False
                validation_result["missing_fields"].append(field)
        
        # Check for ODC compliant licences
        allowed_licences = [
            "CC-BY-4.0", "CC-BY-SA-4.0", "CC0", "PDDL", "ODC-BY",
            "GOVERNMENT_PUBLIC", "MUNICIPAL_RECORDS"
        ]
        
        licence_type = licence_metadata.get("licence_type", "")
        if licence_type not in allowed_licences:
            validation_result["warnings"].append(
                f"Licence type '{licence_type}' may not be ODC compliant"
            )
        
        # Check expiry
        if "expiry_date" in licence_metadata:
            try:
                expiry = datetime.fromisoformat(licence_metadata["expiry_date"])
                if expiry < datetime.utcnow():
                    validation_result["is_compliant"] = False
                    validation_result["warnings"].append("Licence has expired")
            except ValueError:
                validation_result["warnings"].append("Invalid expiry date format")
        
        return validation_result

    def register_dataset(
        self, 
        dataset_id: str, 
        file_path: str, 
        licence_metadata: Dict[str, Any],
        spatial_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Registers a dataset with cryptographic hash and licence validation.
        
        Args:
            dataset_id: Unique identifier for the dataset
            file_path: Path to the data file
            licence_metadata: Licence information dictionary
            spatial_metadata: Optional spatial CRS and extent information
            
        Returns:
            Registration result with hash and compliance status
        """
        # Compute cryptographic hash
        file_hash = self.compute_file_hash(file_path)
        
        # Validate licence
        compliance_result = self.validate_licence_compliance(licence_metadata)
        
        # Create registration record
        registration_record = {
            "dataset_id": dataset_id,
            "file_hash": file_hash,
            "file_path": file_path,
            "licence_metadata": licence_metadata,
            "spatial_metadata": spatial_metadata or {},
            "compliance_result": compliance_result,
            "registration_timestamp": datetime.utcnow().isoformat(),
            "verified": compliance_result["is_compliant"]
        }
        
        # Store in licence manifest
        self.licence_manifest[dataset_id] = registration_record
        
        # Log to integrity log
        self.dataset_integrity_log[dataset_id] = {
            "registration": registration_record,
            "validation_status": "PASSED" if compliance_result["is_compliant"] else "FAILED",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return registration_record

    def verify_dataset_integrity(self, dataset_id: str, file_path: str) -> Dict[str, Any]:
        """
        Verifies that a dataset file has not been modified since registration.
        
        Args:
            dataset_id: Dataset identifier to verify
            file_path: Current path to the file
            
        Returns:
            Integrity verification result
        """
        if dataset_id not in self.licence_manifest:
            return {
                "is_valid": False,
                "reason": "Dataset not registered in licence manifest"
            }
        
        registered_record = self.licence_manifest[dataset_id]
        current_hash = self.compute_file_hash(file_path)
        
        if current_hash != registered_record["file_hash"]:
            return {
                "is_valid": False,
                "reason": "File hash mismatch - dataset has been modified",
                "registered_hash": registered_record["file_hash"],
                "current_hash": current_hash
            }
        
        return {
            "is_valid": True,
            "reason": "Dataset integrity verified",
            "file_hash": current_hash
        }

    def export_licence_manifest(self, output_path: str = "licence_manifest.json") -> str:
        """
        Exports the current licence manifest to JSON file.
        
        Args:
            output_path: Path to export the manifest
            
        Returns:
            Path to exported manifest file
        """
        manifest_data = {
            "version": "1.0",
            "export_timestamp": datetime.utcnow().isoformat(),
            "total_datasets": len(self.licence_manifest),
            "datasets": self.licence_manifest,
            "integrity_log": self.dataset_integrity_log
        }
        
        with open(output_path, 'w') as f:
            json.dump(manifest_data, f, indent=2)
        
        return output_path

    def create_provenance_block(
        self,
        dataset_id: str,
        action: str,
        description: str,
        operator_id: str = "SYSTEM"
    ) -> Dict[str, Any]:
        """
        Creates a provenance block for tracking data transformations.
        
        Args:
            dataset_id: Dataset identifier
            action: Action performed (INGEST, TRANSFORM, EXPORT, etc.)
            description: Description of the action
            operator_id: ID of the operator/system performing the action
            
        Returns:
            Provenance block with cryptographic hash
        """
        if dataset_id not in self.licence_manifest:
            previous_hash = self.GENESIS_HASH
        else:
            # Get most recent hash from integrity log
            log_entry = self.dataset_integrity_log.get(dataset_id, {})
            if "latest_hash" in log_entry:
                previous_hash = log_entry["latest_hash"]
            else:
                previous_hash = self.licence_manifest[dataset_id]["file_hash"]
        
        # Create block header for hashing
        block_header = f"{previous_hash}|{dataset_id}|{action}|{operator_id}|{description}"
        current_hash = hashlib.sha256(block_header.encode()).hexdigest()
        
        provenance_block = {
            "dataset_id": dataset_id,
            "action": action,
            "previous_hash": previous_hash,
            "current_hash": current_hash,
            "operator_id": operator_id,
            "description": description,
            "timestamp": datetime.utcnow().isoformat(),
            "verified": True
        }
        
        # Update integrity log
        if dataset_id not in self.dataset_integrity_log:
            self.dataset_integrity_log[dataset_id] = {}
        
        self.dataset_integrity_log[dataset_id]["latest_hash"] = current_hash
        self.dataset_integrity_log[dataset_id]["last_action"] = provenance_block
        
        return provenance_block


# Global instance for easy access
licence_manager = DataLicenceManager()