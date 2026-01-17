# backend/app/services/schema_inference_service.py - NEW FILE
"""
Schema Inference Service - Automatically infers schema from data files
Supports CSV, JSON, XML, and Excel formats
"""

from typing import List, Dict, Any, Tuple
from ..utils.parsers import FileParser
from ..models.schemas import Cardinality
import logging
import uuid
import re

logger = logging.getLogger(__name__)


class SchemaInferenceService:
    """Service for inferring schema structure from data files"""
    
    @staticmethod
    def infer_schema_from_file(
        file_content: bytes,
        filename: str,
        file_format: str
    ) -> Dict[str, Any]:
        """
        Infer schema structure from uploaded file
        
        Returns:
            Dictionary with suggested_name, description, classes, and relationships
        """
        try:
            # Parse file
            data, columns = FileParser.parse_file(file_content, filename, file_format)
            
            if not data or not columns:
                raise ValueError("No data found in file")
            
            # Infer data types
            data_types = FileParser.infer_data_types(data, columns)
            
            # Analyze data structure for nested/hierarchical patterns
            classes, relationships = SchemaInferenceService._analyze_data_structure(
                data, columns, data_types
            )
            
            # Generate schema name from filename
            suggested_name = SchemaInferenceService._generate_schema_name(filename)
            
            # Calculate confidence score
            confidence_score = SchemaInferenceService._calculate_confidence(
                data, classes, relationships
            )
            
            warnings = []
            if confidence_score < 0.7:
                warnings.append("Low confidence in schema inference. Please review and adjust.")
            
            if len(relationships) == 0 and len(classes) > 1:
                warnings.append("No relationships detected. Consider adding them manually.")
            
            return {
                'suggested_name': suggested_name,
                'description': f'Auto-generated schema from {file_format.upper()} file: {filename}',
                'classes': classes,
                'relationships': relationships,
                'confidence_score': confidence_score,
                'warnings': warnings,
            }
            
        except Exception as e:
            logger.error(f"Failed to infer schema: {str(e)}")
            raise
    
    @staticmethod
    def _analyze_data_structure(
        data: List[Dict[str, Any]],
        columns: List[str],
        data_types: Dict[str, str]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Analyze data structure and infer classes and relationships
        
        Strategy:
        1. Detect nested structures (JSON objects/arrays)
        2. Identify potential parent-child relationships via naming patterns
        3. Detect foreign key patterns (columns ending with _id, _key, etc.)
        4. Group related columns into classes
        """
        
        classes = []
        relationships = []
        
        # Analyze for nested structures in JSON/XML
        nested_structures = SchemaInferenceService._detect_nested_structures(data, columns)
        
        if nested_structures:
            # Create hierarchical classes from nested structure
            classes, relationships = SchemaInferenceService._create_hierarchical_classes(
                nested_structures, data_types
            )
        else:
            # Create flat schema with potential relationships
            classes, relationships = SchemaInferenceService._create_flat_schema(
                columns, data_types, data
            )
        
        return classes, relationships
    
    @staticmethod
    def _detect_nested_structures(
        data: List[Dict[str, Any]],
        columns: List[str]
    ) -> Dict[str, Any]:
        """Detect nested JSON objects or arrays in data"""
        nested = {}
        
        if not data:
            return nested
        
        sample = data[0] if len(data) > 0 else {}
        
        for col in columns:
            value = sample.get(col)
            if isinstance(value, dict):
                nested[col] = {
                    'type': 'object',
                    'keys': list(value.keys()) if value else []
                }
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                nested[col] = {
                    'type': 'array',
                    'keys': list(value[0].keys()) if value else []
                }
        
        return nested
    
    @staticmethod
    def _create_hierarchical_classes(
        nested_structures: Dict[str, Any],
        data_types: Dict[str, str]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Create hierarchical classes from nested structures"""
        classes = []
        relationships = []
        
        # Create root class
        root_class_id = str(uuid.uuid4())
        root_attributes = [
            col for col in data_types.keys() 
            if col not in nested_structures
        ]
        
        root_class = {
            'id': root_class_id,
            'name': 'RootEntity',
            'attributes': root_attributes,
            'parent_id': None,
            'level': 0,
            'children': [],
            'metadata': {}
        }
        classes.append(root_class)
        
        # Create child classes from nested structures
        for nest_col, nest_info in nested_structures.items():
            child_class_id = str(uuid.uuid4())
            child_class = {
                'id': child_class_id,
                'name': SchemaInferenceService._to_class_name(nest_col),
                'attributes': nest_info['keys'],
                'parent_id': root_class_id,
                'level': 1,
                'children': [],
                'metadata': {'nested_type': nest_info['type']}
            }
            classes.append(child_class)
            
            # Create relationship
            relationship = {
                'id': str(uuid.uuid4()),
                'name': f'has_{nest_col}',
                'source_class_id': root_class_id,
                'target_class_id': child_class_id,
                'cardinality': (
                    Cardinality.ONE_TO_MANY 
                    if nest_info['type'] == 'array' 
                    else Cardinality.ONE_TO_ONE
                ),
                'metadata': {}
            }
            relationships.append(relationship)
        
        return classes, relationships
    
    @staticmethod
    def _create_flat_schema(
        columns: List[str],
        data_types: Dict[str, str],
        data: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Create flat schema by grouping related columns"""
        classes = []
        relationships = []
        
        # Detect potential entity groups by column name patterns
        groups = SchemaInferenceService._group_columns_by_pattern(columns)
        
        if len(groups) > 1:
            # Multiple groups detected - create classes for each
            for group_name, group_cols in groups.items():
                class_id = str(uuid.uuid4())
                classes.append({
                    'id': class_id,
                    'name': group_name,
                    'attributes': group_cols,
                    'parent_id': None,
                    'level': 0,
                    'children': [],
                    'metadata': {}
                })
            
            # Detect foreign key relationships
            relationships = SchemaInferenceService._detect_foreign_keys(
                classes, columns, data
            )
        else:
            # Single entity - create one class
            class_id = str(uuid.uuid4())
            classes.append({
                'id': class_id,
                'name': 'MainEntity',
                'attributes': columns,
                'parent_id': None,
                'level': 0,
                'children': [],
                'metadata': {}
            })
        
        return classes, relationships
    
    @staticmethod
    def _group_columns_by_pattern(columns: List[str]) -> Dict[str, List[str]]:
        """Group columns by naming patterns (e.g., user_*, order_*, etc.)"""
        groups = {'main': []}
        
        for col in columns:
            # Check for underscore prefix pattern
            if '_' in col:
                prefix = col.split('_')[0]
                # If prefix appears multiple times, it's likely a group
                prefix_count = sum(1 for c in columns if c.startswith(prefix + '_'))
                if prefix_count >= 2:
                    group_name = SchemaInferenceService._to_class_name(prefix)
                    if group_name not in groups:
                        groups[group_name] = []
                    groups[group_name].append(col)
                    continue
            
            groups['main'].append(col)
        
        # Clean up empty groups
        groups = {k: v for k, v in groups.items() if v}
        
        # If we only ended up with 'main', return simplified structure
        if len(groups) == 1 and 'main' in groups:
            return {'MainEntity': groups['main']}
        
        return groups
    
    @staticmethod
    def _detect_foreign_keys(
        classes: List[Dict[str, Any]],
        columns: List[str],
        data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Detect potential foreign key relationships"""
        relationships = []
        
        # Look for columns ending with _id, _key, _ref
        fk_patterns = ['_id', '_key', '_ref', 'id_']
        
        for col in columns:
            col_lower = col.lower()
            if any(pattern in col_lower for pattern in fk_patterns):
                # Try to match to a class
                for source_class in classes:
                    for target_class in classes:
                        if source_class['id'] == target_class['id']:
                            continue
                        
                        # Check if column name references target class
                        target_name_lower = target_class['name'].lower()
                        if target_name_lower in col_lower:
                            relationships.append({
                                'id': str(uuid.uuid4()),
                                'name': f'references_{target_class["name"]}',
                                'source_class_id': source_class['id'],
                                'target_class_id': target_class['id'],
                                'cardinality': Cardinality.MANY_TO_ONE,
                                'metadata': {'inferred_from': col}
                            })
        
        return relationships
    
    @staticmethod
    def _generate_schema_name(filename: str) -> str:
        """Generate a clean schema name from filename"""
        # Remove extension
        name = filename.rsplit('.', 1)[0]
        # Convert to title case and clean up
        name = re.sub(r'[_-]', ' ', name)
        name = ' '.join(word.capitalize() for word in name.split())
        return f"{name} Schema"
    
    @staticmethod
    def _to_class_name(text: str) -> str:
        """Convert text to a proper class name"""
        # Remove special characters and convert to title case
        text = re.sub(r'[^a-zA-Z0-9]', ' ', text)
        return ''.join(word.capitalize() for word in text.split())
    
    @staticmethod
    def _calculate_confidence(
        data: List[Dict[str, Any]],
        classes: List[Dict[str, Any]],
        relationships: List[Dict[str, Any]]
    ) -> float:
        """Calculate confidence score for inferred schema"""
        score = 0.5  # Base score
        
        # More data = higher confidence
        if len(data) >= 100:
            score += 0.2
        elif len(data) >= 10:
            score += 0.1
        
        # Detected relationships boost confidence
        if relationships:
            score += 0.15
        
        # Multiple classes with proper attributes
        if len(classes) > 1:
            score += 0.1
        
        # All classes have attributes
        if all(len(cls['attributes']) > 0 for cls in classes):
            score += 0.05
        
        return min(1.0, score)