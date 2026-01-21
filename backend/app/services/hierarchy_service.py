# backend/app/services/hierarchy_service.py
"""
Hierarchy Service - Handles class hierarchy operations
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
        Builds tree from SUBCLASS_OF relationships
        """
        try:
            logger.info(f"📊 Getting hierarchy tree for schema: {schema_id}")
            
            # Get all classes with their parent relationships
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[:SUBCLASS_OF]->(parent:SchemaClass)
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
                    instance_count = row[7] if row[7] else 0
                    
                    # Parse attributes
                    attributes = []
                    if attributes_str:
                        try:
                            if isinstance(attributes_str, str):
                                attrs_data = json.loads(attributes_str)
                            else:
                                attrs_data = attributes_str
                            
                            if isinstance(attrs_data, list):
                                attributes = [
                                    Attribute(
                                        id=attr.get('id', str(uuid.uuid4())),
                                        name=attr.get('name', ''),
                                        data_type=attr.get('data_type', 'string'),
                                        is_primary_key=attr.get('is_primary_key', False),
                                        is_foreign_key=attr.get('is_foreign_key', False),
                                        is_nullable=attr.get('is_nullable', True),
                                        metadata=attr.get('metadata', {})
                                    )
                                    for attr in attrs_data
                                ]
                        except Exception as e:
                            logger.warning(f"Failed to parse attributes for {node_id}: {e}")
                    
                    # Parse metadata
                    metadata = {}
                    if metadata_str:
                        try:
                            if isinstance(metadata_str, str):
                                metadata = json.loads(metadata_str)
                            else:
                                metadata = metadata_str
                        except:
                            pass
                    
                    # Store node data
                    nodes_by_id[node_id] = {
                        'id': node_id,
                        'name': node_name,
                        'display_name': display_name or node_name,
                        'type': 'subclass' if parent_id else 'class',
                        'level': level,
                        'parent_id': parent_id,
                        'attributes': attributes,
                        'instance_count': instance_count,
                        'metadata': metadata,
                        'children': []
                    }
                    
                    # Build parent-child map
                    if parent_id:
                        if parent_id not in children_map:
                            children_map[parent_id] = []
                        children_map[parent_id].append(node_id)
                    else:
                        root_ids.append(node_id)
            
            # Build hierarchy tree recursively
            def build_hierarchy_node(node_id: str) -> HierarchyNode:
                node_data = nodes_by_id[node_id]
                
                # Get children
                child_ids = children_map.get(node_id, [])
                children = [build_hierarchy_node(child_id) for child_id in child_ids]
                
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
                    collapsed=False,
                    metadata=node_data['metadata']
                )
            
            # Build root nodes
            root_nodes = [build_hierarchy_node(root_id) for root_id in root_ids]
            
            # Calculate max depth
            def get_max_depth(node: HierarchyNode) -> int:
                if not node.children:
                    return node.level
                return max(get_max_depth(child) for child in node.children)
            
            max_depth = max([get_max_depth(node) for node in root_nodes], default=0) if root_nodes else 0
            
            # Count total nodes
            def count_nodes(node: HierarchyNode) -> int:
                return 1 + sum(count_nodes(child) for child in node.children)
            
            total_nodes = sum(count_nodes(node) for node in root_nodes)
            
            logger.info(f"✅ Built hierarchy tree: {len(root_nodes)} roots, {total_nodes} total nodes, max depth {max_depth}")
            
            return HierarchyTree(
                schema_id=schema_id,
                root_nodes=root_nodes,
                max_depth=max_depth + 1,
                total_nodes=total_nodes,
                metadata={}
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get hierarchy tree: {str(e)}")
            raise
    
    @staticmethod
    def create_subclass(schema_id: str, request: CreateSubclassRequest) -> HierarchyNode:
        """
        Create a subclass under a parent class
        Creates SUBCLASS_OF relationship in FalkorDB
        """
        try:
            # Verify parent exists
            parent_query = """
            MATCH (parent:SchemaClass {id: $parent_id})
            RETURN parent.level as parent_level, parent.name as parent_name
            """
            
            parent_result = db.execute_query(parent_query, {'parent_id': request.parent_class_id})
            
            if not parent_result.result_set:
                raise ValueError(f"Parent class not found: {request.parent_class_id}")
            
            parent_level = parent_result.result_set[0][0] if parent_result.result_set[0][0] is not None else 0
            parent_name = parent_result.result_set[0][1]
            
            # Generate subclass ID
            subclass_id = str(uuid.uuid4())
            subclass_level = parent_level + 1
            
            # Get parent attributes if inheriting
            attributes = list(request.additional_attributes)
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
                            attributes.insert(0, Attribute(**attr))
            
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
                attributes: $attributes,
                metadata: $metadata
            })
            CREATE (s)-[:HAS_CLASS]->(c)
            CREATE (c)-[:SUBCLASS_OF]->(parent)
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
            
            db.execute_query(create_query, {
                'schema_id': schema_id,
                'parent_id': request.parent_class_id,
                'class_id': subclass_id,
                'name': request.name,
                'display_name': request.display_name or request.name,
                'level': subclass_level,
                'attributes': json.dumps(attributes_data),
                'metadata': json.dumps(metadata)
            })
            
            logger.info(f"✅ Created subclass: {request.name} under {parent_name}")
            
            return HierarchyNode(
                id=subclass_id,
                name=request.name,
                display_name=request.display_name or request.name,
                type='subclass',
                level=subclass_level,
                parent_id=request.parent_class_id,
                children=[],
                attributes=attributes,
                instance_count=0,
                collapsed=False,
                metadata=metadata
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to create subclass: {str(e)}")
            raise
    
    @staticmethod
    def get_hierarchy_stats(schema_id: str) -> HierarchyStatsResponse:
        """Get hierarchy statistics"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[:SUBCLASS_OF]->(parent)
            WITH c, parent
            RETURN count(DISTINCT c) as total_classes,
                   count(DISTINCT CASE WHEN parent IS NOT NULL THEN c END) as total_subclasses,
                   max(c.level) as max_depth,
                   count(DISTINCT CASE WHEN parent IS NULL THEN c END) as root_classes,
                   c.level as level
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if result.result_set:
                row = result.result_set[0]
                total_classes = row[0]
                total_subclasses = row[1]
                max_depth = row[2] if row[2] is not None else 0
                root_classes = row[3]
                
                # Count classes by level
                level_query = """
                MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
                RETURN c.level as level, count(c) as count
                ORDER BY level
                """
                level_result = db.execute_query(level_query, {'schema_id': schema_id})
                
                classes_by_level = {}
                if level_result.result_set:
                    for row in level_result.result_set:
                        level = row[0] if row[0] is not None else 0
                        count = row[1]
                        classes_by_level[level] = count
                
                # Count leaf classes (no children)
                leaf_query = """
                MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
                WHERE NOT (c)<-[:SUBCLASS_OF]-()
                RETURN count(c)
                """
                leaf_result = db.execute_query(leaf_query, {'schema_id': schema_id})
                leaf_classes = leaf_result.result_set[0][0] if leaf_result.result_set else 0
                
                avg_children = (total_subclasses / (total_classes - leaf_classes)) if (total_classes - leaf_classes) > 0 else 0
                
                return HierarchyStatsResponse(
                    schema_id=schema_id,
                    total_classes=total_classes,
                    total_subclasses=total_subclasses,
                    max_depth=max_depth + 1,
                    root_classes=root_classes,
                    leaf_classes=leaf_classes,
                    avg_children_per_class=round(avg_children, 2),
                    classes_by_level=classes_by_level
                )
            
            return HierarchyStatsResponse(
                schema_id=schema_id,
                total_classes=0,
                total_subclasses=0,
                max_depth=0,
                root_classes=0,
                leaf_classes=0,
                avg_children_per_class=0.0,
                classes_by_level={}
            )
            
        except Exception as e:
            logger.error(f"❌ Failed to get hierarchy stats: {str(e)}")
            raise