# backend/app/routers/schema.py - FIXED load_data call
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
        logger.info(f"📥 Inferring schema from single file: {file.filename} ({format})")
        
        file_content = await file.read()
        
        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty file provided"
            )
        
        result = SchemaInferenceService.infer_schema_from_file(
            file_content,
            file.filename or 'unknown',
            format
        )
        
        # Validate response structure
        if not isinstance(result, dict):
            logger.error(f"Invalid result type: {type(result)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal error: Invalid response format"
            )
        
        # Ensure required fields exist with defaults
        validated_result = {
            'suggested_name': result.get('suggested_name', f'Schema from {file.filename}'),
            'description': result.get('description', ''),
            'classes': result.get('classes', []),
            'relationships': result.get('relationships', []),
            'confidence_score': result.get('confidence_score', 0.5),
            'warnings': result.get('warnings', []),
        }
        
        # Ensure arrays are actually arrays
        if not isinstance(validated_result['classes'], list):
            logger.warning("Classes field is not a list, converting to empty list")
            validated_result['classes'] = []
        
        if not isinstance(validated_result['relationships'], list):
            logger.warning("Relationships field is not a list, converting to empty list")
            validated_result['relationships'] = []
        
        if not isinstance(validated_result['warnings'], list):
            validated_result['warnings'] = []
        
        logger.info(f"✅ Schema inferred: {len(validated_result['classes'])} classes, "
                   f"{len(validated_result['relationships'])} relationships")
        
        return validated_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to infer schema: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to infer schema: {str(e)}"
        )


@router.post("/infer-multi")
async def infer_schema_multi(
    files: List[UploadFile] = File(...),
    formats: str = Form(...)
):
    """
    Infer unified schema from multiple files using FalkorDB temporary graph
    """
    try:
        logger.info(f"📦 Starting multi-file schema inference with {len(files)} files")
        
        if not files:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No files provided"
            )
        
        try:
            format_list = json.loads(formats)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid formats JSON: {str(e)}"
            )
        
        if not isinstance(format_list, list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formats must be a JSON array"
            )
        
        if len(files) != len(format_list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Number of files ({len(files)}) must match number of formats ({len(format_list)})"
            )
        
        logger.info(f"📊 Processing files: {[f.filename for f in files]}")
        logger.info(f"📊 With formats: {format_list}")
        
        files_data = []
        for file, file_format in zip(files, format_list):
            file_content = await file.read()
            
            if not file_content:
                logger.warning(f"⚠️ Empty file: {file.filename}")
                continue
            
            files_data.append((file_content, file.filename or 'unknown', file_format))
        
        if not files_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All provided files were empty"
            )
        
        result = MultiFileSchemaInferenceService.infer_schema_from_multiple_files(files_data)
        
        # Validate response structure
        if not isinstance(result, dict):
            logger.error(f"Invalid result type from inference: {type(result)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal error: Invalid response format"
            )
        
        # Ensure required fields exist with defaults
        validated_result = {
            'suggested_name': result.get('suggested_name', f'Unified Schema ({len(files)} files)'),
            'description': result.get('description', ''),
            'classes': result.get('classes', []),
            'relationships': result.get('relationships', []),
            'confidence_score': result.get('confidence_score', 0.5),
            'warnings': result.get('warnings', []),
            'metadata': result.get('metadata', {
                'source_files': [f.filename for f in files],
                'total_files': len(files)
            }),
        }
        
        # Ensure arrays are actually arrays
        if not isinstance(validated_result['classes'], list):
            logger.warning("Classes field is not a list, converting to empty list")
            validated_result['classes'] = []
        
        if not isinstance(validated_result['relationships'], list):
            logger.warning("Relationships field is not a list, converting to empty list")
            validated_result['relationships'] = []
        
        if not isinstance(validated_result['warnings'], list):
            validated_result['warnings'] = []
        
        if not isinstance(validated_result['metadata'], dict):
            validated_result['metadata'] = {
                'source_files': [f.filename for f in files],
                'total_files': len(files)
            }
        
        logger.info(f"✅ Multi-file inference complete: {len(validated_result['classes'])} classes, "
                   f"{len(validated_result['relationships'])} relationships")
        
        if validated_result['classes']:
            logger.info(f"📋 Classes: {[c.get('name', 'unknown') for c in validated_result['classes']]}")
        
        return validated_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed multi-file schema inference: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to infer schema from multiple files: {str(e)}"
        )


@router.post("/", response_model=SchemaDefinition, status_code=status.HTTP_201_CREATED)
async def create_schema(request: SchemaCreateRequest):
    """Create a new schema definition"""
    try:
        logger.info(f"Creating schema: {request.name}")
        schema = SchemaService.create_schema(request)
        logger.info(f"✅ Schema created: {schema.id}")
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
    """Get a specific schema"""
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
    """Delete a schema and all its data"""
    try:
        SchemaService.delete_schema(schema_id)
        return SuccessResponse(
            success=True,
            message=f"Schema {schema_id} deleted successfully"
        )
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
    """Get lineage graph for a schema"""
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
async def find_paths(schema_id: str, request: LineagePathRequest):
    """Find paths between nodes in lineage graph"""
    try:
        paths = SchemaService.find_lineage_paths(
            schema_id,
            request.start_node_id,
            request.end_node_id,
            request.max_depth
        )
        return paths
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to find paths: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to find paths: {str(e)}"
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
        logger.info(f"📥 Loading data into schema: {schema_id}")
        logger.info(f"📄 File: {file.filename}")
        
        # Parse mapping JSON
        try:
            mapping_data = json.loads(mapping)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid mapping JSON: {str(e)}"
            )
        
        # Create DataLoadRequest
        request = DataLoadRequest(
            schema_id=schema_id,
            format=mapping_data['format'],
            file_name=file.filename or 'unknown',
            class_mappings=mapping_data['class_mappings'],
            relationship_mappings=mapping_data.get('relationship_mappings')
        )
        
        # Read file content
        file_content = await file.read()
        
        logger.info(f"📊 Request: {len(request.class_mappings)} class mappings")
        
        # FIXED: Call with correct argument order - request first, then file_content
        response = DataLoaderService.load_data(request, file_content)
        
        logger.info(f"✅ Data loaded: {response.instances_created} instances, "
                   f"{response.relationships_created} relationships")
        
        return response
        
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid mapping JSON: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Failed to load data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load data: {str(e)}"
        )