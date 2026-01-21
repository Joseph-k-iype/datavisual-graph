# backend/app/services/schema_service.py - FIXED VERSION
from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    SchemaDefinition, SchemaClass, SchemaRelationship,
    SchemaCreateRequest, LineageNode, LineageEdge,
    LineageGraphResponse, LineagePathResponse, SchemaStats,
    DataInstance, DataRelationship
)
from ..utils.graph_layout import GraphLayoutEngine
import logging
import json
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)


class SchemaService:
    """Service for schema operations with auto-layout"""
    
    @staticmethod
    def create_schema(request: SchemaCreateRequest) -> SchemaDefinition:
        """Create a new schema with classes and relationships"""
        try:
            schema_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            # Create Schema node
            schema_query = """
            CREATE (s:Schema {
                id: $id,
                name: $name,
                description: $description,
                version: $version,
                created_at: $created_at,
                updated_at: $updated_at
            })
            RETURN s
            """
            
            db.execute_query(schema_query, {
                'id': schema_id,
                'name': request.name,
                'description': request.description or '',
                'version': '1.0',
                'created_at': timestamp,
                'updated_at': timestamp
            })
            
            logger.info(f"✅ Created schema: {schema_id} ({request.name})")
            
            # Create classes
            for cls in request.classes:
                # FIXED: Use getattr to safely access metadata
                cls_metadata = getattr(cls, 'metadata', None) or {}
                
                # Determine level from metadata
                level = cls_metadata.get('level', 0)
                parent_id = cls_metadata.get('parent_id', None)
                
                class_query = """
                MATCH (s:Schema {id: $schema_id})
                CREATE (c:SchemaClass {
                    id: $class_id,
                    name: $class_name,
                    attributes: $attributes,
                    schema_id: $schema_id,
                    level: $level,
                    parent_id: $parent_id,
                    metadata: $metadata
                })
                CREATE (s)-[:HAS_CLASS]->(c)
                RETURN c
                """
                
                db.execute_query(class_query, {
                    'schema_id': schema_id,
                    'class_id': cls.id,
                    'class_name': cls.name,
                    'attributes': json.dumps(cls.attributes),
                    'level': level,
                    'parent_id': parent_id or '',
                    'metadata': json.dumps(cls_metadata)
                })
                
                logger.info(f"  ✅ Created class: {cls.name} (level {level})")
            
            # Create relationships
            for rel in request.relationships:
                # FIXED: Use getattr to safely access metadata
                rel_metadata = getattr(rel, 'metadata', None) or {}
                
                rel_query = """
                MATCH (source:SchemaClass {id: $source_id})
                MATCH (target:SchemaClass {id: $target_id})
                CREATE (source)-[r:SCHEMA_REL {
                    id: $rel_id,
                    name: $rel_name,
                    source_class_id: $source_id,
                    target_class_id: $target_id,
                    cardinality: $cardinality,
                    metadata: $metadata
                }]->(target)
                RETURN r
                """
                
                db.execute_query(rel_query, {
                    'rel_id': rel.id,
                    'rel_name': rel.name,
                    'source_id': rel.source_class_id,
                    'target_id': rel.target_class_id,
                    'cardinality': rel.cardinality,
                    'metadata': json.dumps(rel_metadata)
                })
                
                logger.info(f"  ✅ Created relationship: {rel.name}")
            
            # Return full schema
            return SchemaService.get_schema(schema_id)
            
        except Exception as e:
            logger.error(f"❌ Failed to create schema: {str(e)}")
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas - NO LIMIT"""
        try:
            query = """
            MATCH (s:Schema)
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            OPTIONAL MATCH (c)-[r:SCHEMA_REL]->(:SchemaClass)
            WHERE r.source_class_id IS NOT NULL
            RETURN s.id as id,
                   s.name as name,
                   s.description as description,
                   s.created_at as created_at,
                   count(DISTINCT c) as class_count,
                   count(DISTINCT i) as instance_count,
                   count(DISTINCT r) as relationship_count
            ORDER BY s.created_at DESC
            """
            
            result = db.execute_query(query)
            
            schemas = []
            if result.result_set:
                for row in result.result_set:
                    schemas.append({
                        'id': row[0],
                        'name': row[1],
                        'description': row[2] or '',
                        'class_count': row[4],
                        'instance_count': row[5],
                        'relationship_count': row[6]
                    })
            
            logger.info(f"📋 Found {len(schemas)} schemas")
            return schemas
            
        except Exception as e:
            logger.error(f"❌ Failed to list schemas: {str(e)}")
            raise
    
    @staticmethod
    def get_schema(schema_id: str) -> SchemaDefinition:
        """Get schema definition by ID"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE r.source_class_id IS NOT NULL
            RETURN s, 
                   collect(DISTINCT c) as classes, 
                   collect(DISTINCT {
                       id: r.id,
                       source_class_id: r.source_class_id,
                       target_class_id: r.target_class_id,
                       name: r.name,
                       cardinality: r.cardinality
                   }) as relationships
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if not result.result_set:
                raise ValueError(f"Schema {schema_id} not found")
            
            row = result.result_set[0]
            schema_props = dict(row[0].properties)
            classes_nodes = row[1]
            rel_data = row[2]
            
            classes = []
            for cls_node in classes_nodes:
                if cls_node:
                    cls_props = dict(cls_node.properties)
                    attributes = cls_props.get('attributes', [])
                    if isinstance(attributes, str):
                        try:
                            attributes = json.loads(attributes)
                        except:
                            attributes = []
                    
                    metadata = cls_props.get('metadata', {})
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    classes.append(SchemaClass(
                        id=cls_props['id'],
                        name=cls_props['name'],
                        attributes=attributes,
                        metadata=metadata
                    ))
            
            relationships = []
            for rel in rel_data:
                if rel and rel.get('id'):
                    relationships.append(SchemaRelationship(
                        id=rel['id'],
                        name=rel.get('name', ''),
                        source_class_id=rel['source_class_id'],
                        target_class_id=rel['target_class_id'],
                        cardinality=rel.get('cardinality', '1:N')
                    ))
            
            return SchemaDefinition(
                id=schema_props['id'],
                name=schema_props['name'],
                description=schema_props.get('description', ''),
                version=schema_props.get('version', '1.0'),
                classes=classes,
                relationships=relationships,
                created_at=schema_props.get('created_at'),
                updated_at=schema_props.get('updated_at')
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema: {str(e)}")
            raise
    
    @staticmethod
    def delete_schema(schema_id: str) -> bool:
        """Delete schema and all associated data"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            OPTIONAL MATCH (i)-[dr:DATA_REL]-()
            OPTIONAL MATCH (c)-[sr:SCHEMA_REL]-()
            DETACH DELETE s, c, i, dr, sr
            """
            
            db.execute_query(query, {'schema_id': schema_id})
            logger.info(f"✅ Deleted schema: {schema_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete schema: {str(e)}")
            raise
    
    @staticmethod
    def create_data_instance(instance: DataInstance) -> DataInstance:
        """Create a data instance"""
        try:
            query = """
            MATCH (c:SchemaClass {id: $class_id})
            CREATE (i:DataInstance {
                id: $id,
                class_id: $class_id,
                class_name: $class_name,
                data: $data,
                source_file: $source_file,
                source_row: $source_row,
                metadata: $metadata
            })
            CREATE (i)-[:INSTANCE_OF]->(c)
            RETURN i
            """
            
            # FIXED: Use getattr to safely access metadata
            instance_metadata = getattr(instance, 'metadata', None) or {}
            
            db.execute_query(query, {
                'id': instance.id,
                'class_id': instance.class_id,
                'class_name': instance.class_name,
                'data': json.dumps(instance.data),
                'source_file': instance.source_file or '',
                'source_row': instance.source_row or 0,
                'metadata': json.dumps(instance_metadata)
            })
            
            return instance
            
        except Exception as e:
            logger.error(f"❌ Failed to create data instance: {str(e)}")
            raise
    
    @staticmethod
    def create_data_relationship(relationship: DataRelationship) -> DataRelationship:
        """Create a data relationship"""
        try:
            query = """
            MATCH (source:DataInstance {id: $source_instance_id})
            MATCH (target:DataInstance {id: $target_instance_id})
            CREATE (source)-[r:DATA_REL {
                id: $id,
                schema_relationship_id: $schema_relationship_id,
                source_instance_id: $source_instance_id,
                target_instance_id: $target_instance_id
            }]->(target)
            RETURN r
            """
            
            db.execute_query(query, {
                'id': relationship.id,
                'schema_relationship_id': relationship.schema_relationship_id,
                'source_instance_id': relationship.source_instance_id,
                'target_instance_id': relationship.target_instance_id
            })
            
            return relationship
            
        except Exception as e:
            logger.error(f"❌ Failed to create data relationship: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_graph(schema_id: str, expanded_classes: List[str] = None) -> LineageGraphResponse:
        """
        Get hierarchical lineage graph with AUTO-LAYOUT
        """
        try:
            expanded_classes = expanded_classes or []
            
            logger.info(f"📊 Getting lineage graph for schema: {schema_id}")
            
            # Get ALL schema classes
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c.id as id,
                   c.name as name,
                   c.attributes as attributes,
                   c.level as level,
                   c.parent_id as parent_id,
                   c.metadata as metadata
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            # Build node_data as plain dictionaries (NOT Pydantic models)
            node_data = []
            
            if classes_result.result_set:
                for row in classes_result.result_set:
                    class_id = row[0]
                    class_name = row[1]
                    attributes = row[2]
                    level = row[3] if row[3] is not None else 0
                    parent_id = row[4]
                    metadata = row[5]
                    
                    # Parse JSON strings
                    if isinstance(attributes, str):
                        try:
                            attributes = json.loads(attributes)
                        except:
                            attributes = []
                    
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    # Create plain dict for layout calculation
                    node_data.append({
                        'id': class_id,
                        'name': class_name,
                        'type': 'schema_class',
                        'attributes': attributes,
                        'level': level,
                        'parent_id': parent_id if parent_id else None,
                        'metadata': metadata
                    })
                
                logger.info(f"  Found {len(node_data)} classes")
            
            # Get ALL schema relationships
            rels_query = """
            MATCH (source:SchemaClass)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE source.schema_id = $schema_id
            RETURN r.id as id,
                   r.source_class_id as source_class_id,
                   r.target_class_id as target_class_id,
                   r.name as name,
                   r.cardinality as cardinality
            """
            
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            
            # Build edge_data as plain dictionaries (NOT Pydantic models)
            edge_data = []
            if rels_result.result_set:
                for row in rels_result.result_set:
                    edge_data.append({
                        'id': row[0],
                        'source': row[1],  # source_class_id
                        'target': row[2],  # target_class_id
                        'name': row[3],
                        'cardinality': row[4]
                    })
                logger.info(f"  Found {len(edge_data)} relationships")
            
            # Calculate tree layout positions on plain dicts
            nodes_with_positions = GraphLayoutEngine.calculate_tree_layout(node_data, edge_data)
            
            # NOW convert to Pydantic LineageNode objects
            nodes = []
            for node in nodes_with_positions:
                nodes.append(LineageNode(
                    id=node['id'],
                    type='schema_class',
                    name=node['name'],
                    schema_id=schema_id,
                    class_id=node['id'],
                    parent_id=node.get('parent_id'),
                    data={
                        'attributes': node.get('attributes', []),
                        'level': node.get('level', 0)
                    },
                    metadata=node.get('metadata', {}),
                    collapsed=node['id'] not in expanded_classes,
                    position=node.get('position', {'x': 0, 'y': 0})
                ))
            
            # Convert to Pydantic LineageEdge objects
            edges = []
            for edge in edge_data:
                edges.append(LineageEdge(
                    id=edge['id'],
                    source=edge['source'],
                    target=edge['target'],
                    type='schema_relationship',
                    label=edge.get('name', ''),
                    cardinality=edge.get('cardinality'),
                    metadata={}
                ))
            
            # Get schema name
            schema = SchemaService.get_schema(schema_id)
            
            logger.info(f"✅ Generated lineage graph: {len(nodes)} nodes, {len(edges)} edges")
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema.name,
                nodes=nodes,
                edges=edges,
                metadata={
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'generated_at': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get lineage graph: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise
    
    @staticmethod
    def find_lineage_paths(
        schema_id: str,
        start_node_id: str,
        end_node_id: Optional[str] = None,
        max_depth: int = 5
    ) -> LineagePathResponse:
        """Find all paths in lineage graph"""
        try:
            if end_node_id:
                # Find specific path
                query = """
                MATCH path = shortestPath((start)-[*..%d]-(end))
                WHERE start.id = $start_id AND end.id = $end_id
                RETURN path
                """ % max_depth
                
                result = db.execute_query(query, {
                    'start_id': start_node_id,
                    'end_id': end_node_id
                })
            else:
                # Find all paths from start node
                query = """
                MATCH path = (start)-[*..%d]-(connected)
                WHERE start.id = $start_id
                RETURN path
                """ % max_depth
                
                result = db.execute_query(query, {'start_id': start_node_id})
            
            # Process paths
            paths = []
            if result.result_set:
                for row in result.result_set:
                    path_data = row[0]
                    # Process path data here
                    paths.append(path_data)
            
            return LineagePathResponse(
                schema_id=schema_id,
                start_node_id=start_node_id,
                end_node_id=end_node_id,
                paths=paths,
                total_paths=len(paths)
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to find lineage paths: {str(e)}")
            raise
    
    @staticmethod
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            OPTIONAL MATCH (c)-[r:SCHEMA_REL]-()
            RETURN count(DISTINCT c) as class_count,
                   count(DISTINCT i) as instance_count,
                   count(DISTINCT r) as relationship_count
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if result.result_set:
                row = result.result_set[0]
                return SchemaStats(
                    schema_id=schema_id,
                    total_classes=row[0],
                    total_instances=row[1],
                    total_relationships=row[2]
                )
            
            return SchemaStats(
                schema_id=schema_id,
                total_classes=0,
                total_instances=0,
                total_relationships=0
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema stats: {str(e)}")
            raise