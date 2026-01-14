from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any
from ..models.schemas import RelationshipCreate
from ..services.graph_service import GraphService

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_relationship(rel_data: RelationshipCreate) -> Dict[str, Any]:
    """Create a new relationship between two nodes"""
    try:
        return GraphService.create_relationship(rel_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create relationship: {str(e)}"
        )