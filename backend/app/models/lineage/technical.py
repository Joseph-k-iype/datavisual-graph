# backend/app/models/lineage/technical.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from .attribute import Attribute, AttributeMapping


class LineageGraphNode(BaseModel):
    """Node in the lineage graph"""
    id: str = Field(..., description="Node ID")
    type: str = Field(..., description="Node type: class, attribute, instance, attribute_value")
    name: str = Field(..., description="Node name")
    display_name: Optional[str] = Field(None, description="Display name")
    
    # Position
    position: Dict[str, float] = Field(..., description="Position {x, y}")
    
    # Hierarchy
    parent_id: Optional[str] = Field(None, description="Parent node ID")
    level: int = Field(..., description="Hierarchy level")
    
    # Styling
    color: Optional[str] = Field(None, description="Node color")
    icon: Optional[str] = Field(None, description="Icon name")
    size: str = Field(default="medium", description="Node size: small, medium, large")
    
    # State
    collapsed: bool = Field(default=False, description="Is collapsed")
    selected: bool = Field(default=False, description="Is selected")
    highlighted: bool = Field(default=False, description="Is highlighted")
    
    # Data
    data: Dict[str, Any] = Field(default_factory=dict, description="Node data")
    attributes: Optional[List[Attribute]] = Field(None, description="Node attributes")
    instance_count: Optional[int] = Field(None, description="Instance count")
    
    # Lineage
    has_upstream: bool = Field(default=False, description="Has upstream dependencies")
    has_downstream: bool = Field(default=False, description="Has downstream dependencies")
    lineage_depth: Optional[int] = Field(None, description="Lineage depth")
    
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LineageGraphEdge(BaseModel):
    """Edge in the lineage graph"""
    id: str = Field(..., description="Edge ID")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    type: str = Field(..., description="Edge type: schema, data, attribute_flow, hierarchy")
    
    # Labels
    label: Optional[str] = Field(None, description="Edge label")
    source_label: Optional[str] = Field(None, description="Source label")
    target_label: Optional[str] = Field(None, description="Target label")
    
    # Styling
    color: Optional[str] = Field(None, description="Edge color")
    width: int = Field(default=2, description="Edge width")
    style: str = Field(default="solid", description="Edge style: solid, dashed, dotted")
    animated: bool = Field(default=False, description="Is animated")
    
    # State
    highlighted: bool = Field(default=False, description="Is highlighted")
    selected: bool = Field(default=False, description="Is selected")
    
    # Attribute flow details
    attribute_mappings: Optional[List[AttributeMapping]] = Field(None, description="Attribute mappings")
    transformation_applied: Optional[str] = Field(None, description="Transformation applied")
    
    # Metadata
    cardinality: Optional[str] = Field(None, description="Relationship cardinality")
    metadata: Dict[str, Any] = Field(default_factory=dict)


class TechnicalLineageGraph(BaseModel):
    """Complete technical lineage graph"""
    schema_id: str = Field(..., description="Schema ID")
    schema_name: str = Field(..., description="Schema name")
    nodes: List[LineageGraphNode] = Field(default_factory=list, description="Graph nodes")
    edges: List[LineageGraphEdge] = Field(default_factory=list, description="Graph edges")
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Graph metadata (total_nodes, total_edges, max_depth, etc.)"
    )


class LineageTraceRequest(BaseModel):
    """Request for lineage trace"""
    schema_id: str = Field(..., description="Schema ID")
    start_node_id: str = Field(..., description="Starting node ID")
    direction: str = Field(default="both", description="Direction: upstream, downstream, both")
    max_depth: int = Field(default=10, ge=1, le=50, description="Maximum depth")
    include_attributes: bool = Field(default=True, description="Include attribute-level lineage")
    include_instances: bool = Field(default=False, description="Include data instances")


class LineageTraceResponse(BaseModel):
    """Response with lineage trace"""
    start_node_id: str = Field(..., description="Starting node ID")
    graph: TechnicalLineageGraph = Field(..., description="Lineage subgraph")
    paths: List[List[str]] = Field(default_factory=list, description="Lineage paths (node ID lists)")
    highlighted_nodes: List[str] = Field(default_factory=list, description="Highlighted node IDs")
    highlighted_edges: List[str] = Field(default_factory=list, description="Highlighted edge IDs")
    statistics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Statistics (total_nodes, total_paths, avg_path_length, etc.)"
    )


class PathFindingRequest(BaseModel):
    """Request for path finding between nodes"""
    schema_id: str = Field(..., description="Schema ID")
    start_node_id: str = Field(..., description="Start node ID")
    end_node_id: str = Field(..., description="End node ID")
    algorithm: str = Field(default="shortest", description="Algorithm: shortest, all, k_shortest")
    k: int = Field(default=5, description="Number of paths for k_shortest")
    max_depth: int = Field(default=20, description="Maximum path depth")


class PathFindingResponse(BaseModel):
    """Response with found paths"""
    start_node_id: str = Field(..., description="Start node ID")
    end_node_id: str = Field(..., description="End node ID")
    paths: List[List[str]] = Field(default_factory=list, description="Found paths")
    path_lengths: List[int] = Field(default_factory=list, description="Path lengths")
    shortest_path_length: Optional[int] = Field(None, description="Shortest path length")
    total_paths_found: int = Field(..., description="Total paths found")
    highlighted_nodes: List[str] = Field(default_factory=list, description="Highlighted nodes")
    highlighted_edges: List[str] = Field(default_factory=list, description="Highlighted edges")


class ColumnLevelLineageRequest(BaseModel):
    """Request for column-level lineage"""
    schema_id: str = Field(..., description="Schema ID")
    source_class_id: str = Field(..., description="Source class ID")
    source_attribute_id: str = Field(..., description="Source attribute ID")
    target_class_id: Optional[str] = Field(None, description="Target class ID (optional)")
    target_attribute_id: Optional[str] = Field(None, description="Target attribute ID (optional)")
    max_depth: int = Field(default=10, description="Maximum depth")


class ColumnLevelLineageResponse(BaseModel):
    """Response with column-level lineage"""
    source_attribute: Attribute = Field(..., description="Source attribute")
    target_attributes: List[Attribute] = Field(default_factory=list, description="Target attributes")
    paths: List[List[str]] = Field(default_factory=list, description="Attribute paths")
    transformations: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Transformations along paths"
    )
    highlighted_nodes: List[str] = Field(default_factory=list)
    highlighted_edges: List[str] = Field(default_factory=list)