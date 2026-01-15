// frontend/src/services/api.ts - COMPLETE API SERVICE WITH ALL PATHS

import {
  SchemaDefinition,
  SchemaCreateRequest,
  LineageGraphResponse,
  LineagePathResponse,
  LineagePathRequest,
  DataLoadRequest,
  DataLoadResponse,
  SchemaStats,
} from '../types';

const API_BASE_URL = 'http://localhost:8000/api/v1';

class ApiService {
  // Schema endpoints
  async createSchema(request: SchemaCreateRequest): Promise<SchemaDefinition> {
    const response = await fetch(`${API_BASE_URL}/schemas/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to create schema');
    }

    return response.json();
  }

  async listSchemas(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/schemas/`);

    if (!response.ok) {
      throw new Error('Failed to list schemas');
    }

    return response.json();
  }

  async getSchema(schemaId: string): Promise<SchemaDefinition> {
    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to get schema');
    }

    return response.json();
  }

  async deleteSchema(schemaId: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete schema');
    }

    return response.json();
  }

  async getSchemaStats(schemaId: string): Promise<SchemaStats> {
    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}/stats`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to get schema stats');
    }

    return response.json();
  }

  async getLineageGraph(
    schemaId: string,
    expandedClasses: string[] = []
  ): Promise<LineageGraphResponse> {
    const params = new URLSearchParams();
    if (expandedClasses.length > 0) {
      params.append('expanded_classes', expandedClasses.join(','));
    }

    const url = `${API_BASE_URL}/schemas/${schemaId}/lineage${
      params.toString() ? '?' + params.toString() : ''
    }`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to get lineage graph');
    }

    return response.json();
  }

  async getLineagePath(
    schemaId: string,
    request: LineagePathRequest
  ): Promise<LineagePathResponse> {
    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}/lineage/path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to get lineage path');
    }

    return response.json();
  }

  async getShortestPath(
    schemaId: string,
    nodeIds: string[]
  ): Promise<LineagePathResponse> {
    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}/shortest-path`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ node_ids: nodeIds }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to find shortest path');
    }

    return response.json();
  }

  /**
   * Find ALL paths between multiple nodes (not just shortest paths)
   * This includes paths through different intermediate nodes
   * 
   * @param schemaId - The schema ID
   * @param nodeIds - Array of node IDs to find paths between
   * @param maxDepth - Maximum path length (number of hops), default 10
   * @returns LineagePathResponse with all discovered paths
   */
  async findAllPaths(
    schemaId: string,
    nodeIds: string[],
    maxDepth: number = 10
  ): Promise<LineagePathResponse> {
    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}/all-paths`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        node_ids: nodeIds,
        max_depth: maxDepth,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to find all paths');
    }

    return response.json();
  }

  /**
   * Preview file contents before loading
   * Reads first few rows and extracts column names
   * 
   * @param file - File to preview
   * @returns Preview data with columns and sample rows
   */
  async previewFile(file: File): Promise<{ columns: string[]; preview: any[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          
          if (file.name.endsWith('.csv')) {
            // Parse CSV
            const lines = content.split('\n').filter(line => line.trim());
            if (lines.length === 0) {
              reject(new Error('Empty file'));
              return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const preview = lines.slice(1, 6).map(line => {
              const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
              const row: any = {};
              headers.forEach((header, i) => {
                row[header] = values[i] || '';
              });
              return row;
            });
            
            resolve({ columns: headers, preview });
          } else if (file.name.endsWith('.json')) {
            // Parse JSON
            const data = JSON.parse(content);
            const array = Array.isArray(data) ? data : [data];
            
            if (array.length === 0) {
              reject(new Error('Empty JSON array'));
              return;
            }
            
            const columns = Object.keys(array[0]);
            const preview = array.slice(0, 5);
            
            resolve({ columns, preview });
          } else {
            reject(new Error('Unsupported file format for preview'));
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Failed to parse file'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  }

  async loadData(
    schemaId: string,
    file: File,
    mapping: any
  ): Promise<DataLoadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    const response = await fetch(`${API_BASE_URL}/schemas/${schemaId}/load-data`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to load data');
    }

    return response.json();
  }
}

const apiService = new ApiService();
export default apiService;