# backend/app/services/schema_service.py - COMPLETE FIXED VERSION WITH ALL DEBUGGING
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
    """Service for schema operations with auto-layout and hierarchy support"""
    
    @staticmethod
    def create_schema(request: SchemaCreateRequest) -> SchemaDefinition:
        """
        Create a new schema with classes and relationships
        FIXED: Extensive logging, verification, and debugging for relationship creation
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
            logger.info(f"📦 Creating {len(request.classes)} classes...")
            for cls in request.classes:
                cls_metadata = getattr(cls, 'metadata', None) or {}
                level = cls_metadata.get('level', 0)
                parent_id = cls_metadata.get('parent_id', None)
                
                # Ensure attributes are stored as JSON array of strings
                if isinstance(cls.attributes, list):
                    attributes_to_store = cls.attributes
                else:
                    attributes_to_store = []
                
                # Create the class node
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
                    'attributes': json.dumps(attributes_to_store),
                    'level': level,
                    'parent_id': parent_id or '',
                    'metadata': json.dumps(cls_metadata)
                })
                
                # CREATE HAS_SUBCLASS RELATIONSHIP with PARENT->CHILD direction
                if parent_id:
                    subclass_rel_query = """
                    MATCH (child:SchemaClass {id: $child_id})
                    MATCH (parent:SchemaClass {id: $parent_id})
                    CREATE (parent)-[:HAS_SUBCLASS]->(child)
                    RETURN parent.name as parent_name, child.name as child_name
                    """
                    
                    try:
                        result = db.execute_query(subclass_rel_query, {
                            'child_id': cls.id,
                            'parent_id': parent_id
                        })
                        if result.result_set:
                            parent_name = result.result_set[0][0]
                            child_name = result.result_set[0][1]
                            logger.info(f"  ✅ Created HAS_SUBCLASS: {parent_name} -> {child_name}")
                    except Exception as e:
                        logger.error(f"  ❌ Failed to create HAS_SUBCLASS relationship: {e}")
                
                logger.info(f"  ✅ Created class: {cls.name} (ID: {cls.id}, Level: {level})")
            
            # ✅ FIX: Create ALL user-defined relationships with extensive logging
            logger.info(f"\n🔗 Creating {len(request.relationships)} USER-DEFINED relationships...")
            relationships_created = 0
            relationships_failed = 0
            
            for idx, rel in enumerate(request.relationships, 1):
                logger.info(f"\n📌 Relationship {idx}/{len(request.relationships)}:")
                logger.info(f"   Name: {rel.name}")
                logger.info(f"   Source: {rel.source_class_id}")
                logger.info(f"   Target: {rel.target_class_id}")
                logger.info(f"   Cardinality: {rel.cardinality}")
                
                rel_metadata = getattr(rel, 'metadata', None) or {}
                
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
                        logger.error(f"      Schema ID: {schema_id}")
                        logger.error(f"      Source ID: {rel.source_class_id}")
                        logger.error(f"      Target ID: {rel.target_class_id}")
                        relationships_failed += 1
                        continue
                    
                    source_name = verify_result.result_set[0][0]
                    target_name = verify_result.result_set[0][1]
                    logger.info(f"   ✓ Classes verified: {source_name} -> {target_name}")
                    
                except Exception as e:
                    logger.error(f"   ❌ FAILED to verify classes: {e}")
                    relationships_failed += 1
                    continue
                
                # Now create the relationship
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
                        logger.info(f"   ✅ SUCCESS: Created {rel.name} ({source_name} -> {target_name}) [Cardinality: {rel.cardinality}]")
                        relationships_created += 1
                    else:
                        logger.error(f"   ❌ FAILED: No result returned from relationship creation")
                        relationships_failed += 1
                        
                except Exception as e:
                    logger.error(f"   ❌ FAILED to create relationship: {e}")
                    logger.error(f"      Query: {rel_query}")
                    relationships_failed += 1
            
            logger.info(f"\n📊 Relationship Creation Summary:")
            logger.info(f"   ✅ Created: {relationships_created}")
            logger.info(f"   ❌ Failed: {relationships_failed}")
            logger.info(f"   📝 Total: {len(request.relationships)}")
            
            # Verify relationships exist in database
            if relationships_created > 0:
                verify_all_query = """
                MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c1:SchemaClass)
                MATCH (c1)-[r:SCHEMA_REL]->(c2:SchemaClass)
                WHERE c2.schema_id = $schema_id
                RETURN c1.name, r.name, r.cardinality, c2.name
                """
                verify_result = db.execute_query(verify_all_query, {'schema_id': schema_id})
                logger.info(f"\n🔍 Database Verification: Found {len(verify_result.result_set) if verify_result.result_set else 0} relationships in DB")
                if verify_result.result_set:
                    for row in verify_result.result_set:
                        logger.info(f"   {row[0]} -[{row[1]}]-> {row[3]} (Cardinality: {row[2]})")
            
            # Return full schema
            return SchemaService.get_schema(schema_id)
            
        except Exception as e:
            logger.error(f"❌ Failed to create schema: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas"""
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
                    
                    if isinstance(attributes, list):
                        if len(attributes) > 0:
                            if isinstance(attributes[0], dict):
                                attributes = [attr.get('name', str(attr)) for attr in attributes]
                            elif not isinstance(attributes[0], str):
                                attributes = [str(attr) for attr in attributes]
                    else:
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
                    
                    cardinality = row[4]
                    if isinstance(cardinality, str):
                        try:
                            cardinality = Cardinality(cardinality)
                        except:
                            cardinality = Cardinality.ONE_TO_MANY
                    
                    relationships.append(SchemaRelationship(
                        id=row[0],
                        name=row[1],
                        source_class_id=row[2],
                        target_class_id=row[3],
                        cardinality=cardinality,
                        metadata=metadata
                    ))
            
            logger.info(f"✅ Retrieved schema {schema_id}: {len(classes)} classes, {len(relationships)} relationships")
            
            return SchemaDefinition(
                id=schema_row[0],
                name=schema_row[1],
                description=schema_row[2] or '',
                version=schema_row[3] or '1.0',
                classes=classes,
                relationships=relationships,
                created_at=schema_row[4],
                updated_at=schema_row[5]
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to get schema: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def update_schema(schema_id: str, updates: Dict[str, Any]) -> SchemaDefinition:
        """Update schema metadata"""
        try:
            update_fields = []
            params = {'schema_id': schema_id, 'updated_at': datetime.utcnow().isoformat()}
            
            if 'name' in updates:
                update_fields.append('s.name = $name')
                params['name'] = updates['name']
            
            if 'description' in updates:
                update_fields.append('s.description = $description')
                params['description'] = updates['description']
            
            update_fields.append('s.updated_at = $updated_at')
            
            query = f"""
            MATCH (s:Schema {{id: $schema_id}})
            SET {', '.join(update_fields)}
            RETURN s
            """
            
            result = db.execute_query(query, params)
            
            if not result.result_set:
                raise ValueError(f"Schema not found: {schema_id}")
            
            logger.info(f"✅ Updated schema: {schema_id}")
            return SchemaService.get_schema(schema_id)
            
        except Exception as e:
            logger.error(f"❌ Failed to update schema: {str(e)}")
            raise
    
    @staticmethod
    def delete_schema(schema_id: str) -> bool:
        """Delete a schema and all related data"""
        try:
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
    def get_lineage_graph(
        schema_id: str,
        filters: Optional[Dict[str, Any]] = None,
        expanded_classes: Optional[List[str]] = None
    ) -> LineageGraphResponse:
        """
        Get lineage graph for visualization
        ✅ FIXED: Excludes parent_child edges (hierarchy shown in tree view)
        ✅ FIXED: Ensures all positions are valid
        """
        try:
            if expanded_classes is None:
                expanded_classes = []
                
            logger.info(f"🎨 Getting lineage graph for schema: {schema_id}")
            
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
            
            node_data = []
            
            if classes_result.result_set:
                for row in classes_result.result_set:
                    class_id = row[0]
                    class_name = row[1]
                    attributes = row[2]
                    level = row[3] if row[3] is not None else 0
                    parent_id = row[4]
                    metadata = row[5]
                    
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
                        'type': 'schema_class',
                        'name': class_name,
                        'schema_id': schema_id,
                        'class_id': class_id,
                        'parent_id': parent_id or None,
                        'level': level,
                        'data': {
                            'attributes': attributes,
                            'level': level
                        },
                        'metadata': metadata,
                        'collapsed': class_id not in expanded_classes
                    })
            
            # ✅ FIX: Get ONLY schema relationships, NOT hierarchy edges
            edges_data = []
            
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
                        'label': row[3],
                        'type': 'schema_relationship',
                        'cardinality': row[4],
                        'metadata': metadata
                    })
            
            logger.info(f"✅ Built lineage graph: {len(node_data)} nodes, {len(edges_data)} edges (hierarchy edges excluded)")
            
            # Apply layout
            try:
                positioned_nodes = GraphLayoutEngine.calculate_tree_layout(node_data, edges_data)
                logger.info(f"✅ Applied tree layout to {len(positioned_nodes)} nodes")
            except Exception as layout_error:
                logger.error(f"❌ Layout failed: {layout_error}")
                # Fallback: simple grid layout
                for i, node in enumerate(node_data):
                    level = node.get('level', 0)
                    node['position'] = {'x': float(i * 300), 'y': float(level * 200)}
                positioned_nodes = node_data
            
            # ✅ FIX: Ensure all positions are valid numbers
            nodes = []
            for node_dict in positioned_nodes:
                if 'position' not in node_dict or not node_dict['position']:
                    node_dict['position'] = {'x': 0.0, 'y': 0.0}
                
                # Ensure position values are floats
                pos = node_dict['position']
                if not isinstance(pos.get('x'), (int, float)):
                    pos['x'] = 0.0
                if not isinstance(pos.get('y'), (int, float)):
                    pos['y'] = 0.0
                
                pos['x'] = float(pos['x'])
                pos['y'] = float(pos['y'])
                
                nodes.append(LineageNode(**node_dict))
            
            # Create edges
            edges = []
            for edge_dict in edges_data:
                edges.append(LineageEdge(**edge_dict))
            
            # Get schema name
            schema = SchemaService.get_schema(schema_id)
            
            logger.info(f"✅ Lineage graph ready: {len(nodes)} nodes, {len(edges)} edges")
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema.name,
                nodes=nodes,
                edges=edges,
                metadata={
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'expanded_classes': expanded_classes
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get lineage graph: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            class_count_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN count(c) as class_count
            """
            
            class_result = db.execute_query(class_count_query, {'schema_id': schema_id})
            class_count = class_result.result_set[0][0] if class_result.result_set else 0
            
            rel_count_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            MATCH (c)-[r:SCHEMA_REL]->()
            RETURN count(DISTINCT r) as rel_count
            """
            
            rel_result = db.execute_query(rel_count_query, {'schema_id': schema_id})
            rel_count = rel_result.result_set[0][0] if rel_result.result_set else 0
            
            instance_count_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            RETURN count(i) as instance_count
            """
            
            instance_result = db.execute_query(instance_count_query, {'schema_id': schema_id})
            instance_count = instance_result.result_set[0][0] if instance_result.result_set else 0
            
            return SchemaStats(
                schema_id=schema_id,
                class_count=class_count,
                relationship_count=rel_count,
                instance_count=instance_count,
                attribute_count=0
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get schema stats: {str(e)}")
            raise