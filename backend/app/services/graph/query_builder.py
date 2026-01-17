# backend/app/services/graph/query_builder.py

"""
Cypher Query Builder - Utility for building FalkorDB/Cypher queries
"""

from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class CypherQueryBuilder:
    """Builder for constructing Cypher queries"""
    
    @staticmethod
    def build_create_node_query(
        label: str,
        properties: Dict[str, Any],
        return_node: bool = True
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to create a node"""
        props_str = ", ".join([f"{key}: ${key}" for key in properties.keys()])
        query = f"CREATE (n:{label} {{{props_str}}})"
        
        if return_node:
            query += " RETURN n"
        
        return query, properties
    
    @staticmethod
    def build_create_relationship_query(
        source_label: str,
        source_id: str,
        target_label: str,
        target_id: str,
        rel_type: str,
        rel_properties: Optional[Dict[str, Any]] = None
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to create a relationship"""
        query = f"""
        MATCH (source:{source_label} {{id: $source_id}})
        MATCH (target:{target_label} {{id: $target_id}})
        CREATE (source)-[r:{rel_type}"""
        
        params = {
            'source_id': source_id,
            'target_id': target_id
        }
        
        if rel_properties:
            props_str = ", ".join([f"{key}: ${key}" for key in rel_properties.keys()])
            query += f" {{{props_str}}}"
            params.update(rel_properties)
        
        query += "]->(target) RETURN r"
        
        return query, params
    
    @staticmethod
    def build_match_node_query(
        label: str,
        filters: Optional[Dict[str, Any]] = None,
        return_fields: Optional[List[str]] = None
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to match nodes"""
        query = f"MATCH (n:{label}"
        params = {}
        
        if filters:
            filter_str = ", ".join([f"{key}: ${key}" for key in filters.keys()])
            query += f" {{{filter_str}}}"
            params.update(filters)
        
        query += ")"
        
        if return_fields:
            return_str = ", ".join([f"n.{field} as {field}" for field in return_fields])
            query += f" RETURN {return_str}"
        else:
            query += " RETURN n"
        
        return query, params
    
    @staticmethod
    def build_lineage_upstream_query(
        node_label: str,
        node_id: str,
        rel_type: str,
        max_depth: int = 10
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to find upstream lineage"""
        query = f"""
        MATCH path = (source)-[:{rel_type}*1..{max_depth}]->(target:{node_label} {{id: $node_id}})
        WITH source, target, path, length(path) as depth
        RETURN DISTINCT
            source.id as source_id,
            source.name as source_name,
            labels(source) as source_labels,
            depth,
            [rel IN relationships(path) | type(rel)] as rel_types,
            [rel IN relationships(path) | properties(rel)] as rel_properties
        ORDER BY depth
        """
        
        params = {'node_id': node_id}
        return query, params
    
    @staticmethod
    def build_lineage_downstream_query(
        node_label: str,
        node_id: str,
        rel_type: str,
        max_depth: int = 10
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to find downstream lineage"""
        query = f"""
        MATCH path = (source:{node_label} {{id: $node_id}})-[:{rel_type}*1..{max_depth}]->(target)
        WITH source, target, path, length(path) as depth
        RETURN DISTINCT
            target.id as target_id,
            target.name as target_name,
            labels(target) as target_labels,
            depth,
            [rel IN relationships(path) | type(rel)] as rel_types,
            [rel IN relationships(path) | properties(rel)] as rel_properties
        ORDER BY depth
        """
        
        params = {'node_id': node_id}
        return query, params
    
    @staticmethod
    def build_shortest_path_query(
        start_node_id: str,
        end_node_id: str,
        max_depth: int = 20
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to find shortest path between two nodes"""
        query = f"""
        MATCH (start {{id: $start_id}}), (end {{id: $end_id}})
        MATCH path = shortestPath((start)-[*1..{max_depth}]-(end))
        RETURN [node IN nodes(path) | node.id] as node_ids,
               [rel IN relationships(path) | type(rel)] as rel_types,
               length(path) as path_length
        """
        
        params = {
            'start_id': start_node_id,
            'end_id': end_node_id
        }
        return query, params
    
    @staticmethod
    def build_all_paths_query(
        start_node_id: str,
        end_node_id: str,
        max_depth: int = 20
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to find all paths between two nodes"""
        query = f"""
        MATCH (start {{id: $start_id}}), (end {{id: $end_id}})
        MATCH path = (start)-[*1..{max_depth}]-(end)
        WHERE ALL(node IN nodes(path) WHERE single(x IN nodes(path) WHERE x = node))
        RETURN [node IN nodes(path) | node.id] as node_ids,
               [rel IN relationships(path) | type(rel)] as rel_types,
               length(path) as path_length
        ORDER BY path_length
        LIMIT 100
        """
        
        params = {
            'start_id': start_node_id,
            'end_id': end_node_id
        }
        return query, params
    
    @staticmethod
    def build_attribute_flow_query(
        schema_id: str,
        source_attr_id: Optional[str] = None,
        target_attr_id: Optional[str] = None
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to get attribute flows"""
        query = """
        MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(sc:SchemaClass)
        MATCH (sc)-[:HAS_ATTRIBUTE]->(source:Attribute)
        MATCH (source)-[f:ATTRIBUTE_FLOWS_TO]->(target:Attribute)
        """
        
        params = {'schema_id': schema_id}
        
        conditions = []
        if source_attr_id:
            conditions.append("source.id = $source_id")
            params['source_id'] = source_attr_id
        
        if target_attr_id:
            conditions.append("target.id = $target_id")
            params['target_id'] = target_attr_id
        
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        
        query += """
        RETURN source.id as source_id,
               source.name as source_name,
               target.id as target_id,
               target.name as target_name,
               f.transformation as transformation,
               f.id as flow_id
        """
        
        return query, params
    
    @staticmethod
    def build_hierarchy_tree_query(schema_id: str) -> tuple[str, Dict[str, Any]]:
        """Build query to get complete hierarchy tree"""
        query = """
        MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(c:SchemaClass)
        OPTIONAL MATCH (c)-[:HAS_ATTRIBUTE]->(attr:Attribute)
        OPTIONAL MATCH (c)-[:PARENT_CLASS]->(parent:SchemaClass)
        OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(inst:DataInstance)
        WITH c, parent,
             collect(DISTINCT {
                 id: attr.id,
                 name: attr.name,
                 data_type: attr.data_type,
                 is_primary_key: attr.is_primary_key,
                 is_foreign_key: attr.is_foreign_key
             }) as attributes,
             count(DISTINCT inst) as instance_count
        RETURN c.id as id,
               c.name as name,
               c.display_name as display_name,
               c.level as level,
               parent.id as parent_id,
               attributes,
               instance_count
        ORDER BY c.level, c.name
        """
        
        params = {'schema_id': schema_id}
        return query, params
    
    @staticmethod
    def build_instance_count_query(
        class_id: str
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to count instances for a class"""
        query = """
        MATCH (c:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(inst:DataInstance)
        RETURN count(inst) as count
        """
        
        params = {'class_id': class_id}
        return query, params
    
    @staticmethod
    def build_delete_node_query(
        label: str,
        node_id: str,
        detach: bool = True
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to delete a node"""
        detach_str = "DETACH " if detach else ""
        query = f"""
        MATCH (n:{label} {{id: $node_id}})
        {detach_str}DELETE n
        """
        
        params = {'node_id': node_id}
        return query, params
    
    @staticmethod
    def build_update_node_query(
        label: str,
        node_id: str,
        updates: Dict[str, Any]
    ) -> tuple[str, Dict[str, Any]]:
        """Build query to update node properties"""
        set_clauses = [f"n.{key} = ${key}" for key in updates.keys()]
        set_str = ", ".join(set_clauses)
        
        query = f"""
        MATCH (n:{label} {{id: $node_id}})
        SET {set_str}
        RETURN n
        """
        
        params = {'node_id': node_id, **updates}
        return query, params