import { useState, useCallback } from 'react';
import { Node, Edge, useReactFlow } from 'reactflow';
import {
  applyHierarchicalLayout,
  applyCircularLayout,
  LayoutConfig,
} from '../utils/layoutUtils';

export type LayoutType = 'hierarchical' | 'circular' | 'force' | 'grid';
export type LayoutDirection = 'DOWN' | 'RIGHT' | 'LEFT' | 'UP';

export interface LayoutOptions {
  type: LayoutType;
  direction: LayoutDirection;
  spacing: number;
  layerSpacing: number;
  animated: boolean;
}

export interface UseGraphLayoutReturn {
  layoutType: LayoutType;
  layoutDirection: LayoutDirection;
  layoutOptions: LayoutOptions;
  isLayouting: boolean;
  applyLayout: (
    nodes: Node[],
    edges: Edge[],
    options?: Partial<LayoutOptions>
  ) => Promise<{ nodes: Node[]; edges: Edge[] }>;
  setLayoutType: (type: LayoutType) => void;
  setLayoutDirection: (direction: LayoutDirection) => void;
  setLayoutOptions: (options: Partial<LayoutOptions>) => void;
  resetLayout: () => void;
  fitView: () => void;
  centerNode: (nodeId: string) => void;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  type: 'hierarchical',
  direction: 'DOWN',
  spacing: 120,
  layerSpacing: 180,
  animated: true,
};

export const useGraphLayout = (): UseGraphLayoutReturn => {
  const [layoutOptions, setLayoutOptionsState] = useState<LayoutOptions>(DEFAULT_OPTIONS);
  const [isLayouting, setIsLayouting] = useState(false);
  const { fitView: reactFlowFitView, getNode, setCenter } = useReactFlow();

  const applyLayout = useCallback(
    async (
      nodes: Node[],
      edges: Edge[],
      options?: Partial<LayoutOptions>
    ): Promise<{ nodes: Node[]; edges: Edge[] }> => {
      setIsLayouting(true);

      const mergedOptions = { ...layoutOptions, ...options };
      let layoutedNodes: Node[] = nodes;
      let layoutedEdges: Edge[] = edges;

      try {
        switch (mergedOptions.type) {
          case 'hierarchical': {
            const config: LayoutConfig = {
              direction: mergedOptions.direction,
              spacing: mergedOptions.spacing,
              layerSpacing: mergedOptions.layerSpacing,
            };
            const result = await applyHierarchicalLayout(nodes, edges, config);
            layoutedNodes = result.nodes;
            layoutedEdges = result.edges;
            break;
          }

          case 'circular': {
            const result = applyCircularLayout(nodes, edges);
            layoutedNodes = result.nodes;
            layoutedEdges = result.edges;
            break;
          }

          case 'grid': {
            const result = applyGridLayout(nodes, edges, mergedOptions);
            layoutedNodes = result.nodes;
            layoutedEdges = result.edges;
            break;
          }

          case 'force': {
            const result = applyForceLayout(nodes, edges, mergedOptions);
            layoutedNodes = result.nodes;
            layoutedEdges = result.edges;
            break;
          }

          default:
            console.warn(`Unknown layout type: ${mergedOptions.type}`);
        }

        return { nodes: layoutedNodes, edges: layoutedEdges };
      } catch (error) {
        console.error('Layout error:', error);
        return { nodes, edges };
      } finally {
        setIsLayouting(false);
      }
    },
    [layoutOptions]
  );

  const setLayoutType = useCallback((type: LayoutType) => {
    setLayoutOptionsState((prev) => ({ ...prev, type }));
  }, []);

  const setLayoutDirection = useCallback((direction: LayoutDirection) => {
    setLayoutOptionsState((prev) => ({ ...prev, direction }));
  }, []);

  const setLayoutOptions = useCallback((options: Partial<LayoutOptions>) => {
    setLayoutOptionsState((prev) => ({ ...prev, ...options }));
  }, []);

  const resetLayout = useCallback(() => {
    setLayoutOptionsState(DEFAULT_OPTIONS);
  }, []);

  const fitView = useCallback(() => {
    reactFlowFitView({ padding: 0.2, duration: 800 });
  }, [reactFlowFitView]);

  const centerNode = useCallback(
    (nodeId: string) => {
      const node = getNode(nodeId);
      if (node) {
        const x = node.position.x + (node.width || 0) / 2;
        const y = node.position.y + (node.height || 0) / 2;
        setCenter(x, y, { zoom: 1.5, duration: 800 });
      }
    },
    [getNode, setCenter]
  );

  return {
    layoutType: layoutOptions.type,
    layoutDirection: layoutOptions.direction,
    layoutOptions,
    isLayouting,
    applyLayout,
    setLayoutType,
    setLayoutDirection,
    setLayoutOptions,
    resetLayout,
    fitView,
    centerNode,
  };
};

// Grid Layout Implementation
function applyGridLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): { nodes: Node[]; edges: Edge[] } {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const cellWidth = 250;
  const cellHeight = 200;

  const layoutedNodes = nodes.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = col * cellWidth + options.spacing;
    const y = row * cellHeight + options.spacing;

    return {
      ...node,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Simple Force Layout Implementation
function applyForceLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): { nodes: Node[]; edges: Edge[] } {
  // Simple force-directed layout simulation
  const centerX = 500;
  const centerY = 400;
  const repulsionForce = 5000;
  const attractionForce = 0.01;

  // Initialize positions randomly if not set
  const positionedNodes = nodes.map((node) => ({
    ...node,
    position: node.position.x
      ? node.position
      : {
          x: centerX + (Math.random() - 0.5) * 400,
          y: centerY + (Math.random() - 0.5) * 400,
        },
  }));

  // Simple force simulation (simplified for demo)
  const iterations = 50;
  for (let iter = 0; iter < iterations; iter++) {
    // Apply repulsion between all nodes
    for (let i = 0; i < positionedNodes.length; i++) {
      for (let j = i + 1; j < positionedNodes.length; j++) {
        const dx = positionedNodes[j].position.x - positionedNodes[i].position.x;
        const dy = positionedNodes[j].position.y - positionedNodes[i].position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsionForce / (distance * distance);

        positionedNodes[i].position.x -= (dx / distance) * force;
        positionedNodes[i].position.y -= (dy / distance) * force;
        positionedNodes[j].position.x += (dx / distance) * force;
        positionedNodes[j].position.y += (dy / distance) * force;
      }
    }

    // Apply attraction along edges
    edges.forEach((edge) => {
      const sourceNode = positionedNodes.find((n) => n.id === edge.source);
      const targetNode = positionedNodes.find((n) => n.id === edge.target);

      if (sourceNode && targetNode) {
        const dx = targetNode.position.x - sourceNode.position.x;
        const dy = targetNode.position.y - sourceNode.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        sourceNode.position.x += dx * attractionForce;
        sourceNode.position.y += dy * attractionForce;
        targetNode.position.x -= dx * attractionForce;
        targetNode.position.y -= dy * attractionForce;
      }
    });
  }

  return { nodes: positionedNodes, edges };
}