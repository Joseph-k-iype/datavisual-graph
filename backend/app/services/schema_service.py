# backend/app/services/schema_service.py - COMPREHENSIVE FIX
from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    SchemaDefinition, SchemaClass, SchemaRelationship,
    SchemaCreateRequest, LineageNode, LineageEdge,
    LineageGraphResponse, LineagePathResponse, SchemaStats,
    DataInstance, DataRelationship, Cardinality
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
                                'data_type': 'string'
                            })
                        elif isinstance(attr, dict):
                            if 'id' not in attr:
                                attr['id'] = str(uuid.uuid4())
                            attributes_to_store.append(attr)
                
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
            
            logger.info(f"✅ Created all classes")
            
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
                        relationships_failed += 1
                        continue
                    
                    source_name = verify_result.result_set[0][0]
                    target_name = verify_result.result_set[0][1]
                    logger.info(f"   ✓ Classes verified: {source_name} -> {target_name}")
                    
                except Exception as e:
                    logger.error(f"   ❌ FAILED to verify classes: {e}")
                    relationships_failed += 1
                    continue
                
                # Create the SCHEMA_REL relationship
                rel_metadata = getattr(rel, 'metadata', None) or {}
                
                rel_query = """
                MATCH (source:SchemaClass {id: $source_id, schema_id: $schema_id})
                MATCH (target:SchemaClass {id: $target_id, schema_id: $schema_id})
                CREATE (source)-[r:SCHEMA_REL {
                    id: $rel_id,
                    name: $rel_name,
                    source_class_id: $source_id,
                    target_class_id: $target_id,
                    cardinality: $cardinality,
                    metadata: $metadata,
                    created_at: $created_at
                }]->(target)
                RETURN r, source.name as source_name, target.name as target_name
                """
                
                try:
                    result = db.execute_query(rel_query, {
                        'schema_id': schema_id,
                        'rel_id': rel.id,
                        'rel_name': rel.name,
                        'source_id': rel.source_class_id,
                        'target_id': rel.target_class_id,
                        'cardinality': rel.cardinality,
                        'metadata': json.dumps(rel_metadata),
                        'created_at': timestamp
                    })
                    
                    if result.result_set:
                        source_name = result.result_set[0][1]
                        target_name = result.result_set[0][2]
                        logger.info(f"   ✅ SUCCESS: Created {rel.name} ({source_name} -> {target_name})")
                        logger.info(f"      Cardinality: {rel.cardinality}")
                        relationships_created += 1
                    else:
                        logger.error(f"   ❌ FAILED: No result returned")
                        relationships_failed += 1
                        
                except Exception as e:
                    logger.error(f"   ❌ FAILED to create relationship: {e}")
                    relationships_failed += 1
            
            logger.info(f"\n📊 Relationship Creation Summary:")
            logger.info(f"   ✅ Created: {relationships_created}")
            logger.info(f"   ❌ Failed: {relationships_failed}")
            logger.info(f"   📝 Total: {len(request.relationships)}")
            
            # Step 4: Verify relationships in database
            if relationships_created > 0:
                verify_all_query = """
                MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c1:SchemaClass)
                MATCH (c1)-[r:SCHEMA_REL]->(c2:SchemaClass)
                WHERE c2.schema_id = $schema_id
                RETURN c1.name, r.name, r.cardinality, c2.name, r.id
                """
                verify_result = db.execute_query(verify_all_query, {'schema_id': schema_id})
                
                found_count = len(verify_result.result_set) if verify_result.result_set else 0
                logger.info(f"\n🔍 Database Verification: Found {found_count} SCHEMA_REL relationships")
                
                if verify_result.result_set:
                    for row in verify_result.result_set:
                        logger.info(f"   {row[0]} -[{row[1]}]-> {row[3]} (Cardinality: {row[2]}, ID: {row[4]})")
            
            # Return complete schema
            return SchemaService.get_schema(schema_id)
            
        except Exception as e:
            logger.error(f"❌ Failed to create schema: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def get_schema(schema_id: str) -> SchemaDefinition:
        """Get schema with all classes and relationships"""
        try:
            # Get schema info
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
            RETURN c.id, c.name, c.attributes, c.parent_id, c.level, c.metadata
            ORDER BY c.level ASC, c.name ASC
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            classes = []
            if classes_result.result_set:
                for class_row in classes_result.result_set:
                    attributes_str = class_row[2]
                    if isinstance(attributes_str, str):
                        attributes = json.loads(attributes_str)
                    else:
                        attributes = attributes_str or []
                    
                    # ✅ FIX: Convert attribute objects to strings for Pydantic
                    if isinstance(attributes, list) and len(attributes) > 0:
                        if isinstance(attributes[0], dict):
                            # Convert from objects to string array
                            attributes = [attr.get('name', attr) if isinstance(attr, dict) else attr 
                                        for attr in attributes]
                    
                    metadata_str = class_row[5]
                    if isinstance(metadata_str, str):
                        metadata = json.loads(metadata_str)
                    else:
                        metadata = metadata_str or {}
                    
                    classes.append(SchemaClass(
                        id=class_row[0],
                        name=class_row[1],
                        attributes=attributes,
                        parent_id=class_row[3] if class_row[3] else None,
                        level=class_row[4] if class_row[4] is not None else 0,
                        children=[],
                        metadata=metadata
                    ))
            
            # Get all SCHEMA_REL relationships
            rels_query = """
            MATCH (source:SchemaClass)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE source.schema_id = $schema_id AND target.schema_id = $schema_id
            RETURN r.id, r.name, r.source_class_id, r.target_class_id, r.cardinality, r.metadata
            """
            
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            
            relationships = []
            if rels_result.result_set:
                for rel_row in rels_result.result_set:
                    metadata_str = rel_row[5]
                    if isinstance(metadata_str, str):
                        metadata = json.loads(metadata_str)
                    else:
                        metadata = metadata_str or {}
                    
                    relationships.append(SchemaRelationship(
                        id=rel_row[0],
                        name=rel_row[1],
                        source_class_id=rel_row[2],
                        target_class_id=rel_row[3],
                        cardinality=rel_row[4],
                        metadata=metadata
                    ))
            
            logger.info(f"✅ Retrieved schema: {row[1]} with {len(classes)} classes, {len(relationships)} relationships")
            
            return SchemaDefinition(
                id=row[0],
                name=row[1],
                description=row[2] or '',
                version=row[3] or '1.0.0',
                classes=classes,
                relationships=relationships,
                created_at=row[4],
                updated_at=row[5]
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_graph(
        schema_id: str,
        expanded_classes: Optional[List[str]] = None
    ) -> LineageGraphResponse:
        """
        Get lineage graph for visualization
        ✅ FIXED: Returns ONLY schema relationships (SCHEMA_REL), not hierarchy
        ✅ FIXED: Proper layout with valid positions
        """
        try:
            if expanded_classes is None:
                expanded_classes = []
            
            logger.info(f"🎨 Getting lineage graph for schema: {schema_id}")
            
            # Get schema info
            schema = SchemaService.get_schema(schema_id)
            
            # Get ALL classes
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c.id, c.name, c.attributes, c.level, c.parent_id, c.metadata
            ORDER BY c.level ASC, c.name ASC
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            nodes = []
            node_positions = {}
            
            if classes_result.result_set:
                # Use layout engine for proper positioning
                layout_engine = GraphLayoutEngine()
                
                # Build node data for layout
                node_data_list = []
                for row in classes_result.result_set:
                    class_id = row[0]
                    level = row[3] if row[3] is not None else 0
                    parent_id = row[4]
                    
                    node_data_list.append({
                        'id': class_id,
                        'level': level,
                        'parent_id': parent_id
                    })
                
                # Calculate positions
                positions = layout_engine.calculate_hierarchical_layout(
                    node_data_list,
                    direction='horizontal'
                )
                
                # Create nodes with positions
                for row in classes_result.result_set:
                    class_id = row[0]
                    class_name = row[1]
                    attributes_str = row[2]
                    level = row[3] if row[3] is not None else 0
                    parent_id = row[4]
                    metadata_str = row[5]
                    
                    # Parse attributes
                    if isinstance(attributes_str, str):
                        attributes = json.loads(attributes_str)
                    else:
                        attributes = attributes_str or []
                    
                    # Parse metadata
                    if isinstance(metadata_str, str):
                        metadata = json.loads(metadata_str)
                    else:
                        metadata = metadata_str or {}
                    
                    # Get position from layout
                    position = positions.get(class_id, {'x': 0, 'y': 0})
                    
                    nodes.append(LineageNode(
                        id=class_id,
                        type='schema_class',
                        name=class_name,
                        schema_id=schema_id,
                        class_id=class_id,
                        parent_id=parent_id if parent_id else None,
                        data={
                            'attributes': attributes,
                            'level': level,
                            'display_name': class_name
                        },
                        metadata=metadata,
                        collapsed=class_id not in expanded_classes,
                        position=position
                    ))
            
            # Get ONLY SCHEMA_REL relationships (NOT HAS_SUBCLASS)
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
                    
                    # Parse metadata
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
            
            logger.info(f"✅ Lineage graph ready: {len(nodes)} nodes, {len(edges)} edges")
            logger.info(f"   Edges breakdown: {len(edges)} schema relationships")
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema.name,
                nodes=nodes,
                edges=edges,
                metadata={
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'expanded_classes': expanded_classes,
                    'schema_relationships': len(edges),
                    'hierarchy_shown_in_tree': True
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
        """
        Create a new relationship between classes
        ✅ NEW: Allows creating relationships from UI
        """
        try:
            rel_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            logger.info(f"🔗 Creating new relationship: {relationship_name}")
            logger.info(f"   Source: {source_class_id}")
            logger.info(f"   Target: {target_class_id}")
            
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
            MATCH (source:SchemaClass {id: $source_id, schema_id: $schema_id})
            MATCH (target:SchemaClass {id: $target_id, schema_id: $schema_id})
            CREATE (source)-[r:SCHEMA_REL {
                id: $rel_id,
                name: $rel_name,
                source_class_id: $source_id,
                target_class_id: $target_id,
                cardinality: $cardinality,
                metadata: $metadata,
                created_at: $created_at
            }]->(target)
            RETURN r
            """
            
            db.execute_query(rel_query, {
                'schema_id': schema_id,
                'rel_id': rel_id,
                'rel_name': relationship_name,
                'source_id': source_class_id,
                'target_id': target_class_id,
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
            logger.error(f"❌ Failed to create relationship: {str(e)}")
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas"""
        try:
            query = """
            MATCH (s:Schema)
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            WITH s, count(DISTINCT c) as class_count
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c1:SchemaClass)-[r:SCHEMA_REL]->(:SchemaClass)
            RETURN s.id as id,
                   s.name as name,
                   s.description as description,
                   s.version as version,
                   s.created_at as created_at,
                   s.updated_at as updated_at,
                   class_count,
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
                        'version': row[3] or '1.0.0',
                        'created_at': row[4],
                        'updated_at': row[5],
                        'class_count': row[6],
                        'relationship_count': row[7]
                    })
            
            return schemas
            
        except Exception as e:
            logger.error(f"❌ Failed to list schemas: {str(e)}")
            raise
    
    @staticmethod
    def delete_schema(schema_id: str) -> bool:
        """Delete a schema and all related data"""
        try:
            # Delete in order: instances -> relationships -> classes -> schema
            delete_instances_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            DETACH DELETE i
            """
            db.execute_query(delete_instances_query, {'schema_id': schema_id})
            
            delete_classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            DETACH DELETE c
            """
            db.execute_query(delete_classes_query, {'schema_id': schema_id})
            
            delete_schema_query = """
            MATCH (s:Schema {id: $schema_id})
            DELETE s
            """
            db.execute_query(delete_schema_query, {'schema_id': schema_id})
            
            logger.info(f"✅ Deleted schema: {schema_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete schema: {str(e)}")
            raise
    
    @staticmethod
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            stats_query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            WITH s, count(DISTINCT c) as class_count
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c1:SchemaClass)-[r:SCHEMA_REL]->(:SchemaClass)
            WITH s, class_count, count(DISTINCT r) as rel_count
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c2:SchemaClass)<-[:INSTANCE_OF]-(i:DataInstance)
            RETURN s.name as name,
                   class_count,
                   rel_count,
                   count(DISTINCT i) as instance_count
            """
            
            result = db.execute_query(stats_query, {'schema_id': schema_id})
            
            if not result.result_set:
                raise ValueError(f"Schema not found: {schema_id}")
            
            row = result.result_set[0]
            
            return SchemaStats(
                schema_id=schema_id,
                schema_name=row[0],
                total_classes=row[1],
                total_relationships=row[2],
                total_instances=row[3],
                total_data_relationships=0,
                instances_by_class={}
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema stats: {str(e)}")
            raise