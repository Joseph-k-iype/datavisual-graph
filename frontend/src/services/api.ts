// frontend/src/services/api.ts - Complete API Service

import axios, { AxiosInstance } from 'axios';
import {
  SchemaDefinition,
  LineageGraphResponse,
  AttributeTraceRequest,
  AttributeTraceResponse,
  DataLoadRequest,
  DataLoadResponse,
  SchemaStats,
  LineagePathResponse,
  SchemaCreateRequest,
} from '../types';

class APIService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.api.interceptors.request.use(
      (config) => {
        console.log(`📤 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.api.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.config.url}`, response.data);
        return response;
      },
      (error) => {
        console.error('❌ API Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // SCHEMA OPERATIONS
  // ============================================

  async getSchemas(): Promise<SchemaDefinition[]> {
    const response = await this.api.get('/schemas');
    return response.data;
  }

  async getSchema(schemaId: string): Promise<SchemaDefinition> {
    const response = await this.api.get(`/schemas/${schemaId}`);
    return response.data;
  }

  async createSchema(schema: SchemaCreateRequest): Promise<SchemaDefinition> {
    const response = await this.api.post('/schemas', schema);
    return response.data;
  }

  async updateSchema(schemaId: string, updates: Partial<SchemaDefinition>): Promise<SchemaDefinition> {
    const response = await this.api.put(`/schemas/${schemaId}`, updates);
    return response.data;
  }

  async deleteSchema(schemaId: string): Promise<void> {
    await this.api.delete(`/schemas/${schemaId}`);
  }

  // ============================================
  // LINEAGE OPERATIONS
  // ============================================

  async getLineageGraph(
    schemaId: string,
    expandedClasses?: string[]
  ): Promise<LineageGraphResponse> {
    const response = await this.api.get(`/schemas/${schemaId}/lineage`, {
      params: {
        expanded_classes: expandedClasses?.join(','),
      },
    });
    return response.data;
  }

  async findPaths(
    schemaId: string,
    nodeIds: string[],
    maxDepth?: number
  ): Promise<LineagePathResponse> {
    const response = await this.api.post(`/schemas/${schemaId}/find-paths`, {
      node_ids: nodeIds,
      max_depth: maxDepth || 10,
    });
    return response.data;
  }

  async getSchemaStats(schemaId: string): Promise<SchemaStats> {
    const response = await this.api.get(`/schemas/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // ATTRIBUTE LINEAGE
  // ============================================

  async traceAttributeLineage(
    request: AttributeTraceRequest
  ): Promise<AttributeTraceResponse> {
    const response = await this.api.post('/lineage/attribute/trace', request);
    return response.data;
  }

  async getAttributeFlows(schemaId: string): Promise<any> {
    const response = await this.api.get(`/schemas/${schemaId}/attribute-flows`);
    return response.data;
  }

  // ============================================
  // DATA LOADING
  // ============================================

  async loadData(
    schemaId: string,
    file: File,
    mapping: DataLoadRequest
  ): Promise<DataLoadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    const response = await this.api.post(
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

  async parseFile(file: File, format: string): Promise<{
    data: any[];
    columns: string[];
    preview: any[];
    data_types: Record<string, string>;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const response = await this.api.post('/data/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck(): Promise<{ status: string; database: string }> {
    const response = await this.api.get('/health');
    return response.data;
  }
}

export default new APIService();