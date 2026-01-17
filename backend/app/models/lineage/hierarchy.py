# backend/app/models/lineage/hierarchy.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .attribute import Attribute


class HierarchyNode(BaseModel):
    """Node in class hierarchy tree"""
    id: str = Field(..., description="Class ID")
    name: str = Field(..., description="Class name")
    display_name: Optional[str] = Field(None, description="Display name")
    type: str = Field(default="class", description="Node type: class, subclass")
    level: int = Field(..., description="Hierarchy level (0 = root)")
    parent_id: Optional[str] = Field(None, description="Parent class ID")
    children: List['HierarchyNode'] = Field(default_factory=list, description="Child nodes")
    attributes: List[Attribute] = Field(default_factory=list, description="Class attributes")
    instance_count: Optional[int] = Field(None, description="Number of instances")
    collapsed: bool = Field(default=False, description="Is collapsed")
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Required for forward reference
HierarchyNode.model_rebuild()


class HierarchyTree(BaseModel):
    """Complete hierarchy tree"""
    schema_id: str = Field(..., description="Schema ID")
    root_nodes: List[HierarchyNode] = Field(default_factory=list, description="Root nodes")
    max_depth: int = Field(default=0, description="Maximum tree depth")
    total_nodes: int = Field(default=0, description="Total number of nodes")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreateClassRequest(BaseModel):
    """Request to create a new class"""
    schema_id: str = Field(..., description="Schema ID")
    name: str = Field(..., description="Class name")
    display_name: Optional[str] = Field(None, description="Display name")
    description: Optional[str] = Field(None, description="Description")
    parent_class_id: Optional[str] = Field(None, description="Parent class ID (for subclasses)")
    attributes: List[Attribute] = Field(default_factory=list, description="Initial attributes")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreateSubclassRequest(BaseModel):
    """Request to create a subclass"""
    parent_class_id: str = Field(..., description="Parent class ID")
    name: str = Field(..., description="Subclass name")
    display_name: Optional[str] = Field(None, description="Display name")
    description: Optional[str] = Field(None, description="Description")
    inherit_attributes: bool = Field(default=True, description="Inherit parent attributes")
    additional_attributes: List[Attribute] = Field(
        default_factory=list,
        description="Additional attributes beyond inherited ones"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class UpdateClassRequest(BaseModel):
    """Request to update a class"""
    name: Optional[str] = Field(None, description="Class name")
    display_name: Optional[str] = Field(None, description="Display name")
    description: Optional[str] = Field(None, description="Description")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Metadata")


class MoveClassRequest(BaseModel):
    """Request to move a class in hierarchy"""
    class_id: str = Field(..., description="Class ID to move")
    new_parent_id: Optional[str] = Field(None, description="New parent ID (None for root)")
    position: Optional[int] = Field(None, description="Position in new parent's children")


class HierarchyStatsResponse(BaseModel):
    """Hierarchy statistics"""
    schema_id: str = Field(..., description="Schema ID")
    total_classes: int = Field(..., description="Total number of classes")
    total_subclasses: int = Field(..., description="Total number of subclasses")
    max_depth: int = Field(..., description="Maximum hierarchy depth")
    root_classes: int = Field(..., description="Number of root classes")
    leaf_classes: int = Field(..., description="Number of leaf classes (no children)")
    avg_children_per_class: float = Field(..., description="Average children per class")
    classes_by_level: Dict[int, int] = Field(
        default_factory=dict,
        description="Number of classes at each level"
    )