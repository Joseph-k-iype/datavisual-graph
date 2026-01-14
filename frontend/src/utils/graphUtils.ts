import { Node, Edge } from 'reactflow';
import { NodeType, GraphNode, GraphEdge } from '../types';

/**
 * Find all paths between two nodes using BFS
 */
export const findAllPaths = (
  nodes: Node[],
  edges: Edge[],
  sourceId: string,
  targetId: string,
  maxDepth: number = 5
): string[][] => {
  const paths: string[][] = [];
  const visited = new Set<string>();
  
  const dfs = (currentId: string, path: string[], depth: number) => {
    if (depth > maxDepth) return;
    
    if (currentId === targetId) {
      paths.push([...path, currentId]);
      return;
    }
    
    visited.add(currentId);
    
    // Find outgoing edges
    const outgoingEdges = edges.filter((e) => e.source === currentId);
    
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        dfs(edge.target, [...path, currentId], depth + 1);
      }
    }
    
    visited.delete(currentId);
  };
  
  dfs(sourceId, [], 0);
  return paths;
};

/**
 * Get all connected nodes (upstream and downstream)
 */
export const getConnectedNodes = (
  nodeId: string,
  edges: Edge[],
  direction: 'upstream' | 'downstream' | 'both' = 'both'
): string[] => {
  const connected = new Set<string>();
  const queue = [nodeId];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    
    if (current !== nodeId) {
      connected.add(current);
    }
    
    // Find connected edges
    const relevantEdges = edges.filter((edge) => {
      if (direction === 'upstream') return edge.target === current;
      if (direction === 'downstream') return edge.source === current;
      return edge.source === current || edge.target === current;
    });
    
    relevantEdges.forEach((edge) => {
      const nextNode = edge.source === current ? edge.target : edge.source;
      if (!visited.has(nextNode)) {
        queue.push(nextNode);
      }
    });
  }
  
  return Array.from(connected);
};

/**
 * Calculate graph statistics
 */
export const calculateGraphStats = (nodes: Node[], edges: Edge[]) => {
  const nodesByType = nodes.reduce((acc, node) => {
    const type = node.data.nodeType as NodeType;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<NodeType, number>);
  
  // Calculate node degrees (in/out connections)
  const nodeDegrees = new Map<string, { in: number; out: number }>();
  
  edges.forEach((edge) => {
    // Out-degree
    const source = nodeDegrees.get(edge.source) || { in: 0, out: 0 };
    nodeDegrees.set(edge.source, { ...source, out: source.out + 1 });
    
    // In-degree
    const target = nodeDegrees.get(edge.target) || { in: 0, out: 0 };
    nodeDegrees.set(edge.target, { ...target, in: target.in + 1 });
  });
  
  // Find hub nodes (nodes with most connections)
  const hubNodes = Array.from(nodeDegrees.entries())
    .map(([id, degrees]) => ({
      id,
      totalDegree: degrees.in + degrees.out,
      inDegree: degrees.in,
      outDegree: degrees.out,
    }))
    .sort((a, b) => b.totalDegree - a.totalDegree)
    .slice(0, 5);
  
  // Find isolated nodes (no connections)
  const isolatedNodes = nodes.filter(
    (node) => !nodeDegrees.has(node.id)
  );
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodesByType,
    averageConnections: edges.length / nodes.length,
    hubNodes,
    isolatedNodes: isolatedNodes.map((n) => n.id),
  };
};

/**
 * Filter nodes by criteria
 */
export const filterNodes = (
  nodes: Node[],
  criteria: {
    type?: NodeType;
    searchQuery?: string;
    properties?: Record<string, any>;
  }
): Node[] => {
  return nodes.filter((node) => {
    // Filter by type
    if (criteria.type && node.data.nodeType !== criteria.type) {
      return false;
    }
    
    // Filter by search query
    if (criteria.searchQuery) {
      const query = criteria.searchQuery.toLowerCase();
      const searchableFields = [
        node.data.label,
        node.data.name,
        node.id,
        node.data.code,
        node.data.region,
      ].filter(Boolean);
      
      const matches = searchableFields.some((field) =>
        String(field).toLowerCase().includes(query)
      );
      
      if (!matches) return false;
    }
    
    // Filter by properties
    if (criteria.properties) {
      const matchesProperties = Object.entries(criteria.properties).every(
        ([key, value]) => node.data[key] === value
      );
      
      if (!matchesProperties) return false;
    }
    
    return true;
  });
};

/**
 * Group nodes by a property
 */
export const groupNodesByProperty = (
  nodes: Node[],
  property: string
): Record<string, Node[]> => {
  return nodes.reduce((acc, node) => {
    const value = node.data[property] || 'Unknown';
    if (!acc[value]) {
      acc[value] = [];
    }
    acc[value].push(node);
    return acc;
  }, {} as Record<string, Node[]>);
};

/**
 * Calculate shortest path using Dijkstra's algorithm
 */
export const findShortestPath = (
  nodes: Node[],
  edges: Edge[],
  sourceId: string,
  targetId: string
): string[] | null => {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const unvisited = new Set(nodes.map((n) => n.id));
  
  // Initialize distances
  nodes.forEach((node) => {
    distances.set(node.id, node.id === sourceId ? 0 : Infinity);
    previous.set(node.id, null);
  });
  
  while (unvisited.size > 0) {
    // Find node with minimum distance
    let current: string | null = null;
    let minDistance = Infinity;
    
    unvisited.forEach((nodeId) => {
      const distance = distances.get(nodeId)!;
      if (distance < minDistance) {
        minDistance = distance;
        current = nodeId;
      }
    });
    
    if (!current || minDistance === Infinity) break;
    
    unvisited.delete(current);
    
    if (current === targetId) break;
    
    // Update distances to neighbors
    const outgoingEdges = edges.filter((e) => e.source === current);
    
    outgoingEdges.forEach((edge) => {
      if (unvisited.has(edge.target)) {
        const alt = distances.get(current!)! + 1;
        if (alt < distances.get(edge.target)!) {
          distances.set(edge.target, alt);
          previous.set(edge.target, current);
        }
      }
    });
  }
  
  // Reconstruct path
  if (!previous.get(targetId)) return null;
  
  const path: string[] = [];
  let current: string | null = targetId;
  
  while (current) {
    path.unshift(current);
    current = previous.get(current)!;
  }
  
  return path[0] === sourceId ? path : null;
};

/**
 * Detect cycles in the graph
 */
export const detectCycles = (nodes: Node[], edges: Edge[]): string[][] => {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  const dfs = (nodeId: string, path: string[]): void => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);
    
    const outgoingEdges = edges.filter((e) => e.source === nodeId);
    
    for (const edge of outgoingEdges) {
      if (!visited.has(edge.target)) {
        dfs(edge.target, [...path]);
      } else if (recursionStack.has(edge.target)) {
        // Found a cycle
        const cycleStart = path.indexOf(edge.target);
        cycles.push([...path.slice(cycleStart), edge.target]);
      }
    }
    
    recursionStack.delete(nodeId);
  };
  
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  });
  
  return cycles;
};

/**
 * Export graph to JSON
 */
export const exportGraphToJSON = (nodes: Node[], edges: Edge[]): string => {
  const exportData = {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.data.nodeType,
      data: node.data,
      position: node.position,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      data: edge.data,
    })),
  };
  
  return JSON.stringify(exportData, null, 2);
};

/**
 * Import graph from JSON
 */
export const importGraphFromJSON = (
  json: string
): { nodes: Node[]; edges: Edge[] } | null => {
  try {
    const data = JSON.parse(json);
    
    const nodes = data.nodes.map((n: any) => ({
      id: n.id,
      type: 'custom',
      position: n.position || { x: 0, y: 0 },
      data: n.data,
    }));
    
    const edges = data.edges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || 'smoothstep',
      data: e.data || {},
    }));
    
    return { nodes, edges };
  } catch (error) {
    console.error('Failed to import graph:', error);
    return null;
  }
};

/**
 * Calculate node clustering coefficient
 */
export const calculateClusteringCoefficient = (
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): number => {
  // Get neighbors
  const neighbors = new Set<string>();
  edges.forEach((edge) => {
    if (edge.source === nodeId) neighbors.add(edge.target);
    if (edge.target === nodeId) neighbors.add(edge.source);
  });
  
  if (neighbors.size < 2) return 0;
  
  // Count edges between neighbors
  let edgesBetweenNeighbors = 0;
  const neighborArray = Array.from(neighbors);
  
  for (let i = 0; i < neighborArray.length; i++) {
    for (let j = i + 1; j < neighborArray.length; j++) {
      const hasEdge = edges.some(
        (edge) =>
          (edge.source === neighborArray[i] && edge.target === neighborArray[j]) ||
          (edge.source === neighborArray[j] && edge.target === neighborArray[i])
      );
      if (hasEdge) edgesBetweenNeighbors++;
    }
  }
  
  const maxPossibleEdges = (neighbors.size * (neighbors.size - 1)) / 2;
  return edgesBetweenNeighbors / maxPossibleEdges;
};

/**
 * Get node depth in hierarchy
 */
export const getNodeDepth = (
  nodeId: string,
  edges: Edge[],
  direction: 'upstream' | 'downstream' = 'downstream'
): number => {
  const visited = new Set<string>();
  let maxDepth = 0;
  
  const dfs = (current: string, depth: number): void => {
    if (visited.has(current)) return;
    visited.add(current);
    maxDepth = Math.max(maxDepth, depth);
    
    const relevantEdges =
      direction === 'downstream'
        ? edges.filter((e) => e.source === current)
        : edges.filter((e) => e.target === current);
    
    relevantEdges.forEach((edge) => {
      const next = direction === 'downstream' ? edge.target : edge.source;
      dfs(next, depth + 1);
    });
  };
  
  dfs(nodeId, 0);
  return maxDepth;
};