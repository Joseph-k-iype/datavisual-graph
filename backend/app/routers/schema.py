# backend/app/routers/schema.py
"""
Schema Router - API endpoints for schema management
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
    node_ids: List[str]
):
    """
    Find shortest path between multiple nodes.
    If 2 nodes provided: finds shortest path between them.
    If 3+ nodes provided: finds path connecting all nodes.
    """
    try:
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