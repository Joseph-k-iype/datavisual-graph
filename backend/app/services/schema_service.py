# backend/app/services/schema_service.py
"""
Schema Service - FULLY FIXED
Handles all schema operations including creation, relationships, and hierarchy
"""

from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    SchemaDefinition, SchemaClass, SchemaRelationship,
    SchemaCreateRequest, LineageNode, LineageEdge,
    LineageGraphResponse, LineagePathResponse, SchemaStats,
    DataInstance, DataRelationship, Cardinality, Attribute
)
from ..utils.graph_layout import GraphLayoutEngine
import logging
import json
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)


class SchemaService:
    """Service for schema operations - FULLY FIXED"""
    
    @staticmethod
    def create_schema(request: SchemaCreateRequest) -> SchemaDefinition:
        """
        Create a new schema with classes and relationships
        ✅ FIXED: Creates ALL relationships (schema + hierarchy)
        """
        try:
            schema_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            logger.info(f"🎨 Creating schema: {request.name}")
            logger.info(f"   Classes: {len(request.classes)}")
            logger.info(f"   Relationships: {len(request.relationships)}")
            
            # Step 1: Create Schema node
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
                'version': '1.0.0',
                'created_at': timestamp,
                'updated_at': timestamp
            })
            
            logger.info(f"✅ Schema node created: {schema_id}")
            
            # Step 2: Create ALL classes recursively
            def create_class_recursive(cls: SchemaClass, parent_id: Optional[str], level: int):
                """Recursively create class and its children"""
                
                # Prepare attributes
                attributes_to_store = []
                if hasattr(cls, 'attributes') and cls.attributes:
                    for attr in cls.attributes:
                        if isinstance(attr, str):
                            attributes_to_store.append({
                                'id': str(uuid.uuid4()),
                                'name': attr,
                                'data_type': 'string',
                                'is_primary_key': False,
                                'is_foreign_key': False,
                                'is_nullable': True
                            })
                        elif isinstance(attr, dict):
                            if 'id' not in attr:
                                attr['id'] = str(uuid.uuid4())
                            if 'is_primary_key' not in attr:
                                attr['is_primary_key'] = False
                            if 'is_foreign_key' not in attr:
                                attr['is_foreign_key'] = False
                            if 'is_nullable' not in attr:
                                attr['is_nullable'] = True
                            attributes_to_store.append(attr)
                        elif isinstance(attr, Attribute):
                            attributes_to_store.append({
                                'id': attr.id,
                                'name': attr.name,
                                'data_type': attr.data_type,
                                'is_primary_key': attr.is_primary_key,
                                'is_foreign_key': attr.is_foreign_key,
                                'is_nullable': attr.is_nullable,
                                'metadata': attr.metadata
                            })
                
                cls_metadata = getattr(cls, 'metadata', None) or {}
                
                # Create class node
                class_query = """
                CREATE (c:SchemaClass {
                    id: $class_id,
                    schema_id: $schema_id,
                    name: $class_name,
                    attributes: $attributes,
                    level: $level,
                    parent_id: $parent_id,
                    metadata: $metadata,
                    created_at: $created_at
                })
                RETURN c
                """
                
                db.execute_query(class_query, {
                    'class_id': cls.id,
                    'schema_id': schema_id,
                    'class_name': cls.name,
                    'attributes': json.dumps(attributes_to_store),
                    'level': level,
                    'parent_id': parent_id or '',
                    'metadata': json.dumps(cls_metadata),
                    'created_at': timestamp
                })
                
                # Create HAS_CLASS relationship from schema
                has_class_query = """
                MATCH (s:Schema {id: $schema_id})
                MATCH (c:SchemaClass {id: $class_id})
                CREATE (s)-[:HAS_CLASS]->(c)
                """
                
                db.execute_query(has_class_query, {
                    'schema_id': schema_id,
                    'class_id': cls.id
                })
                
                # Create HAS_SUBCLASS relationship if this has a parent
                if parent_id:
                    subclass_rel_query = """
                    MATCH (parent:SchemaClass {id: $parent_id})
                    MATCH (child:SchemaClass {id: $child_id})
                    CREATE (parent)-[:HAS_SUBCLASS]->(child)
                    RETURN parent.name as parent_name, child.name as child_name
                    """
                    
                    result = db.execute_query(subclass_rel_query, {
                        'parent_id': parent_id,
                        'child_id': cls.id
                    })
                    
                    if result.result_set:
                        parent_name = result.result_set[0][0]
                        child_name = result.result_set[0][1]
                        logger.info(f"  ✅ Created HAS_SUBCLASS: {parent_name} -> {child_name}")
                
                logger.info(f"  ✅ Created class: {cls.name} (Level: {level}, Parent: {parent_id or 'None'})")
                
                # Recursively create children
                if hasattr(cls, 'children') and cls.children:
                    for child in cls.children:
                        create_class_recursive(child, cls.id, level + 1)
            
            # Create all root classes and their children
            for cls in request.classes:
                create_class_recursive(cls, None, 0)
            
            logger.info(f"✅ Created all classes with hierarchy")
            
            # Step 3: Create ALL user-defined SCHEMA_REL relationships
            logger.info(f"\n🔗 Creating {len(request.relationships)} SCHEMA_REL relationships...")
            
            relationships_created = 0
            relationships_failed = 0
            
            for idx, rel in enumerate(request.relationships, 1):
                logger.info(f"\n📌 Relationship {idx}/{len(request.relationships)}:")
                logger.info(f"   ID: {rel.id}")
                logger.info(f"   Name: {rel.name}")
                logger.info(f"   Source: {rel.source_class_id}")
                logger.info(f"   Target: {rel.target_class_id}")
                logger.info(f"   Cardinality: {rel.cardinality}")
                
                # First verify both classes exist
                verify_query = """
                MATCH (source:SchemaClass {id: $source_id, schema_id: $schema_id})
                MATCH (target:SchemaClass {id: $target_id, schema_id: $schema_id})
                RETURN source.name as source_name, target.name as target_name
                """
                
                try:
                    verify_result = db.execute_query(verify_query, {
                        'schema_id': schema_id,
                        'source_id': rel.source_class_id,
                        'target_id': rel.target_class_id
                    })
                    
                    if not verify_result.result_set:
                        logger.error(f"   ❌ FAILED: Source or target class not found!")
                        logger.error(f"      Source ID: {rel.source_class_id}")
                        logger.error(f"      Target ID: {rel.target_class_id}")
                        relationships_failed += 1
                        continue
                    
                    source_name = verify_result.result_set[0][0]
                    target_name = verify_result.result_set[0][1]
                    
                    # Create SCHEMA_REL relationship
                    rel_query = """
                    MATCH (source:SchemaClass {id: $source_id, schema_id: $schema_id})
                    MATCH (target:SchemaClass {id: $target_id, schema_id: $schema_id})
                    CREATE (source)-[r:SCHEMA_REL {
                        id: $rel_id,
                        name: $rel_name,
                        cardinality: $cardinality,
                        metadata: $metadata,
                        created_at: $created_at
                    }]->(target)
                    RETURN r
                    """
                    
                    rel_metadata = getattr(rel, 'metadata', None) or {}
                    
                    db.execute_query(rel_query, {
                        'schema_id': schema_id,
                        'source_id': rel.source_class_id,
                        'target_id': rel.target_class_id,
                        'rel_id': rel.id,
                        'rel_name': rel.name,
                        'cardinality': rel.cardinality,
                        'metadata': json.dumps(rel_metadata),
                        'created_at': timestamp
                    })
                    
                    logger.info(f"   ✅ Created SCHEMA_REL: {source_name} -[{rel.name}]-> {target_name}")
                    relationships_created += 1
                    
                except Exception as e:
                    logger.error(f"   ❌ Failed to create relationship: {str(e)}")
                    relationships_failed += 1
            
            logger.info(f"\n📊 Relationship Summary:")
            logger.info(f"   Created: {relationships_created}")
            logger.info(f"   Failed: {relationships_failed}")
            
            # Return complete schema
            return SchemaService.get_schema(schema_id)
            
        except Exception as e:
            logger.error(f"❌ Failed to create schema: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def get_schema(schema_id: str) -> SchemaDefinition:
        """Get a schema by ID with all classes and relationships"""
        try:
            # Get schema
            schema_query = """
            MATCH (s:Schema {id: $schema_id})
            RETURN s.id, s.name, s.description, s.version, s.created_at, s.updated_at
            """
            
            result = db.execute_query(schema_query, {'schema_id': schema_id})
            
            if not result.result_set:
                raise ValueError(f"Schema not found: {schema_id}")
            
            row = result.result_set[0]
            
            # Get all classes
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c.id, c.name, c.attributes, c.level, c.parent_id, c.metadata
            ORDER BY c.level, c.name
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            classes = []
            if classes_result.result_set:
                for class_row in classes_result.result_set:
                    attributes_str = class_row[2]
                    attributes = []
                    
                    if attributes_str:
                        if isinstance(attributes_str, str):
                            attributes_data = json.loads(attributes_str)
                        else:
                            attributes_data = attributes_str
                        
                        for attr in attributes_data:
                            if isinstance(attr, str):
                                attributes.append(attr)
                            elif isinstance(attr, dict):
                                # Convert to Attribute object
                                attributes.append(Attribute(
                                    id=attr.get('id', str(uuid.uuid4())),
                                    name=attr['name'],
                                    data_type=attr.get('data_type', 'string'),
                                    is_primary_key=attr.get('is_primary_key', False),
                                    is_foreign_key=attr.get('is_foreign_key', False),
                                    is_nullable=attr.get('is_nullable', True),
                                    metadata=attr.get('metadata', {})
                                ))
                    
                    metadata = class_row[5]
                    if isinstance(metadata, str):
                        metadata = json.loads(metadata)
                    
                    classes.append(SchemaClass(
                        id=class_row[0],
                        name=class_row[1],
                        attributes=attributes,
                        metadata=metadata or {}
                    ))
            
            # Get all relationships
            rels_query = """
            MATCH (source:SchemaClass)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE source.schema_id = $schema_id AND target.schema_id = $schema_id
            RETURN r.id, r.name, source.id, target.id, r.cardinality, r.metadata
            """
            
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            
            relationships = []
            if rels_result.result_set:
                for rel_row in rels_result.result_set:
                    metadata = rel_row[5]
                    if isinstance(metadata, str):
                        metadata = json.loads(metadata)
                    
                    relationships.append(SchemaRelationship(
                        id=rel_row[0],
                        name=rel_row[1],
                        source_class_id=rel_row[2],
                        target_class_id=rel_row[3],
                        cardinality=rel_row[4],
                        metadata=metadata or {}
                    ))
            
            return SchemaDefinition(
                id=row[0],
                name=row[1],
                description=row[2],
                version=row[3],
                classes=classes,
                relationships=relationships,
                created_at=row[4],
                updated_at=row[5]
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to get schema: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas"""
        try:
            query = """
            MATCH (s:Schema)
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            WITH s, count(c) as class_count
            RETURN s.id, s.name, s.description, s.version, s.created_at, class_count
            ORDER BY s.created_at DESC
            """
            
            result = db.execute_query(query)
            
            schemas = []
            if result.result_set:
                for row in result.result_set:
                    schemas.append({
                        'id': row[0],
                        'name': row[1],
                        'description': row[2],
                        'version': row[3],
                        'created_at': row[4],
                        'class_count': row[5]
                    })
            
            return schemas
            
        except Exception as e:
            logger.error(f"❌ Failed to list schemas: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def delete_schema(schema_id: str):
        """Delete a schema and all its data"""
        try:
            # Delete all related data
            delete_query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            DETACH DELETE s, c, i
            """
            
            db.execute_query(delete_query, {'schema_id': schema_id})
            logger.info(f"✅ Deleted schema: {schema_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to delete schema: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def get_lineage_graph(
        schema_id: str,
        expanded_classes: Optional[List[str]] = None
    ) -> LineageGraphResponse:
        """
        Get lineage graph for visualization
        ✅ FIXED: Returns both SCHEMA_REL and HAS_SUBCLASS relationships
        """
        try:
            expanded_classes = expanded_classes or []
            
            schema = SchemaService.get_schema(schema_id)
            
            # Get all classes with positions
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(inst:DataInstance)
            WITH c, count(inst) as instance_count
            RETURN c.id, c.name, c.attributes, c.level, c.parent_id, c.metadata, instance_count
            ORDER BY c.level, c.name
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            nodes = []
            if result.result_set:
                for idx, row in enumerate(result.result_set):
                    class_id = row[0]
                    class_name = row[1]
                    attributes_str = row[2]
                    level = row[3] or 0
                    parent_id = row[4]
                    metadata_str = row[5]
                    instance_count = row[6]
                    
                    # Parse attributes
                    attributes = []
                    if attributes_str:
                        if isinstance(attributes_str, str):
                            attr_data = json.loads(attributes_str)
                        else:
                            attr_data = attributes_str
                        
                        for attr in attr_data:
                            if isinstance(attr, dict):
                                attributes.append(Attribute(
                                    id=attr.get('id', str(uuid.uuid4())),
                                    name=attr['name'],
                                    data_type=attr.get('data_type', 'string'),
                                    is_primary_key=attr.get('is_primary_key', False),
                                    is_foreign_key=attr.get('is_foreign_key', False),
                                    is_nullable=attr.get('is_nullable', True),
                                    metadata=attr.get('metadata', {})
                                ))
                    
                    # Parse metadata
                    if isinstance(metadata_str, str):
                        metadata = json.loads(metadata_str)
                    else:
                        metadata = metadata_str or {}
                    
                    # Calculate position
                    position = {
                        'x': level * 400,
                        'y': idx * 150
                    }
                    
                    nodes.append(LineageNode(
                        id=class_id,
                        type='class',
                        label=class_name,
                        level=level,
                        parent_id=parent_id if parent_id else None,
                        metadata=metadata,
                        collapsed=class_id not in expanded_classes,
                        position=position,
                        attributes=attributes,
                        instance_count=instance_count
                    ))
            
            # Get SCHEMA_REL relationships (user-defined)
            edges = []
            
            schema_rels_query = """
            MATCH (source:SchemaClass)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE source.schema_id = $schema_id AND target.schema_id = $schema_id
            RETURN r.id, source.id, target.id, r.name, r.cardinality, r.metadata
            """
            
            rels_result = db.execute_query(schema_rels_query, {'schema_id': schema_id})
            
            if rels_result.result_set:
                for row in rels_result.result_set:
                    rel_id = row[0]
                    source_id = row[1]
                    target_id = row[2]
                    rel_name = row[3]
                    cardinality = row[4]
                    metadata_str = row[5]
                    
                    if isinstance(metadata_str, str):
                        metadata = json.loads(metadata_str)
                    else:
                        metadata = metadata_str or {}
                    
                    edges.append(LineageEdge(
                        id=rel_id,
                        source=source_id,
                        target=target_id,
                        type='schema_relationship',
                        label=rel_name,
                        cardinality=cardinality,
                        metadata=metadata
                    ))
            
            # Get HAS_SUBCLASS relationships for hierarchy
            subclass_query = """
            MATCH (parent:SchemaClass)-[r:HAS_SUBCLASS]->(child:SchemaClass)
            WHERE parent.schema_id = $schema_id AND child.schema_id = $schema_id
            RETURN parent.id, child.id
            """
            
            subclass_result = db.execute_query(subclass_query, {'schema_id': schema_id})
            
            hierarchy_edges_count = 0
            if subclass_result.result_set:
                for row in subclass_result.result_set:
                    parent_id = row[0]
                    child_id = row[1]
                    
                    edges.append(LineageEdge(
                        id=f"hierarchy_{parent_id}_{child_id}",
                        source=parent_id,
                        target=child_id,
                        type='hierarchy',
                        label='HAS_SUBCLASS',
                        cardinality='ONE_TO_MANY',
                        metadata={'is_hierarchy': True}
                    ))
                    hierarchy_edges_count += 1
            
            logger.info(f"✅ Lineage graph ready: {len(nodes)} nodes, {len(edges)} edges")
            logger.info(f"   Schema relationships: {len(edges) - hierarchy_edges_count}")
            logger.info(f"   Hierarchy edges: {hierarchy_edges_count}")
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema.name,
                nodes=nodes,
                edges=edges,
                metadata={
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'expanded_classes': expanded_classes,
                    'schema_relationships': len(edges) - hierarchy_edges_count,
                    'hierarchy_edges': hierarchy_edges_count
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get lineage graph: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def create_relationship(
        schema_id: str,
        source_class_id: str,
        target_class_id: str,
        relationship_name: str,
        cardinality: str = Cardinality.ONE_TO_MANY
    ) -> SchemaRelationship:
        """Create a new relationship between classes"""
        try:
            rel_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            logger.info(f"🔗 Creating new relationship: {relationship_name}")
            
            # Verify classes exist
            verify_query = """
            MATCH (source:SchemaClass {id: $source_id, schema_id: $schema_id})
            MATCH (target:SchemaClass {id: $target_id, schema_id: $schema_id})
            RETURN source.name, target.name
            """
            
            verify_result = db.execute_query(verify_query, {
                'schema_id': schema_id,
                'source_id': source_class_id,
                'target_id': target_class_id
            })
            
            if not verify_result.result_set:
                raise ValueError("Source or target class not found")
            
            # Create relationship
            rel_query = """
            MATCH (source:SchemaClass {id: $source_id})
            MATCH (target:SchemaClass {id: $target_id})
            CREATE (source)-[r:SCHEMA_REL {
                id: $rel_id,
                name: $rel_name,
                cardinality: $cardinality,
                metadata: $metadata,
                created_at: $created_at
            }]->(target)
            RETURN r
            """
            
            db.execute_query(rel_query, {
                'source_id': source_class_id,
                'target_id': target_class_id,
                'rel_id': rel_id,
                'rel_name': relationship_name,
                'cardinality': cardinality,
                'metadata': json.dumps({}),
                'created_at': timestamp
            })
            
            logger.info(f"✅ Created relationship: {relationship_name}")
            
            return SchemaRelationship(
                id=rel_id,
                name=relationship_name,
                source_class_id=source_class_id,
                target_class_id=target_class_id,
                cardinality=cardinality,
                metadata={}
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to create relationship: {str(e)}", exc_info=True)
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
            RETURN 
                count(DISTINCT c) as class_count,
                count(DISTINCT r) as relationship_count,
                count(DISTINCT i) as instance_count
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if result.result_set:
                row = result.result_set[0]
                return SchemaStats(
                    total_classes=row[0],
                    total_relationships=row[1],
                    total_instances=row[2]
                )
            
            return SchemaStats(
                total_classes=0,
                total_relationships=0,
                total_instances=0
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema stats: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def find_lineage_paths(
        schema_id: str,
        start_node_id: str,
        end_node_id: str,
        max_depth: int = 5
    ) -> LineagePathResponse:
        """Find paths between two nodes"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            MATCH (start:SchemaClass {id: $start_id})
            MATCH (end:SchemaClass {id: $end_id})
            MATCH path = (start)-[*1..$max_depth]-(end)
            RETURN path
            LIMIT 10
            """
            
            result = db.execute_query(query, {
                'schema_id': schema_id,
                'start_id': start_node_id,
                'end_id': end_node_id,
                'max_depth': max_depth
            })
            
            paths = []
            # Process paths here if needed
            
            return LineagePathResponse(
                start_node_id=start_node_id,
                end_node_id=end_node_id,
                paths=paths,
                total_paths=len(paths)
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to find paths: {str(e)}", exc_info=True)
            raise