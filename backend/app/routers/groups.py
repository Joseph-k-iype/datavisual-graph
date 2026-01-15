from fastapi import APIRouter, HTTPException, status
from typing import List
from ..models.schemas import (
    GroupNodesRequest, UngroupNodesRequest, GroupResponse, GroupListResponse, NodeResponse
)
from ..services.graph_service import GraphService

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("/", response_model=GroupResponse, status_code=status.HTTP_200_OK)
async def group_nodes(request: GroupNodesRequest):
    """Group multiple nodes under a common name"""
    try:
        if not request.nodeIds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one node ID must be provided"
            )
        
        updated_nodes = GraphService.update_node_groups(
            node_ids=request.nodeIds,
            group_name=request.groupName
        )
        
        return GroupResponse(
            groupName=request.groupName,
            nodeCount=len(updated_nodes),
            nodes=updated_nodes
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to group nodes: {str(e)}"
        )


@router.delete("/", response_model=List[NodeResponse], status_code=status.HTTP_200_OK)
async def ungroup_nodes(request: UngroupNodesRequest):
    """Remove group property from multiple nodes"""
    try:
        if not request.nodeIds:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one node ID must be provided"
            )
        
        updated_nodes = GraphService.remove_node_groups(node_ids=request.nodeIds)
        
        return updated_nodes
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to ungroup nodes: {str(e)}"
        )


@router.get("/", response_model=GroupListResponse, status_code=status.HTTP_200_OK)
async def get_all_groups():
    """Get list of all unique group names"""
    try:
        groups = GraphService.get_all_groups()
        return GroupListResponse(groups=groups)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get groups: {str(e)}"
        )


@router.get("/{group_name}", response_model=GroupResponse, status_code=status.HTTP_200_OK)
async def get_nodes_in_group(group_name: str):
    """Get all nodes in a specific group"""
    try:
        nodes = GraphService.get_nodes_by_group(group_name)
        
        if not nodes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No nodes found in group '{group_name}'"
            )
        
        return GroupResponse(
            groupName=group_name,
            nodeCount=len(nodes),
            nodes=nodes
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get nodes in group: {str(e)}"
        )