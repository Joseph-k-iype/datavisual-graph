# backend/app/routers/groups.py
"""
Legacy groups router - kept for backward compatibility
Groups functionality is superseded by schema classes
"""

from fastapi import APIRouter, HTTPException, status
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("/")
async def list_groups():
    """List all groups - legacy endpoint"""
    return {
        "message": "This endpoint is deprecated. Groups are now represented as schema classes.",
        "groups": []
    }


@router.post("/")
async def create_group(group_name: str, node_ids: list):
    """Create group - legacy endpoint"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This endpoint is deprecated. Use schema classes instead."
    )


@router.delete("/{group_id}")
async def delete_group(group_id: str):
    """Delete group - legacy endpoint"""
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="This endpoint is deprecated."
    )