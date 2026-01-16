# backend/app/services/schema_service.py - COMPLETE FIXED VERSION

from typing import List, Optional, Set, Dict, Any
from ..database import db
from ..models.schemas import (
    SchemaDefinition, SchemaClass, SchemaRelationship,
    SchemaStats, LineageGraphResponse, LineageNode, LineageEdge,
    LineagePathResponse
)
import json
import logging

logger = logging.getLogger(__name__)


class SchemaService:
    """Service for schema operations"""
    
    @staticmethod
    def create_schema(schema: SchemaDefinition) -> SchemaDefinition:
        """Create a new schema"""
        try:
            # Create schema node
            schema_query = """
            CREATE (s:Schema {
                id: $id,
                name: $name,
                description: $description,
                created_at: datetime()
            })
            RETURN s
            """
            db.execute_query(schema_query, {
                'id': schema.id,
                'name': schema.name,
                'description': schema.description or ''
            })
            
            # Create schema class nodes
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
            
            # Create schema relationship edges
            for rel in schema.relationships:
                rel_query = """
                MATCH (source:SchemaClass {id: $source_id})
                MATCH (target:SchemaClass {id: $target_id})
                CREATE (source)-[r:SCHEMA_REL {
                    id: $id,
                    name: $name,
                    description: $description,
                    cardinality: $cardinality
                }]->(target)
                RETURN r
                """
                db.execute_query(rel_query, {
                    'id': rel.id,
                    'source_id': rel.source_class_id,
                    'target_id': rel.target_class_id,
                    'name': rel.name,
                    'description': rel.description or '',
                    'cardinality': rel.cardinality
                })
            
            logger.info(f"Created schema: {schema.id} with {len(schema.classes)} classes and {len(schema.relationships)} relationships")
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
                logger.warning(f"Schema {schema_id} not found")
                return None
            
            schema_node = result.result_set[0][0]
            schema_props = dict(schema_node.properties)
            
            logger.info(f"Found schema: {schema_props.get('name')}")
            
            # Get classes - THIS IS THE CRITICAL FIX
            classes_query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
            RETURN c
            """
            
            classes_result = db.execute_query(classes_query, {'schema_id': schema_id})
            
            classes = []
            if classes_result.result_set:
                logger.info(f"Found {len(classes_result.result_set)} classes in database")
                for row in classes_result.result_set:
                    cls = row[0]
                    cls_props = dict(cls.properties)
                    logger.info(f"  - Class: {cls_props.get('name')} (ID: {cls_props.get('id')})")
                    
                    classes.append(SchemaClass(
                        id=cls_props['id'],
                        name=cls_props['name'],
                        description=cls_props.get('description', ''),
                        attributes=json.loads(cls_props.get('attributes', '[]')),
                        color=cls_props.get('color', '#6B7280'),
                        icon=cls_props.get('icon', 'Box')
                    ))
            else:
                logger.warning(f"No classes found for schema {schema_id} with HAS_CLASS relationship")
            
            # Get relationships
            rels_query = """
            MATCH (source:SchemaClass {schema_id: $schema_id})-[r:SCHEMA_REL]->(target:SchemaClass {schema_id: $schema_id})
            RETURN r, source.id, target.id
            """
            
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            
            relationships = []
            if rels_result.result_set:
                logger.info(f"Found {len(rels_result.result_set)} relationships")
                for row in rels_result.result_set:
                    rel = row[0]
                    rel_props = dict(rel.properties)
                    source_id = row[1]
                    target_id = row[2]
                    
                    logger.info(f"  - Relationship: {rel_props.get('name')} ({source_id} -> {target_id})")
                    
                    relationships.append(SchemaRelationship(
                        id=rel_props['id'],
                        name=rel_props['name'],
                        description=rel_props.get('description', ''),
                        source_class_id=source_id,
                        target_class_id=target_id,
                        cardinality=rel_props.get('cardinality', 'one_to_many')
                    ))
            else:
                logger.warning(f"No relationships found for schema {schema_id}")
            
            schema = SchemaDefinition(
                id=schema_props['id'],
                name=schema_props['name'],
                description=schema_props.get('description', ''),
                version=schema_props.get('version', '1.0.0'),
                classes=classes,
                relationships=relationships,
                created_at=schema_props.get('created_at'),
                updated_at=schema_props.get('updated_at')
            )
            
            logger.info(f"Returning schema with {len(classes)} classes and {len(relationships)} relationships")
            
            return schema
            
        except Exception as e:
            logger.error(f"Failed to get schema: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas - returns dict format for API response"""
        try:
            query = """
            MATCH (s:Schema)
            RETURN s
            ORDER BY s.created_at DESC
            """
            result = db.execute_query(query)
            
            schemas = []
            if result.result_set:
                for row in result.result_set:
                    schema_node = row[0]
                    schema_props = dict(schema_node.properties)
                    # Return as dictionary for API serialization
                    schemas.append({
                        'id': schema_props['id'],
                        'name': schema_props['name'],
                        'description': schema_props.get('description', ''),
                        'version': schema_props.get('version', '1.0.0'),
                        'created_at': schema_props.get('created_at'),
                        'updated_at': schema_props.get('updated_at'),
                        'classes': [],  # Empty list for listing view
                        'relationships': [],  # Empty list for listing view
                        'metadata': {}
                    })
            
            return schemas
            
        except Exception as e:
            logger.error(f"Failed to list schemas: {str(e)}")
            raise
    
    @staticmethod
    def delete_schema(schema_id: str) -> bool:
        """Delete a schema and all its data"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)<-[:BELONGS_TO]-(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            DETACH DELETE s, c, i
            """
            db.execute_query(query, {'schema_id': schema_id})
            logger.info(f"Deleted schema: {schema_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to delete schema: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_graph(schema_id: str, expanded_classes: List[str] = []) -> LineageGraphResponse:
        """Get hierarchical lineage graph"""
        try:
            schema = SchemaService.get_schema(schema_id)
            if not schema:
                raise ValueError(f"Schema not found: {schema_id}")
            
            nodes = []
            edges = []
            
            # Add schema classes as top-level nodes
            for cls in schema.classes:
                # Count instances
                count_query = """
                MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(i:DataInstance)
                RETURN COUNT(i) as count
                """
                count_result = db.execute_query(count_query, {'class_id': cls.id})
                instance_count = count_result.result_set[0][0] if count_result.result_set else 0
                
                nodes.append(LineageNode(
                    id=cls.id,
                    type='schema_class',
                    name=cls.name,
                    schema_id=schema_id,
                    class_id=cls.id,
                    data={
                        'description': cls.description,
                        'attributes': cls.attributes,
                        'color': cls.color,
                        'icon': cls.icon,
                        'instance_count': instance_count
                    },
                    collapsed=cls.id not in expanded_classes
                ))
            
            # Add schema relationships
            for rel in schema.relationships:
                edges.append(LineageEdge(
                    id=rel.id,
                    source=rel.source_class_id,
                    target=rel.target_class_id,
                    type='schema_relationship',
                    label=rel.name,
                    cardinality=rel.cardinality
                ))
            
            # If classes are expanded, add their instances
            for class_id in expanded_classes:
                instances_query = """
                MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(i:DataInstance)
                RETURN i
                """
                instances_result = db.execute_query(instances_query, {'class_id': class_id})
                
                if instances_result.result_set:
                    for row in instances_result.result_set:
                        inst = row[0]
                        inst_props = dict(inst.properties)
                        inst_data = json.loads(inst_props.get('data', '{}'))
                        
                        nodes.append(LineageNode(
                            id=inst_props['id'],
                            type='data_instance',
                            name=inst_data.get('name', inst_props['id']),
                            schema_id=schema_id,
                            class_id=class_id,
                            parent_id=class_id,
                            data=inst_data
                        ))
                        
                        # Parent-child edge
                        edges.append(LineageEdge(
                            id=f"parent_{class_id}_{inst_props['id']}",
                            source=class_id,
                            target=inst_props['id'],
                            type='parent_child',
                            label='instance of'
                        ))
                
                # Get data relationships for this class
                data_rels_query = """
                MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(source:DataInstance)
                MATCH (source)-[r:DATA_REL]->(target:DataInstance)
                RETURN r, source.id, target.id
                """
                data_rels_result = db.execute_query(data_rels_query, {'class_id': class_id})
                
                if data_rels_result.result_set:
                    for row in data_rels_result.result_set:
                        rel_props = dict(row[0].properties)
                        source_id = row[1]
                        target_id = row[2]
                        
                        edges.append(LineageEdge(
                            id=rel_props['id'],
                            source=source_id,
                            target=target_id,
                            type='data_relationship',
                            label='related to'
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
    def get_all_paths_between_nodes(schema_id: str, node_ids: List[str], max_depth: int = 10) -> LineagePathResponse:
        """
        Find ALL paths between multiple nodes (FIXED VERSION WITH PROPER EDGE COLLECTION)
        """
        try:
            if len(node_ids) < 2:
                logger.warning("Need at least 2 nodes for path finding")
                return LineagePathResponse(
                    paths=[],
                    highlighted_nodes=node_ids,
                    highlighted_edges=[]
                )
            
            all_paths = []
            all_nodes = set(node_ids)
            all_edges = set()
            
            # For 2 nodes, find all paths between them
            if len(node_ids) == 2:
                start_id = node_ids[0]
                end_id = node_ids[1]
                
                logger.info(f"Finding paths between {start_id} and {end_id}")
                
                # Try bidirectional paths
                query = f"""
                MATCH (start {{id: $start_id}})
                MATCH (end {{id: $end_id}})
                MATCH path = (start)-[*1..{max_depth}]-(end)
                WITH path, nodes(path) as node_list, relationships(path) as rel_list
                RETURN 
                    [n IN node_list | n.id] as node_ids,
                    [i IN range(0, size(rel_list)-1) | {{
                        rel_id: rel_list[i].id,
                        source: node_list[i].id,
                        target: node_list[i+1].id,
                        type: type(rel_list[i])
                    }}] as edge_info
                LIMIT 50
                """
                
                result = db.execute_query(query, {
                    'start_id': start_id,
                    'end_id': end_id
                })
                
                if result.result_set:
                    for row in result.result_set:
                        node_path = row[0] if row[0] else []
                        edge_info_list = row[1] if row[1] else []
                        
                        if node_path:
                            all_paths.append(node_path)
                            all_nodes.update(node_path)
                            
                            # Collect edge IDs with proper formatting
                            for edge_info in edge_info_list:
                                rel_id = edge_info.get('rel_id')
                                source = edge_info.get('source')
                                target = edge_info.get('target')
                                rel_type = edge_info.get('type')
                                
                                # Match the edge ID format used in get_lineage_graph
                                if rel_type == 'INSTANCE_OF':
                                    # Parent-child relationship: parent_{class_id}_{instance_id}
                                    edge_id = f"parent_{source}_{target}"
                                    all_edges.add(edge_id)
                                elif rel_type == 'DATA_REL':
                                    # Data relationship: use the relationship's own ID
                                    if rel_id:
                                        all_edges.add(rel_id)
                                elif rel_type == 'SCHEMA_REL':
                                    # Schema relationship: use the relationship's own ID
                                    if rel_id:
                                        all_edges.add(rel_id)
                else:
                    logger.warning(f"No paths found between {start_id} and {end_id}")
                    all_nodes.update([start_id, end_id])
            
            # For 3+ nodes, find paths connecting consecutive pairs
            else:
                for i in range(len(node_ids) - 1):
                    start_id = node_ids[i]
                    end_id = node_ids[i + 1]
                    
                    # Find all paths for this segment
                    segment_response = SchemaService.get_all_paths_between_nodes(
                        schema_id, [start_id, end_id], max_depth
                    )
                    
                    # Merge results
                    all_paths.extend(segment_response.paths)
                    all_nodes.update(segment_response.highlighted_nodes)
                    all_edges.update(segment_response.highlighted_edges)
            
            logger.info(f"Found {len(all_paths)} paths, {len(all_nodes)} nodes, {len(all_edges)} edges")
            logger.info(f"Edge IDs: {list(all_edges)[:10]}...")  # Log first 10 edges
            
            return LineagePathResponse(
                paths=all_paths,
                highlighted_nodes=list(all_nodes),
                highlighted_edges=list(all_edges)
            )
            
        except Exception as e:
            logger.error(f"Failed to get all paths: {str(e)}")
            logger.error(f"Node IDs: {node_ids}")
            # Return empty response instead of raising
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=node_ids,
                highlighted_edges=[]
            )
    
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
                    
                    # Add parent-child edges
                    for inst in instances:
                        if inst:
                            all_edges.add(f"parent_{start_node_id}_{inst}")
                    
                    # Add schema relationship edges
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
                LIMIT 50
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
        Find shortest path between multiple nodes (LEGACY METHOD - use get_all_paths_between_nodes instead)
        """
        return SchemaService.get_all_paths_between_nodes(schema_id, node_ids, max_depth=10)
    
    @staticmethod
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            schema = SchemaService.get_schema(schema_id)
            if not schema:
                raise ValueError(f"Schema not found: {schema_id}")
            
            # Get total instances
            instances_query = """
            MATCH (c:SchemaClass)-[:BELONGS_TO]->(s:Schema {id: $schema_id})
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            RETURN c.id as class_id, COUNT(i) as instance_count
            """
            instances_result = db.execute_query(instances_query, {'schema_id': schema_id})
            
            instances_by_class = {}
            total_instances = 0
            if instances_result.result_set:
                for row in instances_result.result_set:
                    class_id = row[0]
                    count = row[1]
                    instances_by_class[class_id] = count
                    total_instances += count
            
            # Get total data relationships
            data_rels_query = """
            MATCH (source:DataInstance)-[r:DATA_REL]->(target:DataInstance)
            WHERE source.schema_id = $schema_id
            RETURN COUNT(r) as count
            """
            data_rels_result = db.execute_query(data_rels_query, {'schema_id': schema_id})
            total_data_relationships = data_rels_result.result_set[0][0] if data_rels_result.result_set else 0
            
            return SchemaStats(
                schema_id=schema.id,
                schema_name=schema.name,
                total_classes=len(schema.classes),
                total_relationships=len(schema.relationships),
                total_instances=total_instances,
                total_data_relationships=total_data_relationships,
                instances_by_class=instances_by_class
            )
            
        except Exception as e:
            logger.error(f"Failed to get schema stats: {str(e)}")
            raise