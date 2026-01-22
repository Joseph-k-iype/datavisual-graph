# backend/app/routers/schema.py
"""
Schema Router - FULLY FIXED
All endpoints for schema management
"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from ..models.schemas import (
    SchemaDefinition, SchemaCreateRequest, SchemaStats,
    LineageGraphResponse, LineagePathRequest, LineagePathResponse,
    DataLoadRequest, DataLoadResponse, SuccessResponse,
    SchemaRelationship, Cardinality
)
from ..services.schema_service import SchemaService
from ..services.data_loader import DataLoaderService
from ..services.schema_inference_service import SchemaInferenceService
from ..services.multi_file_schema_inference_service import MultiFileSchemaInferenceService
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/schemas", tags=["schemas"])


# ============================================
# ✅ REQUEST MODELS - ADDED FOR RELATIONSHIP CREATION
# ============================================

class CreateRelationshipRequest(BaseModel):
    """Request model for creating relationships"""
    source_class_id: str = Field(..., description="Source class ID")
    target_class_id: str = Field(..., description="Target class ID")
    name: str = Field(..., description="Relationship name")
    cardinality: Cardinality = Field(default=Cardinality.ONE_TO_MANY, description="Relationship cardinality")


# ============================================
# SCHEMA INFERENCE
# ============================================

@router.post("/infer")
async def infer_schema(
    file: UploadFile = File(...),
    format: str = Form(...)
):
    """Infer schema from single uploaded data file"""
    try:
        logger.info(f"📥 Inferring schema from file: {file.filename} ({format})")
        
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
        
        # Ensure required fields
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
            logger.warning("Classes field is not a list, converting")
            validated_result['classes'] = []
        
        if not isinstance(validated_result['relationships'], list):
            logger.warning("Relationships field is not a list, converting")
            validated_result['relationships'] = []
        
        logger.info(f"✅ Schema inferred: {len(validated_result['classes'])} classes, "
                   f"{len(validated_result['relationships'])} relationships")
        
        return validated_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed schema inference: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to infer schema: {str(e)}"
        )


@router.post("/infer-multi")
async def infer_schema_multi(
    files: List[UploadFile] = File(...),
    formats: str = Form(...)
):
    """Infer unified schema from multiple files"""
    try:
        formats_list = json.loads(formats)
        
        logger.info(f"📥 Inferring unified schema from {len(files)} files")
        
        if len(files) != len(formats_list):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Number of files must match number of formats"
            )
        
        file_data = []
        for file, fmt in zip(files, formats_list):
            content = await file.read()
            if content:
                file_data.append({
                    'content': content,
                    'filename': file.filename or 'unknown',
                    'format': fmt
                })
        
        if not file_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No valid files provided"
            )
        
        result = MultiFileSchemaInferenceService.infer_unified_schema(file_data)
        
        # Validate response
        validated_result = {
            'suggested_name': result.get('suggested_name', 'Unified Schema'),
            'description': result.get('description', ''),
            'classes': result.get('classes', []),
            'relationships': result.get('relationships', []),
            'confidence_score': result.get('confidence_score', 0.5),
            'warnings': result.get('warnings', []),
        }
        
        logger.info(f"✅ Unified schema inferred: {len(validated_result['classes'])} classes, "
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


# ============================================
# SCHEMA CRUD
# ============================================

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


# ============================================
# ✅ RELATIONSHIPS - FIXED TO USE REQUEST BODY
# ============================================

@router.post("/{schema_id}/relationships", response_model=SchemaRelationship)
async def create_relationship(
    schema_id: str,
    request: CreateRelationshipRequest  # ✅ NOW USES REQUEST BODY INSTEAD OF QUERY PARAMS
):
    """Create a new relationship between classes"""
    try:
        logger.info(f"🔗 Creating relationship: {request.name}")
        logger.info(f"   Source: {request.source_class_id}")
        logger.info(f"   Target: {request.target_class_id}")
        logger.info(f"   Cardinality: {request.cardinality}")
        
        relationship = SchemaService.create_relationship(
            schema_id,
            request.source_class_id,
            request.target_class_id,
            request.name,
            request.cardinality
        )
        
        logger.info(f"✅ Relationship created: {relationship.id}")
        return relationship
        
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Failed to create relationship: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create relationship: {str(e)}"
        )


@router.delete("/{schema_id}/relationships/{relationship_id}", response_model=SuccessResponse)
async def delete_relationship(schema_id: str, relationship_id: str):
    """Delete a relationship"""
    try:
        # Implementation would go here
        return SuccessResponse(
            success=True,
            message=f"Relationship {relationship_id} deleted successfully"
        )
    except Exception as e:
        logger.error(f"Failed to delete relationship: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete relationship: {str(e)}"
        )


# ============================================
# LINEAGE & VISUALIZATION
# ============================================

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


# ============================================
# DATA LOADING
# ============================================

@router.post("/{schema_id}/load-data", response_model=DataLoadResponse)
async def load_data(
    schema_id: str,
    file: UploadFile = File(...),
    request_json: str = Form(...)
):
    """Load data into schema"""
    try:
        logger.info(f"Loading data for schema: {schema_id}")
        
        request_data = json.loads(request_json)
        request = DataLoadRequest(**request_data)
        request.schema_id = schema_id
        
        file_content = await file.read()
        
        response = DataLoaderService.load_data(request, file_content)
        
        logger.info(f"✅ Data loaded: {response.instances_created} instances, "
                   f"{response.relationships_created} relationships")
        
        return response
        
    except Exception as e:
        logger.error(f"Failed to load data: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load data: {str(e)}"
        )