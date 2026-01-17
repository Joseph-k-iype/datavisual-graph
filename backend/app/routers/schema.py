# backend/app/routers/schema.py - UPDATED with multi-file support
from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from typing import List, Dict, Any, Optional
from ..models.schemas import (
    SchemaDefinition, SchemaCreateRequest, SchemaStats,
    LineageGraphResponse, LineagePathRequest, LineagePathResponse,
    DataLoadRequest, DataLoadResponse, SuccessResponse
)
from ..services.schema_service import SchemaService
from ..services.data_loader import DataLoaderService
from ..services.schema_inference_service import SchemaInferenceService
from ..services.multi_file_schema_inference_service import MultiFileSchemaInferenceService
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.post("/infer")
async def infer_schema(
    file: UploadFile = File(...),
    format: str = Form(...)
):
    """
    Infer schema from single uploaded data file
    """
    try:
        file_content = await file.read()
        
        result = SchemaInferenceService.infer_schema_from_file(
            file_content,
            file.filename or 'unknown',
            format
        )
        
        return result
    except Exception as e:
        logger.error(f"Failed to infer schema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to infer schema: {str(e)}"
        )


@router.post("/infer-multi")
async def infer_schema_multi(
    files: List[UploadFile] = File(...),
    formats: str = Form(...)  # JSON string array
):
    """
    Infer unified schema from multiple files using FalkorDB temporary graph
    
    This endpoint:
    1. Accepts multiple files
    2. Creates temporary analysis graph in FalkorDB
    3. Detects relationships across files
    4. Builds unified schema
    5. Cleans up temporary graph
    """
    try:
        # Parse formats
        format_list = json.loads(formats)
        
        if len(files) != len(format_list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of files must match number of formats"
            )
        
        logger.info(f"📦 Received {len(files)} files for multi-file schema inference")
        
        # Read all files
        files_data = []
        for file, file_format in zip(files, format_list):
            file_content = await file.read()
            files_data.append((file_content, file.filename or 'unknown', file_format))
        
        # Infer unified schema using FalkorDB
        result = MultiFileSchemaInferenceService.infer_schema_from_multiple_files(files_data)
        
        logger.info(f"✅ Multi-file inference complete: {len(result['classes'])} classes")
        
        return result
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid formats JSON: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed multi-file schema inference: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to infer schema from multiple files: {str(e)}"
        )


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
        return schema
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get schema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schema: {str(e)}"
        )


@router.delete("/{schema_id}", response_model=SuccessResponse)
async def delete_schema(schema_id: str):
    """Delete schema and all associated data"""
    try:
        SchemaService.delete_schema(schema_id)
        return SuccessResponse(success=True, message="Schema deleted successfully")
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to delete schema: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete schema: {str(e)}"
        )


@router.get("/{schema_id}/lineage", response_model=LineageGraphResponse)
async def get_lineage_graph(
    schema_id: str,
    expanded_classes: Optional[str] = None
):
    """Get lineage graph for schema - NO LIMITS"""
    try:
        expanded_list = []
        if expanded_classes:
            expanded_list = [c.strip() for c in expanded_classes.split(',') if c.strip()]
        
        graph = SchemaService.get_lineage_graph(schema_id, expanded_list)
        return graph
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get lineage graph: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get lineage graph: {str(e)}"
        )


@router.post("/{schema_id}/find-paths", response_model=LineagePathResponse)
async def find_all_paths(schema_id: str, request: dict):
    """Find ALL paths between nodes - production grade, NO LIMITS"""
    try:
        node_ids = request.get('node_ids', [])
        max_depth = request.get('max_depth', 10)
        
        if len(node_ids) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least 2 nodes required for path finding"
            )
        
        if max_depth < 1 or max_depth > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="max_depth must be between 1 and 50"
            )
        
        logger.info(f"Finding all paths between {len(node_ids)} nodes with max_depth={max_depth}")
        path = SchemaService.get_all_paths_between_nodes(schema_id, node_ids, max_depth)
        return path
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get all paths: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get all paths: {str(e)}"
        )


@router.get("/{schema_id}/stats", response_model=SchemaStats)
async def get_schema_stats(schema_id: str):
    """Get statistics for a schema"""
    try:
        stats = SchemaService.get_schema_stats(schema_id)
        return stats
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to get schema stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schema stats: {str(e)}"
        )


@router.post("/{schema_id}/load-data", response_model=DataLoadResponse)
async def load_data(
    schema_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(...)
):
    """Load data from file into schema"""
    try:
        mapping_data = json.loads(mapping)
        
        request = DataLoadRequest(
            schema_id=schema_id,
            format=mapping_data['format'],
            file_name=file.filename or 'unknown',
            class_mappings=mapping_data['class_mappings'],
            relationship_mappings=mapping_data.get('relationship_mappings')
        )
        
        file_content = await file.read()
        
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