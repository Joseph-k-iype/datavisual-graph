# backend/app/models/lineage/hierarchy.py
"""
Hierarchy Models - FULLY FIXED
Models for class hierarchy operations
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum


# ============================================
# ATTRIBUTE MODEL
# ============================================

class Attribute(BaseModel):
    """Attribute definition"""
    id: str = Field(..., description="Unique identifier")
    name: str = Field(..., description="Attribute name")
    data_type: str = Field(default="string", description="Data type")
    is_primary_key: bool = Field(default=False, description="Is primary key")
    is_foreign_key: bool = Field(default=False, description="Is foreign key")
    is_nullable: bool = Field(default=True, description="Is nullable")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================
# HIERARCHY NODE MODEL
# ============================================

class HierarchyNode(BaseModel):
    """Node in hierarchy tree representing a class or subclass"""
    id: str = Field(..., description="Class ID")
    name: str = Field(..., description="Class name")
    display_name: str = Field(..., description="Display name")
    type: str = Field(..., description="Node type: 'class' or 'subclass'")
    level: int = Field(default=0, description="Hierarchy level (0 = root)")
    parent_id: Optional[str] = Field(None, description="Parent class ID")
    children: List['HierarchyNode'] = Field(default_factory=list, description="Child nodes")
    attributes: List[Attribute] = Field(default_factory=list, description="Class attributes")
    instance_count: int = Field(default=0, description="Number of data instances")
    collapsed: bool = Field(default=False, description="UI collapse state")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================
# HIERARCHY TREE MODEL
# ============================================

class HierarchyTree(BaseModel):
    """Complete hierarchy tree for a schema"""
    schema_id: str = Field(..., description="Schema ID")
    root_nodes: List[HierarchyNode] = Field(..., description="Root level nodes")
    max_depth: int = Field(..., description="Maximum depth of tree")
    total_nodes: int = Field(..., description="Total number of nodes")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================
# REQUEST MODELS
# ============================================

class CreateSubclassRequest(BaseModel):
    """Request to create a subclass"""
    parent_class_id: str = Field(..., description="Parent class ID")
    name: str = Field(..., description="Subclass name")
    display_name: Optional[str] = Field(None, description="Display name")
    description: Optional[str] = Field(None, description="Description")
    inherit_attributes: bool = Field(default=True, description="Inherit parent attributes")
    additional_attributes: List[Attribute] = Field(
        default_factory=list,
        description="Additional attributes specific to this subclass"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class UpdateClassRequest(BaseModel):
    """Request to update a class"""
    name: Optional[str] = Field(None, description="New name")
    display_name: Optional[str] = Field(None, description="New display name")
    metadata: Optional[Dict[str, Any]] = Field(None, description="New metadata")


# ============================================
# RESPONSE MODELS
# ============================================

class HierarchyStatsResponse(BaseModel):
    """Statistics about class hierarchy"""
    schema_id: str = Field(..., description="Schema ID")
    total_classes: int = Field(..., description="Total number of classes")
    root_classes: int = Field(..., description="Number of root classes")
    max_depth: int = Field(..., description="Maximum hierarchy depth")
    avg_children_per_class: float = Field(..., description="Average children per class")


# Enable forward references
HierarchyNode.model_rebuild()