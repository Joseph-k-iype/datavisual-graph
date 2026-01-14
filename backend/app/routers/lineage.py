from fastapi import APIRouter, HTTPException, status, Query
from typing import Dict, Any
from ..models.schemas import (
    LineageQuery, GraphResponse, LineagePathResponse
)
from ..services.lineage_service import LineageService

router = APIRouter(prefix="/lineage", tags=["lineage"])


@router.get("/full", response_model=GraphResponse)
async def get_full_lineage():
    """Get complete lineage graph"""
    try:
        return LineageService.get_full_lineage()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get full lineage: {str(e)}"
        )


@router.post("/node", response_model=GraphResponse)
async def get_node_lineage(lineage_query: LineageQuery):
    """Get lineage for a specific node"""
    try:
        return LineageService.get_node_lineage(lineage_query)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get node lineage: {str(e)}"
        )


@router.get("/paths", response_model=LineagePathResponse)
async def find_paths(
    source_id: str = Query(..., description="Source node ID"),
    target_id: str = Query(..., description="Target node ID"),
    max_depth: int = Query(5, ge=1, le=10, description="Maximum path depth")
):
    """Find all paths between two nodes"""
    try:
        return LineageService.find_paths(source_id, target_id, max_depth)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find paths: {str(e)}"
        )


@router.get("/hierarchical")
async def get_hierarchical_lineage() -> Dict[str, Any]:
    """Get hierarchical lineage (Country -> Database -> Attribute)"""
    try:
        return LineageService.get_hierarchical_lineage()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hierarchical lineage: {str(e)}"
        )