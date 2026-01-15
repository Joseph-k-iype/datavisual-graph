from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any
from ..models.schemas import (
    LineageQuery, GraphResponse, LineagePathResponse,
    GraphNode, GraphEdge, NodeType
)
from ..database import db
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lineage", tags=["lineage"])


@router.get("/full", response_model=GraphResponse, status_code=status.HTTP_200_OK)
async def get_full_lineage():
    """Get the complete lineage graph with all nodes and relationships"""
    try:
        # Get all nodes
        nodes_query = """
        MATCH (n)
        WHERE n:Country OR n:Database OR n:Attribute
        RETURN n, labels(n)[0] as type
        """
        
        nodes_result = db.execute_query(nodes_query)
        
        nodes = []
        if nodes_result.result_set:
            for row in nodes_result.result_set:
                node = row[0]
                node_type = row[1]
                
                # Convert node properties to dict
                props = dict(node.properties)
                
                nodes.append(GraphNode(
                    id=props.get('id', ''),
                    type=node_type,
                    data=props,
                    position=None  # Let frontend handle positioning
                ))
        
        # Get all relationships
        edges_query = """
        MATCH (source)-[r]->(target)
        WHERE (source:Country OR source:Database OR source:Attribute)
        AND (target:Country OR target:Database OR target:Attribute)
        RETURN source.id as source_id, target.id as target_id, 
               type(r) as rel_type, properties(r) as rel_props
        """
        
        edges_result = db.execute_query(edges_query)
        
        edges = []
        if edges_result.result_set:
            for idx, row in enumerate(edges_result.result_set):
                source_id = row[0]
                target_id = row[1]
                rel_type = row[2]
                rel_props = dict(row[3]) if row[3] else {}
                
                edges.append(GraphEdge(
                    id=f"{source_id}-{target_id}-{idx}",
                    source=source_id,
                    target=target_id,
                    type=rel_type,
                    data=rel_props
                ))
        
        return GraphResponse(nodes=nodes, edges=edges)
        
    except Exception as e:
        logger.error(f"Failed to get full lineage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get full lineage: {str(e)}"
        )


@router.post("/query", response_model=LineagePathResponse, status_code=status.HTTP_200_OK)
async def query_lineage(query: LineageQuery):
    """Query lineage paths for a specific node"""
    try:
        # Build direction clause
        if query.direction == "upstream":
            direction_clause = "<-[*1..{}]-".format(query.maxDepth)
        elif query.direction == "downstream":
            direction_clause = "-[*1..{}]->".format(query.maxDepth)
        else:  # both
            direction_clause = "-[*1..{}]-".format(query.maxDepth)
        
        # Build query
        cypher_query = f"""
        MATCH path = (start:{query.nodeType.value} {{id: $node_id}}){direction_clause}(end)
        WHERE end:Country OR end:Database OR end:Attribute
        RETURN path
        LIMIT 100
        """
        
        result = db.execute_query(cypher_query, {"node_id": query.nodeId})
        
        paths = []
        all_nodes = {}
        all_edges = {}
        
        if result.result_set:
            for row in result.result_set:
                path = row[0]
                path_ids = []
                
                # Extract nodes and edges from path
                for i, node in enumerate(path.nodes()):
                    node_id = node.properties.get('id')
                    path_ids.append(node_id)
                    
                    if node_id not in all_nodes:
                        node_type = list(node.labels)[0]
                        all_nodes[node_id] = GraphNode(
                            id=node_id,
                            type=node_type,
                            data=dict(node.properties),
                            position=None
                        )
                
                # Extract edges
                for i, rel in enumerate(path.relationships()):
                    edge_id = f"{rel.src_node}-{rel.dest_node}-{i}"
                    if edge_id not in all_edges:
                        all_edges[edge_id] = GraphEdge(
                            id=edge_id,
                            source=str(rel.src_node),
                            target=str(rel.dest_node),
                            type=rel.relation,
                            data=dict(rel.properties) if rel.properties else {}
                        )
                
                paths.append(path_ids)
        
        return LineagePathResponse(
            paths=paths,
            nodes=list(all_nodes.values()),
            edges=list(all_edges.values())
        )
        
    except Exception as e:
        logger.error(f"Failed to query lineage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to query lineage: {str(e)}"
        )


@router.get("/node/{node_type}/{node_id}", response_model=GraphResponse)
async def get_node_lineage(node_type: NodeType, node_id: str):
    """Get immediate lineage (one hop) for a specific node"""
    try:
        query = f"""
        MATCH (center:{node_type.value} {{id: $node_id}})
        OPTIONAL MATCH (center)-[r1]-(connected)
        WHERE connected:Country OR connected:Database OR connected:Attribute
        RETURN center, collect(distinct connected) as connected_nodes, 
               collect(distinct r1) as relationships
        """
        
        result = db.execute_query(query, {"node_id": node_id})
        
        nodes = []
        edges = []
        
        if result.result_set and len(result.result_set) > 0:
            row = result.result_set[0]
            center_node = row[0]
            connected_nodes = row[1]
            relationships = row[2]
            
            # Add center node
            center_props = dict(center_node.properties)
            nodes.append(GraphNode(
                id=center_props.get('id', ''),
                type=node_type.value,
                data=center_props,
                position=None
            ))
            
            # Add connected nodes
            for node in connected_nodes:
                if node:
                    node_props = dict(node.properties)
                    node_labels = list(node.labels)
                    nodes.append(GraphNode(
                        id=node_props.get('id', ''),
                        type=node_labels[0] if node_labels else 'Unknown',
                        data=node_props,
                        position=None
                    ))
            
            # Add relationships
            for idx, rel in enumerate(relationships):
                if rel:
                    rel_props = dict(rel.properties) if rel.properties else {}
                    edges.append(GraphEdge(
                        id=f"{rel.src_node}-{rel.dest_node}-{idx}",
                        source=str(rel.src_node),
                        target=str(rel.dest_node),
                        type=rel.relation,
                        data=rel_props
                    ))
        
        return GraphResponse(nodes=nodes, edges=edges)
        
    except Exception as e:
        logger.error(f"Failed to get node lineage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get node lineage: {str(e)}"
        )