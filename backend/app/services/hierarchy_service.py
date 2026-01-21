# backend/app/services/hierarchy_service.py - FIXED FOR HAS_SUBCLASS
"""
Hierarchy Service - Handles class hierarchy operations
FIXED: Uses HAS_SUBCLASS (parent->child) instead of SUBCLASS_OF (child->parent)
"""

from typing import List, Dict, Any, Optional
from ..database import db
from ..models.lineage.hierarchy import (
    HierarchyTree, HierarchyNode, CreateClassRequest,
    CreateSubclassRequest, UpdateClassRequest, HierarchyStatsResponse
)
from ..models.lineage.attribute import Attribute
import logging
import json
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)


class HierarchyService:
    """Service for managing class hierarchies"""
    
    @staticmethod
    def get_hierarchy_tree(schema_id: str) -> HierarchyTree:
        """
        Get complete hierarchy tree for a schema
        FIXED: Builds tree from HAS_SUBCLASS relationships (parent->child)
        """
        try:
            logger.info(f"📊 Getting hierarchy tree for schema: {schema_id}")
            
            # ✅ FIX: Query using HAS_SUBCLASS with parent->child direction
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (parent:SchemaClass)-[:HAS_SUBCLASS]->(c)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(inst:DataInstance)
            WITH c, parent, count(DISTINCT inst) as instance_count
            RETURN c.id as id,
                   c.name as name,
                   c.display_name as display_name,
                   c.attributes as attributes,
                   c.level as level,
                   c.metadata as metadata,
                   parent.id as parent_id,
                   instance_count
            ORDER BY c.level ASC, c.name ASC
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            # Build node lookup and parent-child map
            nodes_by_id: Dict[str, Dict[str, Any]] = {}
            children_map: Dict[str, List[str]] = {}
            root_ids: List[str] = []
            
            if result.result_set:
                for row in result.result_set:
                    node_id = row[0]
                    node_name = row[1]
                    display_name = row[2]
                    attributes_str = row[3]
                    level = row[4] if row[4] is not None else 0
                    metadata_str = row[5]
                    parent_id = row[6]
                    instance_count = row[7] if len(row) > 7 else 0
                    
                    # Parse attributes
                    attributes = []
                    if attributes_str:
                        if isinstance(attributes_str, str):
                            try:
                                parsed = json.loads(attributes_str)
                                if isinstance(parsed, list):
                                    for attr in parsed:
                                        if isinstance(attr, dict):
                                            attributes.append(Attribute(**attr))
                                        elif isinstance(attr, str):
                                            # Create simple attribute from string
                                            attributes.append(Attribute(
                                                id=str(uuid.uuid4()),
                                                name=attr,
                                                data_type='string'
                                            ))
                            except:
                                pass
                    
                    # Parse metadata
                    metadata = {}
                    if metadata_str and isinstance(metadata_str, str):
                        try:
                            metadata = json.loads(metadata_str)
                        except:
                            pass
                    
                    # Store node
                    nodes_by_id[node_id] = {
                        'id': node_id,
                        'name': node_name,
                        'display_name': display_name or node_name,
                        'type': 'subclass' if level > 0 else 'class',
                        'level': level,
                        'parent_id': parent_id,
                        'children': [],
                        'attributes': attributes,
                        'instance_count': instance_count,
                        'collapsed': False,
                        'metadata': metadata
                    }
                    
                    # Build parent-child map
                    if parent_id:
                        if parent_id not in children_map:
                            children_map[parent_id] = []
                        children_map[parent_id].append(node_id)
                    else:
                        root_ids.append(node_id)
            
            # Build tree recursively
            def build_tree(node_id: str) -> HierarchyNode:
                node_data = nodes_by_id[node_id]
                children_ids = children_map.get(node_id, [])
                children = [build_tree(child_id) for child_id in children_ids]
                
                return HierarchyNode(
                    id=node_data['id'],
                    name=node_data['name'],
                    display_name=node_data['display_name'],
                    type=node_data['type'],
                    level=node_data['level'],
                    parent_id=node_data['parent_id'],
                    children=children,
                    attributes=node_data['attributes'],
                    instance_count=node_data['instance_count'],
                    collapsed=node_data['collapsed'],
                    metadata=node_data['metadata']
                )
            
            root_nodes = [build_tree(root_id) for root_id in root_ids]
            
            # Calculate max depth
            def get_max_depth(node: HierarchyNode) -> int:
                if not node.children:
                    return node.level
                return max(get_max_depth(child) for child in node.children)
            
            max_depth = max([get_max_depth(node) for node in root_nodes]) if root_nodes else 0
            
            logger.info(f"✅ Built hierarchy tree: {len(nodes_by_id)} total nodes, {len(root_nodes)} roots, max depth: {max_depth}")
            
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
        FIXED: Uses HAS_SUBCLASS (parent->child) direction
        """
        try:
            logger.info(f"Creating subclass: {request.name} under {request.parent_class_id}")
            
            # Verify parent exists
            parent_query = """
            MATCH (parent:SchemaClass {id: $parent_id})
            WHERE parent.schema_id = $schema_id
            RETURN parent.name as name, parent.level as level
            """
            
            parent_result = db.execute_query(parent_query, {
                'parent_id': request.parent_class_id,
                'schema_id': schema_id
            })
            
            if not parent_result.result_set:
                raise ValueError(f"Parent class not found: {request.parent_class_id}")
            
            parent_name = parent_result.result_set[0][0]
            parent_level = parent_result.result_set[0][1] if parent_result.result_set[0][1] is not None else 0
            child_level = parent_level + 1
            
            class_id = str(uuid.uuid4())
            
            # Build attributes list
            attributes = []
            
            # Inherit parent attributes if requested
            if request.inherit_attributes:
                inherit_query = """
                MATCH (parent:SchemaClass {id: $parent_id})
                RETURN parent.attributes as attributes
                """
                inherit_result = db.execute_query(inherit_query, {'parent_id': request.parent_class_id})
                
                if inherit_result.result_set and inherit_result.result_set[0][0]:
                    parent_attrs = inherit_result.result_set[0][0]
                    if isinstance(parent_attrs, str):
                        parent_attrs = json.loads(parent_attrs)
                    
                    # Add parent attributes first
                    for attr in parent_attrs:
                        if isinstance(attr, dict):
                            attributes.append(Attribute(**attr))
                        elif isinstance(attr, str):
                            # Create simple attribute from string
                            attributes.append(Attribute(
                                id=str(uuid.uuid4()),
                                name=attr,
                                data_type='string'
                            ))
            
            # Add additional attributes
            for attr in request.additional_attributes:
                attributes.append(attr)
            
            # ✅ FIX: Create subclass node
            create_query = """
            MATCH (s:Schema {id: $schema_id})
            MATCH (parent:SchemaClass {id: $parent_id})
            CREATE (c:SchemaClass {
                id: $class_id,
                name: $name,
                display_name: $display_name,
                schema_id: $schema_id,
                level: $level,
                attributes: $attributes,
                metadata: $metadata
            })
            CREATE (s)-[:HAS_CLASS]->(c)
            CREATE (parent)-[:HAS_SUBCLASS]->(c)
            RETURN c
            """
            
            metadata = request.metadata or {}
            metadata['parent_class_id'] = request.parent_class_id
            metadata['parent_class_name'] = parent_name
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
                'display_name': request.display_name or request.name,
                'level': child_level,
                'attributes': json.dumps(attributes_data),
                'metadata': json.dumps(metadata)
            })
            
            logger.info(f"✅ Created subclass: {request.name} (level {child_level})")
            
            return HierarchyNode(
                id=class_id,
                name=request.name,
                display_name=request.display_name or request.name,
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
            # Build update query
            update_fields = []
            params = {'schema_id': schema_id, 'class_id': class_id}
            
            if request.name is not None:
                update_fields.append('c.name = $name')
                params['name'] = request.name
            
            if request.display_name is not None:
                update_fields.append('c.display_name = $display_name')
                params['display_name'] = request.display_name
            
            if request.metadata is not None:
                update_fields.append('c.metadata = $metadata')
                params['metadata'] = json.dumps(request.metadata)
            
            if not update_fields:
                raise ValueError("No update fields provided")
            
            query = f"""
            MATCH (c:SchemaClass {{id: $class_id}})
            WHERE c.schema_id = $schema_id
            SET {', '.join(update_fields)}
            RETURN c
            """
            
            result = db.execute_query(query, params)
            
            if not result.result_set:
                raise ValueError(f"Class not found: {class_id}")
            
            logger.info(f"✅ Updated class: {class_id}")
            
            # Return updated hierarchy node
            tree = HierarchyService.get_hierarchy_tree(schema_id)
            
            def find_node(nodes: List[HierarchyNode], node_id: str) -> Optional[HierarchyNode]:
                for node in nodes:
                    if node.id == node_id:
                        return node
                    if node.children:
                        found = find_node(node.children, node_id)
                        if found:
                            return found
                return None
            
            updated_node = find_node(tree.root_nodes, class_id)
            if not updated_node:
                raise ValueError(f"Updated class not found in tree: {class_id}")
            
            return updated_node
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to update class: {str(e)}")
            raise
    
    @staticmethod
    def delete_class(schema_id: str, class_id: str) -> bool:
        """Delete a class and all its subclasses"""
        try:
            # Delete recursively (all subclasses)
            delete_query = """
            MATCH (c:SchemaClass {id: $class_id})
            WHERE c.schema_id = $schema_id
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS*]->(sub:SchemaClass)
            DETACH DELETE c, sub
            """
            
            db.execute_query(delete_query, {'schema_id': schema_id, 'class_id': class_id})
            
            logger.info(f"✅ Deleted class and subclasses: {class_id}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to delete class: {str(e)}")
            raise
    
    @staticmethod
    def get_hierarchy_stats(schema_id: str) -> HierarchyStatsResponse:
        """Get hierarchy statistics"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS*]->(sub:SchemaClass)
            RETURN count(DISTINCT c) as total_classes,
                   max(c.level) as max_depth,
                   count(DISTINCT sub) as total_subclasses
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if result.result_set:
                row = result.result_set[0]
                return HierarchyStatsResponse(
                    schema_id=schema_id,
                    total_classes=row[0],
                    max_depth=row[1] or 0,
                    total_subclasses=row[2] or 0,
                    root_classes=row[0] - (row[2] or 0)
                )
            
            return HierarchyStatsResponse(
                schema_id=schema_id,
                total_classes=0,
                max_depth=0,
                total_subclasses=0,
                root_classes=0
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get hierarchy stats: {str(e)}")
            raise