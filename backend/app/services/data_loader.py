# backend/app/services/data_loader.py
"""
Data Loader Service - Handles loading data from various formats
Supports CSV, Excel, JSON, and XML
"""

import uuid
import json
import pandas as pd
import xml.etree.ElementTree as ET
import traceback
from typing import List, Dict, Any, Optional
from io import StringIO, BytesIO
from ..models.schemas import (
    DataFormat, DataLoadRequest, DataLoadResponse,
    DataInstance, DataRelationship, ClassDataMapping
)
from .schema_service import SchemaService
import logging

logger = logging.getLogger(__name__)


class DataLoaderService:
    """Service for loading data from files into schema"""
    
    @staticmethod
    def load_data(request: DataLoadRequest, file_content: bytes) -> DataLoadResponse:
        """Load data from file into schema"""
        try:
            # Parse file based on format
            data_frames = DataLoaderService._parse_file(
                file_content, 
                request.format, 
                request.file_name
            )
            
            instances_created = 0
            relationships_created = 0
            errors = []
            warnings = []
            
            # Get schema
            schema = SchemaService.get_schema(request.schema_id)
            if not schema:
                raise ValueError(f"Schema not found: {request.schema_id}")
            
            logger.info(f"Loading data into schema: {schema.name} (ID: {schema.id})")
            logger.info(f"Schema has {len(schema.classes)} classes")
            
            # Process each class mapping
            instance_map = {}  # Maps primary keys to instance IDs
            
            for class_mapping in request.class_mappings:
                try:
                    # Find the class
                    schema_class = next(
                        (c for c in schema.classes if c.id == class_mapping.class_id),
                        None
                    )
                    
                    if not schema_class:
                        errors.append(f"Class not found: {class_mapping.class_id}")
                        continue
                    
                    logger.info(f"Processing class: {schema_class.name} (ID: {schema_class.id})")
                    
                    # Get data for this class
                    # For CSV/Excel, try to match by class name or use default
                    if request.format == DataFormat.JSON:
                        class_data = data_frames.get(schema_class.name, [])
                        if not class_data:
                            class_data = data_frames.get('root', [])
                    else:
                        # For CSV, there's usually one sheet called 'default'
                        class_data = data_frames.get('default', [])
                        if not class_data:
                            # Try by class name
                            class_data = data_frames.get(schema_class.name, [])
                    
                    if not class_data:
                        warnings.append(f"No data found for class: {schema_class.name}")
                        logger.warning(f"No data found for class: {schema_class.name}")
                        continue
                    
                    logger.info(f"Found {len(class_data)} rows for class {schema_class.name}")
                    
                    # Create instances
                    for idx, row in enumerate(class_data):
                        try:
                            # Map columns to attributes
                            instance_data = {}
                            primary_key_value = None
                            
                            for col_mapping in class_mapping.column_mappings:
                                source_value = row.get(col_mapping.source_column)
                                
                                # Apply transformation if specified
                                if col_mapping.transform:
                                    # Simple transformations
                                    if col_mapping.transform == 'uppercase':
                                        source_value = str(source_value).upper()
                                    elif col_mapping.transform == 'lowercase':
                                        source_value = str(source_value).lower()
                                    elif col_mapping.transform == 'trim':
                                        source_value = str(source_value).strip()
                                
                                instance_data[col_mapping.target_attribute] = source_value
                                
                                # Track primary key
                                if col_mapping.source_column == class_mapping.primary_key:
                                    primary_key_value = source_value
                            
                            # Create instance
                            instance_id = str(uuid.uuid4())
                            instance = DataInstance(
                                id=instance_id,
                                class_id=class_mapping.class_id,
                                class_name=schema_class.name,
                                data=instance_data,
                                source_file=request.file_name,
                                source_row=idx
                            )
                            
                            logger.info(f"Creating instance {idx + 1}: {instance_id} for class {schema_class.name}")
                            SchemaService.create_data_instance(instance)
                            instances_created += 1
                            
                            # Store in instance map for relationships
                            if primary_key_value is not None:
                                key = f"{class_mapping.class_id}:{primary_key_value}"
                                instance_map[key] = instance_id
                                logger.debug(f"Mapped key {key} to instance {instance_id}")
                            
                        except Exception as e:
                            error_msg = f"Failed to create instance for {schema_class.name} row {idx}: {str(e)}"
                            errors.append(error_msg)
                            logger.error(error_msg)
                    
                except Exception as e:
                    error_msg = f"Failed to process class {class_mapping.class_id}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(error_msg)
            
            logger.info(f"Created {instances_created} instances total")
            
            # Create relationships if mappings provided
            if request.relationship_mappings:
                logger.info(f"Processing {len(request.relationship_mappings)} relationship mappings")
                for rel_mapping in request.relationship_mappings:
                    try:
                        source_class_id = rel_mapping.get('source_class_id')
                        target_class_id = rel_mapping.get('target_class_id')
                        source_key_attr = rel_mapping.get('source_key_attribute')
                        target_key_attr = rel_mapping.get('target_key_attribute')
                        schema_rel_id = rel_mapping.get('schema_relationship_id')
                        
                        # Find schema relationship
                        schema_rel = next(
                            (r for r in schema.relationships if r.id == schema_rel_id),
                            None
                        )
                        
                        if not schema_rel:
                            errors.append(f"Schema relationship not found: {schema_rel_id}")
                            continue
                        
                        # Get all instances of source class
                        source_instances_query = """
                        MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(i:DataInstance)
                        RETURN i
                        """
                        from ..database import db
                        source_result = db.execute_query(
                            source_instances_query, 
                            {'class_id': source_class_id}
                        )
                        
                        if source_result.result_set:
                            for row in source_result.result_set:
                                source_props = dict(row[0].properties)
                                source_data = json.loads(source_props.get('data', '{}'))
                                source_key_value = source_data.get(source_key_attr)
                                
                                if source_key_value:
                                    # Find target instance
                                    target_key = f"{target_class_id}:{source_key_value}"
                                    target_instance_id = instance_map.get(target_key)
                                    
                                    if target_instance_id:
                                        # Create relationship
                                        rel = DataRelationship(
                                            id=str(uuid.uuid4()),
                                            schema_relationship_id=schema_rel_id,
                                            source_instance_id=source_props['id'],
                                            target_instance_id=target_instance_id
                                        )
                                        SchemaService.create_data_relationship(rel)
                                        relationships_created += 1
                        
                    except Exception as e:
                        error_msg = f"Failed to create relationships: {str(e)}"
                        errors.append(error_msg)
                        logger.error(error_msg)
            
            logger.info(
                f"Data load completed: {instances_created} instances, "
                f"{relationships_created} relationships, {len(errors)} errors"
            )
            
            return DataLoadResponse(
                success=len(errors) == 0,
                schema_id=request.schema_id,
                instances_created=instances_created,
                relationships_created=relationships_created,
                errors=errors,
                warnings=warnings
            )
            
        except Exception as e:
            logger.error(f"Failed to load data: {str(e)}")
            logger.error(traceback.format_exc())
            return DataLoadResponse(
                success=False,
                schema_id=request.schema_id,
                instances_created=0,
                relationships_created=0,
                errors=[str(e)]
            )
    
    @staticmethod
    def _parse_file(file_content: bytes, format: DataFormat, file_name: str) -> Dict[str, List[Dict[str, Any]]]:
        """Parse file content based on format"""
        try:
            if format == DataFormat.CSV:
                return DataLoaderService._parse_csv(file_content)
            elif format == DataFormat.EXCEL:
                return DataLoaderService._parse_excel(file_content)
            elif format == DataFormat.JSON:
                return DataLoaderService._parse_json(file_content)
            elif format == DataFormat.XML:
                return DataLoaderService._parse_xml(file_content)
            else:
                raise ValueError(f"Unsupported format: {format}")
        except Exception as e:
            logger.error(f"Failed to parse file {file_name}: {str(e)}")
            raise
    
    @staticmethod
    def _parse_csv(file_content: bytes) -> Dict[str, List[Dict[str, Any]]]:
        """Parse CSV file"""
        try:
            # Decode bytes to string
            text = file_content.decode('utf-8')
            
            # Read CSV
            df = pd.read_csv(StringIO(text))
            
            # Convert to list of dicts
            records = df.to_dict('records')
            
            # Clean NaN values
            cleaned_records = []
            for record in records:
                cleaned = {k: (v if pd.notna(v) else None) for k, v in record.items()}
                cleaned_records.append(cleaned)
            
            return {'default': cleaned_records}
            
        except Exception as e:
            logger.error(f"Failed to parse CSV: {str(e)}")
            raise
    
    @staticmethod
    def _parse_excel(file_content: bytes) -> Dict[str, List[Dict[str, Any]]]:
        """Parse Excel file (supports multiple sheets)"""
        try:
            # Read Excel file
            excel_file = pd.ExcelFile(BytesIO(file_content))
            
            result = {}
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                
                # Convert to list of dicts
                records = df.to_dict('records')
                
                # Clean NaN values
                cleaned_records = []
                for record in records:
                    cleaned = {k: (v if pd.notna(v) else None) for k, v in record.items()}
                    cleaned_records.append(cleaned)
                
                result[sheet_name] = cleaned_records
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to parse Excel: {str(e)}")
            raise
    
    @staticmethod
    def _parse_json(file_content: bytes) -> Dict[str, List[Dict[str, Any]]]:
        """Parse JSON file"""
        try:
            # Decode and parse JSON
            text = file_content.decode('utf-8')
            data = json.loads(text)
            
            result = {}
            
            if isinstance(data, list):
                # Array of objects
                result['root'] = data
            elif isinstance(data, dict):
                # Object with arrays
                for key, value in data.items():
                    if isinstance(value, list):
                        result[key] = value
                    else:
                        # Single object
                        result[key] = [value]
            else:
                raise ValueError("JSON must be an object or array")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to parse JSON: {str(e)}")
            raise
    
    @staticmethod
    def _parse_xml(file_content: bytes) -> Dict[str, List[Dict[str, Any]]]:
        """Parse XML file"""
        try:
            # Parse XML
            text = file_content.decode('utf-8')
            root = ET.fromstring(text)
            
            result = {}
            
            # Group elements by tag name
            elements_by_tag = {}
            for child in root:
                tag = child.tag
                if tag not in elements_by_tag:
                    elements_by_tag[tag] = []
                
                # Convert XML element to dict
                element_dict = {}
                
                # Add attributes
                element_dict.update(child.attrib)
                
                # Add child elements
                for subchild in child:
                    element_dict[subchild.tag] = subchild.text
                
                # Add text content if no children
                if not list(child) and child.text:
                    element_dict['_text'] = child.text
                
                elements_by_tag[tag].append(element_dict)
            
            return elements_by_tag
            
        except Exception as e:
            logger.error(f"Failed to parse XML: {str(e)}")
            raise