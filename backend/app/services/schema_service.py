# backend/app/services/schema_service.py - FIXED VERSION WITH SUBCLASS_OF RELATIONSHIPS
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
    """Service for schema operations with auto-layout and hierarchy support"""
    
    @staticmethod
    def create_schema(request: SchemaCreateRequest) -> SchemaDefinition:
        """
        Create a new schema with classes and relationships
        NOW CREATES SUBCLASS_OF RELATIONSHIPS for hierarchical classes
        """
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
            
            # Create classes WITH HIERARCHY SUPPORT
            for cls in request.classes:
                # FIXED: Use getattr to safely access metadata
                cls_metadata = getattr(cls, 'metadata', None) or {}
                
                # Determine level and parent from metadata
                level = cls_metadata.get('level', 0)
                parent_id = cls_metadata.get('parent_id', None)
                
                # Create the class node first
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
                
                # CREATE SUBCLASS_OF RELATIONSHIP if parent exists
                if parent_id:
                    subclass_rel_query = """
                    MATCH (child:SchemaClass {id: $child_id})
                    MATCH (parent:SchemaClass {id: $parent_id})
                    CREATE (child)-[:SUBCLASS_OF]->(parent)
                    RETURN child.name as child_name, parent.name as parent_name
                    """
                    
                    try:
                        result = db.execute_query(subclass_rel_query, {
                            'child_id': cls.id,
                            'parent_id': parent_id
                        })
                        if result.result_set:
                            child_name = result.result_set[0][0]
                            parent_name = result.result_set[0][1]
                            logger.info(f"  ✅ Created SUBCLASS_OF: {child_name} -> {parent_name}")
                        else:
                            logger.warning(f"  ⚠️ SUBCLASS_OF relationship created but no result returned")
                    except Exception as e:
                        logger.error(f"  ❌ Failed to create SUBCLASS_OF relationship: {e}")
                        logger.error(f"     Child ID: {cls.id}, Parent ID: {parent_id}")
                
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
            RETURN s.id as id,
                   s.name as name,
                   s.description as description,
                   s.version as version,
                   s.created_at as created_at,
                   s.updated_at as updated_at,
                   count(DISTINCT c) as class_count
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
                        'version': row[3] or '1.0',
                        'created_at': row[4] or '',
                        'updated_at': row[5] or '',
                        'class_count': row[6]
                    })
            
            logger.info(f"✅ Retrieved {len(schemas)} schemas")
            return schemas
            
        except Exception as e:
            logger.error(f"❌ Failed to list schemas: {str(e)}")
            raise
    
    @staticmethod
    def get_schema(schema_id: str) -> SchemaDefinition:
        """Get schema by ID with all classes and relationships"""
        try:
            # Get schema details
            schema_query = """
            MATCH (s:Schema {id: $schema_id})
            RETURN s.id as id,
                   s.name as name,
                   s.description as description,
                   s.version as version,
                   s.created_at as created_at,
                   s.updated_at as updated_at
            """
            
            schema_result = db.execute_query(schema_query, {'schema_id': schema_id})
            
            if not schema_result.result_set:
                raise ValueError(f"Schema not found: {schema_id}")
            
            schema_row = schema_result.result_set[0]
            
            # Get classes
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c.id as id,
                   c.name as name,
                   c.attributes as attributes,
                   c.level as level,
                   c.parent_id as parent_id,
                   c.metadata as metadata
            ORDER BY c.level ASC, c.name ASC
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            classes = []
            if classes_result.result_set:
                for row in classes_result.result_set:
                    attributes = row[2]
                    if isinstance(attributes, str):
                        try:
                            attributes = json.loads(attributes)
                        except:
                            attributes = []
                    
                    metadata = row[5]
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    classes.append(SchemaClass(
                        id=row[0],
                        name=row[1],
                        attributes=attributes,
                        metadata=metadata
                    ))
            
            # Get relationships
            rels_query = """
            MATCH (source:SchemaClass)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE source.schema_id = $schema_id
            RETURN r.id as id,
                   r.name as name,
                   source.id as source_id,
                   target.id as target_id,
                   r.cardinality as cardinality,
                   r.metadata as metadata
            """
            
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            
            relationships = []
            if rels_result.result_set:
                for row in rels_result.result_set:
                    metadata = row[5]
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    relationships.append(SchemaRelationship(
                        id=row[0],
                        name=row[1],
                        source_class_id=row[2],
                        target_class_id=row[3],
                        cardinality=row[4],
                        metadata=metadata
                    ))
            
            return SchemaDefinition(
                id=schema_row[0],
                name=schema_row[1],
                description=schema_row[2] or '',
                version=schema_row[3] or '1.0',
                classes=classes,
                relationships=relationships,
                created_at=schema_row[4] or '',
                updated_at=schema_row[5] or ''
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema: {str(e)}")
            raise
    
    @staticmethod
    def delete_schema(schema_id: str) -> bool:
        """Delete schema and all related data"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            OPTIONAL MATCH (i)-[dr:DATA_REL]-()
            OPTIONAL MATCH (c)-[sr:SCHEMA_REL]-()
            OPTIONAL MATCH (c)-[sub:SUBCLASS_OF]-()
            DETACH DELETE s, c, i, dr, sr, sub
            """
            
            db.execute_query(query, {'schema_id': schema_id})
            logger.info(f"✅ Deleted schema: {schema_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete schema: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_graph(schema_id: str, expanded_classes: List[str] = None) -> LineageGraphResponse:
        """
        Get hierarchical lineage graph with AUTO-LAYOUT
        NOW INCLUDES SUBCLASS_OF RELATIONSHIPS
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
                    
                    node_data.append({
                        'id': class_id,
                        'type': 'schema_class',  # FIXED: Must be 'schema_class' not 'class'
                        'name': class_name,
                        'schema_id': schema_id,
                        'class_id': class_id,
                        'parent_id': parent_id,
                        'data': {
                            'attributes': attributes,
                            'level': level
                        },
                        'metadata': metadata,
                        'collapsed': class_id not in expanded_classes
                    })
            
            # Get ALL relationships INCLUDING SUBCLASS_OF
            edges_data = []
            
            # Get schema relationships
            schema_rels_query = """
            MATCH (source:SchemaClass)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE source.schema_id = $schema_id
            RETURN r.id as id,
                   source.id as source_id,
                   target.id as target_id,
                   r.name as name,
                   r.cardinality as cardinality,
                   r.metadata as metadata
            """
            
            rels_result = db.execute_query(schema_rels_query, {'schema_id': schema_id})
            
            if rels_result.result_set:
                for row in rels_result.result_set:
                    metadata = row[5]
                    if isinstance(metadata, str):
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    edges_data.append({
                        'id': row[0],
                        'source': row[1],
                        'target': row[2],
                        'type': 'schema_relationship',
                        'label': row[3],
                        'cardinality': row[4],
                        'metadata': metadata
                    })
            
            # Get SUBCLASS_OF relationships
            subclass_query = """
            MATCH (child:SchemaClass)-[:SUBCLASS_OF]->(parent:SchemaClass)
            WHERE child.schema_id = $schema_id
            RETURN child.id as child_id,
                   parent.id as parent_id,
                   child.name as child_name,
                   parent.name as parent_name
            """
            
            subclass_result = db.execute_query(subclass_query, {'schema_id': schema_id})
            
            if subclass_result.result_set:
                for row in subclass_result.result_set:
                    edge_id = f"subclass_{row[0]}_{row[1]}"
                    edges_data.append({
                        'id': edge_id,
                        'source': row[1],  # parent
                        'target': row[0],  # child
                        'type': 'parent_child',
                        'label': 'subclass_of',
                        'metadata': {
                            'relationship_type': 'hierarchy',
                            'child_name': row[2],
                            'parent_name': row[3]
                        }
                    })
            
            logger.info(f"📊 Found {len(node_data)} nodes and {len(edges_data)} edges")
            
            # Auto-layout with GraphLayoutEngine OR use default positions
            try:
                # Check if method exists
                if hasattr(GraphLayoutEngine, 'layout_hierarchical_tree'):
                    positions = GraphLayoutEngine.layout_hierarchical_tree(node_data, edges_data)
                    for node in node_data:
                        if node['id'] in positions:
                            node['position'] = positions[node['id']]
                    logger.info(f"✅ Applied auto-layout to {len(positions)} nodes")
                else:
                    logger.warning("⚠️ GraphLayoutEngine.layout_hierarchical_tree not available")
                    # Set default positions based on level
                    logger.info("📐 Using default grid layout...")
                    level_counts = {}
                    for node in node_data:
                        level = node['data'].get('level', 0)
                        if level not in level_counts:
                            level_counts[level] = 0
                        
                        # Grid layout: 300px apart horizontally, 150px apart vertically
                        x = level_counts[level] * 300
                        y = level * 150
                        
                        node['position'] = {'x': x, 'y': y}
                        level_counts[level] += 1
                    
                    logger.info(f"✅ Applied default grid layout to {len(node_data)} nodes")
            except Exception as layout_error:
                logger.error(f"❌ Layout failed: {layout_error}")
                # Fallback: simple linear layout
                logger.info("📐 Using fallback linear layout...")
                for i, node in enumerate(node_data):
                    node['position'] = {'x': i * 300, 'y': 0}
                logger.info(f"✅ Applied fallback layout to {len(node_data)} nodes")
            
            # Convert to Pydantic models ONLY at the end
            nodes = []
            for node in node_data:
                # Ensure position exists
                position = node.get('position')
                if not position or not isinstance(position, dict):
                    position = {'x': 0, 'y': 0}
                
                # Ensure position has valid numbers
                if not isinstance(position.get('x'), (int, float)) or not isinstance(position.get('y'), (int, float)):
                    position = {'x': 0, 'y': 0}
                
                nodes.append(LineageNode(
                    id=node['id'],
                    type=node['type'],
                    name=node['name'],
                    schema_id=node['schema_id'],
                    class_id=node.get('class_id'),
                    parent_id=node.get('parent_id'),
                    data=node.get('data', {}),
                    metadata=node.get('metadata', {}),
                    collapsed=node.get('collapsed', False),
                    position=position
                ))
            
            edges = []
            for edge in edges_data:
                edges.append(LineageEdge(
                    id=edge['id'],
                    source=edge['source'],
                    target=edge['target'],
                    type=edge['type'],
                    label=edge.get('label'),
                    cardinality=edge.get('cardinality'),
                    metadata=edge.get('metadata', {})
                ))
            
            schema = SchemaService.get_schema(schema_id)
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema.name,
                nodes=nodes,
                edges=edges,
                metadata={}
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get lineage graph: {str(e)}")
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
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[r:SCHEMA_REL]->()
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            OPTIONAL MATCH (i)-[dr:DATA_REL]->()
            WITH s, count(DISTINCT c) as class_count,
                 count(DISTINCT r) as rel_count,
                 count(DISTINCT i) as instance_count,
                 count(DISTINCT dr) as data_rel_count,
                 collect(DISTINCT {class_id: c.id, class_name: c.name}) as classes
            UNWIND classes as cls
            OPTIONAL MATCH (c:SchemaClass {id: cls.class_id})<-[:INSTANCE_OF]-(inst:DataInstance)
            RETURN s.name as schema_name,
                   class_count,
                   rel_count,
                   instance_count,
                   data_rel_count,
                   collect({class_name: cls.class_name, count: count(inst)}) as instances_by_class
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if result.result_set and len(result.result_set) > 0:
                row = result.result_set[0]
                instances_dict = {}
                
                if row[5]:
                    for item in row[5]:
                        if item and isinstance(item, dict):
                            class_name = item.get('class_name')
                            count = item.get('count', 0)
                            if class_name:
                                instances_dict[class_name] = count
                
                return SchemaStats(
                    schema_id=schema_id,
                    schema_name=row[0] or '',
                    total_classes=row[1] or 0,
                    total_relationships=row[2] or 0,
                    total_instances=row[3] or 0,
                    total_data_relationships=row[4] or 0,
                    instances_by_class=instances_dict
                )
            
            return SchemaStats(
                schema_id=schema_id,
                schema_name='',
                total_classes=0,
                total_relationships=0,
                total_instances=0,
                total_data_relationships=0,
                instances_by_class={}
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema stats: {str(e)}")
            raise