// frontend/src/services/api.ts - COMPLETE FIXED VERSION

import axios, { AxiosInstance } from 'axios';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Attribute {
  id: string;
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  is_nullable?: boolean;
  metadata?: any;
}

export interface HierarchyNode {
  id: string;
  name: string;
  display_name?: string;
  type: 'class' | 'subclass';
  level: number;
  parent_id?: string;
  children: HierarchyNode[];
  attributes: Attribute[];
  instance_count?: number;
  collapsed: boolean;
  metadata?: any;
}

export interface HierarchyTree {
  schema_id: string;
  root_nodes: HierarchyNode[];
  max_depth: number;
  total_nodes: number;
  metadata?: any;
}

export interface CreateSubclassRequest {
  parent_class_id: string;
  name: string;
  display_name?: string;
  description?: string;
  inherit_attributes: boolean;
  additional_attributes: Attribute[];
  metadata?: any;
}

// ============================================
// API SERVICE CLASS
// ============================================

class APIService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

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

  async getSchemas(): Promise<any[]> {
    const response = await this.api.get('/schemas');
    return response.data;
  }

  async getSchema(schemaId: string): Promise<any> {
    const response = await this.api.get(`/schemas/${schemaId}`);
    return response.data;
  }

  async createSchema(schema: any): Promise<any> {
    const response = await this.api.post('/schemas', schema);
    return response.data;
  }

  async updateSchema(schemaId: string, updates: any): Promise<any> {
    const response = await this.api.put(`/schemas/${schemaId}`, updates);
    return response.data;
  }

  async deleteSchema(schemaId: string): Promise<void> {
    await this.api.delete(`/schemas/${schemaId}`);
  }

  async inferSchema(file: File, format: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    const response = await this.api.post('/schemas/infer', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async inferSchemaMulti(files: File[], formats: string[]): Promise<any> {
    console.log(`🔍 Inferring schema from ${files.length} files:`, files.map(f => f.name));
    
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('formats', JSON.stringify(formats));

    const response = await this.api.post('/schemas/infer-multi', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('✅ Multi-file inference result:', response.data);
    return response.data;
  }

  // ============================================
  // HIERARCHY OPERATIONS - NEW!
  // ============================================

  async getHierarchyTree(schemaId: string): Promise<HierarchyTree> {
    console.log(`📊 Fetching hierarchy tree for schema: ${schemaId}`);
    const response = await this.api.get(`/hierarchy/${schemaId}/tree`);
    return response.data;
  }

  async createSubclass(schemaId: string, request: CreateSubclassRequest): Promise<HierarchyNode> {
    console.log(`➕ Creating subclass under parent: ${request.parent_class_id}`);
    const response = await this.api.post(`/hierarchy/${schemaId}/subclass`, request);
    console.log('✅ Subclass created:', response.data);
    return response.data;
  }

  async getHierarchyStats(schemaId: string): Promise<any> {
    const response = await this.api.get(`/hierarchy/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // LINEAGE OPERATIONS
  // ============================================

  async getLineageGraph(schemaId: string, expandedClasses?: string[]): Promise<any> {
    const response = await this.api.get(`/schemas/${schemaId}/lineage`, {
      params: {
        expanded_classes: expandedClasses?.join(','),
      },
    });
    return response.data;
  }

  async findPaths(schemaId: string, nodeIds: string[], maxDepth?: number): Promise<any> {
    const response = await this.api.post(`/schemas/${schemaId}/find-paths`, {
      node_ids: nodeIds,
      max_depth: maxDepth || 10,
    });
    return response.data;
  }

  async getSchemaStats(schemaId: string): Promise<any> {
    const response = await this.api.get(`/schemas/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // DATA LOADING
  // ============================================

  async loadData(schemaId: string, file: File, mapping: any): Promise<any> {
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

  async parseFile(file: File, format: string): Promise<any> {
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