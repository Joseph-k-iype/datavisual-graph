# backend/app/routers/hierarchy.py
"""
Hierarchy Router - FULLY FIXED
API endpoints for class hierarchy management including subclass creation
"""

from fastapi import APIRouter, HTTPException, status
from typing import Optional
from ..models.lineage.hierarchy import (
    HierarchyTree, HierarchyNode, CreateSubclassRequest,
    UpdateClassRequest, HierarchyStatsResponse
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
    ✅ FIXED: Create a subclass under a parent class
    Automatically creates HAS_SUBCLASS relationship in the graph
    """
    try:
        logger.info(f"API: Creating subclass {request.name} in schema {schema_id}")
        logger.info(f"   Parent: {request.parent_class_id}")
        logger.info(f"   Additional attributes: {len(request.additional_attributes)}")
        
        subclass = HierarchyService.create_subclass(schema_id, request)
        
        logger.info(f"✅ API: Subclass created successfully: {subclass.id}")
        return subclass
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
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


@router.patch("/{schema_id}/class/{class_id}", response_model=HierarchyNode)
async def update_class(
    schema_id: str,
    class_id: str,
    request: UpdateClassRequest
):
    """Update a class or subclass"""
    try:
        updated_class = HierarchyService.update_class(schema_id, class_id, request)
        return updated_class
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to update class: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update class: {str(e)}"
        )


@router.delete("/{schema_id}/class/{class_id}")
async def delete_class(schema_id: str, class_id: str):
    """Delete a class and all its subclasses"""
    try:
        HierarchyService.delete_class(schema_id, class_id)
        return {"success": True, "message": f"Class {class_id} deleted successfully"}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to delete class: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete class: {str(e)}"
        )


@router.get("/{schema_id}/stats", response_model=HierarchyStatsResponse)
async def get_hierarchy_stats(schema_id: str):
    """Get statistics about the class hierarchy"""
    try:
        stats = HierarchyService.get_hierarchy_stats(schema_id)
        return stats
    except Exception as e:
        logger.error(f"Failed to get hierarchy stats: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hierarchy stats: {str(e)}"
        )