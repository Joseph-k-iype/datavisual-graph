// frontend/src/services/api.ts - ENHANCED API SERVICE

import axios, { AxiosInstance } from 'axios';
import {
  SchemaDefinition,
  SchemaCreateRequest,
  SchemaListItem,
  SchemaStats,
  LineageGraphResponse,
  LineagePathRequest,
  LineagePathResponse,
  DataLoadResponse,
  SuccessResponse,
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

  // ============================================
  // SCHEMA ENDPOINTS
  // ============================================

  async createSchema(request: SchemaCreateRequest): Promise<SchemaDefinition> {
    const response = await this.client.post<SchemaDefinition>('/schemas/', request);
    return response.data;
  }

  async listSchemas(): Promise<SchemaListItem[]> {
    const response = await this.client.get<SchemaListItem[]>('/schemas/');
    return response.data;
  }

  async getSchema(schemaId: string): Promise<SchemaDefinition> {
    const response = await this.client.get<SchemaDefinition>(`/schemas/${schemaId}`);
    return response.data;
  }

  async deleteSchema(schemaId: string): Promise<SuccessResponse> {
    const response = await this.client.delete<SuccessResponse>(`/schemas/${schemaId}`);
    return response.data;
  }

  async getSchemaStats(schemaId: string): Promise<SchemaStats> {
    const response = await this.client.get<SchemaStats>(`/schemas/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // LINEAGE ENDPOINTS
  // ============================================

  async getLineageGraph(
    schemaId: string,
    expandedClasses?: string[]
  ): Promise<LineageGraphResponse> {
    const params = expandedClasses && expandedClasses.length > 0
      ? { expanded_classes: expandedClasses.join(',') }
      : {};
    
    const response = await this.client.get<LineageGraphResponse>(
      `/schemas/${schemaId}/lineage`,
      { params }
    );
    return response.data;
  }

  async getLineagePath(
    schemaId: string,
    request: LineagePathRequest
  ): Promise<LineagePathResponse> {
    const response = await this.client.post<LineagePathResponse>(
      `/schemas/${schemaId}/lineage/path`,
      request
    );
    return response.data;
  }

  async getShortestPath(
    schemaId: string,
    nodeIds: string[]
  ): Promise<LineagePathResponse> {
    const response = await this.client.post<LineagePathResponse>(
      `/schemas/${schemaId}/shortest-path`,
      nodeIds
    );
    return response.data;
  }

  // ============================================
  // DATA LOADING ENDPOINTS
  // ============================================

  async loadData(
    schemaId: string,
    file: File,
    mapping: {
      format: string;
      class_mappings: any[];
      relationship_mappings?: any[];
    }
  ): Promise<DataLoadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    const response = await this.client.post<DataLoadResponse>(
      `/schemas/${schemaId}/load-data`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  }

  // ============================================
  // FILE PREVIEW ENDPOINTS
  // ============================================

  async previewFile(file: File): Promise<{
    columns: string[];
    preview: any[];
    sheets?: string[];
  }> {
    // Client-side file preview
    const text = await file.text();
    
    if (file.name.endsWith('.csv')) {
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) {
        return { columns: [], preview: [] };
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      const preview = lines.slice(1, 11).map(line => {
        const values = line.split(',');
        const obj: Record<string, any> = {};
        headers.forEach((header, idx) => {
          obj[header] = values[idx]?.trim() || '';
        });
        return obj;
      });
      
      return { columns: headers, preview };
    } else if (file.name.endsWith('.json')) {
      const data = JSON.parse(text);
      let preview: any[] = [];
      let columns: string[] = [];
      
      if (Array.isArray(data)) {
        preview = data.slice(0, 10);
        if (preview.length > 0) {
          columns = Object.keys(preview[0]);
        }
      } else if (typeof data === 'object') {
        // Find the first array in the object
        for (const key in data) {
          if (Array.isArray(data[key])) {
            preview = data[key].slice(0, 10);
            if (preview.length > 0) {
              columns = Object.keys(preview[0]);
            }
            break;
          }
        }
      }
      
      return { columns, preview };
    }
    
    // For Excel and XML, we'd need a backend endpoint or library
    return { columns: [], preview: [] };
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck(): Promise<{ status: string; database: string }> {
    const response = await this.client.get('/health', {
      baseURL: API_BASE_URL,
    });
    return response.data;
  }
}

export const apiService = new ApiService();
export default apiService;