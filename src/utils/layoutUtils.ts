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
      return { width: 200, height: 120 };
    case 'Database':
      return { width: 180, height: 100 };
    case 'Attribute':
      return { width: 160, height: 80 };
    default:
      return { width: 180, height: 100 };
  }
};

export const getNodeColor = (type: NodeType): string => {
  switch (type) {
    case 'Country':
      return '#3b82f6'; // blue-500
    case 'Database':
      return '#8b5cf6'; // violet-500
    case 'Attribute':
      return '#06b6d4'; // cyan-500
    default:
      return '#6b7280'; // gray-500
  }
};

export const createReactFlowNodes = (graphNodes: GraphNode[]): Node[] => {
  return graphNodes.map((node) => {
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
    };
  });
};

export const createReactFlowEdges = (graphEdges: GraphEdge[]): Edge[] => {
  return graphEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: true,
    data: edge.data,
    label: edge.data.dataCategories?.join(', ') || '',
    labelStyle: { fontSize: 10, fill: '#64748b' },
    style: { stroke: '#94a3b8', strokeWidth: 2 },
  }));
};

export const applyHierarchicalLayout = async (
  nodes: Node[],
  edges: Edge[],
  config: LayoutConfig = {}
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const {
    direction = 'DOWN',
    spacing = 100,
    layerSpacing = 150,
  } = config;

  const elkNodes: ElkNode[] = nodes.map((node) => ({
    id: node.id,
    width: node.style?.width as number || 180,
    height: node.style?.height as number || 100,
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
      'elk.spacing.edgeNode': '50',
      'elk.spacing.edgeEdge': '30',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const layout = await elk.layout(graph);

    const layoutedNodes = nodes.map((node) => {
      const layoutedNode = layout.children?.find((n) => n.id === node.id);
      return {
        ...node,
        position: {
          x: layoutedNode?.x ?? node.position.x,
          y: layoutedNode?.y ?? node.position.y,
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });

    return { nodes: layoutedNodes, edges };
  } catch (error) {
    console.error('Layout error:', error);
    return { nodes, edges };
  }
};

export const applyCircularLayout = (nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } => {
  const centerX = 500;
  const centerY = 400;
  const radius = 300;

  const layoutedNodes = nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / nodes.length;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return {
      ...node,
      position: { x, y },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });

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
      opacity: pathSet.has(node.id) ? 1 : 0.3,
      filter: pathSet.has(node.id) ? 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))' : 'none',
    },
  }));

  const highlightedEdges = edges.map((edge) => {
    const isHighlighted = pathSet.has(edge.source) && pathSet.has(edge.target);
    return {
      ...edge,
      animated: isHighlighted,
      style: {
        ...edge.style,
        stroke: isHighlighted ? '#3b82f6' : '#94a3b8',
        strokeWidth: isHighlighted ? 3 : 2,
        opacity: isHighlighted ? 1 : 0.3,
      },
    };
  });

  return { nodes: highlightedNodes, edges: highlightedEdges };
};

export const clearHighlights = (nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } => {
  const clearedNodes = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      highlighted: false,
    },
    style: {
      ...node.style,
      opacity: 1,
      filter: 'none',
    },
  }));

  const clearedEdges = edges.map((edge) => ({
    ...edge,
    animated: true,
    style: {
      ...edge.style,
      stroke: '#94a3b8',
      strokeWidth: 2,
      opacity: 1,
    },
  }));

  return { nodes: clearedNodes, edges: clearedEdges };
};