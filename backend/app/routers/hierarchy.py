# backend/app/routers/hierarchy.py
"""
Hierarchy Router - API endpoints for class hierarchy management
"""

from fastapi import APIRouter, HTTPException, status
from typing import Optional
from ..models.lineage.hierarchy import (
    HierarchyTree, HierarchyNode, CreateClassRequest,
    CreateSubclassRequest, UpdateClassRequest, HierarchyStatsResponse
)
from ..services.hierarchy_service import HierarchyService
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/hierarchy", tags=["hierarchy"])


@router.get("/{schema_id}/tree", response_model=HierarchyTree)
async def get_hierarchy_tree(schema_id: str):
    """
    Get complete hierarchy tree for a schema
    Returns a tree structure with parent-child relationships
    """
    try:
        tree = HierarchyService.get_hierarchy_tree(schema_id)
        return tree
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get hierarchy tree: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hierarchy tree: {str(e)}"
        )


@router.post("/{schema_id}/subclass", response_model=HierarchyNode)
async def create_subclass(schema_id: str, request: CreateSubclassRequest):
    """
    Create a subclass under a parent class
    Automatically creates SUBCLASS_OF relationship in the graph
    """
    try:
        subclass = HierarchyService.create_subclass(schema_id, request)
        return subclass
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to create subclass: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create subclass: {str(e)}"
        )


@router.get("/{schema_id}/stats", response_model=HierarchyStatsResponse)
async def get_hierarchy_stats(schema_id: str):
    """
    Get statistics about the class hierarchy
    """
    try:
        stats = HierarchyService.get_hierarchy_stats(schema_id)
        return stats
    except Exception as e:
        logger.error(f"Failed to get hierarchy stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hierarchy stats: {str(e)}"
        )