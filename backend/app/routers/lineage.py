# backend/app/routers/lineage.py
"""
Legacy lineage router - kept for backward compatibility
Lineage endpoints are now part of the schema system
"""

from fastapi import APIRouter, HTTPException, status
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lineage", tags=["lineage"])


@router.get("/full")
async def get_full_lineage():
    """Get full lineage - legacy endpoint"""
    return {
        "message": "This endpoint is deprecated. Please use /api/v1/schemas/{schema_id}/lineage instead.",
        "nodes": [],
        "edges": []
    }


@router.post("/node")
async def get_node_lineage(node_id: str):
    """Get node lineage - legacy endpoint"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This endpoint is deprecated. Please use schema-based lineage endpoints."
    )


@router.get("/paths")
async def find_paths(source_id: str, target_id: str):
    """Find paths - legacy endpoint"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This endpoint is deprecated. Please use /api/v1/schemas/{schema_id}/lineage/path"
    )