# backend/app/models/schemas.py
"""
Enhanced Schema Models for Data Lineage System
Supports schema definition, data loading, and hierarchical visualization
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from enum import Enum


# ============================================
# CARDINALITY ENUM
# ============================================

class Cardinality(str, Enum):
    ONE_TO_ONE = "1:1"
    ONE_TO_MANY = "1:N"
    MANY_TO_ONE = "N:1"
    MANY_TO_MANY = "N:M"


# ============================================
# SCHEMA DEFINITION MODELS
# ============================================

class SchemaClass(BaseModel):
    """Definition of a class in the schema"""
    id: str = Field(..., description="Unique identifier for the class")
    name: str = Field(..., description="Name of the class (e.g., Customer, Order)")
    description: Optional[str] = Field(None, description="Description of the class")
    attributes: List[str] = Field(default_factory=list, description="List of attribute names")
    color: Optional[str] = Field(None, description="Color for visualization")
    icon: Optional[str] = Field(None, description="Icon name for visualization")


class SchemaRelationship(BaseModel):
    """Definition of a relationship between classes"""
    id: str = Field(..., description="Unique identifier for the relationship")
    name: str = Field(..., description="Name of the relationship")
    source_class_id: str = Field(..., description="Source class ID")
    target_class_id: str = Field(..., description="Target class ID")
    cardinality: Cardinality = Field(..., description="Cardinality of the relationship")
    description: Optional[str] = Field(None, description="Description of the relationship")
    bidirectional: bool = Field(default=False, description="Whether the relationship is bidirectional")


class SchemaDefinition(BaseModel):
    """Complete schema definition"""
    id: str = Field(..., description="Unique identifier for the schema")
    name: str = Field(..., description="Name of the schema")
    description: Optional[str] = Field(None, description="Description of the schema")
    version: str = Field(default="1.0.0", description="Schema version")
    classes: List[SchemaClass] = Field(default_factory=list, description="Classes in the schema")
    relationships: List[SchemaRelationship] = Field(default_factory=list, description="Relationships in the schema")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class SchemaCreateRequest(BaseModel):
    """Request to create a new schema"""
    name: str = Field(..., description="Name of the schema")
    description: Optional[str] = Field(None, description="Description of the schema")
    classes: List[SchemaClass] = Field(..., description="Classes in the schema")
    relationships: List[SchemaRelationship] = Field(..., description="Relationships in the schema")


# ============================================
# DATA INSTANCE MODELS
# ============================================

class DataInstance(BaseModel):
    """An instance of a schema class with actual data"""
    id: str = Field(..., description="Unique identifier for the instance")
    class_id: str = Field(..., description="ID of the schema class this instance belongs to")
    class_name: str = Field(..., description="Name of the schema class")
    data: Dict[str, Any] = Field(..., description="Actual data values")
    source_file: Optional[str] = Field(None, description="Source file name")
    source_row: Optional[int] = Field(None, description="Row number in source file")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class DataRelationship(BaseModel):
    """A relationship instance between data instances"""
    id: str = Field(..., description="Unique identifier for the relationship instance")
    schema_relationship_id: str = Field(..., description="ID of the schema relationship")
    source_instance_id: str = Field(..., description="Source data instance ID")
    target_instance_id: str = Field(..., description="Target data instance ID")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================
# DATA LOADING MODELS
# ============================================

class DataFormat(str, Enum):
    CSV = "csv"
    EXCEL = "excel"
    JSON = "json"
    XML = "xml"


class ColumnMapping(BaseModel):
    """Mapping between data file column and schema attribute"""
    source_column: str = Field(..., description="Column name in source file")
    target_attribute: str = Field(..., description="Attribute name in schema class")
    transform: Optional[str] = Field(None, description="Optional transformation function")


class ClassDataMapping(BaseModel):
    """Mapping configuration for a class"""
    class_id: str = Field(..., description="Schema class ID")
    column_mappings: List[ColumnMapping] = Field(..., description="Column to attribute mappings")
    primary_key: Optional[str] = Field(None, description="Primary key column for relationships")


class DataLoadRequest(BaseModel):
    """Request to load data into schema"""
    schema_id: str = Field(..., description="Schema ID to load data into")
    format: DataFormat = Field(..., description="Format of the data file")
    file_name: str = Field(..., description="Name of the uploaded file")
    class_mappings: List[ClassDataMapping] = Field(..., description="Mappings for each class")
    relationship_mappings: Optional[List[Dict[str, str]]] = Field(
        None, 
        description="Mappings for relationships"
    )


class DataLoadResponse(BaseModel):
    """Response after loading data"""
    success: bool = Field(..., description="Whether the load was successful")
    schema_id: str = Field(..., description="Schema ID")
    instances_created: int = Field(..., description="Number of data instances created")
    relationships_created: int = Field(..., description="Number of relationships created")
    errors: List[str] = Field(default_factory=list, description="Any errors encountered")
    warnings: List[str] = Field(default_factory=list, description="Any warnings")


# ============================================
# LINEAGE MODELS
# ============================================

class LineageNode(BaseModel):
    """A node in the lineage graph (can be schema class or data instance)"""
    id: str = Field(..., description="Unique identifier")
    type: Literal["schema_class", "data_instance"] = Field(..., description="Type of node")
    name: str = Field(..., description="Display name")
    schema_id: Optional[str] = Field(None, description="Schema ID if applicable")
    class_id: Optional[str] = Field(None, description="Class ID if applicable")
    parent_id: Optional[str] = Field(None, description="Parent node ID for hierarchy")
    data: Dict[str, Any] = Field(default_factory=dict, description="Node data")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    collapsed: bool = Field(default=True, description="Whether children are collapsed")
    position: Optional[Dict[str, float]] = Field(None, description="Visual position")


class LineageEdge(BaseModel):
    """An edge in the lineage graph"""
    id: str = Field(..., description="Unique identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    type: Literal["schema_relationship", "data_relationship", "parent_child"] = Field(
        ..., 
        description="Type of edge"
    )
    label: Optional[str] = Field(None, description="Edge label")
    cardinality: Optional[Cardinality] = Field(None, description="Cardinality if applicable")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class LineageGraphResponse(BaseModel):
    """Complete lineage graph response"""
    schema_id: str = Field(..., description="Schema ID")
    schema_name: str = Field(..., description="Schema name")
    nodes: List[LineageNode] = Field(..., description="All nodes in the graph")
    edges: List[LineageEdge] = Field(..., description="All edges in the graph")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class LineagePathRequest(BaseModel):
    """Request to find lineage path"""
    start_node_id: str = Field(..., description="Starting node ID")
    end_node_id: Optional[str] = Field(None, description="Ending node ID (optional)")
    max_depth: int = Field(default=10, description="Maximum depth to traverse")


class LineagePathResponse(BaseModel):
    """Response with lineage path"""
    paths: List[List[str]] = Field(..., description="List of paths (each path is list of node IDs)")
    highlighted_nodes: List[str] = Field(..., description="All nodes in the paths")
    highlighted_edges: List[str] = Field(..., description="All edges in the paths")


# ============================================
# STATS MODELS
# ============================================

class SchemaStats(BaseModel):
    """Statistics for a schema"""
    schema_id: str = Field(..., description="Schema ID")
    schema_name: str = Field(..., description="Schema name")
    total_classes: int = Field(..., description="Number of classes")
    total_relationships: int = Field(..., description="Number of relationships")
    total_instances: int = Field(..., description="Number of data instances")
    total_data_relationships: int = Field(..., description="Number of data relationships")
    instances_by_class: Dict[str, int] = Field(..., description="Instance count per class")


# ============================================
# RESPONSE MODELS
# ============================================

class SuccessResponse(BaseModel):
    """Generic success response"""
    success: bool = Field(default=True, description="Success flag")
    message: str = Field(..., description="Success message")
    data: Optional[Dict[str, Any]] = Field(None, description="Optional data")


class ErrorResponse(BaseModel):
    """Generic error response"""
    success: bool = Field(default=False, description="Success flag")
    error: str = Field(..., description="Error message")
    details: Optional[Dict[str, Any]] = Field(None, description="Optional error details")