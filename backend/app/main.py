"""
FastAPI Server Entry Point
Urban Cadastral AI: Land Boundary Vectorization & VLM Management System
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.parcels import router as parcels_router
from app.api.vlm import router as vlm_router
from app.api.stream import router as stream_router
from app.api.map_ingest import router as map_ingest_router
from app.services.privacy_ethics import privacy_compliance


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize vision models and spatial cache
    print("🚀 Urban Cadastral AI Perception Engine initialized.")
    print("📡 GIS Endpoints & WebSocket broadcaster ready on port 8000 / 3000 proxy.")
    yield
    print("🛑 Cadastral Engine shut down.")


app = FastAPI(
    title="Urban Cadastral AI Perception & Land Management Engine",
    description="Automated aerial boundary vectorization, Shoelace area calculation, Shapely topological verification, Gemini Flash VLM audits, and SHA-256 tamper-proof cadastral title ledger.",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js / Vite client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(parcels_router, prefix="/api")
app.include_router(vlm_router, prefix="/api")
app.include_router(map_ingest_router, prefix="/api")
app.include_router(stream_router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "urban-cadastral-ai-perception-engine",
        "modules": {
            "vision": "OpenCV + YOLOv8",
            "spatial": "Shapely + Shoelace Geodesic",
            "vlm": "Gemini-3.8-Flash",
            "audit": "SHA-256 Hash Chain",
            "privacy": "PII Stripping & Spatial UUID Mapping"
        }
    }


@app.get("/privacy/status")
async def privacy_status():
    """Privacy compliance status endpoint"""
    return {
        "status": "compliant",
        "framework": "GDPR-INDIAN-IT-ACT",
        "anonymization_enabled": True,
        "spatial_uuid_generation": True,
        "disclaimer": privacy_compliance.disclaimer_text,
        "data_retention": "PRELIMINARY-CADASTRAL-90-DAYS"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
