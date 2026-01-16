# backend/app/routers/schema.py
"""
Schema Router - API endpoints for schema management
COMPLETE IMPLEMENTATION with ALL endpoints including all-paths
"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from typing import List, Dict, Any, Optional
from ..models.schemas import (
    SchemaDefinition, SchemaCreateRequest, SchemaStats,
    LineageGraphResponse, LineagePathRequest, LineagePathResponse,
    DataLoadRequest, DataLoadResponse, SuccessResponse
)
from ..services.schema_service import SchemaService
from ..services.data_loader import DataLoaderService
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.post("/", response_model=SchemaDefinition, status_code=status.HTTP_201_CREATED)
async def create_schema(request: SchemaCreateRequest):
    """Create a new schema definition"""
    try:
        schema = SchemaService.create_schema(request)
        return schema
    except Exception as e:
        logger.error(f"Failed to create schema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create schema: {str(e)}"
        )


@router.get("/", response_model=List[Dict[str, Any]])
async def list_schemas():
    """List all schemas"""
    try:
        schemas = SchemaService.list_schemas()
        return schemas
    except Exception as e:
        logger.error(f"Failed to list schemas: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list schemas: {str(e)}"
        )


@router.get("/{schema_id}", response_model=SchemaDefinition)
async def get_schema(schema_id: str):
    """Get schema by ID"""
    try:
        schema = SchemaService.get_schema(schema_id)
        if not schema:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schema not found: {schema_id}"
            )
        return schema
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schema: {str(e)}"
        )


@router.delete("/{schema_id}", response_model=SuccessResponse)
async def delete_schema(schema_id: str):
    """Delete a schema and all associated data"""
    try:
        success = SchemaService.delete_schema(schema_id)
        return SuccessResponse(
            success=success,
            message=f"Schema {schema_id} deleted successfully"
        )
    except Exception as e:
        logger.error(f"Failed to delete schema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete schema: {str(e)}"
        )


@router.get("/{schema_id}/stats", response_model=SchemaStats)
async def get_schema_stats(schema_id: str):
    """Get statistics for a schema"""
    try:
        stats = SchemaService.get_schema_stats(schema_id)
        return stats
    except Exception as e:
        logger.error(f"Failed to get schema stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schema stats: {str(e)}"
        )


@router.get("/{schema_id}/lineage", response_model=LineageGraphResponse)
async def get_lineage_graph(
    schema_id: str,
    expanded_classes: Optional[str] = None
):
    """Get hierarchical lineage graph for a schema"""
    try:
        expanded_list = []
        if expanded_classes:
            expanded_list = expanded_classes.split(',')
        
        graph = SchemaService.get_lineage_graph(schema_id, expanded_list)
        return graph
    except Exception as e:
        logger.error(f"Failed to get lineage graph: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get lineage graph: {str(e)}"
        )


@router.post("/{schema_id}/lineage/path", response_model=LineagePathResponse)
async def get_lineage_path(schema_id: str, request: LineagePathRequest):
    """Get lineage path from start node"""
    try:
        path = SchemaService.get_lineage_path(
            schema_id,
            request.start_node_id,
            request.end_node_id,
            request.max_depth
        )
        return path
    except Exception as e:
        logger.error(f"Failed to get lineage path: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get lineage path: {str(e)}"
        )


@router.post("/{schema_id}/shortest-path", response_model=LineagePathResponse)
async def get_shortest_path(
    schema_id: str,
    request: dict
):
    """
    Find shortest path between multiple nodes (LEGACY - delegates to all-paths).
    If 2 nodes provided: finds shortest path between them.
    If 3+ nodes provided: finds path connecting all nodes.
    """
    try:
        node_ids = request.get('node_ids', [])
        
        if len(node_ids) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 nodes required for shortest path"
            )
        
        path = SchemaService.get_shortest_path(schema_id, node_ids)
        return path
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get shortest path: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get shortest path: {str(e)}"
        )


@router.post("/{schema_id}/all-paths", response_model=LineagePathResponse)
async def get_all_paths(
    schema_id: str,
    request: dict
):
    """
    Find ALL paths between multiple nodes (not just shortest paths).
    This includes paths through different intermediate nodes.
    
    Request body:
    {
        "node_ids": ["node1", "node2"],  // List of node IDs
        "max_depth": 10  // Optional, default 10
    }
    
    For 2 nodes: finds ALL paths between them
    For 3+ nodes: finds ALL paths connecting consecutive pairs
    """
    try:
        node_ids = request.get('node_ids', [])
        max_depth = request.get('max_depth', 10)
        
        if len(node_ids) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 nodes required for path finding"
            )
        
        if max_depth < 1 or max_depth > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_depth must be between 1 and 20"
            )
        
        logger.info(f"Finding all paths between {len(node_ids)} nodes with max_depth={max_depth}")
        path = SchemaService.get_all_paths_between_nodes(schema_id, node_ids, max_depth)
        logger.info(f"Found {len(path.paths)} paths, {len(path.highlighted_nodes)} nodes, {len(path.highlighted_edges)} edges")
        return path
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get all paths: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all paths: {str(e)}"
        )


@router.post("/{schema_id}/load-data", response_model=DataLoadResponse)
async def load_data(
    schema_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(...)
):
    """Load data from file into schema"""
    try:
        # Parse mapping JSON
        mapping_data = json.loads(mapping)
        
        # Create request object
        request = DataLoadRequest(
            schema_id=schema_id,
            format=mapping_data['format'],
            file_name=file.filename or 'unknown',
            class_mappings=mapping_data['class_mappings'],
            relationship_mappings=mapping_data.get('relationship_mappings')
        )
        
        # Read file content
        file_content = await file.read()
        
        # Load data
        response = DataLoaderService.load_data(request, file_content)
        return response
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mapping JSON: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to load data: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load data: {str(e)}"
        )
    # Add this to backend/app/routers/schema.py

@router.get("/{schema_id}/verify-db")
async def verify_database(schema_id: str):
    """Verify what's actually in the database for this schema"""
    from ..database import db
    
    results = {}
    
    # 1. Check schema exists
    schema_check = """
    MATCH (s:Schema {id: $schema_id})
    RETURN s.name as name
    """
    schema_result = db.execute_query(schema_check, {'schema_id': schema_id})
    results['schema_exists'] = len(schema_result.result_set) > 0 if schema_result.result_set else False
    if results['schema_exists']:
        results['schema_name'] = schema_result.result_set[0][0]
    
    # 2. Check for classes with HAS_CLASS relationship
    has_class_check = """
    MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
    RETURN c.id, c.name
    """
    has_class_result = db.execute_query(has_class_check, {'schema_id': schema_id})
    results['classes_with_HAS_CLASS'] = []
    if has_class_result.result_set:
        for row in has_class_result.result_set:
            results['classes_with_HAS_CLASS'].append({
                'id': row[0],
                'name': row[1]
            })
    
    # 3. Check for classes with BELONGS_TO relationship (old/wrong)
    belongs_to_check = """
    MATCH (c:SchemaClass)-[:BELONGS_TO]->(s:Schema {id: $schema_id})
    RETURN c.id, c.name
    """
    belongs_to_result = db.execute_query(belongs_to_check, {'schema_id': schema_id})
    results['classes_with_BELONGS_TO'] = []
    if belongs_to_result.result_set:
        for row in belongs_to_result.result_set:
            results['classes_with_BELONGS_TO'].append({
                'id': row[0],
                'name': row[1]
            })
    
    # 4. Check for orphaned classes (have schema_id property but no relationship)
    orphan_check = """
    MATCH (c:SchemaClass {schema_id: $schema_id})
    WHERE NOT (c)-[:HAS_CLASS|BELONGS_TO]-()
    RETURN c.id, c.name
    """
    orphan_result = db.execute_query(orphan_check, {'schema_id': schema_id})
    results['orphaned_classes'] = []
    if orphan_result.result_set:
        for row in orphan_result.result_set:
            results['orphaned_classes'].append({
                'id': row[0],
                'name': row[1]
            })
    
    # 5. Check all SchemaClass nodes with this schema_id (regardless of relationship)
    all_classes_check = """
    MATCH (c:SchemaClass {schema_id: $schema_id})
    RETURN c.id, c.name
    """
    all_classes_result = db.execute_query(all_classes_check, {'schema_id': schema_id})
    results['all_classes_with_schema_id'] = []
    if all_classes_result.result_set:
        for row in all_classes_result.result_set:
            results['all_classes_with_schema_id'].append({
                'id': row[0],
                'name': row[1]
            })
    
    # 6. Diagnosis
    if not results['schema_exists']:
        results['diagnosis'] = "❌ Schema doesn't exist!"
    elif len(results['classes_with_HAS_CLASS']) > 0:
        results['diagnosis'] = f"✅ Found {len(results['classes_with_HAS_CLASS'])} classes with correct HAS_CLASS relationship"
    elif len(results['classes_with_BELONGS_TO']) > 0:
        results['diagnosis'] = f"⚠️ Found {len(results['classes_with_BELONGS_TO'])} classes with OLD BELONGS_TO relationship - NEED TO FIX!"
        results['fix_needed'] = "Run the migration endpoint to fix relationships"
    elif len(results['orphaned_classes']) > 0:
        results['diagnosis'] = f"⚠️ Found {len(results['orphaned_classes'])} orphaned classes - NEED TO CONNECT!"
        results['fix_needed'] = "Run the migration endpoint to create HAS_CLASS relationships"
    elif len(results['all_classes_with_schema_id']) > 0:
        results['diagnosis'] = "⚠️ Classes exist but relationship is unclear"
    else:
        results['diagnosis'] = "❌ No classes found at all - schema was created without classes"
    
    return results


@router.post("/{schema_id}/fix-relationships")
async def fix_relationships(schema_id: str):
    """
    Fix schema class relationships
    This will:
    1. Remove old BELONGS_TO relationships
    2. Create correct HAS_CLASS relationships
    """
    from ..database import db
    
    try:
        # First, create HAS_CLASS for classes that have schema_id property
        fix_query = """
        MATCH (s:Schema {id: $schema_id})
        MATCH (c:SchemaClass {schema_id: $schema_id})
        WHERE NOT (s)-[:HAS_CLASS]->(c)
        CREATE (s)-[:HAS_CLASS]->(c)
        RETURN c.id, c.name
        """
        result = db.execute_query(fix_query, {'schema_id': schema_id})
        
        fixed_classes = []
        if result.result_set:
            for row in result.result_set:
                fixed_classes.append({
                    'id': row[0],
                    'name': row[1]
                })
        
        # Remove old BELONGS_TO relationships
        remove_old_query = """
        MATCH (c:SchemaClass)-[r:BELONGS_TO]->(:Schema {id: $schema_id})
        DELETE r
        """
        db.execute_query(remove_old_query, {'schema_id': schema_id})
        
        return {
            'success': True,
            'message': f'Fixed {len(fixed_classes)} classes',
            'fixed_classes': fixed_classes
        }
        
    except Exception as e:
        logger.error(f"Failed to fix relationships: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }