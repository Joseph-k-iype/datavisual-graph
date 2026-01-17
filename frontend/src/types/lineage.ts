// frontend/src/types/lineage.ts - FIXED TYPES

/**
 * Enhanced Types for Enterprise Data Lineage
 * Supports attribute-level lineage, hierarchies, and tracing
 */

// ============================================
// ATTRIBUTE TYPES
// ============================================

export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'json' | 'binary';
export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export interface Attribute {
  id: string;
  name: string;
  display_name?: string;
  data_type: DataType;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  is_nullable: boolean;
  description?: string;
  business_name?: string;
  business_description?: string;
  sensitivity_level?: SensitivityLevel;
  lineage_enabled: boolean;
  position: number;
  sample_values?: any[];
  metadata?: Record<string, any>;
}

export interface ValidationRule {
  type: 'regex' | 'range' | 'enum' | 'custom';
  value: any;
  error_message?: string;
}

// ============================================
// LINEAGE GRAPH TYPES
// ============================================

export interface LineageGraphNode {
  id: string;
  type: 'class' | 'attribute' | 'instance' | 'attribute_value';
  name: string;
  display_name?: string;
  
  // Position
  position: { x: number; y: number };
  
  // Hierarchy
  parent_id?: string;
  level: number;
  
  // Styling
  color?: string;
  icon?: string;
  size?: 'small' | 'medium' | 'large';
  
  // State
  collapsed: boolean;
  selected: boolean;
  highlighted: boolean;
  
  // Data
  data: Record<string, any>;
  attributes?: Attribute[];
  instance_count?: number;
  
  // Lineage
  has_upstream: boolean;
  has_downstream: boolean;
  lineage_depth?: number;
  
  metadata?: Record<string, any>;
}

export interface LineageGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'schema' | 'data' | 'attribute_flow' | 'hierarchy';
  
  // Labels
  label?: string;
  source_label?: string;
  target_label?: string;
  
  // Styling
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  animated?: boolean;
  
  // State
  highlighted: boolean;
  selected: boolean;
  
  // Metadata
  cardinality?: string;
  transformation_applied?: string;
  metadata?: Record<string, any>;
}

// This matches the backend response exactly
export interface LineageGraph {
  schema_id: string;
  schema_name: string;
  nodes: LineageGraphNode[];
  edges: LineageGraphEdge[];
  metadata?: {
    total_nodes: number;
    total_edges: number;
    max_depth?: number;
    generated_at?: string;
  };
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