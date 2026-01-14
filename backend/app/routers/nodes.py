from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from ..models.schemas import (
    NodeType, NodeCreate, NodeUpdate, NodeResponse, StatsResponse
)
from ..services.graph_service import GraphService

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.post("/", response_model=NodeResponse, status_code=status.HTTP_201_CREATED)
async def create_node(node_data: NodeCreate):
    """Create a new node"""
    try:
        return GraphService.create_node(node_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create node: {str(e)}"
        )


@router.get("/{node_type}/{node_id}", response_model=NodeResponse)
async def get_node(node_type: NodeType, node_id: str):
    """Get a node by ID and type"""
    try:
        node = GraphService.get_node(node_id, node_type)
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node {node_id} of type {node_type} not found"
            )
        return node
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get node: {str(e)}"
        )


@router.put("/{node_type}/{node_id}", response_model=NodeResponse)
async def update_node(node_type: NodeType, node_id: str, update_data: NodeUpdate):
    """Update a node's properties"""
    try:
        return GraphService.update_node(node_id, node_type, update_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update node: {str(e)}"
        )


@router.delete("/{node_type}/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(node_type: NodeType, node_id: str):
    """Delete a node"""
    try:
        deleted = GraphService.delete_node(node_id, node_type)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node {node_id} of type {node_type} not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete node: {str(e)}"
        )


@router.get("/", response_model=List[NodeResponse])
async def get_all_nodes(node_type: Optional[NodeType] = None):
    """Get all nodes, optionally filtered by type"""
    try:
        return GraphService.get_all_nodes(node_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get nodes: {str(e)}"
        )


@router.get("/stats/summary", response_model=StatsResponse)
async def get_stats():
    """Get graph statistics"""
    try:
        return GraphService.get_stats()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get stats: {str(e)}"
        )