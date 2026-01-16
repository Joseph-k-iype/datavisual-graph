# backend/app/services/schema_service.py - OPTIMIZED VERSION

from typing import List, Dict, Any, Optional
from ..database import db
from ..models.schemas import (
    SchemaDefinition, SchemaClass, SchemaRelationship,
    SchemaCreateRequest, LineageNode, LineageEdge,
    LineageGraphResponse, LineagePathResponse, SchemaStats
)
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class SchemaService:
    """Service for schema operations - OPTIMIZED"""
    
    @staticmethod
    def get_lineage_graph(schema_id: str, expanded_classes: List[str] = None) -> LineageGraphResponse:
        """
        Get hierarchical lineage graph for a schema - FIXED FOR FALKORDB STRUCTURE
        
        FalkorDB Structure:
        - Schema -[HAS_CLASS]-> SchemaClass
        - SchemaClass -[SCHEMA_REL]-> SchemaClass (with properties: id, name, source_class_id, target_class_id, cardinality)
        - DataInstance -[INSTANCE_OF]-> SchemaClass
        - DataInstance -[DATA_REL]-> DataInstance
        """
        try:
            import json
            
            logger.info(f"🔍 Loading lineage graph for schema: {schema_id}")
            logger.info(f"📋 Expanded classes: {expanded_classes}")
            
            if expanded_classes is None:
                expanded_classes = []
            
            # QUERY 1: Get schema, classes, and relationships
            schema_query = """
            MATCH (schema:Schema {id: $schema_id})
            MATCH (schema)-[:HAS_CLASS]->(class:SchemaClass)
            RETURN schema.name as schema_name,
                   collect(DISTINCT {
                       id: class.id,
                       name: class.name,
                       attributes: class.attributes,
                       color: class.color,
                       icon: class.icon
                   }) as classes
            """
            
            result = db.execute_query(schema_query, {'schema_id': schema_id})
            
            if not result.result_set or len(result.result_set) == 0:
                logger.warning(f"Schema {schema_id} not found")
                return LineageGraphResponse(
                    schema_id=schema_id,
                    schema_name="Unknown",
                    nodes=[],
                    edges=[],
                    metadata={'total_nodes': 0, 'total_edges': 0}
                )
            
            row = result.result_set[0]
            schema_name = row[0]
            classes_data = row[1]
            
            logger.info(f"📦 Retrieved {len(classes_data)} classes from schema")
            
            # DEBUG: Show what classes we have
            for cls in classes_data:
                logger.info(f"  Class: {cls.get('name')} (ID: {cls.get('id')})")
            
            # QUERY 2: Get ALL schema relationships (SCHEMA_REL edges)
            # Find relationships between classes that belong to this schema
            rels_query = """
            MATCH (schema:Schema {id: $schema_id})-[:HAS_CLASS]->(source:SchemaClass)
            MATCH (source)-[r:SCHEMA_REL]->(target:SchemaClass)
            RETURN r.id as id,
                   r.source_class_id as source_class_id,
                   r.target_class_id as target_class_id,
                   r.name as name,
                   r.cardinality as cardinality,
                   source.id as actual_source,
                   target.id as actual_target
            """
            
            logger.info(f"🔍 Executing relationship query...")
            rels_result = db.execute_query(rels_query, {'schema_id': schema_id})
            
            schema_rels_data = []
            if rels_result.result_set:
                for row in rels_result.result_set:
                    rel = {
                        'id': row[0],
                        'source_class_id': row[1],
                        'target_class_id': row[2],
                        'name': row[3],
                        'cardinality': row[4],
                        'actual_source': row[5],
                        'actual_target': row[6]
                    }
                    logger.info(f"  Found SCHEMA_REL: {rel}")
                    schema_rels_data.append(rel)
            
            logger.info(f"🔗 Retrieved {len(schema_rels_data)} schema relationships")
            
            # If no relationships found, try a simpler query to debug
            if len(schema_rels_data) == 0:
                logger.warning("⚠️ No relationships found with main query, trying fallback...")
                fallback_query = """
                MATCH ()-[r:SCHEMA_REL]->()
                RETURN r.id as id,
                       r.source_class_id as source_class_id,
                       r.target_class_id as target_class_id,
                       r.name as name,
                       r.cardinality as cardinality
                LIMIT 10
                """
                fallback_result = db.execute_query(fallback_query)
                
                if fallback_result.result_set:
                    logger.info(f"Found {len(fallback_result.result_set)} SCHEMA_REL edges in database:")
                    for row in fallback_result.result_set:
                        logger.info(f"  Edge: {row[3]} from {row[1]} to {row[2]}")
                else:
                    logger.warning("  No SCHEMA_REL edges found in entire database!")
            
            # QUERY 3: Get instances for expanded classes
            instances_data = []
            if expanded_classes:
                logger.info(f"📦 Loading instances for {len(expanded_classes)} expanded classes...")
                
                for class_id in expanded_classes:
                    logger.info(f"  🔍 Querying instances for class: {class_id}")
                    
                    # Try multiple query patterns to find instances
                    
                    # Pattern 1: DataInstance -[:INSTANCE_OF]-> SchemaClass
                    instances_query_1 = """
                    MATCH (instance:DataInstance)-[:INSTANCE_OF]->(class:SchemaClass {id: $class_id})
                    RETURN instance.id as id,
                           instance.name as name,
                           instance.class_id as class_id,
                           properties(instance) as data
                    """
                    
                    logger.info(f"  Trying Pattern 1: DataInstance -[:INSTANCE_OF]-> SchemaClass...")
                    inst_result = db.execute_query(instances_query_1, {'class_id': class_id})
                    
                    if inst_result.result_set and len(inst_result.result_set) > 0:
                        logger.info(f"  ✅ Pattern 1 worked! Found {len(inst_result.result_set)} instances")
                        for row in inst_result.result_set:
                            inst_id = row[0]
                            inst_name = row[1]
                            inst_class_id = row[2] or class_id
                            inst_properties = row[3] or {}
                            
                            # Parse the 'data' field if it exists and is a string
                            actual_data = {}
                            if isinstance(inst_properties, dict):
                                # If properties has a 'data' field that's a JSON string, parse it
                                if 'data' in inst_properties and isinstance(inst_properties['data'], str):
                                    try:
                                        actual_data = json.loads(inst_properties['data'])
                                        logger.info(f"    Parsed JSON data: {actual_data}")
                                    except json.JSONDecodeError:
                                        logger.warning(f"    Failed to parse data JSON for {inst_id}")
                                        actual_data = inst_properties
                                else:
                                    # Use properties as-is
                                    actual_data = inst_properties
                            
                            # Extract name from parsed data
                            display_name = (
                                actual_data.get('name') or 
                                inst_name or 
                                inst_id
                            )
                            
                            logger.info(f"    Instance: {display_name} (ID: {inst_id})")
                            logger.info(f"      Parsed Data: {actual_data}")
                            
                            instances_data.append({
                                'id': inst_id,
                                'name': display_name,
                                'parent_id': inst_class_id,
                                'data': actual_data  # Use parsed data
                            })
                        continue
                    else:
                        logger.info(f"  ❌ Pattern 1 found nothing")
                    
                    # Pattern 2: SchemaClass <-[:INSTANCE_OF]- DataInstance (reversed)
                    instances_query_2 = """
                    MATCH (class:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(instance:DataInstance)
                    RETURN instance.id as id,
                           instance.name as name,
                           instance.class_id as class_id,
                           properties(instance) as data
                    """
                    
                    logger.info(f"  Trying Pattern 2: SchemaClass <-[:INSTANCE_OF]- DataInstance...")
                    inst_result = db.execute_query(instances_query_2, {'class_id': class_id})
                    
                    if inst_result.result_set and len(inst_result.result_set) > 0:
                        logger.info(f"  ✅ Pattern 2 worked! Found {len(inst_result.result_set)} instances")
                        for row in inst_result.result_set:
                            inst_id = row[0]
                            inst_name = row[1]
                            inst_class_id = row[2] or class_id
                            inst_properties = row[3] or {}
                            
                            # Parse the 'data' field if it exists and is a JSON string
                            actual_data = {}
                            if isinstance(inst_properties, dict):
                                if 'data' in inst_properties and isinstance(inst_properties['data'], str):
                                    try:
                                        actual_data = json.loads(inst_properties['data'])
                                        logger.info(f"    Parsed JSON data: {actual_data}")
                                    except json.JSONDecodeError:
                                        logger.warning(f"    Failed to parse data JSON for {inst_id}")
                                        actual_data = inst_properties
                                else:
                                    actual_data = inst_properties
                            
                            # Extract name from parsed data
                            display_name = (
                                actual_data.get('name') or 
                                inst_name or 
                                inst_id
                            )
                            
                            logger.info(f"    Instance: {display_name} (ID: {inst_id})")
                            logger.info(f"      Parsed Data: {actual_data}")
                            
                            instances_data.append({
                                'id': inst_id,
                                'name': display_name,
                                'parent_id': inst_class_id,
                                'data': actual_data
                            })
                        continue
                    else:
                        logger.info(f"  ❌ Pattern 2 found nothing")
                    
                    # Pattern 3: Match by class_id property
                    instances_query_3 = """
                    MATCH (instance:DataInstance {class_id: $class_id})
                    RETURN instance.id as id,
                           instance.name as name,
                           instance.class_id as class_id,
                           properties(instance) as data
                    """
                    
                    logger.info(f"  Trying Pattern 3: DataInstance with class_id property...")
                    inst_result = db.execute_query(instances_query_3, {'class_id': class_id})
                    
                    if inst_result.result_set and len(inst_result.result_set) > 0:
                        logger.info(f"  ✅ Pattern 3 worked! Found {len(inst_result.result_set)} instances")
                        for row in inst_result.result_set:
                            inst_id = row[0]
                            inst_name = row[1]
                            inst_class_id = row[2] or class_id
                            inst_properties = row[3] or {}
                            
                            # Parse the 'data' field if it exists and is a JSON string
                            actual_data = {}
                            if isinstance(inst_properties, dict):
                                if 'data' in inst_properties and isinstance(inst_properties['data'], str):
                                    try:
                                        actual_data = json.loads(inst_properties['data'])
                                        logger.info(f"    Parsed JSON data: {actual_data}")
                                    except json.JSONDecodeError:
                                        logger.warning(f"    Failed to parse data JSON for {inst_id}")
                                        actual_data = inst_properties
                                else:
                                    actual_data = inst_properties
                            
                            # Extract name from parsed data
                            display_name = (
                                actual_data.get('name') or 
                                inst_name or 
                                inst_id
                            )
                            
                            logger.info(f"    Instance: {display_name} (ID: {inst_id})")
                            logger.info(f"      Parsed Data: {actual_data}")
                            
                            instances_data.append({
                                'id': inst_id,
                                'name': display_name,
                                'parent_id': inst_class_id,
                                'data': actual_data
                            })
                        continue
                    else:
                        logger.info(f"  ❌ Pattern 3 found nothing")
                    
                    # Pattern 4: Check what instances exist at all
                    debug_query = """
                    MATCH (instance:DataInstance)
                    RETURN instance.id, instance.class_id, labels(instance), properties(instance)
                    LIMIT 5
                    """
                    
                    logger.info(f"  🔍 Debug: Checking ALL DataInstances in database...")
                    debug_result = db.execute_query(debug_query)
                    
                    if debug_result.result_set:
                        logger.info(f"  Found {len(debug_result.result_set)} DataInstance nodes:")
                        for row in debug_result.result_set:
                            logger.info(f"    - ID: {row[0]}, class_id: {row[1]}, labels: {row[2]}")
                            logger.info(f"      Properties: {row[3]}")
                    else:
                        logger.warning(f"  ⚠️ NO DataInstance nodes found in database!")
                    
                    # Pattern 5: Check relationships FROM instances
                    rel_debug_query = """
                    MATCH (instance:DataInstance)-[r]->(target)
                    RETURN instance.id, type(r), target.id, labels(target)
                    LIMIT 10
                    """
                    
                    logger.info(f"  🔍 Debug: Checking relationships FROM DataInstances...")
                    rel_debug_result = db.execute_query(rel_debug_query)
                    
                    if rel_debug_result.result_set:
                        logger.info(f"  Found {len(rel_debug_result.result_set)} relationships:")
                        for row in rel_debug_result.result_set:
                            logger.info(f"    - {row[0]} -[{row[1]}]-> {row[2]} ({row[3]})")
                    else:
                        logger.info(f"  No outgoing relationships from DataInstances")
                    
                    # Pattern 6: Check relationships TO instances
                    rel_debug_query_2 = """
                    MATCH (source)-[r]->(instance:DataInstance)
                    RETURN source.id, type(r), instance.id, labels(source)
                    LIMIT 10
                    """
                    
                    logger.info(f"  🔍 Debug: Checking relationships TO DataInstances...")
                    rel_debug_result_2 = db.execute_query(rel_debug_query_2)
                    
                    if rel_debug_result_2.result_set:
                        logger.info(f"  Found {len(rel_debug_result_2.result_set)} relationships:")
                        for row in rel_debug_result_2.result_set:
                            logger.info(f"    - {row[0]} ({row[3]}) -[{row[1]}]-> {row[2]}")
                    else:
                        logger.info(f"  No incoming relationships to DataInstances")
                
                logger.info(f"📊 Total instances loaded: {len(instances_data)}")
            else:
                logger.info("📦 No expanded classes - skipping instance loading")
            
            # QUERY 4: Get data relationships for expanded classes
            data_rels_data = []
            if expanded_classes:
                for class_id in expanded_classes:
                    data_rels_query = """
                    MATCH (source:DataInstance)-[r:DATA_REL]->(target:DataInstance)
                    WHERE source.class_id = $class_id OR target.class_id = $class_id
                    RETURN r.id as id,
                           r.source_id as source,
                           r.target_id as target,
                           r.source_class_id as parent_class
                    """
                    
                    data_rels_result = db.execute_query(data_rels_query, {'class_id': class_id})
                    
                    if data_rels_result.result_set:
                        for row in data_rels_result.result_set:
                            data_rels_data.append({
                                'id': row[0],
                                'source': row[1],
                                'target': row[2],
                                'parent_class': row[3]
                            })
                
                logger.info(f"🔗 Retrieved {len(data_rels_data)} data relationships")
            
            # Process nodes and edges
            nodes: List[LineageNode] = []
            edges: List[LineageEdge] = []
            
            # Get instance counts for ALL classes (even if not expanded)
            instance_counts = {}
            logger.info(f"🔢 Counting instances for all classes...")
            
            for class_data in classes_data:
                if not class_data or not class_data.get('id'):
                    continue
                    
                class_id = class_data['id']
                
                # Try multiple patterns to count instances
                count = 0
                
                # Pattern 1: DataInstance -[:INSTANCE_OF]-> SchemaClass
                count_query_1 = """
                MATCH (instance:DataInstance)-[:INSTANCE_OF]->(class:SchemaClass {id: $class_id})
                RETURN count(instance) as count
                """
                count_result = db.execute_query(count_query_1, {'class_id': class_id})
                
                if count_result.result_set and count_result.result_set[0]:
                    count = count_result.result_set[0][0]
                
                # If Pattern 1 found nothing, try Pattern 2
                if count == 0:
                    count_query_2 = """
                    MATCH (class:SchemaClass {id: $class_id})<-[:INSTANCE_OF]-(instance:DataInstance)
                    RETURN count(instance) as count
                    """
                    count_result = db.execute_query(count_query_2, {'class_id': class_id})
                    
                    if count_result.result_set and count_result.result_set[0]:
                        count = count_result.result_set[0][0]
                
                # If still 0, try matching by class_id property
                if count == 0:
                    count_query_3 = """
                    MATCH (instance:DataInstance {class_id: $class_id})
                    RETURN count(instance) as count
                    """
                    count_result = db.execute_query(count_query_3, {'class_id': class_id})
                    
                    if count_result.result_set and count_result.result_set[0]:
                        count = count_result.result_set[0][0]
                
                instance_counts[class_id] = count
                logger.info(f"  Class {class_data.get('name')} ({class_id}): {count} instances")
            
            logger.info(f"📊 Instance counts: {instance_counts}")
            
            # Process schema classes
            valid_class_ids = set()
            class_id_map = {}  # Map both stored ID and actual ID
            
            for class_data in classes_data:
                if not class_data or not class_data.get('id'):
                    continue
                
                class_id = class_data['id']
                valid_class_ids.add(class_id)
                class_id_map[class_id] = class_id
                
                # Get instance count from our pre-calculated counts
                instance_count = instance_counts.get(class_id, 0)
                
                is_expanded = class_id in expanded_classes
                
                # Parse attributes - handle both string and list
                attributes = class_data.get('attributes', [])
                if isinstance(attributes, str):
                    try:
                        attributes = json.loads(attributes)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to parse attributes for class {class_id}")
                        attributes = []
                elif not isinstance(attributes, list):
                    attributes = []
                
                nodes.append(LineageNode(
                    id=class_id,
                    type='schema_class',
                    name=class_data.get('name', 'Unnamed'),
                    schema_id=schema_id,
                    class_id=class_id,
                    collapsed=not is_expanded,
                    data={
                        'instance_count': instance_count,
                        'attributes': attributes,
                        'color': class_data.get('color', '#6B7280'),
                        'icon': class_data.get('icon', 'Box'),
                    }
                ))
                
                logger.info(f"  ✅ Class: {class_data.get('name')} ({class_id}) - "
                          f"{instance_count} instances, expanded={is_expanded}")
            
            logger.info(f"Valid class IDs: {valid_class_ids}")
            
            # Process data instances (only for expanded classes)
            logger.info(f"🔄 Processing {len(instances_data)} instances...")
            for inst_data in instances_data:
                if not inst_data or not inst_data.get('id'):
                    logger.warning("  Skipping instance with no ID")
                    continue
                
                parent_id = inst_data.get('parent_id')
                inst_id = inst_data['id']
                
                # Only include instances for expanded classes
                if parent_id not in expanded_classes:
                    logger.warning(f"  Skipping instance {inst_id} - parent {parent_id} not expanded")
                    continue
                
                # The data has already been parsed in the query sections above
                parsed_data = inst_data.get('data', {})
                display_name = inst_data.get('name', inst_id)
                
                logger.info(f"  ✅ Adding instance: {display_name} (ID: {inst_id}, parent: {parent_id})")
                logger.info(f"      Final Data: {parsed_data}")
                
                nodes.append(LineageNode(
                    id=inst_id,
                    type='data_instance',
                    name=display_name,
                    schema_id=schema_id,
                    parent_id=parent_id,
                    class_id=parent_id,
                    collapsed=False,
                    data=parsed_data  # Already parsed data object
                ))
                
                # Add parent-child edge (INSTANCE_OF relationship)
                parent_child_edge_id = f"parent_{parent_id}_{inst_id}"
                
                logger.info(f"  ✅ Adding parent-child edge: {parent_child_edge_id}")
                
                edges.append(LineageEdge(
                    id=parent_child_edge_id,
                    source=parent_id,
                    target=inst_id,
                    type='parent_child',
                    label='instance of'
                ))
            
            # Process schema relationships (SCHEMA_REL edges)
            logger.info(f"🔗 Processing {len(schema_rels_data)} SCHEMA_REL relationships...")
            for rel_data in schema_rels_data:
                if not rel_data or not rel_data.get('id'):
                    logger.warning(f"  ⚠️ Skipping null/invalid relationship")
                    continue
                
                # Try both the stored IDs and actual IDs
                source_id = rel_data.get('source_class_id') or rel_data.get('actual_source')
                target_id = rel_data.get('target_class_id') or rel_data.get('actual_target')
                
                logger.info(f"  Checking SCHEMA_REL: {rel_data.get('name')}")
                logger.info(f"    ID: {rel_data.get('id')}")
                logger.info(f"    Source: {source_id}")
                logger.info(f"    Target: {target_id}")
                logger.info(f"    Valid classes: {valid_class_ids}")
                
                # Check if both classes exist in our valid set
                if source_id not in valid_class_ids:
                    logger.warning(f"    ⚠️ Source class {source_id} not in valid classes")
                    # Try the actual source
                    source_id = rel_data.get('actual_source')
                    if source_id not in valid_class_ids:
                        logger.warning(f"    ⚠️ Actual source {source_id} also not in valid classes")
                        continue
                    
                if target_id not in valid_class_ids:
                    logger.warning(f"    ⚠️ Target class {target_id} not in valid classes")
                    # Try the actual target
                    target_id = rel_data.get('actual_target')
                    if target_id not in valid_class_ids:
                        logger.warning(f"    ⚠️ Actual target {target_id} also not in valid classes")
                        continue
                
                logger.info(f"  ✅ Adding SCHEMA_REL edge: {rel_data.get('name')} ({source_id} → {target_id})")
                
                edges.append(LineageEdge(
                    id=rel_data['id'],
                    source=source_id,
                    target=target_id,
                    type='schema_relationship',
                    label=rel_data.get('name', 'related to'),
                    data={'cardinality': rel_data.get('cardinality')}
                ))
            
            # Process data relationships (only for expanded classes)
            for rel_data in data_rels_data:
                if not rel_data or not rel_data.get('id'):
                    continue
                
                parent_class = rel_data.get('parent_class')
                
                # Only include if parent class is expanded
                if parent_class not in expanded_classes:
                    continue
                
                edges.append(LineageEdge(
                    id=rel_data['id'],
                    source=rel_data.get('source'),
                    target=rel_data.get('target'),
                    type='data_relationship',
                    label='related to'
                ))
            
            logger.info(f"✅ Final graph: {len(nodes)} nodes, {len(edges)} edges")
            logger.info(f"   Schema relationships (edges): {len([e for e in edges if e.type == 'schema_relationship'])}")
            logger.info(f"   Parent-child (edges): {len([e for e in edges if e.type == 'parent_child'])}")
            logger.info(f"   Data relationships (edges): {len([e for e in edges if e.type == 'data_relationship'])}")
            
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name=schema_name,
                nodes=nodes,
                edges=edges,
                metadata={
                    'total_nodes': len(nodes),
                    'total_edges': len(edges),
                    'expanded_classes': expanded_classes,
                    'generated_at': datetime.utcnow().isoformat()
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to get lineage graph: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            # Return empty graph instead of raising
            return LineageGraphResponse(
                schema_id=schema_id,
                schema_name="Error",
                nodes=[],
                edges=[],
                metadata={'error': str(e)}
            )
    
    @staticmethod
    def create_schema(request: SchemaCreateRequest) -> SchemaDefinition:
        """Create a new schema definition"""
        try:
            schema_id = f"schema_{request.name.lower().replace(' ', '_')}_{int(datetime.utcnow().timestamp())}"
            
            query = """
            CREATE (s:Schema {
                id: $id,
                name: $name,
                description: $description,
                created_at: $created_at
            })
            RETURN s
            """
            
            db.execute_query(query, {
                'id': schema_id,
                'name': request.name,
                'description': request.description or '',
                'created_at': datetime.utcnow().isoformat()
            })
            
            classes = []
            for cls_req in request.classes:
                class_id = f"{schema_id}_class_{cls_req.name.lower().replace(' ', '_')}"
                
                cls_query = """
                MATCH (s:Schema {id: $schema_id})
                CREATE (c:SchemaClass {
                    id: $id,
                    name: $name,
                    attributes: $attributes,
                    color: $color,
                    icon: $icon,
                    schema_id: $schema_id
                })
                CREATE (s)-[:HAS_CLASS]->(c)
                RETURN c
                """
                
                db.execute_query(cls_query, {
                    'id': class_id,
                    'schema_id': schema_id,
                    'name': cls_req.name,
                    'attributes': cls_req.attributes,
                    'color': cls_req.color or '#6B7280',
                    'icon': cls_req.icon or 'Box'
                })
                
                classes.append(SchemaClass(
                    id=class_id,
                    name=cls_req.name,
                    attributes=cls_req.attributes,
                    color=cls_req.color,
                    icon=cls_req.icon
                ))
            
            relationships = []
            for rel_req in request.relationships:
                rel_id = f"{schema_id}_rel_{len(relationships)}"
                
                rel_query = """
                MATCH (source:SchemaClass {id: $source_id})
                MATCH (target:SchemaClass {id: $target_id})
                CREATE (source)-[r:SCHEMA_REL {
                    id: $id,
                    source_class_id: $source_id,
                    target_class_id: $target_id,
                    name: $name,
                    cardinality: $cardinality
                }]->(target)
                RETURN r
                """
                
                db.execute_query(rel_query, {
                    'id': rel_id,
                    'source_id': rel_req.source_class_id,
                    'target_id': rel_req.target_class_id,
                    'name': rel_req.name,
                    'cardinality': rel_req.cardinality
                })
                
                relationships.append(SchemaRelationship(
                    id=rel_id,
                    source_class_id=rel_req.source_class_id,
                    target_class_id=rel_req.target_class_id,
                    name=rel_req.name,
                    cardinality=rel_req.cardinality
                ))
            
            logger.info(f"Created schema: {schema_id} with {len(classes)} classes and {len(relationships)} relationships")
            
            return SchemaDefinition(
                id=schema_id,
                name=request.name,
                description=request.description,
                classes=classes,
                relationships=relationships
            )
            
        except Exception as e:
            logger.error(f"Failed to create schema: {str(e)}")
            raise
    
    @staticmethod
    def list_schemas() -> List[Dict[str, Any]]:
        """List all schemas with basic info"""
        try:
            query = """
            MATCH (s:Schema)
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            RETURN s.id as id, s.name as name, s.description as description,
                   s.created_at as created_at,
                   count(DISTINCT c) as class_count,
                   count(DISTINCT i) as instance_count
            ORDER BY s.created_at DESC
            """
            
            result = db.execute_query(query)
            
            schemas = []
            if result.result_set:
                for row in result.result_set:
                    schemas.append({
                        'id': row[0],
                        'name': row[1],
                        'description': row[2] or '',
                        'class_count': row[4],
                        'instance_count': row[5]
                    })
            
            logger.info(f"Found {len(schemas)} schemas")
            return schemas
            
        except Exception as e:
            logger.error(f"Failed to list schemas: {str(e)}")
            raise
    
    @staticmethod
    def get_schema(schema_id: str) -> SchemaDefinition:
        """Get schema definition by ID"""
        try:
            import json
            
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[r:SCHEMA_REL]->(target:SchemaClass)
            WHERE r.source_class_id IS NOT NULL
            RETURN s, 
                   collect(DISTINCT c) as classes, 
                   collect(DISTINCT {
                       id: r.id,
                       source_class_id: r.source_class_id,
                       target_class_id: r.target_class_id,
                       name: r.name,
                       cardinality: r.cardinality
                   }) as relationships
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if not result.result_set:
                raise ValueError(f"Schema {schema_id} not found")
            
            row = result.result_set[0]
            schema_props = dict(row[0].properties)
            classes_nodes = row[1]
            rel_data = row[2]
            
            classes = []
            for cls_node in classes_nodes:
                if cls_node:
                    cls_props = dict(cls_node.properties)
                    
                    # Parse attributes - handle both string and list
                    attributes = cls_props.get('attributes', [])
                    if isinstance(attributes, str):
                        try:
                            attributes = json.loads(attributes)
                        except json.JSONDecodeError:
                            logger.warning(f"Failed to parse attributes for class {cls_props.get('id')}")
                            attributes = []
                    elif not isinstance(attributes, list):
                        attributes = []
                    
                    classes.append(SchemaClass(
                        id=cls_props['id'],
                        name=cls_props['name'],
                        attributes=attributes,
                        color=cls_props.get('color'),
                        icon=cls_props.get('icon')
                    ))
            
            relationships = []
            for rel in rel_data:
                if rel and rel.get('id'):
                    try:
                        relationships.append(SchemaRelationship(
                            id=rel['id'],
                            source_class_id=rel['source_class_id'],
                            target_class_id=rel['target_class_id'],
                            name=rel['name'],
                            cardinality=rel['cardinality']
                        ))
                    except KeyError as e:
                        logger.warning(f"Skipping relationship with missing field: {e}")
                        continue
            
            logger.info(f"Loaded schema {schema_id}: {len(classes)} classes, {len(relationships)} relationships")
            
            return SchemaDefinition(
                id=schema_props['id'],
                name=schema_props['name'],
                description=schema_props.get('description', ''),
                classes=classes,
                relationships=relationships
            )
            
        except Exception as e:
            logger.error(f"Failed to get schema: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            raise
    
    @staticmethod
    def get_schema_stats(schema_id: str) -> SchemaStats:
        """Get statistics for a schema"""
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})
            OPTIONAL MATCH (s)-[:HAS_CLASS]->(c:SchemaClass)
            OPTIONAL MATCH (c)-[sr:SCHEMA_REL]->()
            OPTIONAL MATCH (c)<-[:INSTANCE_OF]-(i:DataInstance)
            OPTIONAL MATCH (i)-[dr:DATA_REL]->()
            RETURN s.name as name,
                   count(DISTINCT c) as total_classes,
                   count(DISTINCT sr) as total_relationships,
                   count(DISTINCT i) as total_instances,
                   count(DISTINCT dr) as total_data_relationships
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            if not result.result_set:
                raise ValueError(f"Schema {schema_id} not found")
            
            row = result.result_set[0]
            
            return SchemaStats(
                schema_id=schema_id,
                schema_name=row[0],
                total_classes=row[1],
                total_relationships=row[2],
                total_instances=row[3],
                total_data_relationships=row[4],
                instances_by_class={}
            )
            
        except Exception as e:
            logger.error(f"Failed to get schema stats: {str(e)}")
            raise
    
    @staticmethod
    def get_lineage_path(schema_id: str, start_node_id: str, end_node_id: Optional[str] = None, max_depth: int = 10) -> LineagePathResponse:
        """Get lineage path - simplified version"""
        try:
            # Basic path finding implementation
            if end_node_id:
                query = """
                MATCH path = shortestPath((start {id: $start_id})-[*1..10]-(end {id: $end_id}))
                RETURN [node IN nodes(path) | node.id] as path
                """
                result = db.execute_query(query, {
                    'start_id': start_node_id,
                    'end_id': end_node_id
                })
                
                if result.result_set and result.result_set[0]:
                    path = result.result_set[0][0]
                    return LineagePathResponse(
                        paths=[path],
                        highlighted_nodes=path,
                        highlighted_edges=[]
                    )
            
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=[start_node_id],
                highlighted_edges=[]
            )
            
        except Exception as e:
            logger.error(f"Failed to get lineage path: {str(e)}")
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=[],
                highlighted_edges=[]
            )
    
    @staticmethod
    def get_shortest_path(schema_id: str, node_ids: List[str]) -> LineagePathResponse:
        """Find shortest path - delegates to all paths for now"""
        return SchemaService.get_all_paths_between_nodes(schema_id, node_ids, max_depth=10)
    
    @staticmethod
    def get_all_paths_between_nodes(schema_id: str, node_ids: List[str], max_depth: int = 10) -> LineagePathResponse:
        """Find all paths between multiple nodes"""
        try:
            all_paths = []
            all_nodes = set(node_ids)
            all_edges = set()
            
            # Find paths between all pairs
            for i in range(len(node_ids)):
                for j in range(i + 1, len(node_ids)):
                    start_id = node_ids[i]
                    end_id = node_ids[j]
                    
                    query = """
                    MATCH path = (start {id: $start_id})-[*1..5]-(end {id: $end_id})
                    WHERE ALL(node IN nodes(path) WHERE 
                        node:SchemaClass OR node:DataInstance)
                    RETURN [node IN nodes(path) | node.id] as node_path,
                           [rel IN relationships(path) | rel.id] as edge_path
                    LIMIT 10
                    """
                    
                    result = db.execute_query(query, {
                        'start_id': start_id,
                        'end_id': end_id
                    })
                    
                    if result.result_set:
                        for row in result.result_set:
                            node_path = row[0]
                            edge_path = row[1]
                            
                            all_paths.append(node_path)
                            all_nodes.update(node_path)
                            all_edges.update([e for e in edge_path if e])
            
            return LineagePathResponse(
                paths=all_paths,
                highlighted_nodes=list(all_nodes),
                highlighted_edges=list(all_edges)
            )
            
        except Exception as e:
            logger.error(f"Failed to find all paths: {str(e)}")
            return LineagePathResponse(
                paths=[],
                highlighted_nodes=node_ids,
                highlighted_edges=[]
            )