# backend/app/routers/nodes.py
"""
Legacy nodes router - kept for backward compatibility
These endpoints are superseded by the schema system
"""

from fastapi import APIRouter, HTTPException, status
from typing import List
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/")
async def list_nodes():
    """List all nodes - legacy endpoint"""
    return {
        "message": "This endpoint is deprecated. Please use /api/v1/schemas/ instead.",
        "nodes": []
    }


@router.get("/{node_id}")
async def get_node(node_id: str):
    """Get node by ID - legacy endpoint"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This endpoint is deprecated. Please use schema-based endpoints."
    )