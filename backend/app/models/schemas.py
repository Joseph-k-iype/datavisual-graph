# backend/app/models/schemas.py
"""
Complete Schema Models for Data Lineage System
Includes all models needed for schema operations
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
# ATTRIBUTE MODEL (CRITICAL - MUST BE HERE)
# ============================================

class Attribute(BaseModel):
    """Attribute definition - COMPLETE MODEL"""
    id: str = Field(..., description="Unique attribute ID")
    name: str = Field(..., description="Attribute name")
    data_type: str = Field(default="string", description="Data type")
    is_primary_key: bool = Field(default=False, description="Is primary key")
    is_foreign_key: bool = Field(default=False, description="Is foreign key")
    is_nullable: bool = Field(default=True, description="Can be null")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# ============================================
# SCHEMA DEFINITION MODELS
# ============================================

class SchemaClass(BaseModel):
    """Definition of a class in the schema"""
    id: str = Field(..., description="Unique identifier for the class")
    name: str = Field(..., description="Name of the class (e.g., Customer, Order)")
    attributes: List[Any] = Field(default_factory=list, description="List of attributes (can be strings or Attribute objects)")
    parent_id: Optional[str] = Field(None, description="Parent class ID for hierarchy")
    children: List['SchemaClass'] = Field(default_factory=list, description="Child classes")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


# Enable forward reference for SchemaClass
SchemaClass.model_rebuild()


class SchemaRelationship(BaseModel):
    """Definition of a relationship between classes"""
    id: str = Field(..., description="Unique identifier for the relationship")
    name: str = Field(..., description="Name of the relationship")
    source_class_id: str = Field(..., description="Source class ID")
    target_class_id: str = Field(..., description="Target class ID")
    cardinality: Cardinality = Field(..., description="Cardinality of the relationship")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


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
    """A node in the lineage graph"""
    id: str = Field(..., description="Unique identifier")
    type: str = Field(..., description="Type of node (class, instance, etc.)")
    label: str = Field(..., description="Display label")
    level: int = Field(default=0, description="Hierarchy level")
    parent_id: Optional[str] = Field(None, description="Parent node ID")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    collapsed: bool = Field(default=False, description="Whether children are collapsed")
    position: Optional[Dict[str, float]] = Field(None, description="Visual position (x, y)")
    attributes: List[Attribute] = Field(default_factory=list, description="Node attributes")
    instance_count: int = Field(default=0, description="Number of instances")


class LineageEdge(BaseModel):
    """An edge in the lineage graph"""
    id: str = Field(..., description="Unique identifier")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    type: str = Field(..., description="Type of edge (schema_relationship, hierarchy, etc.)")
    label: Optional[str] = Field(None, description="Edge label")
    cardinality: Optional[str] = Field(None, description="Cardinality if applicable")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class LineageGraphResponse(BaseModel):
    """Complete lineage graph response"""
    schema_id: str = Field(..., description="Schema ID")
    schema_name: str = Field(..., description="Schema name")
    nodes: List[LineageNode] = Field(..., description="All nodes in the graph")
    edges: List[LineageEdge] = Field(..., description="All edges in the graph")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Graph metadata")


class LineagePathRequest(BaseModel):
    """Request to find lineage path"""
    start_node_id: str = Field(..., description="Starting node ID")
    end_node_id: str = Field(..., description="Ending node ID")
    max_depth: int = Field(default=5, description="Maximum depth to traverse")


class LineagePathResponse(BaseModel):
    """Response with lineage path"""
    start_node_id: str = Field(..., description="Starting node ID")
    end_node_id: str = Field(..., description="Ending node ID")
    paths: List[List[str]] = Field(..., description="List of paths (each path is list of node IDs)")
    total_paths: int = Field(..., description="Total number of paths found")


# ============================================
# STATS MODELS
# ============================================

class SchemaStats(BaseModel):
    """Statistics for a schema"""
    total_classes: int = Field(default=0, description="Number of classes")
    total_relationships: int = Field(default=0, description="Number of relationships")
    total_instances: int = Field(default=0, description="Number of data instances")


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