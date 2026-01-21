// frontend/src/types/lineage.ts - FIXED

// ============================================
// CORE LINEAGE TYPES
// ============================================

export interface Attribute {
  id: string;
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  is_nullable?: boolean;
  default_value?: any;
  description?: string;
  metadata?: Record<string, any>;
}

export type DataType = 
  | 'string' 
  | 'integer' 
  | 'float' 
  | 'boolean' 
  | 'date' 
  | 'datetime' 
  | 'json' 
  | 'array';

// ============================================
// LINEAGE GRAPH NODE
// ============================================

export interface LineageGraphNode {
  id: string;
  type: 'class' | 'schema_class' | 'instance' | 'attribute' | 'attribute_value';
  name: string;
  display_name?: string;
  schema_id?: string;
  class_id?: string;
  parent_id?: string;
  level: number;
  attributes?: Attribute[];
  instance_count?: number;
  collapsed?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  has_upstream?: boolean;
  has_downstream?: boolean;
  position?: { x: number; y: number };
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

// ============================================
// LINEAGE GRAPH EDGE
// ============================================

export interface LineageGraphEdge {
  id: string;
  source: string;
  target: string;
  type?: 'schema_relationship' | 'data_relationship' | 'hierarchy' | 'attribute_flow';
  label?: string;
  cardinality?: string;
  highlighted?: boolean;
  metadata?: Record<string, any>;
}

// ============================================
// LINEAGE GRAPH METADATA
// ============================================

export interface LineageGraphMetadata {
  total_nodes: number;
  total_edges: number;
  max_depth?: number;
  generated_at?: string;
  // ✅ FIX: Added optional properties for extended metadata
  expanded_classes?: string[];
  schema_relationships?: number;
  hierarchy_shown_in_tree?: boolean;
  [key: string]: any; // Allow additional properties
}

// ============================================
// LINEAGE GRAPH
// ============================================

export interface LineageGraph {
  schema_id: string;
  schema_name: string;
  nodes: LineageGraphNode[];
  edges: LineageGraphEdge[];
  metadata: LineageGraphMetadata;
}

// Alias for compatibility
export type LineageGraphResponse = LineageGraph;

// ============================================
// HIERARCHY TYPES
// ============================================

export interface HierarchyNode {
  id: string;
  name: string;
  display_name?: string;
  type: 'class' | 'subclass';
  level: number;
  parent_id?: string;
  children: HierarchyNode[];
  attributes: Attribute[];
  instance_count?: number;
  collapsed: boolean;
  metadata?: Record<string, any>;
}

export interface HierarchyTree {
  schema_id: string;
  root_nodes: HierarchyNode[];
  max_depth: number;
  total_nodes: number;
  metadata?: Record<string, any>;
}

// ============================================
// ATTRIBUTE LINEAGE TYPES
// ============================================

export interface TransformationRule {
  id: string;
  name?: string;
  type: 'direct_copy' | 'calculation' | 'lookup' | 'aggregation' | 'custom';
  expression?: string;
  language?: 'sql' | 'python' | 'javascript';
  description?: string;
  metadata?: Record<string, any>;
}

export interface AttributeLineageNode {
  attribute_id: string;
  attribute_name: string;
  class_id: string;
  class_name: string;
  level: number;
  transformation?: TransformationRule;
  data_type: DataType;
  sample_value?: any;
}

export interface AttributeLineagePath {
  path_id: string;
  attributes: AttributeLineageNode[];
  transformations: TransformationRule[];
  total_hops: number;
  confidence_score?: number;
}

export interface AttributeLineage {
  attribute_id: string;
  attribute_name: string;
  class_id: string;
  class_name: string;
  source_attributes: AttributeLineageNode[];
  target_attributes: AttributeLineageNode[];
  lineage_paths: AttributeLineagePath[];
  impacted_attributes: string[];
  impacted_instances: number;
  metadata?: Record<string, any>;
}

// ============================================
// TRACE REQUEST/RESPONSE TYPES
// ============================================

export interface AttributeTraceRequest {
  attribute_id: string;
  direction?: 'upstream' | 'downstream' | 'both';
  max_depth?: number;
  include_transformations?: boolean;
  include_sample_data?: boolean;
}

export interface AttributeTraceResponse {
  attribute: Attribute;
  lineage: AttributeLineage;
  highlighted_nodes: string[];
  highlighted_edges: string[];
}

export interface ImpactAnalysisRequest {
  node_id: string;
  node_type: 'class' | 'attribute' | 'instance';
  analysis_type: 'downstream' | 'upstream' | 'both';
  max_depth?: number;
}

export interface ImpactAnalysisResponse {
  source_node_id: string;
  impacted_nodes: string[];
  impacted_count: number;
  impact_levels: {
    direct: number;
    indirect: number;
    total: number;
  };
  critical_paths: AttributeLineagePath[];
  risk_score?: number;
}

// ============================================
// UI STATE TYPES
// ============================================

export interface LineageViewState {
  layout_direction: 'horizontal' | 'vertical';
  layout_algorithm: 'hierarchical' | 'dagre' | 'force' | 'elk';
  show_attributes: boolean;
  show_data_instances: boolean;
  show_transformations: boolean;
  show_minimap: boolean;
  class_filter?: string[];
  attribute_filter?: string[];
  level_filter?: number[];
  selected_nodes: string[];
  highlighted_nodes: string[];
  highlighted_edges: string[];
  left_panel_open: boolean;
  right_panel_open: boolean;
  bottom_panel_open: boolean;
  active_panel?: 'hierarchy' | 'details' | 'lineage' | 'search';
  zoom_level: number;
  center_position: { x: number; y: number };
}