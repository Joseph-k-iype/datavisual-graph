// frontend/src/hooks/useLineageGraph.ts - FIXED

import { useState, useCallback } from 'react';
import { LineageGraph } from '../types/lineage';
import apiService from '../services/api';

interface UseLineageGraphOptions {
  onError?: (error: Error) => void;
}

export function useLineageGraph(options?: UseLineageGraphOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [graph, setGraph] = useState<LineageGraph | null>(null);

  const loadGraph = useCallback(
    async (schemaId: string, expandedClasses?: string[]) => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiService.getLineageGraph(schemaId, expandedClasses || []);
        
        // Transform response to include all required properties
        const transformedData: LineageGraph = {
          schema_id: data.schema_id,
          schema_name: data.schema_name,
          nodes: data.nodes,
          edges: data.edges,
          metadata: data.metadata || {
            total_nodes: data.nodes.length,
            total_edges: data.edges.length,
          },
        };
        
        setGraph(transformedData);
        return transformedData;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load graph');
        setError(error);
        if (options?.onError) {
          options.onError(error);
        }
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const refreshGraph = useCallback(async () => {
    if (!graph?.schema_id) return;
    return loadGraph(graph.schema_id);
  }, [graph?.schema_id, loadGraph]);

  const clearGraph = useCallback(() => {
    setGraph(null);
    setError(null);
  }, []);

  return {
    graph,
    loading,
    error,
    loadGraph,
    refreshGraph,
    clearGraph,
  };
}

export default useLineageGraph;