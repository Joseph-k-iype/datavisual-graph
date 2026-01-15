from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class NodeType(str, Enum):
    COUNTRY = "Country"
    DATABASE = "Database"
    ATTRIBUTE = "Attribute"


class Country(BaseModel):
    id: str
    name: str
    code: str
    region: str
    dataProtectionRegime: str
    adequacyStatus: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class Database(BaseModel):
    id: str
    name: str
    countryId: str
    type: str
    classification: str
    owner: str
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class Attribute(BaseModel):
    id: str
    name: str
    databaseId: str
    dataType: str
    category: str
    sensitivity: str
    isPII: bool
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class Transfer(BaseModel):
    id: str
    sourceType: str
    sourceId: str
    targetType: str
    targetId: str
    dataCategories: List[str]
    legalBasis: str
    frequency: Optional[str] = None
    volume: Optional[str] = None
    purpose: Optional[str] = None
    transformationType: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class NodeCreate(BaseModel):
    nodeType: NodeType
    properties: Dict[str, Any]


class NodeUpdate(BaseModel):
    properties: Dict[str, Any]


class RelationshipCreate(BaseModel):
    sourceId: str
    sourceType: NodeType
    targetId: str
    targetType: NodeType
    relationshipType: str
    properties: Optional[Dict[str, Any]] = Field(default_factory=dict)


class LineageQuery(BaseModel):
    nodeId: str
    nodeType: NodeType
    direction: str = Field(default="both", pattern="^(upstream|downstream|both)$")
    maxDepth: int = Field(default=5, ge=1, le=10)
    dataCategories: Optional[List[str]] = None


class GraphNode(BaseModel):
    id: str
    type: str
    data: Dict[str, Any]
    position: Optional[Dict[str, float]] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str
    data: Dict[str, Any]


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class LineagePathResponse(BaseModel):
    paths: List[List[str]]
    nodes: List[GraphNode]
    edges: List[GraphEdge]


class NodeResponse(BaseModel):
    id: str
    type: str
    properties: Dict[str, Any]
    relationships: Optional[List[Dict[str, Any]]] = None


class StatsResponse(BaseModel):
    totalCountries: int
    totalDatabases: int
    totalAttributes: int
    totalTransfers: int
    dataCategories: List[str]
    regions: List[str]


# ========== NEW: GROUP SCHEMAS ==========

class GroupNodesRequest(BaseModel):
    """Request to group multiple nodes"""
    nodeIds: List[str] = Field(..., description="List of node IDs to group")
    groupName: str = Field(..., min_length=1, max_length=100, description="Name for the group")


class UngroupNodesRequest(BaseModel):
    """Request to remove group from nodes"""
    nodeIds: List[str] = Field(..., description="List of node IDs to ungroup")


class GroupResponse(BaseModel):
    """Response for group operations"""
    groupName: str
    nodeCount: int
    nodes: List[NodeResponse]


class GroupListResponse(BaseModel):
    """Response listing all groups"""
    groups: List[str]