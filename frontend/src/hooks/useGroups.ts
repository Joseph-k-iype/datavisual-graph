// frontend/src/hooks/useGroups.ts
import { useState, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export interface GroupNodesRequest {
  nodeIds: string[];
  groupName: string;
}

export interface GroupResponse {
  groupName: string;
  nodeCount: number;
  nodes: any[];
}

export const useGroups = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  const groupNodes = useCallback(async (nodeIds: string[], groupName: string): Promise<GroupResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/groups/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeIds,
          groupName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to group nodes');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to group nodes';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const ungroupNodes = useCallback(async (nodeIds: string[]): Promise<any[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/groups/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nodeIds,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to ungroup nodes');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to ungroup nodes';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getAllGroups = useCallback(async (): Promise<string[]> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/groups/`);

      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }

      const data = await response.json();
      setGroups(data.groups);
      return data.groups;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch groups';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getNodesInGroup = useCallback(async (groupName: string): Promise<GroupResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/groups/${encodeURIComponent(groupName)}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch group nodes');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch group nodes';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    groups,
    groupNodes,
    ungroupNodes,
    getAllGroups,
    getNodesInGroup,
  };
};