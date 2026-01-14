// frontend/src/utils/layoutUtils.ts - FIXED
import ELK, { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import { Node, Edge, Position } from 'reactflow';
import { GraphNode, GraphEdge, NodeType } from '../types';

const elk = new ELK();

export interface LayoutConfig {
  direction?: 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';
  spacing?: number;
  layerSpacing?: number;
}

export const getNodeDimensions = (type: NodeType): { width: number; height: number } => {
  switch (type) {
    case 'Country':
      return { width: 220, height: 140 };
    case 'Database':
      return { width: 200, height: 120 };
    case 'Attribute':
      return { width: 180, height: 100 };
    default:
      return { width: 200, height: 120 };
  }
};

export const getNodeColor = (type: NodeType): string => {
  switch (type) {
    case 'Country':
      return '#DC2626';
    case 'Database':
      return '#4B5563';
    case 'Attribute':
      return '#6B7280';
    default:
      return '#9CA3AF';
  }
};

// Generate fallback grid positions
const generateFallbackPositions = (nodes: Node[]): Node[] => {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellWidth = 350;
  const cellHeight = 250;

  return nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    return {
      ...node,
      position: {
        x: col * cellWidth + 100,
        y: row * cellHeight + 100,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
};

export const createReactFlowNodes = (graphNodes: GraphNode[]): Node[] => {
  const nodes = graphNodes.map((node) => {
    const dimensions = getNodeDimensions(node.type);
    
    return {
      id: node.id,
      type: 'custom',
      position: { x: 0, y: 0 },
      data: {
        ...node.data,
        nodeType: node.type,
        label: node.data.name || node.data.id,
        color: getNodeColor(node.type),
      },
      style: {
        width: dimensions.width,
        height: dimensions.height,
      },
      // FIXED: Add source/target positions
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  return generateFallbackPositions(nodes);
};

export const createReactFlowEdges = (graphEdges: GraphEdge[]): Edge[] => {
  return graphEdges.map((edge, index) => ({
    id: edge.id || `edge-${index}`,
    source: edge.source,
    target: edge.target,
    // FIXED: Explicitly set handle IDs
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: 'smoothstep',
    animated: true,
    data: edge.data,
    label: edge.data.dataCategories?.join(', ') || '',
    labelStyle: { 
      fontSize: 11, 
      fill: '#374151',
      fontWeight: 500,
    },
    style: { 
      stroke: '#6B7280',
      strokeWidth: 2.5,
    },
  }));
};

export const applyHierarchicalLayout = async (
  nodes: Node[],
  edges: Edge[],
  config: LayoutConfig = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const {
    direction = 'DOWN',
    spacing = 150,
    layerSpacing = 200,
  } = config;

  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: node.style?.width as number || 200,
    height: node.style?.height as number || 120,
  }));

  const elkEdges: ElkExtendedEdge[] = edges.map((edge) => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': spacing.toString(),
      'elk.layered.spacing.nodeNodeBetweenLayers': layerSpacing.toString(),
      'elk.spacing.edgeNode': '60',
      'elk.spacing.edgeEdge': '40',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.padding': '[top=80,left=80,bottom=80,right=80]',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layout = await elk.layout(graph);

    const layoutedNodes = nodes.map((node) => {
      const layoutedNode = layout.children?.find((n) => n.id === node.id);
      
      const x = layoutedNode?.x ?? node.position.x ?? 100;
      const y = layoutedNode?.y ?? node.position.y ?? 100;
      
      return {
        ...node,
        position: { x, y },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });

    console.log('✓ Hierarchical layout applied:', layoutedNodes.length, 'nodes');
    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.error('Layout error, using fallback:', error);
    return { nodes: generateFallbackPositions(nodes), edges };
  }
};

export const applyCircularLayout = (
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const centerX = 600;
  const centerY = 400;
  const radius = Math.max(350, nodes.length * 35);

  const layoutedNodes = nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return {
      ...node,
      position: { x, y },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  console.log('✓ Circular layout applied:', layoutedNodes.length, 'nodes');
  return { nodes: layoutedNodes, edges };
};

export const applyGridLayout = (
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  if (nodes.length === 0) {
    return { nodes, edges };
  }

  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellWidth = 350;
  const cellHeight = 250;

  const layoutedNodes = nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    return {
      ...node,
      position: {
        x: col * cellWidth + 100,
        y: row * cellHeight + 100,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });

  console.log('✓ Grid layout applied:', layoutedNodes.length, 'nodes');
  return { nodes: layoutedNodes, edges };
};

export const highlightPath = (
  nodes: Node[],
  edges: Edge[],
  pathNodeIds: string[]
): { nodes: Node[]; edges: Edge[] } => {
  const pathSet = new Set(pathNodeIds);

  const highlightedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      highlighted: pathSet.has(node.id),
    },
    style: {
      ...node.style,
      opacity: pathSet.has(node.id) ? 1 : 0.4,
    },
  }));

  const highlightedEdges = edges.map((edge) => {
    const isHighlighted = pathSet.has(edge.source) && pathSet.has(edge.target);
    return {
      ...edge,
      animated: isHighlighted,
      style: {
        ...edge.style,
        stroke: isHighlighted ? '#DC2626' : '#6B7280',
        strokeWidth: isHighlighted ? 3 : 2.5,
        opacity: isHighlighted ? 1 : 0.4,
      },
    };
  });

  return { nodes: highlightedNodes, edges: highlightedEdges };
};

export const clearHighlights = (
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } => {
  const clearedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      highlighted: false,
    },
    style: {
      ...node.style,
      opacity: 1,
    },
  }));

  const clearedEdges = edges.map((edge) => ({
    ...edge,
    animated: true,
    style: {
      ...edge.style,
      stroke: '#6B7280',
      strokeWidth: 2.5,
      opacity: 1,
    },
  }));

  return { nodes: clearedNodes, edges: clearedEdges };
};