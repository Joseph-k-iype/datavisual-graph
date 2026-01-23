# backend/app/services/hierarchy_service.py
"""
Hierarchy Service - FULLY FIXED
Handles class hierarchy operations with proper parent verification
"""

import uuid
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from ..database import db
from ..models.lineage.hierarchy import (
    HierarchyTree, HierarchyNode, Attribute,
    CreateSubclassRequest, UpdateClassRequest, HierarchyStatsResponse
)

logger = logging.getLogger(__name__)


class HierarchyService:
    """Service for managing class hierarchies"""
    
    @staticmethod
    def get_hierarchy_tree(schema_id: str) -> HierarchyTree:
        """
        Get complete hierarchy tree for a schema
        Returns nested structure with parent-child relationships
        """
        try:
            logger.info(f"📊 Building hierarchy tree for schema: {schema_id}")
            
            # Verify schema exists
            schema_query = """
            MATCH (s:Schema {id: $schema_id})
            RETURN s.name
            """
            
            schema_result = db.execute_query(schema_query, {'schema_id': schema_id})
            if not schema_result.result_set:
                raise ValueError(f"Schema not found: {schema_id}")
            
            # Get all classes
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c.id, c.name, c.display_name, c.level, c.parent_id, 
                   c.attributes, c.metadata, c.instance_count
            ORDER BY c.level, c.name
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            if not classes_result.result_set:
                return HierarchyTree(
                    schema_id=schema_id,
                    root_nodes=[],
                    max_depth=0,
                    total_nodes=0,
                    metadata={'note': 'No classes found'}
                )
            
            # Build nodes map
            nodes_by_id: Dict[str, HierarchyNode] = {}
            children_map: Dict[str, List[str]] = {}
            
            for row in classes_result.result_set:
                class_id = row[0]
                name = row[1]
                display_name = row[2] if row[2] else name
                level = row[3] if row[3] is not None else 0
                parent_id = row[4] if row[4] else None
                attributes_str = row[5]
                metadata_str = row[6]
                instance_count = row[7] if row[7] is not None else 0
                
                # Parse attributes
                attributes = []
                if attributes_str:
                    try:
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
                    except Exception as e:
                        logger.warning(f"Failed to parse attributes for {class_id}: {e}")
                
                # Parse metadata
                metadata = {}
                if metadata_str:
                    try:
                        if isinstance(metadata_str, str):
                            metadata = json.loads(metadata_str)
                        else:
                            metadata = metadata_str
                    except Exception as e:
                        logger.warning(f"Failed to parse metadata for {class_id}: {e}")
                
                # Create node
                node = HierarchyNode(
                    id=class_id,
                    name=name,
                    display_name=display_name,
                    type='subclass' if level > 0 else 'class',
                    level=level,
                    parent_id=parent_id,
                    children=[],
                    attributes=attributes,
                    instance_count=instance_count,
                    collapsed=False,
                    metadata=metadata
                )
                
                nodes_by_id[class_id] = node
                
                # Track parent-child relationships
                if parent_id:
                    if parent_id not in children_map:
                        children_map[parent_id] = []
                    children_map[parent_id].append(class_id)
            
            # Build tree structure
            def build_children(node_id: str) -> List[HierarchyNode]:
                if node_id not in children_map:
                    return []
                
                children = []
                for child_id in children_map[node_id]:
                    if child_id in nodes_by_id:
                        child_node = nodes_by_id[child_id]
                        child_node.children = build_children(child_id)
                        children.append(child_node)
                
                return children
            
            # Find root nodes and build their trees
            root_nodes = []
            max_depth = 0
            
            for node_id, node in nodes_by_id.items():
                if not node.parent_id:  # Root node
                    node.children = build_children(node_id)
                    root_nodes.append(node)
                
                # Track max depth
                if node.level > max_depth:
                    max_depth = node.level
            
            logger.info(f"✅ Built hierarchy tree: {len(root_nodes)} roots, {len(nodes_by_id)} total nodes, max depth: {max_depth}")
            
            return HierarchyTree(
                schema_id=schema_id,
                root_nodes=root_nodes,
                max_depth=max_depth,
                total_nodes=len(nodes_by_id),
                metadata={
                    'root_count': len(root_nodes),
                    'total_count': len(nodes_by_id)
                }
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get hierarchy tree: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def create_subclass(
        schema_id: str,
        request: CreateSubclassRequest
    ) -> HierarchyNode:
        """
        Create a subclass under a parent class
        ✅ FIXED: Proper parent verification and error handling
        """
        try:
            logger.info(f"Creating subclass: {request.name} under parent: {request.parent_class_id}")
            
            # ✅ FIXED: More robust parent verification
            parent_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(parent:SchemaClass {id: $parent_id})
            RETURN parent.name as name, parent.level as level, parent.id as id
            """
            
            parent_result = db.execute_query(parent_query, {
                'parent_id': request.parent_class_id,
                'schema_id': schema_id
            })
            
            if not parent_result.result_set:
                # Log detailed error for debugging
                logger.error(f"❌ Parent class not found!")
                logger.error(f"   Schema ID: {schema_id}")
                logger.error(f"   Parent ID: {request.parent_class_id}")
                
                # Try to find if parent exists without schema constraint
                check_query = """
                MATCH (parent:SchemaClass {id: $parent_id})
                RETURN parent.schema_id, parent.name
                """
                check_result = db.execute_query(check_query, {'parent_id': request.parent_class_id})
                
                if check_result.result_set:
                    actual_schema = check_result.result_set[0][0]
                    parent_name = check_result.result_set[0][1]
                    logger.error(f"   Parent '{parent_name}' exists but belongs to schema: {actual_schema}")
                    raise ValueError(f"Parent class '{parent_name}' belongs to different schema")
                else:
                    logger.error(f"   Parent class does not exist in database")
                    raise ValueError(f"Parent class not found: {request.parent_class_id}")
            
            parent_name = parent_result.result_set[0][0]
            parent_level = parent_result.result_set[0][1] if parent_result.result_set[0][1] is not None else 0
            child_level = parent_level + 1
            
            logger.info(f"   ✅ Parent found: {parent_name} (Level {parent_level})")
            
            class_id = str(uuid.uuid4())
            final_display_name = request.display_name if request.display_name else request.name
            
            # Use only additional_attributes (no inheritance)
            attributes = list(request.additional_attributes)
            
            logger.info(f"   📝 Subclass will have {len(attributes)} attributes")
            
            # Create subclass node
            create_query = """
            MATCH (s:Schema {id: $schema_id})
            MATCH (parent:SchemaClass {id: $parent_id})
            CREATE (c:SchemaClass {
                id: $class_id,
                name: $name,
                display_name: $display_name,
                schema_id: $schema_id,
                level: $level,
                parent_id: $parent_id,
                attributes: $attributes,
                metadata: $metadata,
                instance_count: 0,
                created_at: datetime()
            })
            CREATE (s)-[:HAS_CLASS]->(c)
            CREATE (parent)-[:HAS_SUBCLASS]->(c)
            RETURN c
            """
            
            metadata = request.metadata or {}
            metadata['parent_class_id'] = request.parent_class_id
            metadata['parent_class_name'] = parent_name
            metadata['inherited_attributes'] = False
            if request.description:
                metadata['description'] = request.description
            
            # Convert attributes to dict for storage
            attributes_data = [
                {
                    'id': attr.id,
                    'name': attr.name,
                    'data_type': attr.data_type,
                    'is_primary_key': attr.is_primary_key,
                    'is_foreign_key': attr.is_foreign_key,
                    'is_nullable': attr.is_nullable,
                    'metadata': attr.metadata
                }
                for attr in attributes
            ]
            
            result = db.execute_query(create_query, {
                'schema_id': schema_id,
                'parent_id': request.parent_class_id,
                'class_id': class_id,
                'name': request.name,
                'display_name': final_display_name,
                'level': child_level,
                'attributes': json.dumps(attributes_data),
                'metadata': json.dumps(metadata)
            })
            
            logger.info(f"✅ Created subclass: {request.name} (ID: {class_id}, Level {child_level})")
            
            return HierarchyNode(
                id=class_id,
                name=request.name,
                display_name=final_display_name,
                type='subclass',
                level=child_level,
                parent_id=request.parent_class_id,
                children=[],
                attributes=attributes,
                instance_count=0,
                collapsed=False,
                metadata=metadata
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to create subclass: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def update_class(
        schema_id: str,
        class_id: str,
        request: UpdateClassRequest
    ) -> HierarchyNode:
        """Update a class or subclass"""
        try:
            logger.info(f"Updating class: {class_id}")
            
            # Build update fields
            updates = []
            params = {
                'schema_id': schema_id,
                'class_id': class_id
            }
            
            if request.name is not None:
                updates.append("c.name = $name")
                params['name'] = request.name
            
            if request.display_name is not None:
                updates.append("c.display_name = $display_name")
                params['display_name'] = request.display_name
            
            if request.metadata is not None:
                updates.append("c.metadata = $metadata")
                params['metadata'] = json.dumps(request.metadata)
            
            if not updates:
                raise ValueError("No update fields provided")
            
            # Update class
            update_query = f"""
            MATCH (s:Schema {{id: $schema_id}})-[:HAS_CLASS]->(c:SchemaClass {{id: $class_id}})
            SET {', '.join(updates)}
            RETURN c.id, c.name, c.display_name, c.level, c.parent_id, 
                   c.attributes, c.metadata, c.instance_count
            """
            
            result = db.execute_query(update_query, params)
            
            if not result.result_set:
                raise ValueError(f"Class not found: {class_id}")
            
            row = result.result_set[0]
            
            # Parse attributes
            attributes = []
            if row[5]:
                try:
                    attr_data = json.loads(row[5]) if isinstance(row[5], str) else row[5]
                    for attr in attr_data:
                        if isinstance(attr, dict):
                            attributes.append(Attribute(**attr))
                except Exception as e:
                    logger.warning(f"Failed to parse attributes: {e}")
            
            # Parse metadata
            metadata = {}
            if row[6]:
                try:
                    metadata = json.loads(row[6]) if isinstance(row[6], str) else row[6]
                except Exception as e:
                    logger.warning(f"Failed to parse metadata: {e}")
            
            logger.info(f"✅ Updated class: {row[1]}")
            
            return HierarchyNode(
                id=row[0],
                name=row[1],
                display_name=row[2] if row[2] else row[1],
                type='subclass' if row[3] > 0 else 'class',
                level=row[3] if row[3] is not None else 0,
                parent_id=row[4],
                children=[],
                attributes=attributes,
                instance_count=row[7] if row[7] is not None else 0,
                collapsed=False,
                metadata=metadata
            )
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to update class: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def delete_class(schema_id: str, class_id: str) -> None:
        """Delete a class and all its children"""
        try:
            logger.info(f"Deleting class: {class_id} and all children")
            
            # Delete class and all descendants
            delete_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass {id: $class_id})
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS*]->(child:SchemaClass)
            DETACH DELETE c, child
            """
            
            db.execute_query(delete_query, {
                'schema_id': schema_id,
                'class_id': class_id
            })
            
            logger.info(f"✅ Deleted class and children: {class_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to delete class: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def get_hierarchy_stats(schema_id: str) -> HierarchyStatsResponse:
        """Get statistics about class hierarchy"""
        try:
            stats_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS]->(child:SchemaClass)
            WITH c, count(child) as children_count
            RETURN 
                count(c) as total_classes,
                sum(CASE WHEN c.level = 0 THEN 1 ELSE 0 END) as root_classes,
                max(c.level) as max_depth,
                avg(children_count) as avg_children
            """
            
            result = db.execute_query(stats_query, {'schema_id': schema_id})
            
            if not result.result_set:
                raise ValueError(f"Schema not found: {schema_id}")
            
            row = result.result_set[0]
            
            return HierarchyStatsResponse(
                schema_id=schema_id,
                total_classes=row[0] if row[0] is not None else 0,
                root_classes=row[1] if row[1] is not None else 0,
                max_depth=row[2] if row[2] is not None else 0,
                avg_children_per_class=row[3] if row[3] is not None else 0.0
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get hierarchy stats: {str(e)}", exc_info=True)
            raise