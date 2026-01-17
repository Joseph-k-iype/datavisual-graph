# backend/app/models/lineage/attribute.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum
from datetime import datetime


class DataType(str, Enum):
    """Data types for attributes"""
    STRING = "string"
    NUMBER = "number"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    JSON = "json"
    BINARY = "binary"


class SensitivityLevel(str, Enum):
    """Data sensitivity classification"""
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class TransformationType(str, Enum):
    """Types of transformations"""
    DIRECT_COPY = "direct_copy"
    CALCULATION = "calculation"
    LOOKUP = "lookup"
    AGGREGATION = "aggregation"
    CUSTOM = "custom"


class ValidationRule(BaseModel):
    """Validation rule for an attribute"""
    type: str = Field(..., description="Validation type (regex, range, enum, custom)")
    value: Any = Field(..., description="Validation value/expression")
    error_message: Optional[str] = Field(None, description="Custom error message")


class Attribute(BaseModel):
    """Attribute definition"""
    id: str = Field(..., description="Unique attribute ID")
    name: str = Field(..., description="Attribute name")
    display_name: Optional[str] = Field(None, description="Human-readable name")
    data_type: DataType = Field(..., description="Data type")
    is_primary_key: bool = Field(default=False, description="Is primary key")
    is_foreign_key: bool = Field(default=False, description="Is foreign key")
    is_nullable: bool = Field(default=True, description="Can be null")
    description: Optional[str] = Field(None, description="Technical description")
    business_name: Optional[str] = Field(None, description="Business name")
    business_description: Optional[str] = Field(None, description="Business description")
    sensitivity_level: Optional[SensitivityLevel] = Field(None, description="Sensitivity level")
    lineage_enabled: bool = Field(default=True, description="Enable lineage tracking")
    position: int = Field(default=0, description="Display position")
    sample_values: Optional[List[Any]] = Field(None, description="Sample values")
    validation_rules: Optional[List[ValidationRule]] = Field(None, description="Validation rules")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class TransformationRule(BaseModel):
    """Transformation rule for attribute lineage"""
    id: str = Field(..., description="Transformation ID")
    name: Optional[str] = Field(None, description="Transformation name")
    type: TransformationType = Field(..., description="Transformation type")
    expression: Optional[str] = Field(None, description="Transformation expression")
    language: Optional[str] = Field(None, description="Expression language (sql, python, etc)")
    description: Optional[str] = Field(None, description="Description")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AttributeMapping(BaseModel):
    """Mapping between source and target attributes"""
    source_attribute_id: str = Field(..., description="Source attribute ID")
    target_attribute_id: str = Field(..., description="Target attribute ID")
    transformation: Optional[str] = Field(None, description="Transformation expression")
    transformation_type: TransformationType = Field(
        default=TransformationType.DIRECT_COPY,
        description="Type of transformation"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AttributeLineageNode(BaseModel):
    """Node in attribute lineage path"""
    attribute_id: str = Field(..., description="Attribute ID")
    attribute_name: str = Field(..., description="Attribute name")
    class_id: str = Field(..., description="Parent class ID")
    class_name: str = Field(..., description="Parent class name")
    level: int = Field(..., description="Distance from source")
    data_type: DataType = Field(..., description="Data type")
    transformation: Optional[TransformationRule] = Field(None, description="Applied transformation")
    sample_value: Optional[Any] = Field(None, description="Sample value")


class AttributeLineagePath(BaseModel):
    """Complete lineage path between attributes"""
    path_id: str = Field(..., description="Path ID")
    attributes: List[AttributeLineageNode] = Field(..., description="Attributes in path")
    transformations: List[TransformationRule] = Field(
        default_factory=list,
        description="Transformations in path"
    )
    total_hops: int = Field(..., description="Number of hops in path")
    confidence_score: Optional[float] = Field(
        None,
        description="Confidence score for auto-detected lineage"
    )


class AttributeLineage(BaseModel):
    """Complete lineage information for an attribute"""
    attribute_id: str = Field(..., description="Attribute ID")
    attribute_name: str = Field(..., description="Attribute name")
    class_id: str = Field(..., description="Parent class ID")
    class_name: str = Field(..., description="Parent class name")
    source_attributes: List[AttributeLineageNode] = Field(
        default_factory=list,
        description="Upstream source attributes"
    )
    target_attributes: List[AttributeLineageNode] = Field(
        default_factory=list,
        description="Downstream target attributes"
    )
    lineage_paths: List[AttributeLineagePath] = Field(
        default_factory=list,
        description="Complete lineage paths"
    )
    impacted_attributes: List[str] = Field(
        default_factory=list,
        description="IDs of impacted attributes"
    )
    impacted_instances: int = Field(default=0, description="Number of impacted data instances")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AttributeTraceRequest(BaseModel):
    """Request for attribute lineage trace"""
    attribute_id: str = Field(..., description="Attribute ID to trace")
    direction: str = Field(
        default="both",
        description="Trace direction (upstream, downstream, both)"
    )
    max_depth: int = Field(default=10, description="Maximum trace depth")
    include_transformations: bool = Field(
        default=True,
        description="Include transformation details"
    )
    include_sample_data: bool = Field(
        default=False,
        description="Include sample data values"
    )


class AttributeTraceResponse(BaseModel):
    """Response with attribute lineage trace"""
    attribute: Attribute = Field(..., description="Source attribute")
    lineage: AttributeLineage = Field(..., description="Complete lineage")
    highlighted_nodes: List[str] = Field(
        default_factory=list,
        description="Node IDs to highlight"
    )
    highlighted_edges: List[str] = Field(
        default_factory=list,
        description="Edge IDs to highlight"
    )
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ImpactAnalysisRequest(BaseModel):
    """Request for impact analysis"""
    node_id: str = Field(..., description="Node ID")
    node_type: str = Field(..., description="Node type (class, attribute, instance)")
    analysis_type: str = Field(
        default="both",
        description="Analysis type (downstream, upstream, both)"
    )
    max_depth: int = Field(default=10, description="Maximum analysis depth")


class ImpactAnalysisResponse(BaseModel):
    """Response with impact analysis"""
    source_node_id: str = Field(..., description="Source node ID")
    impacted_nodes: List[str] = Field(default_factory=list, description="Impacted node IDs")
    impacted_count: int = Field(..., description="Total impacted nodes")
    impact_levels: Dict[str, int] = Field(
        default_factory=dict,
        description="Impact by level (direct, indirect, total)"
    )
    critical_paths: List[AttributeLineagePath] = Field(
        default_factory=list,
        description="Critical dependency paths"
    )
    risk_score: Optional[float] = Field(None, description="Risk score (0-1)")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AttributeValue(BaseModel):
    """Value of an attribute in a data instance"""
    attribute_id: str = Field(..., description="Attribute ID")
    attribute_name: str = Field(..., description="Attribute name")
    value: Any = Field(..., description="Attribute value")
    display_value: Optional[str] = Field(None, description="Formatted display value")
    previous_value: Optional[Any] = Field(None, description="Previous value (for change tracking)")
    source_attribute_id: Optional[str] = Field(
        None,
        description="Source attribute in lineage"
    )
    transformation_applied: Optional[TransformationRule] = Field(
        None,
        description="Transformation applied"
    )
    confidence_score: Optional[float] = Field(None, description="Confidence score")
    data_quality_score: Optional[float] = Field(None, description="Data quality score")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreateAttributeRequest(BaseModel):
    """Request to create a new attribute"""
    class_id: str = Field(..., description="Parent class ID")
    name: str = Field(..., description="Attribute name")
    display_name: Optional[str] = Field(None, description="Display name")
    data_type: DataType = Field(..., description="Data type")
    is_primary_key: bool = Field(default=False)
    is_foreign_key: bool = Field(default=False)
    is_nullable: bool = Field(default=True)
    description: Optional[str] = Field(None)
    position: int = Field(default=0)
    validation_rules: Optional[List[ValidationRule]] = Field(None)


class UpdateAttributeRequest(BaseModel):
    """Request to update an attribute"""
    name: Optional[str] = Field(None, description="Attribute name")
    display_name: Optional[str] = Field(None, description="Display name")
    data_type: Optional[DataType] = Field(None, description="Data type")
    description: Optional[str] = Field(None)
    position: Optional[int] = Field(None)
    lineage_enabled: Optional[bool] = Field(None)


class AttributeFlowRequest(BaseModel):
    """Request to create attribute flow relationship"""
    source_attribute_id: str = Field(..., description="Source attribute ID")
    target_attribute_id: str = Field(..., description="Target attribute ID")
    transformation: Optional[TransformationRule] = Field(None, description="Transformation rule")