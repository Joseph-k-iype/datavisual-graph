// frontend/src/services/api.ts - ENHANCED WITH RELATIONSHIP CREATION

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

    // Add request interceptor for logging
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

    // Add response interceptor for logging
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
  // ✅ NEW: RELATIONSHIP OPERATIONS
  // ============================================

  async createRelationship(
    schemaId: string,
    sourceClassId: string,
    targetClassId: string,
    relationshipName: string,
    cardinality: Cardinality = Cardinality.ONE_TO_MANY
  ): Promise<SchemaRelationship> {
    console.log('🔗 Creating relationship:', relationshipName);
    console.log('   Schema:', schemaId);
    console.log('   Source:', sourceClassId);
    console.log('   Target:', targetClassId);
    console.log('   Cardinality:', cardinality);
    
    const response = await this.client.post<SchemaRelationship>(
      `/schemas/${schemaId}/relationships`,
      {
        source_class_id: sourceClassId,
        target_class_id: targetClassId,
        relationship_name: relationshipName,
        cardinality: cardinality,
      }
    );
    
    console.log('✅ Relationship created:', response.data.id);
    return response.data;
  }

  // ============================================
  // LINEAGE OPERATIONS
  // ============================================

  async getLineageGraph(
    schemaId: string,
    expandedClasses: string[] = []
  ): Promise<LineageGraph> {
    console.log('🎨 Fetching lineage graph for schema:', schemaId);
    console.log('   Expanded classes:', expandedClasses);
    
    const params = expandedClasses.length > 0 
      ? { expanded_classes: expandedClasses.join(',') } 
      : {};
    
    const response = await this.client.get<LineageGraph>(
      `/schemas/${schemaId}/lineage`,
      { params }
    );
    
    console.log('✅ Lineage graph fetched:');
    console.log('   Nodes:', response.data.nodes?.length || 0);
    console.log('   Edges:', response.data.edges?.length || 0);
    
    return response.data;
  }

  async getSchemaStats(schemaId: string): Promise<any> {
    const response = await this.client.get(`/schemas/${schemaId}/stats`);
    return response.data;
  }

  // ============================================
  // SCHEMA INFERENCE OPERATIONS
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
  // HIERARCHY OPERATIONS
  // ============================================

  async createSubclass(
    schemaId: string,
    parentClassId: string,
    subclassData: any
  ): Promise<any> {
    console.log('➕ Creating subclass under parent:', parentClassId);
    
    const response = await this.client.post(
      `/hierarchy/${schemaId}/subclass`,
      {
        parent_class_id: parentClassId,
        ...subclassData,
      }
    );
    
    console.log('✅ Subclass created:', response.data.id);
    return response.data;
  }

  async getHierarchyTree(schemaId: string): Promise<any> {
    const response = await this.client.get(`/hierarchy/${schemaId}/tree`);
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

  // ✅ FIX: Corrected loadData signature to match usage
  async loadData(dataLoadRequest: any): Promise<any> {
    console.log('📊 Loading data for schema:', dataLoadRequest.schema_id);

    // Create FormData for file upload
    const formData = new FormData();
    
    // If there's a file in the request, we need to handle it
    // The actual implementation depends on your backend API
    // For now, assuming the request contains all necessary data
    
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