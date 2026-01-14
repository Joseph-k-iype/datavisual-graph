import axios, { AxiosInstance } from 'axios';
import {
  GraphData,
  GraphNode,
  LineagePath,
  NodeCreate,
  NodeUpdate,
  NodeType,
  RelationshipCreate,
  LineageQuery,
  Stats,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}${API_PREFIX}`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Lineage endpoints
  async getFullLineage(): Promise<GraphData> {
    const response = await this.client.get<GraphData>('/lineage/full');
    return response.data;
  }

  async getNodeLineage(query: LineageQuery): Promise<GraphData> {
    const response = await this.client.post<GraphData>('/lineage/node', query);
    return response.data;
  }

  async findPaths(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<LineagePath> {
    const response = await this.client.get<LineagePath>('/lineage/paths', {
      params: { source_id: sourceId, target_id: targetId, max_depth: maxDepth },
    });
    return response.data;
  }

  async getHierarchicalLineage(): Promise<{ hierarchy: any[] }> {
    const response = await this.client.get('/lineage/hierarchical');
    return response.data;
  }

  // Node endpoints
  async createNode(nodeData: NodeCreate): Promise<GraphNode> {
    const response = await this.client.post<GraphNode>('/nodes/', nodeData);
    return response.data;
  }

  async getNode(nodeId: string, nodeType: NodeType): Promise<GraphNode> {
    const response = await this.client.get<GraphNode>(`/nodes/${nodeType}/${nodeId}`);
    return response.data;
  }

  async updateNode(
    nodeId: string,
    nodeType: NodeType,
    updateData: NodeUpdate
  ): Promise<GraphNode> {
    const response = await this.client.put<GraphNode>(
      `/nodes/${nodeType}/${nodeId}`,
      updateData
    );
    return response.data;
  }

  async deleteNode(nodeId: string, nodeType: NodeType): Promise<void> {
    await this.client.delete(`/nodes/${nodeType}/${nodeId}`);
  }

  async getAllNodes(nodeType?: NodeType): Promise<GraphNode[]> {
    const params = nodeType ? { node_type: nodeType } : {};
    const response = await this.client.get<GraphNode[]>('/nodes/', { params });
    return response.data;
  }

  async getStats(): Promise<Stats> {
    const response = await this.client.get<Stats>('/nodes/stats/summary');
    return response.data;
  }

  // Relationship endpoints
  async createRelationship(relData: RelationshipCreate): Promise<any> {
    const response = await this.client.post('/relationships/', relData);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; database: string }> {
    const response = await this.client.get('/health', {
      baseURL: API_BASE_URL,
    });
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;