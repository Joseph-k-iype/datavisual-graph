# backend/app/services/lineage/attribute_lineage_service.py - NEW FILE

"""
Attribute Lineage Service - Core logic for attribute-level lineage tracing
Handles fine-grain column-level lineage with end-to-end mapping
"""

from typing import List, Dict, Any, Optional, Tuple
from ...database import db
from ...models.lineage.attribute import (
    Attribute,
    AttributeLineage,
    AttributeLineageNode,
    AttributeLineagePath,
    AttributeTraceRequest,
    AttributeTraceResponse,
    ImpactAnalysisRequest,
    ImpactAnalysisResponse,
    TransformationRule,
    TransformationType,
)
import logging
import json
import uuid

logger = logging.getLogger(__name__)


class AttributeLineageService:
    """Service for attribute-level lineage operations"""
    
    @staticmethod
    def get_attribute(attribute_id: str) -> Optional[Attribute]:
        """Get attribute details"""
        try:
            query = """
            MATCH (attr:Attribute {id: $attr_id})
            OPTIONAL MATCH (attr)-[:BELONGS_TO]->(class:SchemaClass)
            RETURN attr, class.id as class_id, class.name as class_name
            """
            
            result = db.execute_query(query, {'attr_id': attribute_id})
            
            if not result.result_set:
                return None
            
            row = result.result_set[0]
            attr_props = dict(row[0].properties)
            
            return Attribute(
                id=attr_props['id'],
                name=attr_props['name'],
                display_name=attr_props.get('display_name'),
                data_type=attr_props['data_type'],
                is_primary_key=attr_props.get('is_primary_key', False),
                is_foreign_key=attr_props.get('is_foreign_key', False),
                is_nullable=attr_props.get('is_nullable', True),
                description=attr_props.get('description'),
                business_name=attr_props.get('business_name'),
                business_description=attr_props.get('business_description'),
                sensitivity_level=attr_props.get('sensitivity_level'),
                lineage_enabled=attr_props.get('lineage_enabled', True),
                position=attr_props.get('position', 0),
                metadata=json.loads(attr_props.get('metadata', '{}'))
            )
            
        except Exception as e:
            logger.error(f"Failed to get attribute: {str(e)}")
            raise
    
    @staticmethod
    def trace_attribute_lineage(request: AttributeTraceRequest) -> AttributeTraceResponse:
        """
        Trace complete lineage for an attribute
        
        This finds all upstream sources and downstream targets for an attribute,
        including transformations and intermediate nodes.
        """
        try:
            logger.info(f"🔍 Tracing attribute lineage: {request.attribute_id}")
            logger.info(f"   Direction: {request.direction}, Max depth: {request.max_depth}")
            
            # Get source attribute
            attribute = AttributeLineageService.get_attribute(request.attribute_id)
            if not attribute:
                raise ValueError(f"Attribute not found: {request.attribute_id}")
            
            # Initialize lineage
            lineage = AttributeLineage(
                attribute_id=attribute.id,
                attribute_name=attribute.name,
                class_id="",  # Will be filled
                class_name="",  # Will be filled
            )
            
            # Get upstream lineage
            if request.direction in ['upstream', 'both']:
                logger.info("📤 Finding upstream sources...")
                upstream = AttributeLineageService._trace_upstream(
                    request.attribute_id,
                    request.max_depth,
                    request.include_transformations
                )
                lineage.source_attributes = upstream['nodes']
                lineage.lineage_paths.extend(upstream['paths'])
            
            # Get downstream lineage
            if request.direction in ['downstream', 'both']:
                logger.info("📥 Finding downstream targets...")
                downstream = AttributeLineageService._trace_downstream(
                    request.attribute_id,
                    request.max_depth,
                    request.include_transformations
                )
                lineage.target_attributes = downstream['nodes']
                lineage.lineage_paths.extend(downstream['paths'])
            
            # Collect highlighted nodes and edges
            highlighted_nodes = [request.attribute_id]
            highlighted_edges = []
            
            for path in lineage.lineage_paths:
                for node in path.attributes:
                    highlighted_nodes.append(node.attribute_id)
            
            logger.info(f"✅ Trace complete: {len(lineage.source_attributes)} sources, "
                       f"{len(lineage.target_attributes)} targets, "
                       f"{len(lineage.lineage_paths)} paths")
            
            return AttributeTraceResponse(
                attribute=attribute,
                lineage=lineage,
                highlighted_nodes=list(set(highlighted_nodes)),
                highlighted_edges=highlighted_edges,
            )
            
        except Exception as e:
            logger.error(f"Failed to trace attribute lineage: {str(e)}")
            raise
    
    @staticmethod
    def _trace_upstream(
        attribute_id: str,
        max_depth: int,
        include_transformations: bool
    ) -> Dict[str, Any]:
        """
        Trace upstream sources for an attribute
        
        Cypher pattern:
        (target:Attribute)<-[:FLOWS_TO*1..max_depth]-(source:Attribute)
        """
        try:
            # Find all upstream attributes using variable-length pattern
            query = """
            MATCH path = (source:Attribute)-[:ATTRIBUTE_FLOWS_TO*1..%(max_depth)d]->(target:Attribute {id: $attr_id})
            WITH source, target, path, length(path) as depth
            OPTIONAL MATCH (source)-[:BELONGS_TO]->(src_class:SchemaClass)
            OPTIONAL MATCH (target)-[:BELONGS_TO]->(tgt_class:SchemaClass)
            RETURN DISTINCT
                source.id as source_id,
                source.name as source_name,
                source.data_type as source_type,
                src_class.id as source_class_id,
                src_class.name as source_class_name,
                depth,
                [rel IN relationships(path) | rel.transformation] as transformations
            ORDER BY depth
            """ % {'max_depth': max_depth}
            
            result = db.execute_query(query, {'attr_id': attribute_id})
            
            nodes = []
            paths = []
            
            if result.result_set:
                for row in result.result_set:
                    # Create lineage node
                    node = AttributeLineageNode(
                        attribute_id=row[0],
                        attribute_name=row[1],
                        class_id=row[3] or "",
                        class_name=row[4] or "",
                        level=row[5],
                        data_type=row[2],
                        transformation=None,  # Will be populated if needed
                    )
                    nodes.append(node)
                    
                    # Create path
                    if include_transformations and row[6]:
                        # Parse transformations
                        transformations = []
                        for trans_json in row[6]:
                            if trans_json:
                                trans_dict = json.loads(trans_json)
                                transformations.append(TransformationRule(**trans_dict))
                        
                        path = AttributeLineagePath(
                            path_id=str(uuid.uuid4()),
                            attributes=[node],  # Simplified
                            transformations=transformations,
                            total_hops=row[5],
                        )
                        paths.append(path)
            
            logger.info(f"   Found {len(nodes)} upstream sources")
            
            return {
                'nodes': nodes,
                'paths': paths,
            }
            
        except Exception as e:
            logger.error(f"Failed to trace upstream: {str(e)}")
            return {'nodes': [], 'paths': []}
    
    @staticmethod
    def _trace_downstream(
        attribute_id: str,
        max_depth: int,
        include_transformations: bool
    ) -> Dict[str, Any]:
        """
        Trace downstream targets for an attribute
        
        Cypher pattern:
        (source:Attribute)-[:FLOWS_TO*1..max_depth]->(target:Attribute)
        """
        try:
            # Find all downstream attributes
            query = """
            MATCH path = (source:Attribute {id: $attr_id})-[:ATTRIBUTE_FLOWS_TO*1..%(max_depth)d]->(target:Attribute)
            WITH source, target, path, length(path) as depth
            OPTIONAL MATCH (source)-[:BELONGS_TO]->(src_class:SchemaClass)
            OPTIONAL MATCH (target)-[:BELONGS_TO]->(tgt_class:SchemaClass)
            RETURN DISTINCT
                target.id as target_id,
                target.name as target_name,
                target.data_type as target_type,
                tgt_class.id as target_class_id,
                tgt_class.name as target_class_name,
                depth,
                [rel IN relationships(path) | rel.transformation] as transformations
            ORDER BY depth
            """ % {'max_depth': max_depth}
            
            result = db.execute_query(query, {'attr_id': attribute_id})
            
            nodes = []
            paths = []
            
            if result.result_set:
                for row in result.result_set:
                    node = AttributeLineageNode(
                        attribute_id=row[0],
                        attribute_name=row[1],
                        class_id=row[3] or "",
                        class_name=row[4] or "",
                        level=row[5],
                        data_type=row[2],
                    )
                    nodes.append(node)
                    
                    if include_transformations and row[6]:
                        transformations = []
                        for trans_json in row[6]:
                            if trans_json:
                                trans_dict = json.loads(trans_json)
                                transformations.append(TransformationRule(**trans_dict))
                        
                        path = AttributeLineagePath(
                            path_id=str(uuid.uuid4()),
                            attributes=[node],
                            transformations=transformations,
                            total_hops=row[5],
                        )
                        paths.append(path)
            
            logger.info(f"   Found {len(nodes)} downstream targets")
            
            return {
                'nodes': nodes,
                'paths': paths,
            }
            
        except Exception as e:
            logger.error(f"Failed to trace downstream: {str(e)}")
            return {'nodes': [], 'paths': []}
    
    @staticmethod
    def perform_impact_analysis(request: ImpactAnalysisRequest) -> ImpactAnalysisResponse:
        """
        Perform impact analysis for a node (class, attribute, or instance)
        
        Impact analysis shows what would be affected if this node changes or fails.
        """
        try:
            logger.info(f"🎯 Performing impact analysis: {request.node_id}")
            logger.info(f"   Type: {request.node_type}, Analysis: {request.analysis_type}")
            
            # Based on node type, use different queries
            if request.node_type == 'attribute':
                return AttributeLineageService._analyze_attribute_impact(request)
            elif request.node_type == 'class':
                return AttributeLineageService._analyze_class_impact(request)
            else:
                return AttributeLineageService._analyze_instance_impact(request)
                
        except Exception as e:
            logger.error(f"Failed to perform impact analysis: {str(e)}")
            raise
    
    @staticmethod
    def _analyze_attribute_impact(request: ImpactAnalysisRequest) -> ImpactAnalysisResponse:
        """Analyze impact for an attribute"""
        try:
            # Find all downstream dependencies
            query = """
            MATCH path = (source:Attribute {id: $node_id})-[:ATTRIBUTE_FLOWS_TO*1..%(max_depth)d]->(target:Attribute)
            WITH target, length(path) as distance, path
            ORDER BY distance
            RETURN 
                target.id as id,
                target.name as name,
                distance,
                count(path) as path_count
            """ % {'max_depth': request.max_depth}
            
            result = db.execute_query(query, {'node_id': request.node_id})
            
            impacted_nodes = []
            impact_by_level = {'direct': 0, 'indirect': 0, 'total': 0}
            
            if result.result_set:
                for row in result.result_set:
                    impacted_nodes.append(row[0])
                    impact_by_level['total'] += 1
                    
                    if row[2] == 1:  # Distance 1 = direct
                        impact_by_level['direct'] += 1
                    else:
                        impact_by_level['indirect'] += 1
            
            # Calculate risk score (0-1) based on number of impacts
            risk_score = min(1.0, len(impacted_nodes) / 100.0)
            
            logger.info(f"✅ Impact analysis complete: {len(impacted_nodes)} nodes impacted")
            
            return ImpactAnalysisResponse(
                source_node_id=request.node_id,
                impacted_nodes=impacted_nodes,
                impacted_count=len(impacted_nodes),
                impact_levels=impact_by_level,
                critical_paths=[],  # Would be populated with actual paths
                risk_score=risk_score,
            )
            
        except Exception as e:
            logger.error(f"Failed to analyze attribute impact: {str(e)}")
            raise
    
    @staticmethod
    def _analyze_class_impact(request: ImpactAnalysisRequest) -> ImpactAnalysisResponse:
        """Analyze impact for a class (affects all its attributes)"""
        # Similar logic but at class level
        pass
    
    @staticmethod
    def _analyze_instance_impact(request: ImpactAnalysisRequest) -> ImpactAnalysisResponse:
        """Analyze impact for a data instance"""
        # Similar logic but at instance level
        pass
    
    @staticmethod
    def create_attribute_flow(
        source_attr_id: str,
        target_attr_id: str,
        transformation: Optional[TransformationRule] = None
    ) -> bool:
        """
        Create an ATTRIBUTE_FLOWS_TO relationship between two attributes
        """
        try:
            query = """
            MATCH (source:Attribute {id: $source_id})
            MATCH (target:Attribute {id: $target_id})
            CREATE (source)-[r:ATTRIBUTE_FLOWS_TO {
                id: $flow_id,
                transformation: $transformation,
                created_at: datetime()
            }]->(target)
            RETURN r
            """
            
            flow_id = str(uuid.uuid4())
            transformation_json = None
            if transformation:
                transformation_json = transformation.model_dump_json()
            
            db.execute_query(query, {
                'source_id': source_attr_id,
                'target_id': target_attr_id,
                'flow_id': flow_id,
                'transformation': transformation_json,
            })
            
            logger.info(f"✅ Created attribute flow: {source_attr_id} -> {target_attr_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create attribute flow: {str(e)}")
            raise
    
    @staticmethod
    def get_all_attribute_flows(schema_id: str) -> List[Tuple[str, str, Optional[str]]]:
        """
        Get all attribute flows for a schema
        Returns: List of (source_attr_id, target_attr_id, transformation_json)
        """
        try:
            query = """
            MATCH (s:Schema {id: $schema_id})-[:HAS_CLASS]->(sc:SchemaClass)
            MATCH (sc)-[:HAS_ATTRIBUTE]->(source:Attribute)
            MATCH (source)-[f:ATTRIBUTE_FLOWS_TO]->(target:Attribute)
            RETURN source.id, target.id, f.transformation
            """
            
            result = db.execute_query(query, {'schema_id': schema_id})
            
            flows = []
            if result.result_set:
                for row in result.result_set:
                    flows.append((row[0], row[1], row[2]))
            
            logger.info(f"Found {len(flows)} attribute flows for schema {schema_id}")
            return flows
            
        except Exception as e:
            logger.error(f"Failed to get attribute flows: {str(e)}")
            return []