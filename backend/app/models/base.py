# backend/app/models/base.py

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from datetime import datetime


class BaseNodeModel(BaseModel):
    """Base model for all graph nodes"""
    id: str = Field(..., description="Unique identifier")
    created_at: Optional[datetime] = Field(None, description="Creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Update timestamp")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class BaseRelationshipModel(BaseModel):
    """Base model for all graph relationships"""
    id: str = Field(..., description="Unique identifier")
    source_id: str = Field(..., description="Source node ID")
    target_id: str = Field(..., description="Target node ID")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class APIResponse(BaseModel):
    """Standard API response wrapper"""
    success: bool = Field(..., description="Operation success status")
    message: Optional[str] = Field(None, description="Response message")
    data: Optional[Any] = Field(None, description="Response data")
    errors: list[str] = Field(default_factory=list, description="Error messages")


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=20, ge=1, le=100, description="Items per page")
    
    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""
    items: list[Any] = Field(..., description="Page items")
    total: int = Field(..., description="Total items")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Items per page")
    total_pages: int = Field(..., description="Total pages")
    
    @classmethod
    def create(cls, items: list[Any], total: int, page: int, page_size: int):
        """Create paginated response"""
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=(total + page_size - 1) // page_size
        )