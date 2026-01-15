// frontend/src/types/index.ts - ENHANCED TYPES

// ============================================
// CARDINALITY
// ============================================

export enum Cardinality {
  ONE_TO_ONE = '1:1',
  ONE_TO_MANY = '1:N',
  MANY_TO_ONE = 'N:1',
  MANY_TO_MANY = 'N:M',
}

// ============================================
// SCHEMA DEFINITION TYPES
// ============================================

export interface SchemaClass {
  id: string;
  name: string;
  description?: string;
  attributes: string[];
  color?: string;
  icon?: string;
}

export interface SchemaRelationship {
  id: string;
  name: string;
  source_class_id: string;
  target_class_id: string;
  cardinality: Cardinality;
  description?: string;
  bidirectional?: boolean;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  classes: SchemaClass[];
  relationships: SchemaRelationship[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface SchemaCreateRequest {
  name: string;
  description?: string;
  classes: SchemaClass[];
  relationships: SchemaRelationship[];
}

export interface SchemaListItem {
  id: string;
  name: string;
  description?: string;
  version: string;
  class_count: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// DATA INSTANCE TYPES
// ============================================

export interface DataInstance {
  id: string;
  class_id: string;
  class_name: string;
  data: Record<string, any>;
  source_file?: string;
  source_row?: number;
  metadata?: Record<string, any>;
}

export interface DataRelationship {
  id: string;
  schema_relationship_id: string;
  source_instance_id: string;
  target_instance_id: string;
  metadata?: Record<string, any>;
}

// ============================================
// DATA LOADING TYPES
// ============================================

export enum DataFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json',
  XML = 'xml',
}

export interface ColumnMapping {
  source_column: string;
  target_attribute: string;
  transform?: string;
}

export interface ClassDataMapping {
  class_id: string;
  column_mappings: ColumnMapping[];
  primary_key?: string;
}

export interface RelationshipMapping {
  source_class_id: string;
  target_class_id: string;
  source_key_attribute: string;
  target_key_attribute: string;
  schema_relationship_id: string;
}

export interface DataLoadRequest {
  schema_id: string;
  format: DataFormat;
  file_name: string;
  class_mappings: ClassDataMapping[];
  relationship_mappings?: RelationshipMapping[];
}

export interface DataLoadResponse {
  success: boolean;
  schema_id: string;
  instances_created: number;
  relationships_created: number;
  errors: string[];
  warnings: string[];
}

// ============================================
// LINEAGE TYPES
// ============================================

export interface LineageNode {
  id: string;
  type: 'schema_class' | 'data_instance';
  name: string;
  schema_id?: string;
  class_id?: string;
  parent_id?: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  collapsed: boolean;
  position?: { x: number; y: number };
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: 'schema_relationship' | 'data_relationship' | 'parent_child';
  label?: string;
  cardinality?: Cardinality;
  metadata?: Record<string, any>;
}

export interface LineageGraphResponse {
  schema_id: string;
  schema_name: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  metadata?: Record<string, any>;
}

export interface LineagePathRequest {
  start_node_id: string;
  end_node_id?: string;
  max_depth?: number;
}

export interface LineagePathResponse {
  paths: string[][];
  highlighted_nodes: string[];
  highlighted_edges: string[];
}

// ============================================
// STATS TYPES
// ============================================

export interface SchemaStats {
  schema_id: string;
  schema_name: string;
  total_classes: number;
  total_relationships: number;
  total_instances: number;
  total_data_relationships: number;
  instances_by_class: Record<string, number>;
}

// ============================================
// REACT FLOW TYPES
// ============================================

export interface FlowNodeData {
  label: string;
  type: 'schema_class' | 'data_instance';
  nodeType: 'schema_class' | 'data_instance';
  schema_id?: string;
  class_id?: string;
  parent_id?: string;
  collapsed: boolean;
  instance_count?: number;
  attributes?: string[];
  data?: Record<string, any>;
  color?: string;
  icon?: string;
  isHighlighted?: boolean;
  isSelected?: boolean;
}

export interface FlowEdgeData {
  label?: string;
  type: 'schema_relationship' | 'data_relationship' | 'parent_child';
  cardinality?: Cardinality;
  isHighlighted?: boolean;
}

// ============================================
// FILE UPLOAD TYPES
// ============================================

export interface FileUploadState {
  file: File | null;
  format: DataFormat | null;
  preview: any[] | null;
  columns: string[] | null;
  sheets?: string[];
}

export interface MappingState {
  class_mappings: ClassDataMapping[];
  relationship_mappings: RelationshipMapping[];
}

// ============================================
// UI STATE TYPES
// ============================================

export interface AppState {
  currentSchema: SchemaDefinition | null;
  expandedClasses: Set<string>;
  selectedNode: string | null;
  highlightedPath: LineagePathResponse | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// RESPONSE TYPES
// ============================================

export interface SuccessResponse {
  success: boolean;
  message: string;
  data?: Record<string, any>;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
  details?: Record<string, any>;
}