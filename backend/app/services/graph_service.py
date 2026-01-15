from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    NodeType, NodeCreate, NodeUpdate, RelationshipCreate,
    GraphNode, GraphEdge, NodeResponse, StatsResponse
)
import logging
import uuid

logger = logging.getLogger(__name__)


class GraphService:
    """Service for graph operations"""
    
    @staticmethod
    def create_node(node_data: NodeCreate) -> NodeResponse:
        """Create a new node in the graph"""
        try:
            # Generate UUID for the node if not provided
            node_id = node_data.properties.get('id', str(uuid.uuid4()))
            
            # Build properties string - ensure id is included
            props = []
            params = {'node_id': node_id}
            
            # Add id to properties
            props.append("id: $node_id")
            
            # Add other properties
            for key, value in node_data.properties.items():
                if key != 'id':  # Skip id as we already added it
                    param_key = f"prop_{key}"
                    params[param_key] = value
                    props.append(f"{key}: ${param_key}")
            
            props_str = "{" + ", ".join(props) + "}"
            
            query = f"""
            CREATE (n:{node_data.nodeType.value} {props_str})
            RETURN n
            """
            
            result = db.execute_query(query, params)
            
            if result.result_set and len(result.result_set) > 0:
                node = result.result_set[0][0]
                return NodeResponse(
                    id=node.properties.get('id'),
                    type=node_data.nodeType.value,
                    properties=dict(node.properties)
                )
            
            raise Exception("Node creation failed")
            
        except Exception as e:
            logger.error(f"Failed to create node: {str(e)}")
            raise
    
    @staticmethod
    def get_node(node_id: str, node_type: NodeType) -> Optional[NodeResponse]:
        """Get a node by ID and type"""
        try:
            query = f"""
            MATCH (n:{node_type.value} {{id: $node_id}})
            RETURN n
            """
            
            result = db.execute_query(query, {"node_id": node_id})
            
            if result.result_set and len(result.result_set) > 0:
                node = result.result_set[0][0]
                return NodeResponse(
                    id=node.properties.get('id'),
                    type=node_type.value,
                    properties=dict(node.properties)
                )
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get node: {str(e)}")
            raise
    
    @staticmethod
    def update_node(node_id: str, node_type: NodeType, update_data: NodeUpdate) -> NodeResponse:
        """Update a node's properties"""
        try:
            # Build SET clause
            set_clauses = []
            params = {"node_id": node_id}
            
            for key, value in update_data.properties.items():
                if key != 'id':  # Don't allow updating the id
                    param_key = f"prop_{key}"
                    params[param_key] = value
                    set_clauses.append(f"n.{key} = ${param_key}")
            
            if not set_clauses:
                raise Exception("No properties to update")
            
            set_str = ", ".join(set_clauses)
            
            query = f"""
            MATCH (n:{node_type.value} {{id: $node_id}})
            SET {set_str}
            RETURN n
            """
            
            result = db.execute_query(query, params)
            
            if result.result_set and len(result.result_set) > 0:
                node = result.result_set[0][0]
                return NodeResponse(
                    id=node.properties.get('id'),
                    type=node_type.value,
                    properties=dict(node.properties)
                )
            
            raise Exception("Node update failed")
            
        except Exception as e:
            logger.error(f"Failed to update node: {str(e)}")
            raise
    
    @staticmethod
    def delete_node(node_id: str, node_type: NodeType) -> bool:
        """Delete a node and its relationships"""
        try:
            query = f"""
            MATCH (n:{node_type.value} {{id: $node_id}})
            DETACH DELETE n
            RETURN count(n) as deleted
            """
            
            result = db.execute_query(query, {"node_id": node_id})
            
            if result.result_set and len(result.result_set) > 0:
                deleted_count = result.result_set[0][0]
                return deleted_count > 0
            
            return False
            
        except Exception as e:
            logger.error(f"Failed to delete node: {str(e)}")
            raise
    
    @staticmethod
    def get_all_nodes(node_type: Optional[NodeType] = None) -> List[NodeResponse]:
        """Get all nodes, optionally filtered by type"""
        try:
            if node_type:
                query = f"""
                MATCH (n:{node_type.value})
                RETURN n, labels(n)[0] as type
                """
            else:
                query = """
                MATCH (n)
                WHERE n:Country OR n:Database OR n:Attribute
                RETURN n, labels(n)[0] as type
                """
            
            result = db.execute_query(query)
            
            nodes = []
            if result.result_set:
                for row in result.result_set:
                    node = row[0]
                    node_type_str = row[1]
                    nodes.append(NodeResponse(
                        id=node.properties.get('id'),
                        type=node_type_str,
                        properties=dict(node.properties)
                    ))
            
            return nodes
            
        except Exception as e:
            logger.error(f"Failed to get nodes: {str(e)}")
            raise
    
    # ========== NEW: GROUP MANAGEMENT ==========
    
    @staticmethod
    def update_node_groups(node_ids: List[str], group_name: str) -> List[NodeResponse]:
        """Update the 'group' property for multiple nodes"""
        try:
            query = """
            MATCH (n)
            WHERE n.id IN $node_ids
            SET n.group = $group_name
            RETURN n, labels(n)[0] as type
            """
            
            result = db.execute_query(query, {
                "node_ids": node_ids,
                "group_name": group_name
            })
            
            updated_nodes = []
            if result.result_set:
                for row in result.result_set:
                    node = row[0]
                    node_type_str = row[1]
                    updated_nodes.append(NodeResponse(
                        id=node.properties.get('id'),
                        type=node_type_str,
                        properties=dict(node.properties)
                    ))
            
            return updated_nodes
            
        except Exception as e:
            logger.error(f"Failed to update node groups: {str(e)}")
            raise
    
    @staticmethod
    def remove_node_groups(node_ids: List[str]) -> List[NodeResponse]:
        """Remove the 'group' property from multiple nodes"""
        try:
            query = """
            MATCH (n)
            WHERE n.id IN $node_ids
            REMOVE n.group
            RETURN n, labels(n)[0] as type
            """
            
            result = db.execute_query(query, {"node_ids": node_ids})
            
            updated_nodes = []
            if result.result_set:
                for row in result.result_set:
                    node = row[0]
                    node_type_str = row[1]
                    updated_nodes.append(NodeResponse(
                        id=node.properties.get('id'),
                        type=node_type_str,
                        properties=dict(node.properties)
                    ))
            
            return updated_nodes
            
        except Exception as e:
            logger.error(f"Failed to remove node groups: {str(e)}")
            raise
    
    @staticmethod
    def get_nodes_by_group(group_name: str) -> List[NodeResponse]:
        """Get all nodes in a specific group"""
        try:
            query = """
            MATCH (n)
            WHERE n.group = $group_name
            RETURN n, labels(n)[0] as type
            """
            
            result = db.execute_query(query, {"group_name": group_name})
            
            nodes = []
            if result.result_set:
                for row in result.result_set:
                    node = row[0]
                    node_type_str = row[1]
                    nodes.append(NodeResponse(
                        id=node.properties.get('id'),
                        type=node_type_str,
                        properties=dict(node.properties)
                    ))
            
            return nodes
            
        except Exception as e:
            logger.error(f"Failed to get nodes by group: {str(e)}")
            raise
    
    @staticmethod
    def get_all_groups() -> List[str]:
        """Get all unique group names"""
        try:
            query = """
            MATCH (n)
            WHERE n.group IS NOT NULL
            RETURN DISTINCT n.group as group_name
            """
            
            result = db.execute_query(query)
            
            groups = []
            if result.result_set:
                for row in result.result_set:
                    groups.append(row[0])
            
            return groups
            
        except Exception as e:
            logger.error(f"Failed to get all groups: {str(e)}")
            raise
    
    @staticmethod
    def create_relationship(rel_data: RelationshipCreate) -> Dict[str, Any]:
        """Create a relationship between two nodes"""
        try:
            # Build properties string
            props = []
            params = {
                "source_id": rel_data.sourceId,
                "target_id": rel_data.targetId
            }
            
            for key, value in rel_data.properties.items():
                param_key = f"prop_{key}"
                params[param_key] = value
                props.append(f"{key}: ${param_key}")
            
            props_str = "{" + ", ".join(props) + "}" if props else ""
            
            query = f"""
            MATCH (source:{rel_data.sourceType.value} {{id: $source_id}})
            MATCH (target:{rel_data.targetType.value} {{id: $target_id}})
            CREATE (source)-[r:{rel_data.relationshipType} {props_str}]->(target)
            RETURN source, r, target
            """
            
            result = db.execute_query(query, params)
            
            if result.result_set and len(result.result_set) > 0:
                return {
                    "source": rel_data.sourceId,
                    "target": rel_data.targetId,
                    "type": rel_data.relationshipType
                }
            
            raise Exception("Relationship creation failed")
            
        except Exception as e:
            logger.error(f"Failed to create relationship: {str(e)}")
            raise