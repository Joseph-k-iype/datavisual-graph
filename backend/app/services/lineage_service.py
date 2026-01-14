from typing import List, Dict, Any, Set, Tuple
from ..database import db
from ..models.schemas import (
    NodeType, LineageQuery, GraphNode, GraphEdge, 
    GraphResponse, LineagePathResponse
)
import logging

logger = logging.getLogger(__name__)


class LineageService:
    """Service for lineage and path-finding operations"""
    
    @staticmethod
    def get_full_lineage() -> GraphResponse:
        """Get complete lineage graph with all nodes and relationships"""
        try:
            query = """
            MATCH (n)
            WHERE n:Country OR n:Database OR n:Attribute
            OPTIONAL MATCH (n)-[r]->(m)
            WHERE m:Country OR m:Database OR m:Attribute
            RETURN n, labels(n)[0] as n_type, r, m, labels(m)[0] as m_type
            """
            
            result = db.execute_query(query)
            
            nodes_dict = {}
            edges = []
            
            if result.result_set:
                for row in result.result_set:
                    source_node = row[0]
                    source_type = row[1]
                    relationship = row[2]
                    target_node = row[3]
                    target_type = row[4]
                    
                    # Add source node
                    source_id = source_node.properties.get('id')
                    if source_id and source_id not in nodes_dict:
                        nodes_dict[source_id] = GraphNode(
                            id=source_id,
                            type=source_type,
                            data=dict(source_node.properties)
                        )
                    
                    # Add target node and edge if they exist
                    if target_node:
                        target_id = target_node.properties.get('id')
                        if target_id and target_id not in nodes_dict:
                            nodes_dict[target_id] = GraphNode(
                                id=target_id,
                                type=target_type,
                                data=dict(target_node.properties)
                            )
                        
                        if relationship and source_id and target_id:
                            edge_id = f"{source_id}_to_{target_id}"
                            edge_data = dict(relationship.properties) if hasattr(relationship, 'properties') else {}
                            
                            edges.append(GraphEdge(
                                id=edge_id,
                                source=source_id,
                                target=target_id,
                                type=relationship.relation,
                                data=edge_data
                            ))
            
            return GraphResponse(
                nodes=list(nodes_dict.values()),
                edges=edges
            )
            
        except Exception as e:
            logger.error(f"Failed to get full lineage: {str(e)}")
            raise
    
    @staticmethod
    def get_node_lineage(lineage_query: LineageQuery) -> GraphResponse:
        """Get lineage for a specific node with direction and depth"""
        try:
            direction_clause = ""
            if lineage_query.direction == "upstream":
                direction_clause = "<-[r*1.." + str(lineage_query.maxDepth) + "]-"
            elif lineage_query.direction == "downstream":
                direction_clause = "-[r*1.." + str(lineage_query.maxDepth) + "]->"
            else:  # both
                direction_clause = "-[r*1.." + str(lineage_query.maxDepth) + "]-"
            
            query = f"""
            MATCH (start:{lineage_query.nodeType.value} {{id: $node_id}})
            MATCH path = (start){direction_clause}(end)
            WHERE end:Country OR end:Database OR end:Attribute
            WITH nodes(path) as path_nodes, relationships(path) as path_rels
            UNWIND path_nodes as n
            WITH collect(DISTINCT n) as all_nodes, path_rels
            UNWIND path_rels as r
            WITH all_nodes, collect(DISTINCT r) as all_rels
            RETURN all_nodes, all_rels
            """
            
            result = db.execute_query(query, {"node_id": lineage_query.nodeId})
            
            nodes_dict = {}
            edges = []
            
            if result.result_set and len(result.result_set) > 0:
                all_nodes = result.result_set[0][0]
                all_rels = result.result_set[0][1]
                
                # Process nodes
                for node in all_nodes:
                    node_id = node.properties.get('id')
                    node_labels = node.labels
                    node_type = node_labels[0] if node_labels else "Unknown"
                    
                    if node_id:
                        nodes_dict[node_id] = GraphNode(
                            id=node_id,
                            type=node_type,
                            data=dict(node.properties)
                        )
                
                # Process relationships
                for rel in all_rels:
                    # Get source and target from relationship
                    source_id = rel.src_node
                    target_id = rel.dest_node
                    
                    edge_id = f"{source_id}_to_{target_id}"
                    edge_data = dict(rel.properties) if hasattr(rel, 'properties') else {}
                    
                    # Filter by data categories if specified
                    if lineage_query.dataCategories:
                        edge_categories = edge_data.get('dataCategories', [])
                        if not any(cat in edge_categories for cat in lineage_query.dataCategories):
                            continue
                    
                    edges.append(GraphEdge(
                        id=edge_id,
                        source=str(source_id),
                        target=str(target_id),
                        type=rel.relation,
                        data=edge_data
                    ))
            
            return GraphResponse(
                nodes=list(nodes_dict.values()),
                edges=edges
            )
            
        except Exception as e:
            logger.error(f"Failed to get node lineage: {str(e)}")
            raise
    
    @staticmethod
    def find_paths(source_id: str, target_id: str, max_depth: int = 5) -> LineagePathResponse:
        """Find all paths between two nodes"""
        try:
            query = f"""
            MATCH (source {{id: $source_id}})
            MATCH (target {{id: $target_id}})
            MATCH path = (source)-[*1..{max_depth}]->(target)
            RETURN path
            LIMIT 100
            """
            
            result = db.execute_query(query, {
                "source_id": source_id,
                "target_id": target_id
            })
            
            paths = []
            nodes_dict = {}
            edges = []
            
            if result.result_set:
                for row in result.result_set:
                    path = row[0]
                    path_nodes = path.nodes()
                    path_rels = path.relationships()
                    
                    # Extract path as list of node IDs
                    path_ids = [node.properties.get('id') for node in path_nodes]
                    paths.append(path_ids)
                    
                    # Collect all nodes
                    for node in path_nodes:
                        node_id = node.properties.get('id')
                        node_labels = node.labels
                        node_type = node_labels[0] if node_labels else "Unknown"
                        
                        if node_id and node_id not in nodes_dict:
                            nodes_dict[node_id] = GraphNode(
                                id=node_id,
                                type=node_type,
                                data=dict(node.properties)
                            )
                    
                    # Collect all edges
                    for rel in path_rels:
                        source_id_rel = rel.src_node
                        target_id_rel = rel.dest_node
                        edge_id = f"{source_id_rel}_to_{target_id_rel}"
                        
                        # Check if edge already exists
                        if not any(e.id == edge_id for e in edges):
                            edge_data = dict(rel.properties) if hasattr(rel, 'properties') else {}
                            edges.append(GraphEdge(
                                id=edge_id,
                                source=str(source_id_rel),
                                target=str(target_id_rel),
                                type=rel.relation,
                                data=edge_data
                            ))
            
            return LineagePathResponse(
                paths=paths,
                nodes=list(nodes_dict.values()),
                edges=edges
            )
            
        except Exception as e:
            logger.error(f"Failed to find paths: {str(e)}")
            raise
    
    @staticmethod
    def get_hierarchical_lineage() -> Dict[str, Any]:
        """Get lineage organized by hierarchy: Country -> Database -> Attribute"""
        try:
            # Get all countries with their databases
            query = """
            MATCH (c:Country)
            OPTIONAL MATCH (c)<-[:LOCATED_IN]-(d:Database)
            OPTIONAL MATCH (d)<-[:BELONGS_TO]-(a:Attribute)
            RETURN c, collect(DISTINCT d) as databases, collect(DISTINCT a) as attributes
            """
            
            result = db.execute_query(query)
            
            hierarchy = []
            
            if result.result_set:
                for row in result.result_set:
                    country = row[0]
                    databases = row[1]
                    
                    country_data = {
                        "id": country.properties.get('id'),
                        "type": "Country",
                        "data": dict(country.properties),
                        "children": []
                    }
                    
                    # Process databases
                    for db_node in databases:
                        if db_node and hasattr(db_node, 'properties'):
                            db_id = db_node.properties.get('id')
                            
                            # Get attributes for this database
                            attr_query = """
                            MATCH (d:Database {id: $db_id})<-[:BELONGS_TO]-(a:Attribute)
                            RETURN a
                            """
                            attr_result = db.execute_query(attr_query, {"db_id": db_id})
                            
                            db_data = {
                                "id": db_id,
                                "type": "Database",
                                "data": dict(db_node.properties),
                                "children": []
                            }
                            
                            if attr_result.result_set:
                                for attr_row in attr_result.result_set:
                                    attr = attr_row[0]
                                    db_data["children"].append({
                                        "id": attr.properties.get('id'),
                                        "type": "Attribute",
                                        "data": dict(attr.properties),
                                        "children": []
                                    })
                            
                            country_data["children"].append(db_data)
                    
                    hierarchy.append(country_data)
            
            return {"hierarchy": hierarchy}
            
        except Exception as e:
            logger.error(f"Failed to get hierarchical lineage: {str(e)}")
            raise