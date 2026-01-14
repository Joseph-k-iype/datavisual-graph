from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    NodeType, NodeCreate, NodeUpdate, RelationshipCreate,
    GraphNode, GraphEdge, NodeResponse, StatsResponse
)
import logging

logger = logging.getLogger(__name__)


class GraphService:
    """Service for graph operations"""
    
    @staticmethod
    def create_node(node_data: NodeCreate) -> NodeResponse:
        """Create a new node in the graph"""
        try:
            # Build properties string
            props = []
            params = {}
            for key, value in node_data.properties.items():
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
                param_key = f"prop_{key}"
                params[param_key] = value
                set_clauses.append(f"n.{key} = ${param_key}")
            
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
            RETURN r, source.id as source_id, target.id as target_id
            """
            
            result = db.execute_query(query, params)
            
            if result.result_set and len(result.result_set) > 0:
                rel = result.result_set[0][0]
                return {
                    "type": rel_data.relationshipType,
                    "source": rel_data.sourceId,
                    "target": rel_data.targetId,
                    "properties": dict(rel.properties) if hasattr(rel, 'properties') else {}
                }
            
            raise Exception("Relationship creation failed")
            
        except Exception as e:
            logger.error(f"Failed to create relationship: {str(e)}")
            raise
    
    @staticmethod
    def get_stats() -> StatsResponse:
        """Get graph statistics"""
        try:
            query = """
            MATCH (c:Country)
            WITH count(c) as countries
            MATCH (d:Database)
            WITH countries, count(d) as databases
            MATCH (a:Attribute)
            RETURN countries, databases, count(a) as attributes
            """
            
            result = db.execute_query(query)
            
            countries = 0
            databases = 0
            attributes = 0
            
            if result.result_set and len(result.result_set) > 0:
                row = result.result_set[0]
                countries = row[0]
                databases = row[1]
                attributes = row[2]
            
            # Get transfers count
            transfers_query = "MATCH ()-[r:TRANSFERS_TO]->() RETURN count(r) as transfers"
            transfers_result = db.execute_query(transfers_query)
            transfers = transfers_result.result_set[0][0] if transfers_result.result_set else 0
            
            # Get unique data categories
            categories_query = """
            MATCH ()-[r:TRANSFERS_TO]->()
            WHERE r.dataCategories IS NOT NULL
            RETURN DISTINCT r.dataCategories
            """
            categories_result = db.execute_query(categories_query)
            categories = set()
            if categories_result.result_set:
                for row in categories_result.result_set:
                    if row[0]:
                        categories.update(row[0])
            
            # Get unique regions
            regions_query = "MATCH (c:Country) RETURN DISTINCT c.region"
            regions_result = db.execute_query(regions_query)
            regions = [row[0] for row in regions_result.result_set] if regions_result.result_set else []
            
            return StatsResponse(
                totalCountries=countries,
                totalDatabases=databases,
                totalAttributes=attributes,
                totalTransfers=transfers,
                dataCategories=list(categories),
                regions=regions
            )
            
        except Exception as e:
            logger.error(f"Failed to get stats: {str(e)}")
            raise