# backend/app/services/schema_service.py
"""
Schema Service - Manages schema definitions and data instances
"""

import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    SchemaDefinition, SchemaClass, SchemaRelationship,
    DataInstance, DataRelationship, SchemaCreateRequest,
    LineageNode, LineageEdge, LineageGraphResponse,
    LineagePathResponse, SchemaStats, Cardinality
)
import logging

logger = logging.getLogger(__name__)


class SchemaService:
    """Service for managing schemas and data instances"""
    
    @staticmethod
    def create_schema(request: SchemaCreateRequest) -> SchemaDefinition:
        """Create a new schema"""
        try:
            schema_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat()
            
            schema = SchemaDefinition(
                id=schema_id,
                name=request.name,
                description=request.description,
                classes=request.classes,
                relationships=request.relationships,
                created_at=timestamp,
                updated_at=timestamp
            )
            
            # Store schema in FalkorDB
            # Create schema node
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
                'id': schema.id,
                'name': schema.name,
                'description': schema.description or '',
                'version': schema.version,
                'created_at': schema.created_at,
                'updated_at': schema.updated_at
            })
            
            # Create class nodes
            for cls in schema.classes:
                class_query = """
                MATCH (s:Schema {id: $schema_id})
                CREATE (c:SchemaClass {
                    id: $id,
                    name: $name,
                    description: $description,
                    attributes: $attributes,
                    color: $color,
                    icon: $icon,
                    schema_id: $schema_id
                })
                CREATE (s)-[:HAS_CLASS]->(c)
                RETURN c
                """
                
                db.execute_query(class_query, {
                    'schema_id': schema.id,
                    'id': cls.id,
                    'name': cls.name,
                    'description': cls.description or '',
                    'attributes': json.dumps(cls.attributes),
                    'color': cls.color or '#6B7280',
                    'icon': cls.icon or 'Box'
                })
            
            # Create relationship edges
            for rel in schema.relationships:
                rel_query = """
                MATCH (source:SchemaClass {id: $source_id, schema_id: $schema_id})
                MATCH (target:SchemaClass {id: $target_id, schema_id: $schema_id})
                CREATE (source)-[r:SCHEMA_REL {
                    id: $id,
                    name: $name,
                    cardinality: $cardinality,
                    description: $description,
                    bidirectional: $bidirectional
                }]->(target)
                RETURN r
                """
                
                db.execute_query(rel_query, {
                    'schema_id': schema.id,
                    'id': rel.id,
                    'name': rel.name,
                    'source_id': rel.source_class_id,
                    'target_id': rel.target_class_id,
                    'cardinality': rel.cardinality.value,
                    'description': rel.description or '',
                    'bidirectional': rel.bidirectional
                })
            
            logger.info(f"Created schema: {schema.name} (ID: {schema.id})")
            return schema
            
        except Exception as e:
            logger.error(f"Failed to create schema: {str(e)}")
            raise
    
    @staticmethod
    def get_schema(schema_id: str) -> Optional[SchemaDefinition]:
        """Get schema by ID"""
        try:
            # Get schema node
            schema_query = """
            MATCH (s:Schema {id: $schema_id})
            RETURN s
            """
            
            result = db.execute_query(schema_query, {'schema_id': schema_id})
            
            if not result.result_set:
                return None
            
            schema_node = result.result_set[0][0]
            schema_props = dict(schema_node.properties)
            
            # Get classes
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            classes = []
            
            if classes_result.result_set:
                for row in classes_result.result_set:
                    cls_props = dict(row[0].properties)
                    classes.append(SchemaClass(
                        id=cls_props['id'],
                        name=cls_props['name'],
                        description=cls_props.get('description'),
                        attributes=json.loads(cls_props.get('attributes', '[]')),
                        color=cls_props.get('color'),
                        icon=cls_props.get('icon')
                    ))
            
            # Get relationships
            rels_query = """
            MATCH (s:SchemaClass {schema_id: $schema_id})-[r:SCHEMA_REL]->(t:SchemaClass {schema_id: $schema_id})
            RETURN s.id, t.id, r
            """
            
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            relationships = []
            
            if rels_result.result_set:
                for row in rels_result.result_set:
                    source_id = row[0]
                    target_id = row[1]
                    rel_props = dict(row[2].properties)
                    
                    relationships.append(SchemaRelationship(
                        id=rel_props['id'],
                        name=rel_props['name'],
                        source_class_id=source_id,
                        target_class_id=target_id,
                        cardinality=Cardinality(rel_props['cardinality']),
                        description=rel_props.get('description'),
                        bidirectional=rel_props.get('bidirectional', False)
                    ))
            
            return SchemaDefinition(
                id=schema_props['id'],
                name=schema_props['name'],
                description=schema_props.get('description'),
                version=schema_props.get('version', '1.0.0'),
                classes=classes,
                relationships=relationships,
                created_at=schema_props.get('created_at'),
                updated_at=schema_props.get('updated_at')
            )
            
        except Exception as e:
            logger.error(f"Failed to get schema: {str(e)}")
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas"""
        try:
            query = """
            MATCH (s:Schema)
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            WITH s, COUNT(c) as class_count
            RETURN s, class_count
            ORDER BY s.created_at DESC
            """
            
            result = db.execute_query(query)
            schemas = []
            
            if result.result_set:
                for row in result.result_set:
                    props = dict(row[0].properties)
                    class_count = row[1]
                    
                    schemas.append({
                        'id': props['id'],
                        'name': props['name'],
                        'description': props.get('description'),
                        'version': props.get('version', '1.0.0'),
                        'class_count': class_count,
                        'created_at': props.get('created_at'),
                        'updated_at': props.get('updated_at')
                    })
            
            return schemas
            
        except Exception as e:
            logger.error(f"Failed to list schemas: {str(e)}")
            raise
    
    @staticmethod
    def delete_schema(schema_id: str) -> bool:
        """Delete a schema and all associated data"""
        try:
            # Delete all data instances
            delete_instances_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)<-[:INSTANCE_OF]-(i:DataInstance)
            DETACH DELETE i
            """
            db.execute_query(delete_instances_query, {'schema_id': schema_id})
            
            # Delete schema classes and relationships
            delete_schema_query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            DETACH DELETE s, c
            """
            db.execute_query(delete_schema_query, {'schema_id': schema_id})
            
            logger.info(f"Deleted schema: {schema_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete schema: {str(e)}")
            raise
    
    @staticmethod
    def create_data_instance(instance: DataInstance) -> DataInstance:
        """Create a data instance"""
        try:
            # First verify the SchemaClass exists
            check_query = """
            MATCH (c:SchemaClass {id: $class_id})
            RETURN c
            """
            check_result = db.execute_query(check_query, {'class_id': instance.class_id})
            
            if not check_result.result_set:
                logger.error(f"SchemaClass not found for id: {instance.class_id}")
                raise ValueError(f"SchemaClass not found: {instance.class_id}")
            
            logger.info(f"Creating DataInstance {instance.id} for class {instance.class_id}")
            
            query = """
            MATCH (c:SchemaClass {id: $class_id})
            CREATE (i:DataInstance {
                id: $id,
                class_id: $class_id,
                class_name: $class_name,
                data: $data,
                source_file: $source_file,
                source_row: $source_row
            })
            CREATE (c)<-[:INSTANCE_OF]-(i)
            RETURN i
            """
            
            result = db.execute_query(query, {
                'id': instance.id,
                'class_id': instance.class_id,
                'class_name': instance.class_name,
                'data': json.dumps(instance.data),
                'source_file': instance.source_file or '',
                'source_row': instance.source_row or 0
            })
            
            if not result.result_set:
                raise ValueError(f"Failed to create instance - no result returned")
            
            logger.info(f"Successfully created DataInstance {instance.id}")
            return instance
            
        except Exception as e:
            logger.error(f"Failed to create data instance: {str(e)}")
            logger.error(f"Instance details: class_id={instance.class_id}, id={instance.id}")
            raise
    
    @staticmethod
    def create_data_relationship(rel: DataRelationship) -> DataRelationship:
        """Create a relationship between data instances"""
        try:
            query = """
            MATCH (source:DataInstance {id: $source_id})
            MATCH (target:DataInstance {id: $target_id})
            CREATE (source)-[r:DATA_REL {
                id: $id,
                schema_relationship_id: $schema_rel_id
            }]->(target)
            RETURN r
            """
            
            db.execute_query(query, {
                'id': rel.id,
                'source_id': rel.source_instance_id,
                'target_id': rel.target_instance_id,
                'schema_rel_id': rel.schema_relationship_id
            })
            
            return rel
            
        except Exception as e:
            logger.error(f"Failed to create data relationship: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_graph(schema_id: str, expanded_classes: List[str] = []) -> LineageGraphResponse:
        """Get hierarchical lineage graph for a schema"""
        try:
            schema = SchemaService.get_schema(schema_id)
            if not schema:
                raise ValueError(f"Schema not found: {schema_id}")
            
            nodes = []
            edges = []
            
            # Add schema class nodes
            for cls in schema.classes:
                # Get instance count
                count_query = """
                MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(i:DataInstance)
                RETURN COUNT(i) as count
                """
                count_result = db.execute_query(count_query, {'class_id': cls.id})
                instance_count = count_result.result_set[0][0] if count_result.result_set else 0
                
                is_expanded = cls.id in expanded_classes
                
                nodes.append(LineageNode(
                    id=cls.id,
                    type="schema_class",
                    name=cls.name,
                    schema_id=schema_id,
                    class_id=cls.id,
                    parent_id=None,
                    data={
                        'description': cls.description,
                        'attributes': cls.attributes,
                        'instance_count': instance_count,
                        'color': cls.color,
                        'icon': cls.icon
                    },
                    collapsed=not is_expanded
                ))
                
                # If expanded, add data instances as child nodes
                if is_expanded:
                    instances_query = """
                    MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(i:DataInstance)
                    RETURN i
                    LIMIT 100
                    """
                    instances_result = db.execute_query(instances_query, {'class_id': cls.id})
                    
                    if instances_result.result_set:
                        for row in instances_result.result_set:
                            inst_props = dict(row[0].properties)
                            inst_data = json.loads(inst_props.get('data', '{}'))
                            
                            nodes.append(LineageNode(
                                id=inst_props['id'],
                                type="data_instance",
                                name=inst_data.get('name') or inst_data.get('id') or inst_props['id'][:8],
                                schema_id=schema_id,
                                class_id=cls.id,
                                parent_id=cls.id,
                                data=inst_data,
                                collapsed=False
                            ))
                            
                            # Add parent-child edge
                            edges.append(LineageEdge(
                                id=f"parent_{cls.id}_{inst_props['id']}",
                                source=cls.id,
                                target=inst_props['id'],
                                type="parent_child",
                                metadata={'relationship_type': 'contains'}
                            ))
            
            # Add schema relationship edges
            for rel in schema.relationships:
                edges.append(LineageEdge(
                    id=rel.id,
                    source=rel.source_class_id,
                    target=rel.target_class_id,
                    type="schema_relationship",
                    label=rel.name,
                    cardinality=rel.cardinality,
                    metadata={
                        'description': rel.description,
                        'bidirectional': rel.bidirectional
                    }
                ))
            
            # Add data relationship edges (only if both classes are expanded)
            for cls_id in expanded_classes:
                data_rels_query = """
                MATCH (source:DataInstance)-[r:DATA_REL]->(target:DataInstance)
                WHERE source.class_id = $class_id OR target.class_id = $class_id
                RETURN source.id, target.id, r
                """
                rels_result = db.execute_query(data_rels_query, {'class_id': cls_id})
                
                if rels_result.result_set:
                    for row in rels_result.result_set:
                        source_id = row[0]
                        target_id = row[1]
                        rel_props = dict(row[2].properties)
                        
                        edges.append(LineageEdge(
                            id=rel_props['id'],
                            source=source_id,
                            target=target_id,
                            type="data_relationship",
                            metadata={'schema_rel_id': rel_props['schema_relationship_id']}
                        ))
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema.name,
                nodes=nodes,
                edges=edges,
                metadata={'total_nodes': len(nodes), 'total_edges': len(edges)}
            )
            
        except Exception as e:
            logger.error(f"Failed to get lineage graph: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_path(schema_id: str, start_node_id: str, end_node_id: Optional[str] = None, max_depth: int = 10) -> LineagePathResponse:
        """Get lineage path from start node to end node (or all descendants)"""
        try:
            # First, check if the node exists and get its type
            check_query = """
            MATCH (n {id: $start_id})
            RETURN n, labels(n) as labels
            LIMIT 1
            """
            check_result = db.execute_query(check_query, {'start_id': start_node_id})
            
            if not check_result.result_set:
                logger.warning(f"Node {start_node_id} not found")
                return LineagePathResponse(
                    paths=[],
                    highlighted_nodes=[start_node_id],
                    highlighted_edges=[]
                )
            
            node_labels = check_result.result_set[0][1]
            is_schema_class = 'SchemaClass' in node_labels
            
            # For schema classes, get all related instances and relationships
            if is_schema_class:
                query = """
                MATCH (start:SchemaClass {id: $start_id})
                OPTIONAL MATCH (start)<-[:INSTANCE_OF]-(instance:DataInstance)
                OPTIONAL MATCH (start)-[r:SCHEMA_REL]->(target:SchemaClass)
                WITH start, collect(DISTINCT instance.id) as instances, 
                     collect(DISTINCT {rel_id: r.id, target: target.id}) as rels
                RETURN start.id as start_id, instances, rels
                """
                result = db.execute_query(query, {'start_id': start_node_id})
                
                all_nodes = {start_node_id}
                all_edges = set()
                paths = []
                
                if result.result_set:
                    row = result.result_set[0]
                    instances = row[1] if row[1] else []
                    relationships = row[2] if row[2] else []
                    
                    all_nodes.update([inst for inst in instances if inst])
                    
                    for rel in relationships:
                        if rel and 'rel_id' in rel:
                            all_edges.add(rel['rel_id'])
                            if 'target' in rel and rel['target']:
                                all_nodes.add(rel['target'])
                                paths.append([start_node_id, rel['target']])
                
                return LineagePathResponse(
                    paths=paths,
                    highlighted_nodes=list(all_nodes),
                    highlighted_edges=list(all_edges)
                )
            
            # For data instances, trace downstream connections
            else:
                query = """
                MATCH path = (start:DataInstance {id: $start_id})-[r:DATA_REL*0..3]->(related:DataInstance)
                WITH path, nodes(path) as node_list, relationships(path) as rel_list
                RETURN [n IN node_list | n.id] as node_ids, 
                       [rel IN rel_list | rel.id] as edge_ids
                LIMIT 20
                """
                result = db.execute_query(query, {'start_id': start_node_id})
                
                paths = []
                all_nodes = set()
                all_edges = set()
                
                if result.result_set:
                    for row in result.result_set:
                        node_ids = row[0] if row[0] else []
                        edge_ids = row[1] if row[1] else []
                        
                        if node_ids:
                            paths.append(node_ids)
                            all_nodes.update(node_ids)
                        if edge_ids:
                            all_edges.update(edge_ids)
                
                # If no paths found, at least highlight the node itself
                if not all_nodes:
                    all_nodes.add(start_node_id)
                
                return LineagePathResponse(
                    paths=paths,
                    highlighted_nodes=list(all_nodes),
                    highlighted_edges=list(all_edges)
                )
            
        except Exception as e:
            logger.error(f"Failed to get lineage path: {str(e)}")
            logger.error(f"Start node: {start_node_id}")
            # Return empty response instead of raising
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=[start_node_id],
                highlighted_edges=[]
            )
    
    @staticmethod
    def get_shortest_path(schema_id: str, node_ids: List[str]) -> LineagePathResponse:
        """
        Find shortest path between multiple nodes using FalkorDB's shortest path algorithm.
        For 2 nodes: direct shortest path
        For 3+ nodes: finds path connecting all nodes
        """
        try:
            if len(node_ids) < 2:
                raise ValueError("At least 2 nodes required")
            
            all_paths = []
            all_nodes = set()
            all_edges = set()
            
            # For 2 nodes, find direct shortest path
            if len(node_ids) == 2:
                node_ids_in_path = []
                
                # Try FalkorDB's shortestPath first (both directions)
                # Try forward direction
                query_forward = """
                MATCH (start {id: $start_id}), (end {id: $end_id})
                WITH shortestPath((start)-[*1..10]->(end)) as path
                WHERE path IS NOT NULL
                UNWIND nodes(path) as n
                RETURN collect(n.id) as node_ids
                """
                
                try:
                    result = db.execute_query(query_forward, {
                        'start_id': node_ids[0],
                        'end_id': node_ids[1]
                    })
                    
                    if result.result_set and result.result_set[0][0]:
                        node_ids_in_path = result.result_set[0][0]
                        logger.info(f"Found forward path with {len(node_ids_in_path)} nodes")
                except Exception as e:
                    logger.debug(f"Forward shortestPath failed: {str(e)}")
                
                # Try backward direction if forward didn't work
                if not node_ids_in_path:
                    query_backward = """
                    MATCH (start {id: $start_id}), (end {id: $end_id})
                    WITH shortestPath((start)<-[*1..10]-(end)) as path
                    WHERE path IS NOT NULL
                    UNWIND nodes(path) as n
                    RETURN collect(n.id) as node_ids
                    """
                    
                    try:
                        result = db.execute_query(query_backward, {
                            'start_id': node_ids[0],
                            'end_id': node_ids[1]
                        })
                        
                        if result.result_set and result.result_set[0][0]:
                            node_ids_in_path = result.result_set[0][0]
                            logger.info(f"Found backward path with {len(node_ids_in_path)} nodes")
                    except Exception as e:
                        logger.debug(f"Backward shortestPath failed: {str(e)}")
                
                # Fallback: Manual BFS-style path finding if shortestPath didn't work
                if not node_ids_in_path:
                    logger.info("ShortestPath failed, trying manual path finding...")
                    node_ids_in_path = SchemaService._find_path_manual(node_ids[0], node_ids[1])
                    if node_ids_in_path:
                        logger.info(f"Manual path finding succeeded with {len(node_ids_in_path)} nodes")
                
                if node_ids_in_path:
                    all_nodes.update(node_ids_in_path)
                    all_paths.append(node_ids_in_path)
                    
                    # Get edges between consecutive nodes
                    if len(node_ids_in_path) > 1:
                        for i in range(len(node_ids_in_path) - 1):
                            edge_id = SchemaService._find_edge_between_nodes(
                                node_ids_in_path[i], 
                                node_ids_in_path[i + 1]
                            )
                            if edge_id:
                                all_edges.add(edge_id)
                        
                        logger.info(f"Found {len(all_edges)} edges in path")
                else:
                    logger.warning(f"No path found between {node_ids[0]} and {node_ids[1]}")
            
            # For 3+ nodes, find paths connecting consecutive pairs
            else:
                for i in range(len(node_ids) - 1):
                    start_id = node_ids[i]
                    end_id = node_ids[i + 1]
                    
                    segment_nodes = []
                    
                    # Try shortestPath in both directions
                    query_forward = """
                    MATCH (start {id: $start_id}), (end {id: $end_id})
                    WITH shortestPath((start)-[*1..10]->(end)) as path
                    WHERE path IS NOT NULL
                    UNWIND nodes(path) as n
                    RETURN collect(n.id) as node_ids
                    """
                    
                    try:
                        result = db.execute_query(query_forward, {
                            'start_id': start_id,
                            'end_id': end_id
                        })
                        
                        if result.result_set and result.result_set[0][0]:
                            segment_nodes = result.result_set[0][0]
                    except Exception as e:
                        logger.debug(f"Forward segment failed: {str(e)}")
                    
                    # Try backward if forward failed
                    if not segment_nodes:
                        query_backward = """
                        MATCH (start {id: $start_id}), (end {id: $end_id})
                        WITH shortestPath((start)<-[*1..10]-(end)) as path
                        WHERE path IS NOT NULL
                        UNWIND nodes(path) as n
                        RETURN collect(n.id) as node_ids
                        """
                        
                        try:
                            result = db.execute_query(query_backward, {
                                'start_id': start_id,
                                'end_id': end_id
                            })
                            
                            if result.result_set and result.result_set[0][0]:
                                segment_nodes = result.result_set[0][0]
                        except Exception as e:
                            logger.debug(f"Backward segment failed: {str(e)}")
                    
                    # Manual fallback
                    if not segment_nodes:
                        segment_nodes = SchemaService._find_path_manual(start_id, end_id)
                    
                    if segment_nodes:
                        all_paths.append(segment_nodes)
                        all_nodes.update(segment_nodes)
                        
                        # Get edges for this segment
                        if len(segment_nodes) > 1:
                            for j in range(len(segment_nodes) - 1):
                                edge_id = SchemaService._find_edge_between_nodes(
                                    segment_nodes[j],
                                    segment_nodes[j + 1]
                                )
                                if edge_id:
                                    all_edges.add(edge_id)
                        
                        logger.info(f"Found segment from {start_id} to {end_id} with {len(segment_nodes)} nodes")
                    else:
                        logger.warning(f"No path found between {start_id} and {end_id}")
            
            # If no paths found, just return the selected nodes
            if not all_nodes:
                all_nodes.update(node_ids)
                logger.warning("No connecting paths found, returning selected nodes only")
            
            logger.info(f"Total path: {len(all_nodes)} nodes, {len(all_edges)} edges")
            
            return LineagePathResponse(
                paths=all_paths,
                highlighted_nodes=list(all_nodes),
                highlighted_edges=list(all_edges)
            )
            
        except Exception as e:
            logger.error(f"Failed to find shortest path: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            # Return selected nodes even on error
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=node_ids,
                highlighted_edges=[]
            )
    
    @staticmethod
    def _find_edge_between_nodes(node1_id: str, node2_id: str) -> Optional[str]:
        """Find edge ID between two nodes (tries both directions)"""
        # Try forward direction
        edge_query = """
        MATCH (n1 {id: $id1})-[r]->(n2 {id: $id2})
        RETURN r.id as edge_id
        LIMIT 1
        """
        try:
            edge_result = db.execute_query(edge_query, {
                'id1': node1_id,
                'id2': node2_id
            })
            
            if edge_result.result_set and edge_result.result_set[0][0]:
                return edge_result.result_set[0][0]
        except Exception as e:
            logger.debug(f"Forward edge query failed: {str(e)}")
        
        # Try backward direction
        edge_query_rev = """
        MATCH (n1 {id: $id1})<-[r]-(n2 {id: $id2})
        RETURN r.id as edge_id
        LIMIT 1
        """
        try:
            edge_result_rev = db.execute_query(edge_query_rev, {
                'id1': node1_id,
                'id2': node2_id
            })
            
            if edge_result_rev.result_set and edge_result_rev.result_set[0][0]:
                return edge_result_rev.result_set[0][0]
        except Exception as e:
            logger.debug(f"Backward edge query failed: {str(e)}")
        
        return None
    
    @staticmethod
    def _find_path_manual(start_id: str, end_id: str, max_depth: int = 10) -> List[str]:
        """Manual BFS-style path finding as fallback"""
        try:
            # Use variable-length pattern matching with MATCH
            query = """
            MATCH path = (start {id: $start_id})-[*1..10]->(end {id: $end_id})
            WITH path, length(path) as pathLength
            ORDER BY pathLength ASC
            LIMIT 1
            UNWIND nodes(path) as n
            RETURN collect(n.id) as node_ids
            """
            
            result = db.execute_query(query, {
                'start_id': start_id,
                'end_id': end_id
            })
            
            if result.result_set and result.result_set[0][0]:
                return result.result_set[0][0]
            
            # Try reverse direction
            query_rev = """
            MATCH path = (start {id: $start_id})<-[*1..10]-(end {id: $end_id})
            WITH path, length(path) as pathLength
            ORDER BY pathLength ASC
            LIMIT 1
            UNWIND nodes(path) as n
            RETURN collect(n.id) as node_ids
            """
            
            result_rev = db.execute_query(query_rev, {
                'start_id': start_id,
                'end_id': end_id
            })
            
            if result_rev.result_set and result_rev.result_set[0][0]:
                return result_rev.result_set[0][0]
            
        except Exception as e:
            logger.error(f"Manual path finding failed: {str(e)}")
        
        return []
        """
        Find shortest path between multiple nodes using FalkorDB's shortest path algorithm.
        For 2 nodes: direct shortest path
        For 3+ nodes: finds path connecting all nodes
        """
        try:
            if len(node_ids) < 2:
                raise ValueError("At least 2 nodes required")
            
            all_paths = []
            all_nodes = set()
            all_edges = set()
            
            # For 2 nodes, find direct shortest path
            if len(node_ids) == 2:
                # FalkorDB requires directed paths, so try both directions
                # Try forward direction first
                query_forward = """
                MATCH (start {id: $start_id}), (end {id: $end_id})
                WITH shortestPath((start)-[*]->(end)) as path
                WHERE path IS NOT NULL
                UNWIND nodes(path) as n
                RETURN collect(n.id) as node_ids
                """
                
                query_backward = """
                MATCH (start {id: $start_id}), (end {id: $end_id})
                WITH shortestPath((start)<-[*]-(end)) as path
                WHERE path IS NOT NULL
                UNWIND nodes(path) as n
                RETURN collect(n.id) as node_ids
                """
                
                node_ids_in_path = []
                
                # Try forward direction
                try:
                    result = db.execute_query(query_forward, {
                        'start_id': node_ids[0],
                        'end_id': node_ids[1]
                    })
                    
                    if result.result_set and result.result_set[0][0]:
                        node_ids_in_path = result.result_set[0][0]
                        logger.info(f"Found forward path with {len(node_ids_in_path)} nodes")
                except Exception as e:
                    logger.debug(f"Forward path not found: {str(e)}")
                
                # If forward didn't work, try backward
                if not node_ids_in_path:
                    try:
                        result = db.execute_query(query_backward, {
                            'start_id': node_ids[0],
                            'end_id': node_ids[1]
                        })
                        
                        if result.result_set and result.result_set[0][0]:
                            node_ids_in_path = result.result_set[0][0]
                            logger.info(f"Found backward path with {len(node_ids_in_path)} nodes")
                    except Exception as e:
                        logger.debug(f"Backward path not found: {str(e)}")
                
                if node_ids_in_path:
                    all_nodes.update(node_ids_in_path)
                    all_paths.append(node_ids_in_path)
                    
                    # Get edges between consecutive nodes
                    if len(node_ids_in_path) > 1:
                        for i in range(len(node_ids_in_path) - 1):
                            # Try both directions for edge
                            edge_query = """
                            MATCH (n1 {id: $id1})-[r]->(n2 {id: $id2})
                            RETURN r.id as edge_id
                            LIMIT 1
                            """
                            edge_result = db.execute_query(edge_query, {
                                'id1': node_ids_in_path[i],
                                'id2': node_ids_in_path[i + 1]
                            })
                            
                            if edge_result.result_set and edge_result.result_set[0][0]:
                                edge_id = edge_result.result_set[0][0]
                                all_edges.add(edge_id)
                            else:
                                # Try reverse direction
                                edge_query_rev = """
                                MATCH (n1 {id: $id1})<-[r]-(n2 {id: $id2})
                                RETURN r.id as edge_id
                                LIMIT 1
                                """
                                edge_result_rev = db.execute_query(edge_query_rev, {
                                    'id1': node_ids_in_path[i],
                                    'id2': node_ids_in_path[i + 1]
                                })
                                
                                if edge_result_rev.result_set and edge_result_rev.result_set[0][0]:
                                    edge_id = edge_result_rev.result_set[0][0]
                                    all_edges.add(edge_id)
                        
                        logger.info(f"Found {len(all_edges)} edges in path")
                else:
                    logger.warning(f"No path found between {node_ids[0]} and {node_ids[1]}")
            
            # For 3+ nodes, find paths connecting consecutive pairs
            else:
                for i in range(len(node_ids) - 1):
                    start_id = node_ids[i]
                    end_id = node_ids[i + 1]
                    
                    # Try both directions
                    query_forward = """
                    MATCH (start {id: $start_id}), (end {id: $end_id})
                    WITH shortestPath((start)-[*]->(end)) as path
                    WHERE path IS NOT NULL
                    UNWIND nodes(path) as n
                    RETURN collect(n.id) as node_ids
                    """
                    
                    query_backward = """
                    MATCH (start {id: $start_id}), (end {id: $end_id})
                    WITH shortestPath((start)<-[*]-(end)) as path
                    WHERE path IS NOT NULL
                    UNWIND nodes(path) as n
                    RETURN collect(n.id) as node_ids
                    """
                    
                    segment_nodes = []
                    
                    # Try forward
                    try:
                        result = db.execute_query(query_forward, {
                            'start_id': start_id,
                            'end_id': end_id
                        })
                        
                        if result.result_set and result.result_set[0][0]:
                            segment_nodes = result.result_set[0][0]
                    except Exception as e:
                        logger.debug(f"Forward segment not found: {str(e)}")
                    
                    # Try backward if forward failed
                    if not segment_nodes:
                        try:
                            result = db.execute_query(query_backward, {
                                'start_id': start_id,
                                'end_id': end_id
                            })
                            
                            if result.result_set and result.result_set[0][0]:
                                segment_nodes = result.result_set[0][0]
                        except Exception as e:
                            logger.debug(f"Backward segment not found: {str(e)}")
                    
                    if segment_nodes:
                        all_paths.append(segment_nodes)
                        all_nodes.update(segment_nodes)
                        
                        # Get edges for this segment
                        if len(segment_nodes) > 1:
                            for j in range(len(segment_nodes) - 1):
                                # Try forward direction
                                edge_query = """
                                MATCH (n1 {id: $id1})-[r]->(n2 {id: $id2})
                                RETURN r.id as edge_id
                                LIMIT 1
                                """
                                edge_result = db.execute_query(edge_query, {
                                    'id1': segment_nodes[j],
                                    'id2': segment_nodes[j + 1]
                                })
                                
                                if edge_result.result_set and edge_result.result_set[0][0]:
                                    edge_id = edge_result.result_set[0][0]
                                    all_edges.add(edge_id)
                                else:
                                    # Try backward direction
                                    edge_query_rev = """
                                    MATCH (n1 {id: $id1})<-[r]-(n2 {id: $id2})
                                    RETURN r.id as edge_id
                                    LIMIT 1
                                    """
                                    edge_result_rev = db.execute_query(edge_query_rev, {
                                        'id1': segment_nodes[j],
                                        'id2': segment_nodes[j + 1]
                                    })
                                    
                                    if edge_result_rev.result_set and edge_result_rev.result_set[0][0]:
                                        edge_id = edge_result_rev.result_set[0][0]
                                        all_edges.add(edge_id)
                        
                        logger.info(f"Found path segment from {start_id} to {end_id} with {len(segment_nodes)} nodes")
                    else:
                        logger.warning(f"No path found between {start_id} and {end_id}")
            
            # If no paths found, just return the selected nodes
            if not all_nodes:
                all_nodes.update(node_ids)
                logger.warning("No connecting paths found, returning selected nodes only")
            
            logger.info(f"Total path: {len(all_nodes)} nodes, {len(all_edges)} edges")
            
            return LineagePathResponse(
                paths=all_paths,
                highlighted_nodes=list(all_nodes),
                highlighted_edges=list(all_edges)
            )
            
        except Exception as e:
            logger.error(f"Failed to find shortest path: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            # Return selected nodes even on error
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=node_ids,
                highlighted_edges=[]
            )
    
    @staticmethod
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            schema = SchemaService.get_schema(schema_id)
            if not schema:
                raise ValueError(f"Schema not found: {schema_id}")
            
            # Get total instances
            instances_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(:SchemaClass)<-[:INSTANCE_OF]-(i:DataInstance)
            RETURN COUNT(i) as total
            """
            instances_result = db.execute_query(instances_query, {'schema_id': schema_id})
            total_instances = instances_result.result_set[0][0] if instances_result.result_set else 0
            
            # Get total data relationships
            data_rels_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(:SchemaClass)<-[:INSTANCE_OF]-(:DataInstance)-[r:DATA_REL]->()
            RETURN COUNT(r) as total
            """
            data_rels_result = db.execute_query(data_rels_query, {'schema_id': schema_id})
            total_data_rels = data_rels_result.result_set[0][0] if data_rels_result.result_set else 0
            
            # Get instances by class
            by_class_query = """
            MATCH (c:SchemaClass {schema_id: $schema_id})<-[:INSTANCE_OF]-(i:DataInstance)
            RETURN c.name as class_name, COUNT(i) as count
            """
            by_class_result = db.execute_query(by_class_query, {'schema_id': schema_id})
            
            instances_by_class = {}
            if by_class_result.result_set:
                for row in by_class_result.result_set:
                    class_name = row[0]
                    count = row[1]
                    instances_by_class[class_name] = count
            
            return SchemaStats(
                schema_id=schema_id,
                schema_name=schema.name,
                total_classes=len(schema.classes),
                total_relationships=len(schema.relationships),
                total_instances=total_instances,
                total_data_relationships=total_data_rels,
                instances_by_class=instances_by_class
            )
            
        except Exception as e:
            logger.error(f"Failed to get schema stats: {str(e)}")
            raise