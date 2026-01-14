export type NodeType = 'Country' | 'Database' | 'Attribute';

export interface BaseNode {
  id: string;
  type: NodeType;
  data: Record<string, any>;
}

export interface Country extends BaseNode {
  type: 'Country';
  data: {
    id: string;
    name: string;
    code: string;
    region: string;
    dataProtectionRegime: string;
    adequacyStatus: string;
  };
}

export interface Database extends BaseNode {
  type: 'Database';
  data: {
    id: string;
    name: string;
    countryId: string;
    type: string;
    classification: string;
    owner: string;
  };
}

export interface Attribute extends BaseNode {
  type: 'Attribute';
  data: {
    id: string;
    name: string;
    databaseId: string;
    dataType: string;
    category: string;
    sensitivity: string;
    isPII: boolean;
  };
}

export type GraphNode = Country | Database | Attribute;

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data: {
    dataCategories?: string[];
    legalBasis?: string;
    frequency?: string;
    volume?: string;
    purpose?: string;
    transformationType?: string;
  };
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LineagePath {
  paths: string[][];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Stats {
  totalCountries: number;
  totalDatabases: number;
  totalAttributes: number;
  totalTransfers: number;
  dataCategories: string[];
  regions: string[];
}

export interface NodeCreate {
  nodeType: NodeType;
  properties: Record<string, any>;
}

export interface NodeUpdate {
  properties: Record<string, any>;
}

export interface RelationshipCreate {
  sourceId: string;
  sourceType: NodeType;
  targetId: string;
  targetType: NodeType;
  relationshipType: string;
  properties?: Record<string, any>;
}

export interface LineageQuery {
  nodeId: string;
  nodeType: NodeType;
  direction: 'upstream' | 'downstream' | 'both';
  maxDepth: number;
  dataCategories?: string[];
}

export interface HierarchicalNode {
  id: string;
  type: NodeType;
  data: Record<string, any>;
  children: HierarchicalNode[];
  collapsed?: boolean;
}

export interface LayoutOptions {
  algorithm: 'elk' | 'dagre' | 'hierarchical';
  direction: 'TB' | 'LR' | 'BT' | 'RL';
  nodeSpacing: number;
  layerSpacing: number;
}