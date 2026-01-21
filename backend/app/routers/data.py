# backend/app/routers/data.py - FIXED NaN HANDLING
"""
Data operations router
Handles file parsing, data preview, and data type inference
"""

from fastapi import APIRouter, HTTPException, status, UploadFile, File, Form
from typing import List, Dict, Any
from ..utils.parsers import FileParser
import logging
import math
import json

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])


def clean_data_for_json(data: Any) -> Any:
    """
    Recursively clean data to make it JSON serializable
    Converts NaN, Infinity to None
    """
    if isinstance(data, dict):
        return {k: clean_data_for_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_data_for_json(item) for item in data]
    elif isinstance(data, float):
        # Check for NaN, Infinity
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    else:
        return data


@router.post("/parse")
async def parse_file(
    file: UploadFile = File(...),
    format: str = Form(...)
):
    """
    Parse uploaded file and return columns, preview data, and inferred data types
    
    Args:
        file: Uploaded file
        format: File format (csv, excel, json, xml)
    
    Returns:
        Dictionary with:
        - data: Full dataset (NaN values converted to null)
        - columns: List of column names
        - preview: First 10 rows
        - data_types: Inferred data types for each column
    """
    try:
        logger.info(f"📄 Parsing file: {file.filename} (format: {format})")
        
        # Read file content
        file_content = await file.read()
        
        # Parse file using FileParser utility
        data, columns = FileParser.parse_file(
            file_content,
            file.filename or 'unknown',
            format
        )
        
        logger.info(f"✅ Parsed {len(data)} rows with {len(columns)} columns")
        
        # Clean data to handle NaN values
        cleaned_data = clean_data_for_json(data)
        
        # Get preview (first 10 rows) and clean it too
        preview = FileParser.get_data_preview(data, max_rows=10)
        cleaned_preview = clean_data_for_json(preview)
        
        # Infer data types
        data_types = FileParser.infer_data_types(data, columns)
        
        # Filter out empty/unnamed columns
        filtered_columns = [col for col in columns if col and not col.startswith('Unnamed:')]
        
        # If we filtered columns, also filter the data
        if len(filtered_columns) < len(columns):
            logger.info(f"🧹 Filtered out {len(columns) - len(filtered_columns)} unnamed columns")
            cleaned_data = [
                {k: v for k, v in row.items() if k in filtered_columns}
                for row in cleaned_data
            ]
            cleaned_preview = [
                {k: v for k, v in row.items() if k in filtered_columns}
                for row in cleaned_preview
            ]
            data_types = {k: v for k, v in data_types.items() if k in filtered_columns}
        
        response_data = {
            "data": cleaned_data,
            "columns": filtered_columns,
            "preview": cleaned_preview,
            "data_types": data_types,
            "row_count": len(cleaned_data),
            "column_count": len(filtered_columns)
        }
        
        # Verify the response is JSON serializable
        try:
            json.dumps(response_data)
        except (ValueError, TypeError) as e:
            logger.error(f"❌ Response not JSON serializable: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to serialize response: {str(e)}"
            )
        
        return response_data
        
    except ValueError as e:
        logger.error(f"❌ Validation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"❌ Failed to parse file: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse file: {str(e)}"
        )


@router.post("/preview")
async def preview_file(
    file: UploadFile = File(...),
    format: str = Form(...),
    max_rows: int = Form(10)
):
    """
    Get a preview of file data without full parsing
    
    Args:
        file: Uploaded file
        format: File format
        max_rows: Maximum rows to return (default: 10)
    
    Returns:
        Dictionary with preview data and basic stats
    """
    try:
        logger.info(f"📄 Previewing file: {file.filename}")
        
        file_content = await file.read()
        
        data, columns = FileParser.parse_file(
            file_content,
            file.filename or 'unknown',
            format
        )
        
        preview = FileParser.get_data_preview(data, max_rows=max_rows)
        
        # Clean preview data
        cleaned_preview = clean_data_for_json(preview)
        
        # Filter unnamed columns
        filtered_columns = [col for col in columns if col and not col.startswith('Unnamed:')]
        
        return {
            "preview": cleaned_preview,
            "columns": filtered_columns,
            "total_rows": len(data),
            "preview_rows": len(cleaned_preview)
        }
        
    except Exception as e:
        logger.error(f"❌ Failed to preview file: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview file: {str(e)}"
        )


@router.post("/validate")
async def validate_file(
    file: UploadFile = File(...),
    format: str = Form(...)
):
    """
    Validate file format and structure without parsing full content
    
    Returns:
        Validation result with any errors or warnings
    """
    try:
        logger.info(f"🔍 Validating file: {file.filename}")
        
        file_content = await file.read()
        
        # Try to parse file
        try:
            data, columns = FileParser.parse_file(
                file_content,
                file.filename or 'unknown',
                format
            )
            
            # Filter unnamed columns
            filtered_columns = [col for col in columns if col and not col.startswith('Unnamed:')]
            
            warnings = []
            if len(filtered_columns) < len(columns):
                warnings.append(f"File contains {len(columns) - len(filtered_columns)} unnamed/empty columns that will be ignored")
            
            return {
                "valid": True,
                "message": "File is valid and can be parsed",
                "row_count": len(data),
                "column_count": len(filtered_columns),
                "columns": filtered_columns,
                "warnings": warnings
            }
            
        except ValueError as e:
            return {
                "valid": False,
                "message": str(e),
                "errors": [str(e)]
            }
            
    except Exception as e:
        logger.error(f"❌ Validation failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Validation failed: {str(e)}"
        )