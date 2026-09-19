"""
FastAPI Parcel Cadastral Management Endpoints
Implements:
- Querying parcels by ID, bounding box, or owner
- Shoelace surface area calculation
- Topological validation on boundary creation/update
- Immutable SHA-256 hash chaining
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import time

from app.spatial.shoelace import compute_parcel_metrics
from app.spatial.topology import TopologyValidator
from app.spatial.uncertainty import BoundaryUncertaintyEstimator
from app.services.audit_chain import CadastralAuditLedger
from app.services.privacy_ethics import privacy_compliance

router = APIRouter(prefix="/parcels", tags=["Parcels"])

topology_validator = TopologyValidator()
uncertainty_estimator = BoundaryUncertaintyEstimator()


class CoordinatePoint(BaseModel):
    longitude: float
    latitude: float


class ParcelCreateRequest(BaseModel):
    uprn: str
    owner_name: str
    owner_national_id: str
    land_type: str = "RESIDENTIAL"
    coordinates: List[List[float]] = Field(..., description="Array of [longitude, latitude] pairs")
    surveyor_id: str = "SURV-8821"
    surveyor_name: str = "P. Sharma (Licensed Cadastral Surveyor)"


class BoundaryUpdateRequest(BaseModel):
    coordinates: List[List[float]]
    surveyor_id: str
    surveyor_name: str
    justification: str


# In-memory mock database for instant demo responsiveness
MOCK_PARCELS: Dict[str, Dict[str, Any]] = {}
MOCK_AUDIT_LEDGER: Dict[str, List[Dict[str, Any]]] = {}


@router.get("/")
async def list_parcels(
    min_lon: Optional[float] = None,
    min_lat: Optional[float] = None,
    max_lon: Optional[float] = None,
    max_lat: Optional[float] = None,
    owner: Optional[str] = None,
    land_type: Optional[str] = None,
    status: Optional[str] = None,
    anonymize: bool = False
):
    """Query cadastral parcels with optional bounding box and owner filters."""
    results = list(MOCK_PARCELS.values())

    if owner:
        results = [p for p in results if owner.lower() in p["owner_name"].lower()]
    if land_type:
        results = [p for p in results if p["land_type"].upper() == land_type.upper()]
    if status:
        results = [p for p in results if p["status"].upper() == status.upper()]

    # Bounding box filter
    if min_lon is not None and max_lon is not None and min_lat is not None and max_lat is not None:
        filtered = []
        for p in results:
            c_lat = p["centroid"]["latitude"]
            c_lon = p["centroid"]["longitude"]
            if min_lon <= c_lon <= max_lon and min_lat <= c_lat <= max_lat:
                filtered.append(p)
        results = filtered

    # Apply privacy anonymization if requested
    if anonymize:
        results = [privacy_compliance.anonymize_parcel_attributes(p) for p in results]

    return {
        "count": len(results),
        "parcels": results
    }


@router.get("/{parcel_id}")
async def get_parcel_detail(parcel_id: str, anonymize: bool = False):
    """Retrieve full cadastral parcel detail, coordinates, uncertainty scores, and audit chain."""
    parcel = MOCK_PARCELS.get(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    blocks = MOCK_AUDIT_LEDGER.get(parcel_id, [])
    chain_verification = CadastralAuditLedger.verify_audit_chain(blocks, parcel["coordinates"])

    # Apply privacy anonymization if requested
    parcel_to_return = parcel
    if anonymize:
        parcel_to_return = privacy_compliance.anonymize_parcel_attributes(parcel)

    return {
        "parcel": parcel_to_return,
        "audit_chain": blocks,
        "chain_verification": chain_verification
    }


@router.post("/")
async def create_parcel(payload: ParcelCreateRequest):
    """
    Ingests and registers a new cadastral land parcel:
    1. Validates geometric topology
    2. Calculates exact Shoelace metric area (m²)
    3. Computes calibrated uncertainty scores
    4. Mints genesis SHA-256 audit hash block
    """
    coords = payload.coordinates
    if len(coords) < 3:
        raise HTTPException(status_code=400, detail="Invalid coordinates: At least 3 boundary vertices required.")

    # Geometric validity check
    geom_report = topology_validator.validate_single_parcel(coords)
    if not geom_report["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Topological defect detected: {geom_report['reason']}")

    # Shoelace metric area calculation
    metrics = compute_parcel_metrics([(c[0], c[1]) for c in coords])

    # Uncertainty assessment
    uncertainty = uncertainty_estimator.estimate_boundary_uncertainty(coords)

    parcel_id = f"PRCL-{payload.uprn}"
    
    # Genesis audit block
    genesis_block = CadastralAuditLedger.create_audit_block(
        parcel_id=parcel_id,
        block_index=0,
        previous_hash=CadastralAuditLedger.GENESIS_HASH,
        coordinates=coords,
        surveyor_id=payload.surveyor_id,
        surveyor_name=payload.surveyor_name,
        action="INITIAL_INGESTION",
        description=f"Cadastral boundary vectorized from UAV drone orthomosaic. Initial verified area: {metrics['area_sq_meters']} m²."
    )

    record = {
        "id": parcel_id,
        "uprn": payload.uprn,
        "owner_name": payload.owner_name,
        "owner_national_id": payload.owner_national_id,
        "land_type": payload.land_type,
        "status": "TOPOLOGY_VERIFIED" if geom_report["is_valid"] else "DRAFT_SEGMENTATION",
        "coordinates": coords,
        "calculated_area_sq_meters": metrics["area_sq_meters"],
        "perimeter_meters": metrics["perimeter_meters"],
        "centroid": metrics["centroid"],
        "vertex_count": metrics["vertex_count"],
        "uncertainty": uncertainty,
        "compliance_score": 92,
        "encroachment_detected": False,
        "current_hash": genesis_block["current_hash"],
        "created_at": time.time()
    }

    MOCK_PARCELS[parcel_id] = record
    MOCK_AUDIT_LEDGER[parcel_id] = [genesis_block]

    return {"status": "success", "parcel": record, "genesis_block": genesis_block}


@router.put("/{parcel_id}/boundaries")
async def update_parcel_boundaries(parcel_id: str, payload: BoundaryUpdateRequest):
    """
    Updates boundary coordinates (e.g. after surveyor field ground-truthing).
    Chains a new cryptographic SHA-256 block.
    """
    parcel = MOCK_PARCELS.get(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    coords = payload.coordinates
    geom_report = topology_validator.validate_single_parcel(coords)
    if not geom_report["is_valid"]:
        raise HTTPException(status_code=400, detail=f"Topological validation failed: {geom_report['reason']}")

    metrics = compute_parcel_metrics([(c[0], c[1]) for c in coords])
    uncertainty = uncertainty_estimator.estimate_boundary_uncertainty(coords)

    chain = MOCK_AUDIT_LEDGER.get(parcel_id, [])
    prev_hash = chain[-1]["current_hash"] if chain else CadastralAuditLedger.GENESIS_HASH

    new_block = CadastralAuditLedger.create_audit_block(
        parcel_id=parcel_id,
        block_index=len(chain),
        previous_hash=prev_hash,
        coordinates=coords,
        surveyor_id=payload.surveyor_id,
        surveyor_name=payload.surveyor_name,
        action="SURVEYOR_ADJUSTMENT",
        description=payload.justification
    )

    parcel["coordinates"] = coords
    parcel["calculated_area_sq_meters"] = metrics["area_sq_meters"]
    parcel["perimeter_meters"] = metrics["perimeter_meters"]
    parcel["centroid"] = metrics["centroid"]
    parcel["vertex_count"] = metrics["vertex_count"]
    parcel["uncertainty"] = uncertainty
    parcel["status"] = "SURVEYOR_ADJUSTED"
    parcel["current_hash"] = new_block["current_hash"]

    chain.append(new_block)
    MOCK_AUDIT_LEDGER[parcel_id] = chain

    return {
        "status": "success",
        "parcel": parcel,
        "new_audit_block": new_block
    }


@router.post("/anonymize/{parcel_id}")
async def anonymize_parcel(parcel_id: str):
    """Anonymize parcel data by removing PII and adding spatial UUID."""
    parcel = MOCK_PARCELS.get(parcel_id)
    if not parcel:
        raise HTTPException(status_code=404, detail="Parcel not found")

    anonymized = privacy_compliance.anonymize_parcel_attributes(parcel)
    
    return {
        "status": "success",
        "anonymized_parcel": anonymized,
        "audit_log": privacy_compliance.generate_audit_log_entry("ANONYMIZE", anonymized.get("spatial_uuid", "UNKNOWN"))
    }


@router.post("/anonymize-batch")
async def anonymize_parcels_batch():
    """Anonymize all parcels in the system for export or analysis."""
    parcels = list(MOCK_PARCELS.values())
    anonymized_parcels = privacy_compliance.anonymize_parcel_batch(parcels)
    
    return {
        "status": "success",
        "count": len(anonymized_parcels),
        "anonymized_parcels": anonymized_parcels,
        "disclaimer": privacy_compliance.disclaimer_text
    }
