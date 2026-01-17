# backend/app/models/data/instance.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from ..lineage.attribute import AttributeValue


class DataInstance(BaseModel):
    """Data instance - a single record"""
    id: str = Field(..., description="Unique instance ID")
    class_id: str = Field(..., description="Parent class ID")
    class_name: str = Field(..., description="Parent class name")
    data: Dict[str, Any] = Field(..., description="Actual data values as key-value pairs")
    source_file: Optional[str] = Field(None, description="Source file name")
    source_row: Optional[int] = Field(None, description="Row number in source file")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class EnhancedDataInstance(BaseModel):
    """Enhanced data instance with structured attribute values"""
    id: str = Field(..., description="Instance ID")
    class_id: str = Field(..., description="Parent class ID")
    class_name: str = Field(..., description="Parent class name")
    attribute_values: List[AttributeValue] = Field(
        default_factory=list,
        description="Structured attribute values"
    )
    source_system: Optional[str] = Field(None, description="Source system")
    source_file: Optional[str] = Field(None, description="Source file")
    source_row: Optional[int] = Field(None, description="Source row number")
    load_timestamp: datetime = Field(default_factory=datetime.utcnow, description="Load timestamp")
    lineage_id: Optional[str] = Field(None, description="Lineage tracking ID")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class CreateDataInstanceRequest(BaseModel):
    """Request to create a data instance"""
    class_id: str = Field(..., description="Parent class ID")
    data: Dict[str, Any] = Field(..., description="Data values")
    source_file: Optional[str] = Field(None, description="Source file")
    source_row: Optional[int] = Field(None, description="Source row")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BulkCreateDataInstancesRequest(BaseModel):
    """Request to create multiple data instances"""
    schema_id: str = Field(..., description="Schema ID")
    instances: List[CreateDataInstanceRequest] = Field(..., description="Instances to create")
    create_relationships: bool = Field(
        default=True,
        description="Automatically create relationships based on keys"
    )


class DataInstanceResponse(BaseModel):
    """Response with data instance details"""
    instance: EnhancedDataInstance = Field(..., description="Data instance")
    related_instances: Optional[List[str]] = Field(None, description="Related instance IDs")
    lineage_info: Optional[Dict[str, Any]] = Field(None, description="Lineage information")


class QueryDataInstancesRequest(BaseModel):
    """Request to query data instances"""
    schema_id: str = Field(..., description="Schema ID")
    class_id: Optional[str] = Field(None, description="Filter by class ID")
    filters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Attribute filters {attr_name: value}"
    )
    limit: int = Field(default=100, ge=1, le=1000, description="Result limit")
    offset: int = Field(default=0, ge=0, description="Result offset")
    order_by: Optional[str] = Field(None, description="Order by attribute name")
    order_direction: str = Field(default="asc", description="Order direction: asc, desc")


class DataInstanceStats(BaseModel):
    """Statistics for data instances"""
    schema_id: str = Field(..., description="Schema ID")
    total_instances: int = Field(..., description="Total instances")
    instances_by_class: Dict[str, int] = Field(
        default_factory=dict,
        description="Instance count by class"
    )
    total_relationships: int = Field(..., description="Total relationships")
    data_quality_score: Optional[float] = Field(None, description="Overall data quality score")
    last_updated: Optional[datetime] = Field(None, description="Last update timestamp")