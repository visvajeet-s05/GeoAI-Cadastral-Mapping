"""
FastAPI VLM Cadastral Land-Use & Encroachment Router
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.services.gemini_vlm import GeminiVlmAuditService

router = APIRouter(prefix="/vlm", tags=["VLM Audit"])

vlm_service = GeminiVlmAuditService()


class VlmAuditRequest(BaseModel):
    uprn: str
    area_sqm: float = 500.0
    current_zoning: str = "RESIDENTIAL"
    base64_image: Optional[str] = None
    context_notes: Optional[str] = ""


@router.post("/audit")
async def audit_parcel(request: VlmAuditRequest):
    """
    Submits parcel crop to Gemini Flash 2.0 / 3.8 Flash for:
    - Land type classification (Residential, Commercial, Agricultural, Unclaimed)
    - Permanent structure count
    - Compliance score (0-100)
    - Encroachment detection (Boolean + narrative details)
    """
    try:
        report = await vlm_service.audit_parcel_land_use(
            parcel_uprn=request.uprn,
            base64_image=request.base64_image,
            area_sqm=request.area_sqm,
            current_zoning=request.current_zoning,
            context_notes=request.context_notes or ""
        )
        return {"status": "success", "audit_report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"VLM Audit service error: {str(e)}")
