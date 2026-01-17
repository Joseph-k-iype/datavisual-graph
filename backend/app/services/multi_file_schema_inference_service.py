# backend/app/services/multi_file_schema_inference_service.py - NEW FILE
"""
Multi-File Schema Inference Service
Uses FalkorDB to create a temporary analysis graph for cross-file relationship detection
"""

from typing import List, Dict, Any, Tuple, Set
from ..utils.parsers import FileParser
from ..database import db
from ..models.schemas import Cardinality
import logging
import uuid
import re
from collections import defaultdict
from datetime import datetime

logger = logging.getLogger(__name__)


class MultiFileSchemaInferenceService:
    """
    Service for inferring unified schema from multiple files
    Uses FalkorDB temporary graph for cross-file analysis
    """
    
    TEMP_GRAPH_PREFIX = "temp_inference_"
    
    @staticmethod
    def infer_schema_from_multiple_files(
        files_data: List[Tuple[bytes, str, str]]  # [(content, filename, format), ...]
    ) -> Dict[str, Any]:
        """
        Infer unified schema from multiple files using FalkorDB temporary graph
        
        Args:
            files_data: List of tuples (file_content, filename, format)
            
        Returns:
            Dictionary with unified schema suggestion
        """
        try:
            # Generate unique temporary graph ID
            temp_graph_id = f"{MultiFileSchemaInferenceService.TEMP_GRAPH_PREFIX}{uuid.uuid4().hex[:8]}"
            
            logger.info(f"🔍 Starting multi-file schema inference with temp graph: {temp_graph_id}")
            logger.info(f"📁 Processing {len(files_data)} files")
            
            # Parse all files
            parsed_files = []
            for file_content, filename, file_format in files_data:
                try:
                    data, columns = FileParser.parse_file(file_content, filename, file_format)
                    data_types = FileParser.infer_data_types(data, columns)
                    
                    parsed_files.append({
                        'filename': filename,
                        'format': file_format,
                        'data': data,
                        'columns': columns,
                        'data_types': data_types,
                        'row_count': len(data)
                    })
                    logger.info(f"  ✅ Parsed {filename}: {len(data)} rows, {len(columns)} columns")
                except Exception as e:
                    logger.warning(f"  ⚠️ Failed to parse {filename}: {str(e)}")
                    continue
            
            if not parsed_files:
                raise ValueError("No files could be parsed successfully")
            
            # Create temporary analysis graph in FalkorDB
            MultiFileSchemaInferenceService._create_temp_analysis_graph(
                temp_graph_id, parsed_files
            )
            
            # Analyze relationships across files using the graph
            relationships = MultiFileSchemaInferenceService._analyze_cross_file_relationships(
                temp_graph_id, parsed_files
            )
            
            # Build unified schema
            unified_schema = MultiFileSchemaInferenceService._build_unified_schema(
                parsed_files, relationships
            )
            
            # Clean up temporary graph
            MultiFileSchemaInferenceService._cleanup_temp_graph(temp_graph_id)
            
            # Calculate confidence
            confidence_score = MultiFileSchemaInferenceService._calculate_multi_file_confidence(
                parsed_files, relationships
            )
            
            # Generate warnings
            warnings = []
            if confidence_score < 0.7:
                warnings.append("Low confidence - please review the inferred schema carefully")
            if len(relationships) == 0 and len(parsed_files) > 1:
                warnings.append("No relationships detected between files - consider adding them manually")
            
            logger.info(f"✅ Multi-file inference complete: {len(unified_schema['classes'])} classes, "
                       f"{len(unified_schema['relationships'])} relationships")
            
            return {
                'suggested_name': MultiFileSchemaInferenceService._generate_multi_file_schema_name(
                    [pf['filename'] for pf in parsed_files]
                ),
                'description': f'Unified schema inferred from {len(parsed_files)} files: ' + 
                              ', '.join([pf['filename'] for pf in parsed_files]),
                'classes': unified_schema['classes'],
                'relationships': unified_schema['relationships'],
                'confidence_score': confidence_score,
                'warnings': warnings,
                'metadata': {
                    'source_files': [pf['filename'] for pf in parsed_files],
                    'total_rows': sum(pf['row_count'] for pf in parsed_files),
                    'inference_timestamp': datetime.utcnow().isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"❌ Failed multi-file schema inference: {str(e)}")
            raise
    
    @staticmethod
    def _create_temp_analysis_graph(temp_graph_id: str, parsed_files: List[Dict[str, Any]]) -> None:
        """
        Create temporary graph in FalkorDB for analysis
        
        Graph structure:
        - FileNode for each file
        - TableNode for each detected entity/table
        - ColumnNode for each column
        - Relationships: FILE_CONTAINS, HAS_COLUMN
        """
        try:
            logger.info(f"📊 Creating temporary analysis graph: {temp_graph_id}")
            
            for file_idx, parsed_file in enumerate(parsed_files):
                filename = parsed_file['filename']
                columns = parsed_file['columns']
                data_types = parsed_file['data_types']
                
                # Create file node
                file_node_id = f"file_{file_idx}"
                file_query = f"""
                CREATE (f:TempFile {{
                    id: '{file_node_id}',
                    filename: '{filename}',
                    row_count: {parsed_file['row_count']},
                    column_count: {len(columns)},
                    temp_graph: '{temp_graph_id}'
                }})
                """
                db.execute_query(file_query)
                
                # Infer table/entity name from filename
                table_name = MultiFileSchemaInferenceService._extract_entity_name(filename)
                table_node_id = f"table_{file_idx}_{table_name}"
                
                # Create table node
                table_query = f"""
                MATCH (f:TempFile {{id: '{file_node_id}'}})
                CREATE (t:TempTable {{
                    id: '{table_node_id}',
                    name: '{table_name}',
                    source_file: '{filename}',
                    temp_graph: '{temp_graph_id}'
                }})
                CREATE (f)-[:FILE_CONTAINS]->(t)
                """
                db.execute_query(table_query)
                
                # Create column nodes
                for col_idx, column in enumerate(columns):
                    col_node_id = f"col_{file_idx}_{col_idx}"
                    data_type = data_types.get(column, 'string')
                    
                    # Detect if column might be a key
                    is_potential_pk = MultiFileSchemaInferenceService._is_potential_primary_key(
                        column, parsed_file['data']
                    )
                    is_potential_fk = MultiFileSchemaInferenceService._is_potential_foreign_key(column)
                    
                    col_query = f"""
                    MATCH (t:TempTable {{id: '{table_node_id}'}})
                    CREATE (c:TempColumn {{
                        id: '{col_node_id}',
                        name: '{column}',
                        data_type: '{data_type}',
                        is_potential_pk: {str(is_potential_pk).lower()},
                        is_potential_fk: {str(is_potential_fk).lower()},
                        temp_graph: '{temp_graph_id}'
                    }})
                    CREATE (t)-[:HAS_COLUMN]->(c)
                    """
                    db.execute_query(col_query)
                
                logger.info(f"  ✅ Created analysis nodes for {filename}")
            
        except Exception as e:
            logger.error(f"❌ Failed to create temp graph: {str(e)}")
            # Clean up on failure
            MultiFileSchemaInferenceService._cleanup_temp_graph(temp_graph_id)
            raise
    
    @staticmethod
    def _analyze_cross_file_relationships(
        temp_graph_id: str, 
        parsed_files: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Analyze relationships across files using the temporary graph
        
        Detection strategies:
        1. Foreign key patterns (column names ending with _id, _key that match other table names)
        2. Common columns across tables
        3. Value overlap analysis
        """
        relationships = []
        
        try:
            # Strategy 1: Foreign key pattern matching
            fk_query = f"""
            MATCH (t1:TempTable {{temp_graph: '{temp_graph_id}'}})-[:HAS_COLUMN]->(c1:TempColumn)
            MATCH (t2:TempTable {{temp_graph: '{temp_graph_id}'}})-[:HAS_COLUMN]->(c2:TempColumn)
            WHERE t1.id <> t2.id
              AND c1.is_potential_fk = true
              AND c2.is_potential_pk = true
              AND (toLower(c1.name) CONTAINS toLower(t2.name) OR 
                   toLower(c1.name) CONTAINS toLower(c2.name))
            RETURN t1.id as source_table, 
                   t1.name as source_name,
                   t2.id as target_table,
                   t2.name as target_name,
                   c1.name as fk_column,
                   c2.name as pk_column
            """
            
            result = db.execute_query(fk_query)
            
            if result.result_set:
                for row in result.result_set:
                    relationships.append({
                        'source_table_id': row[0],
                        'source_table_name': row[1],
                        'target_table_id': row[2],
                        'target_table_name': row[3],
                        'fk_column': row[4],
                        'pk_column': row[5],
                        'type': 'foreign_key',
                        'confidence': 0.8
                    })
                    logger.info(f"  🔗 Detected FK relationship: {row[1]}.{row[4]} -> {row[3]}.{row[5]}")
            
            # Strategy 2: Common columns (potential join keys)
            common_col_query = f"""
            MATCH (t1:TempTable {{temp_graph: '{temp_graph_id}'}})-[:HAS_COLUMN]->(c1:TempColumn)
            MATCH (t2:TempTable {{temp_graph: '{temp_graph_id}'}})-[:HAS_COLUMN]->(c2:TempColumn)
            WHERE t1.id <> t2.id
              AND c1.name = c2.name
              AND c1.data_type = c2.data_type
            RETURN DISTINCT t1.id as source_table,
                            t1.name as source_name,
                            t2.id as target_table,
                            t2.name as target_name,
                            c1.name as common_column
            """
            
            result = db.execute_query(common_col_query)
            
            if result.result_set:
                for row in result.result_set:
                    # Check if relationship already exists
                    exists = any(
                        r['source_table_id'] == row[0] and 
                        r['target_table_id'] == row[2]
                        for r in relationships
                    )
                    
                    if not exists:
                        relationships.append({
                            'source_table_id': row[0],
                            'source_table_name': row[1],
                            'target_table_id': row[2],
                            'target_table_name': row[3],
                            'fk_column': row[4],
                            'pk_column': row[4],
                            'type': 'common_column',
                            'confidence': 0.6
                        })
                        logger.info(f"  🔗 Detected common column: {row[1]} <-> {row[3]} on {row[4]}")
            
        except Exception as e:
            logger.error(f"⚠️ Error analyzing relationships: {str(e)}")
        
        return relationships
    
    @staticmethod
    def _build_unified_schema(
        parsed_files: List[Dict[str, Any]], 
        relationships: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Build unified schema from parsed files and detected relationships"""
        
        classes = []
        schema_relationships = []
        
        # Create a class for each file/table
        for file_idx, parsed_file in enumerate(parsed_files):
            class_id = str(uuid.uuid4())
            class_name = MultiFileSchemaInferenceService._extract_entity_name(
                parsed_file['filename']
            )
            
            classes.append({
                'id': class_id,
                'name': class_name,
                'attributes': parsed_file['columns'],
                'parent_id': None,
                'level': 0,
                'children': [],
                'metadata': {
                    'source_file': parsed_file['filename'],
                    'row_count': parsed_file['row_count'],
                    'data_types': parsed_file['data_types']
                }
            })
        
        # Create schema relationships from detected relationships
        class_name_to_id = {cls['name']: cls['id'] for cls in classes}
        
        for rel in relationships:
            source_name = rel['source_table_name']
            target_name = rel['target_table_name']
            
            source_id = class_name_to_id.get(source_name)
            target_id = class_name_to_id.get(target_name)
            
            if source_id and target_id:
                # Determine cardinality based on relationship type
                cardinality = Cardinality.MANY_TO_ONE if rel['type'] == 'foreign_key' else Cardinality.ONE_TO_MANY
                
                schema_relationships.append({
                    'id': str(uuid.uuid4()),
                    'name': f"{source_name}_to_{target_name}",
                    'source_class_id': source_id,
                    'target_class_id': target_id,
                    'cardinality': cardinality,
                    'metadata': {
                        'detected_via': rel['type'],
                        'confidence': rel['confidence'],
                        'join_column': rel['fk_column']
                    }
                })
        
        return {
            'classes': classes,
            'relationships': schema_relationships
        }
    
    @staticmethod
    def _cleanup_temp_graph(temp_graph_id: str) -> None:
        """Clean up temporary analysis graph"""
        try:
            cleanup_query = f"""
            MATCH (n {{temp_graph: '{temp_graph_id}'}})
            DETACH DELETE n
            """
            db.execute_query(cleanup_query)
            logger.info(f"🧹 Cleaned up temporary graph: {temp_graph_id}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to cleanup temp graph {temp_graph_id}: {str(e)}")
    
    @staticmethod
    def _extract_entity_name(filename: str) -> str:
        """Extract entity/table name from filename"""
        # Remove extension
        name = filename.rsplit('.', 1)[0]
        # Remove common prefixes/suffixes
        name = re.sub(r'^(tbl_|table_|data_|export_)', '', name, flags=re.IGNORECASE)
        name = re.sub(r'(_data|_export|_dump)$', '', name, flags=re.IGNORECASE)
        # Convert to title case
        name = re.sub(r'[_-]', ' ', name)
        return ''.join(word.capitalize() for word in name.split())
    
    @staticmethod
    def _is_potential_primary_key(column_name: str, data: List[Dict[str, Any]]) -> bool:
        """Check if column is likely a primary key"""
        col_lower = column_name.lower()
        
        # Name-based detection
        if col_lower in ['id', 'pk', 'key'] or col_lower.endswith('_id') or col_lower.endswith('_key'):
            # Check uniqueness
            if data:
                values = [row.get(column_name) for row in data if row.get(column_name) is not None]
                if len(values) == len(set(values)):  # All unique
                    return True
        
        return False
    
    @staticmethod
    def _is_potential_foreign_key(column_name: str) -> bool:
        """Check if column name suggests it's a foreign key"""
        col_lower = column_name.lower()
        fk_patterns = ['_id', '_key', '_fk', '_ref', 'id_']
        return any(pattern in col_lower for pattern in fk_patterns)
    
    @staticmethod
    def _calculate_multi_file_confidence(
        parsed_files: List[Dict[str, Any]], 
        relationships: List[Dict[str, Any]]
    ) -> float:
        """Calculate confidence score for multi-file inference"""
        score = 0.5  # Base score
        
        # Multiple files boost confidence
        if len(parsed_files) >= 3:
            score += 0.15
        elif len(parsed_files) >= 2:
            score += 0.1
        
        # Relationships detected
        if relationships:
            score += 0.2
            # High-confidence relationships
            high_conf_rels = sum(1 for r in relationships if r['confidence'] > 0.7)
            if high_conf_rels > 0:
                score += 0.1
        
        # Good data volume
        total_rows = sum(pf['row_count'] for pf in parsed_files)
        if total_rows >= 100:
            score += 0.05
        
        return min(1.0, score)
    
    @staticmethod
    def _generate_multi_file_schema_name(filenames: List[str]) -> str:
        """Generate schema name from multiple filenames"""
        if len(filenames) == 1:
            return MultiFileSchemaInferenceService._extract_entity_name(filenames[0]) + " Schema"
        
        # Try to find common prefix
        common_prefix = filenames[0]
        for filename in filenames[1:]:
            while not filename.startswith(common_prefix) and common_prefix:
                common_prefix = common_prefix[:-1]
        
        if common_prefix and len(common_prefix) > 3:
            name = re.sub(r'[_-]', ' ', common_prefix).strip()
            return f"{name.title()} Schema"
        
        # Use generic name
        return f"Unified Schema ({len(filenames)} files)"