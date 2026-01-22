// frontend/src/services/api.ts
// COMPLETE FIXED VERSION - ALL METHODS INCLUDING createSubclass

import axios, { AxiosInstance } from 'axios';
import { 
  SchemaDefinition, 
  SchemaCreateRequest, 
  SchemaRelationship,
  Cardinality 
} from '../types';
import { LineageGraph } from '../types/lineage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class APIService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 60000, // 60 seconds
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.config.url} - ${response.status}`);
        return response;
      },
      (error) => {
        console.error('❌ Response Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // ============================================
  // SCHEMA OPERATIONS
  // ============================================

  async createSchema(data: SchemaCreateRequest): Promise<SchemaDefinition> {
    console.log('📝 Creating schema:', data.name);
    console.log('   Classes:', data.classes.length);
    console.log('   Relationships:', data.relationships.length);
    
    const response = await this.client.post<SchemaDefinition>('/schemas/', data);
    
    console.log('✅ Schema created:', response.data.id);
    return response.data;
  }

  async listSchemas(): Promise<any[]> {
    const response = await this.client.get('/schemas/');
    return response.data;
  }

  async getSchema(schemaId: string): Promise<SchemaDefinition> {
    const response = await this.client.get<SchemaDefinition>(`/schemas/${schemaId}`);
    return response.data;
  }

  async deleteSchema(schemaId: string): Promise<void> {
    await this.client.delete(`/schemas/${schemaId}`);
  }

  // ============================================
  // ✅ HIERARCHY OPERATIONS (FIXED - ADDED MISSING METHOD)
  // ============================================

  async createSubclass(
    schemaId: string,
    parentClassId: string,
    subclassData: {
      name: string;
      display_name?: string;
      description?: string;
      inherit_attributes?: boolean;
      additional_attributes?: any[];
      metadata?: any;
    }
  ): Promise<any> {
    console.log('➕ Creating subclass:', subclassData.name);
    console.log('   Parent:', parentClassId);
    console.log('   Schema:', schemaId);
    
    const payload = {
      parent_class_id: parentClassId,
      name: subclassData.name,
      display_name: subclassData.display_name || subclassData.name,
      description: subclassData.description || '',
      inherit_attributes: subclassData.inherit_attributes !== false,
      additional_attributes: subclassData.additional_attributes || [],
      metadata: subclassData.metadata || {}
    };
    
    const response = await this.client.post(
      `/hierarchy/${schemaId}/subclass`,
      payload
    );
    
    console.log('✅ Subclass created:', response.data.id);
    return response.data;
  }

  async getHierarchyTree(schemaId: string): Promise<any> {
    console.log('🌳 Fetching hierarchy tree for schema:', schemaId);
    const response = await this.client.get(`/hierarchy/${schemaId}/tree`);
    return response.data;
  }

  async updateClass(
    schemaId: string,
    classId: string,
    updateData: {
      name?: string;
      display_name?: string;
      metadata?: any;
    }
  ): Promise<any> {
    console.log('✏️ Updating class:', classId);
    const response = await this.client.patch(
      `/hierarchy/${schemaId}/class/${classId}`,
      updateData
    );
    return response.data;
  }

  async deleteClass(schemaId: string, classId: string): Promise<void> {
    console.log('🗑️ Deleting class:', classId);
    await this.client.delete(`/hierarchy/${schemaId}/class/${classId}`);
  }

  async getHierarchyStats(schemaId: string): Promise<any> {
    const response = await this.client.get(`/hierarchy/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // RELATIONSHIP OPERATIONS
  // ============================================

  async createRelationship(
    schemaId: string,
    sourceClassId: string,
    targetClassId: string,
    relationshipName: string,
    cardinality: Cardinality = Cardinality.ONE_TO_MANY
  ): Promise<SchemaRelationship> {
    console.log('🔗 Creating relationship:', relationshipName);
    console.log('   From:', sourceClassId);
    console.log('   To:', targetClassId);
    
    const response = await this.client.post<SchemaRelationship>(
      `/schemas/${schemaId}/relationships`,
      {
        source_class_id: sourceClassId,
        target_class_id: targetClassId,
        name: relationshipName,
        cardinality: cardinality
      }
    );
    
    console.log('✅ Relationship created:', response.data.id);
    return response.data;
  }

  async deleteRelationship(schemaId: string, relationshipId: string): Promise<void> {
    await this.client.delete(`/schemas/${schemaId}/relationships/${relationshipId}`);
  }

  // ============================================
  // LINEAGE & VISUALIZATION
  // ============================================

  async getLineageGraph(schemaId: string, expandedClasses: string[] = []): Promise<LineageGraph> {
    console.log('📊 Fetching lineage graph for schema:', schemaId);
    
    const params = expandedClasses.length > 0 
      ? { expanded_classes: expandedClasses.join(',') }
      : {};
    
    const response = await this.client.get<LineageGraph>(
      `/schemas/${schemaId}/lineage`,
      { params }
    );
    
    console.log('✅ Lineage graph loaded');
    console.log('   Nodes:', response.data.nodes?.length || 0);
    console.log('   Edges:', response.data.edges?.length || 0);
    
    return response.data;
  }

  async findPaths(
    schemaId: string,
    startNodeId: string,
    endNodeId: string,
    maxDepth: number = 5
  ): Promise<any> {
    const response = await this.client.post(`/schemas/${schemaId}/find-paths`, {
      start_node_id: startNodeId,
      end_node_id: endNodeId,
      max_depth: maxDepth
    });
    return response.data;
  }

  async getSchemaStats(schemaId: string): Promise<any> {
    const response = await this.client.get(`/schemas/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // SCHEMA INFERENCE
  // ============================================

  async inferSchema(file: File, format: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    console.log('🔍 Inferring schema from file:', file.name);

    const response = await this.client.post('/schemas/infer', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('✅ Schema inferred');
    console.log('   Classes:', response.data.classes?.length || 0);
    console.log('   Relationships:', response.data.relationships?.length || 0);

    return response.data;
  }

  async inferSchemaMulti(files: File[], formats: string[]): Promise<any> {
    const formData = new FormData();
    
    files.forEach((file) => {
      formData.append('files', file);
    });
    
    formData.append('formats', JSON.stringify(formats));

    console.log('🔍 Inferring unified schema from', files.length, 'files');

    const response = await this.client.post('/schemas/infer-multi', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('✅ Unified schema inferred');
    console.log('   Classes:', response.data.classes?.length || 0);
    console.log('   Relationships:', response.data.relationships?.length || 0);

    return response.data;
  }

  // ============================================
  // DATA OPERATIONS
  // ============================================

  async parseFile(file: File, format: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', format);

    console.log('📄 Parsing file:', file.name);

    const response = await this.client.post('/data/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('✅ File parsed');
    console.log('   Rows:', response.data.row_count || 0);
    console.log('   Columns:', response.data.columns?.length || 0);

    return response.data;
  }

  async loadData(dataLoadRequest: any): Promise<any> {
    console.log('📊 Loading data for schema:', dataLoadRequest.schema_id);

    const response = await this.client.post('/data/load', dataLoadRequest);

    console.log('✅ Data loaded');
    console.log('   Instances created:', response.data.instances_created || 0);
    console.log('   Relationships created:', response.data.relationships_created || 0);

    return response.data;
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async healthCheck(): Promise<any> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

// Export singleton instance
const apiService = new APIService();
export default apiService;