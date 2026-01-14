import { useState, useEffect, useCallback } from 'react';
import { Node, Edge } from 'reactflow';
import { apiService } from '../services/api';
import {
  LineageQuery,
  NodeCreate,
  NodeUpdate,
  RelationshipCreate,
  Stats,
  NodeType,
} from '../types';
import {
  createReactFlowNodes,
  createReactFlowEdges,
  applyHierarchicalLayout,
  highlightPath,
  clearHighlights,
} from '../utils/layoutUtils';

export interface UseLineageDataReturn {
  nodes: Node[];
  edges: Edge[];
  stats: Stats | null;
  loading: boolean;
  error: string | null;
  loadFullLineage: () => Promise<void>;
  loadNodeLineage: (query: LineageQuery) => Promise<void>;
  findPath: (sourceId: string, targetId: string) => Promise<void>;
  createNode: (nodeData: NodeCreate) => Promise<void>;
  updateNode: (nodeId: string, nodeType: NodeType, updateData: NodeUpdate) => Promise<void>;
  deleteNode: (nodeId: string, nodeType: NodeType) => Promise<void>;
  createRelationship: (relData: RelationshipCreate) => Promise<void>;
  highlightPathNodes: (pathIds: string[]) => void;
  clearAllHighlights: () => void;
  refreshStats: () => Promise<void>;
  selectedNode: Node | null;
  setSelectedNode: (node: Node | null) => void;
}

export const useLineageData = (): UseLineageDataReturn => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const statsData = await apiService.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const loadFullLineage = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiService.getFullLineage();
      const reactFlowNodes = createReactFlowNodes(data.nodes);
      const reactFlowEdges = createReactFlowEdges(data.edges);
      
      const { nodes: layoutedNodes, edges: layoutedEdges } = await applyHierarchicalLayout(
        reactFlowNodes,
        reactFlowEdges,
        { direction: 'DOWN', spacing: 120, layerSpacing: 180 }
      );
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      await refreshStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load lineage';
      setError(errorMessage);
      console.error('Error loading full lineage:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshStats]);

  const loadNodeLineage = useCallback(async (query: LineageQuery) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiService.getNodeLineage(query);
      const reactFlowNodes = createReactFlowNodes(data.nodes);
      const reactFlowEdges = createReactFlowEdges(data.edges);
      
      const { nodes: layoutedNodes, edges: layoutedEdges } = await applyHierarchicalLayout(
        reactFlowNodes,
        reactFlowEdges
      );
      
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load node lineage';
      setError(errorMessage);
      console.error('Error loading node lineage:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const findPath = useCallback(async (sourceId: string, targetId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const pathData = await apiService.findPaths(sourceId, targetId);
      
      if (pathData.paths.length > 0) {
        const firstPath = pathData.paths[0];
        const reactFlowNodes = createReactFlowNodes(pathData.nodes);
        const reactFlowEdges = createReactFlowEdges(pathData.edges);
        
        const { nodes: layoutedNodes, edges: layoutedEdges } = await applyHierarchicalLayout(
          reactFlowNodes,
          reactFlowEdges
        );
        
        const { nodes: highlightedNodes, edges: highlightedEdges } = highlightPath(
          layoutedNodes,
          layoutedEdges,
          firstPath
        );
        
        setNodes(highlightedNodes);
        setEdges(highlightedEdges);
      } else {
        setError('No path found between selected nodes');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to find path';
      setError(errorMessage);
      console.error('Error finding path:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createNode = useCallback(async (nodeData: NodeCreate) => {
    try {
      await apiService.createNode(nodeData);
      await loadFullLineage();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create node';
      setError(errorMessage);
      throw err;
    }
  }, [loadFullLineage]);

  const updateNode = useCallback(async (
    nodeId: string,
    nodeType: NodeType,
    updateData: NodeUpdate
  ) => {
    try {
      await apiService.updateNode(nodeId, nodeType, updateData);
      await loadFullLineage();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update node';
      setError(errorMessage);
      throw err;
    }
  }, [loadFullLineage]);

  const deleteNode = useCallback(async (nodeId: string, nodeType: NodeType) => {
    try {
      await apiService.deleteNode(nodeId, nodeType);
      await loadFullLineage();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete node';
      setError(errorMessage);
      throw err;
    }
  }, [loadFullLineage]);

  const createRelationship = useCallback(async (relData: RelationshipCreate) => {
    try {
      await apiService.createRelationship(relData);
      await loadFullLineage();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create relationship';
      setError(errorMessage);
      throw err;
    }
  }, [loadFullLineage]);

  const highlightPathNodes = useCallback((pathIds: string[]) => {
    const { nodes: highlightedNodes, edges: highlightedEdges } = highlightPath(
      nodes,
      edges,
      pathIds
    );
    setNodes(highlightedNodes);
    setEdges(highlightedEdges);
  }, [nodes, edges]);

  const clearAllHighlights = useCallback(() => {
    const { nodes: clearedNodes, edges: clearedEdges } = clearHighlights(nodes, edges);
    setNodes(clearedNodes);
    setEdges(clearedEdges);
  }, [nodes, edges]);

  useEffect(() => {
    loadFullLineage();
  }, []);

  return {
    nodes,
    edges,
    stats,
    loading,
    error,
    loadFullLineage,
    loadNodeLineage,
    findPath,
    createNode,
    updateNode,
    deleteNode,
    createRelationship,
    highlightPathNodes,
    clearAllHighlights,
    refreshStats,
    selectedNode,
    setSelectedNode,
  };
};