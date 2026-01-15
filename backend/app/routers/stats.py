# backend/app/routers/stats.py
"""
Legacy stats router - kept for backward compatibility
Stats endpoints are now part of the schema system
"""

from fastapi import APIRouter, HTTPException, status
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary")
async def get_summary_stats():
    """Get summary stats - legacy endpoint"""
    return {
        "message": "This endpoint is deprecated. Please use /api/v1/schemas/{schema_id}/stats instead.",
        "total_nodes": 0,
        "total_edges": 0
    }


@router.get("/nodes/{node_type}")
async def get_node_type_stats(node_type: str):
    """Get stats by node type - legacy endpoint"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This endpoint is deprecated. Please use schema-based stats endpoints."
    )