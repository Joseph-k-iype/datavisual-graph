# backend/app/services/hierarchy_service.py
"""
Hierarchy Service - FULLY FIXED
NO ATTRIBUTE INHERITANCE - Each class has only its own attributes
"""

from typing import List, Dict, Any, Optional
from ..database import db
from ..models.lineage.hierarchy import (
    HierarchyTree, HierarchyNode, CreateSubclassRequest,
    UpdateClassRequest, HierarchyStatsResponse, Attribute
)
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
        Returns nested structure with parent-child relationships
        ✅ FIXED: Ensures name and display_name are always set with proper fallbacks
        """
        try:
            logger.info(f"📊 Building hierarchy tree for schema: {schema_id}")
            
            # Get all classes with their relationships
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS]->(child:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(inst:DataInstance)
            WITH c, 
                 collect(DISTINCT child.id) as child_ids,
                 count(DISTINCT inst) as instance_count
            RETURN c.id, c.name, c.display_name, c.level, c.parent_id, 
                   c.attributes, c.metadata, child_ids, instance_count
            ORDER BY c.level, c.name
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if not result.result_set:
                return HierarchyTree(
                    schema_id=schema_id,
                    root_nodes=[],
                    max_depth=0,
                    total_nodes=0,
                    metadata={}
                )
            
            # Build node map
            nodes_by_id = {}
            children_map = {}
            root_ids = []
            
            for row in result.result_set:
                node_id = row[0]
                name_raw = row[1]
                display_name_raw = row[2]
                level = row[3] if row[3] is not None else 0
                parent_id = row[4] if row[4] else None
                attributes_str = row[5]
                metadata_str = row[6]
                child_ids = row[7] or []
                instance_count = row[8]
                
                # ✅ CRITICAL FIX: Ensure name and display_name are never None/empty
                if display_name_raw and str(display_name_raw).strip():
                    final_display_name = str(display_name_raw).strip()
                    final_name = str(name_raw).strip() if name_raw else final_display_name
                elif name_raw and str(name_raw).strip():
                    final_name = str(name_raw).strip()
                    final_display_name = final_name
                else:
                    final_name = f"Class_{node_id[:8]}"
                    final_display_name = final_name
                    logger.warning(f"⚠️ Node {node_id} has no name, using fallback: {final_name}")
                
                # Parse attributes - ✅ ONLY THIS CLASS'S ATTRIBUTES
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
                
                # Determine node type
                node_type = 'subclass' if parent_id else 'class'
                
                nodes_by_id[node_id] = {
                    'id': node_id,
                    'name': final_name,
                    'display_name': final_display_name,
                    'type': node_type,
                    'level': level,
                    'parent_id': parent_id,
                    'attributes': attributes,
                    'instance_count': instance_count,
                    'collapsed': False,
                    'metadata': metadata
                }
                
                # Track children
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
            
            logger.info(f"✅ Built hierarchy tree: {len(nodes_by_id)} nodes, {len(root_nodes)} roots, depth: {max_depth}")
            
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
        ✅ FIXED: NO ATTRIBUTE INHERITANCE - only uses additional_attributes
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
            final_display_name = request.display_name if request.display_name else request.name
            
            # ✅ CRITICAL FIX: NO INHERITANCE - only use additional_attributes
            # Each class has ONLY its own attributes
            attributes = list(request.additional_attributes)  # Only the new attributes
            
            logger.info(f"   📝 Subclass will have {len(attributes)} attributes (NO inheritance)")
            
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
                metadata: $metadata
            })
            CREATE (s)-[:HAS_CLASS]->(c)
            CREATE (parent)-[:HAS_SUBCLASS]->(c)
            RETURN c
            """
            
            metadata = request.metadata or {}
            metadata['parent_class_id'] = request.parent_class_id
            metadata['parent_class_name'] = parent_name
            metadata['inherited_attributes'] = False  # Mark that we don't inherit
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
            
            logger.info(f"✅ Created subclass: {request.name} (level {child_level}, {len(attributes)} own attributes)")
            
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
                raise ValueError(f"Updated node not found: {class_id}")
            
            return updated_node
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Failed to update class: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def delete_class(schema_id: str, class_id: str):
        """Delete a class and all its subclasses"""
        try:
            # Delete class and all children recursively
            query = """
            MATCH (c:SchemaClass {id: $class_id})
            WHERE c.schema_id = $schema_id
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS*]->(child:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(inst:DataInstance)
            OPTIONAL MATCH (child)<-[:INSTANCE_OF]-(child_inst:DataInstance)
            DETACH DELETE c, child, inst, child_inst
            """
            
            db.execute_query(query, {'schema_id': schema_id, 'class_id': class_id})
            logger.info(f"✅ Deleted class and children: {class_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to delete class: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def get_hierarchy_stats(schema_id: str) -> HierarchyStatsResponse:
        """Get statistics about the class hierarchy"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[:HAS_SUBCLASS]->(child:SchemaClass)
            WITH c, count(DISTINCT child) as child_count
            WHERE c.parent_id IS NULL OR c.parent_id = ''
            RETURN 
                count(c) as root_classes,
                sum(child_count) as total_subclasses,
                max(c.level) as max_depth
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if result.result_set:
                row = result.result_set[0]
                return HierarchyStatsResponse(
                    schema_id=schema_id,
                    total_classes=row[0] + (row[1] or 0),
                    root_classes=row[0],
                    max_depth=row[2] or 0,
                    avg_children_per_class=0.0
                )
            
            return HierarchyStatsResponse(
                schema_id=schema_id,
                total_classes=0,
                root_classes=0,
                max_depth=0,
                avg_children_per_class=0.0
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get hierarchy stats: {str(e)}", exc_info=True)
            raise