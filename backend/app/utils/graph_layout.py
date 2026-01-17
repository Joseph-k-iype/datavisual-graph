# backend/app/utils/graph_layout.py - NEW FILE
"""
Graph Layout Utilities
Auto-generates tree layout positions for nodes
"""

from typing import List, Dict, Any, Tuple
import logging

logger = logging.getLogger(__name__)


class GraphLayoutEngine:
    """Generates automatic layout positions for graph nodes"""
    
    # Layout constants
    HORIZONTAL_SPACING = 300  # Pixels between nodes horizontally
    VERTICAL_SPACING = 200    # Pixels between levels vertically
    ROOT_X = 400             # Starting X position
    ROOT_Y = 50              # Starting Y position
    
    @staticmethod
    def calculate_tree_layout(
        nodes: List[Dict[str, Any]], 
        edges: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Calculate tree layout positions for nodes
        
        Args:
            nodes: List of node dictionaries
            edges: List of edge dictionaries
            
        Returns:
            List of nodes with calculated positions
        """
        try:
            # Build adjacency list (parent -> children)
            children_map: Dict[str, List[str]] = {}
            parent_map: Dict[str, str] = {}
            
            for edge in edges:
                source = edge.get('source_class_id') or edge.get('source')
                target = edge.get('target_class_id') or edge.get('target')
                
                if source and target:
                    if source not in children_map:
                        children_map[source] = []
                    children_map[source].append(target)
                    parent_map[target] = source
            
            # Find root nodes (nodes with no parents)
            node_ids = {node['id'] for node in nodes}
            root_ids = [nid for nid in node_ids if nid not in parent_map]
            
            logger.info(f"Found {len(root_ids)} root nodes out of {len(nodes)} total nodes")
            
            # If no clear roots, use first node as root
            if not root_ids and nodes:
                root_ids = [nodes[0]['id']]
                logger.warning(f"No root nodes found, using {root_ids[0]} as root")
            
            # Calculate positions using tree layout
            positions = {}
            
            if root_ids:
                # Calculate layout for each root tree
                x_offset = GraphLayoutEngine.ROOT_X
                
                for root_id in root_ids:
                    tree_width = GraphLayoutEngine._layout_tree(
                        root_id, 
                        children_map, 
                        positions, 
                        x_offset, 
                        GraphLayoutEngine.ROOT_Y,
                        0
                    )
                    x_offset += tree_width + GraphLayoutEngine.HORIZONTAL_SPACING * 2
            
            # Apply positions to nodes
            for node in nodes:
                node_id = node['id']
                if node_id in positions:
                    node['position'] = positions[node_id]
                else:
                    # Fallback position for orphan nodes
                    node['position'] = {
                        'x': GraphLayoutEngine.ROOT_X + len(positions) * GraphLayoutEngine.HORIZONTAL_SPACING,
                        'y': GraphLayoutEngine.ROOT_Y
                    }
                    logger.warning(f"Node {node_id} has no calculated position, using fallback")
            
            logger.info(f"✅ Calculated positions for {len(positions)} nodes")
            return nodes
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate layout: {str(e)}")
            # Return nodes with default positions
            for i, node in enumerate(nodes):
                if 'position' not in node or not node['position']:
                    node['position'] = {
                        'x': GraphLayoutEngine.ROOT_X + (i % 5) * GraphLayoutEngine.HORIZONTAL_SPACING,
                        'y': GraphLayoutEngine.ROOT_Y + (i // 5) * GraphLayoutEngine.VERTICAL_SPACING
                    }
            return nodes
    
    @staticmethod
    def _layout_tree(
        node_id: str,
        children_map: Dict[str, List[str]],
        positions: Dict[str, Dict[str, float]],
        x: float,
        y: float,
        level: int
    ) -> float:
        """
        Recursively layout tree using post-order traversal
        
        Returns:
            Width of the subtree
        """
        children = children_map.get(node_id, [])
        
        if not children:
            # Leaf node
            positions[node_id] = {'x': x, 'y': y}
            return GraphLayoutEngine.HORIZONTAL_SPACING
        
        # Layout children first
        child_x = x
        child_y = y + GraphLayoutEngine.VERTICAL_SPACING
        total_width = 0
        child_positions = []
        
        for child_id in children:
            if child_id not in positions:  # Avoid cycles
                child_width = GraphLayoutEngine._layout_tree(
                    child_id,
                    children_map,
                    positions,
                    child_x,
                    child_y,
                    level + 1
                )
                child_positions.append(child_x + child_width / 2)
                child_x += child_width
                total_width += child_width
        
        # Center parent over children
        if child_positions:
            parent_x = (child_positions[0] + child_positions[-1]) / 2
        else:
            parent_x = x
        
        positions[node_id] = {'x': parent_x, 'y': y}
        
        return max(total_width, GraphLayoutEngine.HORIZONTAL_SPACING)
    
    @staticmethod
    def build_hierarchy_tree(
        nodes: List[Dict[str, Any]], 
        edges: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Build hierarchical tree structure from flat nodes and edges
        
        Returns:
            HierarchyTree structure with root_nodes
        """
        try:
            # Build parent-child map
            parent_map: Dict[str, str] = {}
            children_map: Dict[str, List[str]] = {}
            
            for edge in edges:
                source = edge.get('source_class_id') or edge.get('source')
                target = edge.get('target_class_id') or edge.get('target')
                
                if source and target:
                    parent_map[target] = source
                    if source not in children_map:
                        children_map[source] = []
                    children_map[source].append(target)
            
            # Find root nodes
            node_ids = {node['id'] for node in nodes}
            root_ids = [nid for nid in node_ids if nid not in parent_map]
            
            # Build node lookup
            node_lookup = {node['id']: node for node in nodes}
            
            # Build hierarchy recursively
            def build_node(node_id: str, level: int = 0) -> Dict[str, Any]:
                node = node_lookup[node_id]
                
                children = []
                for child_id in children_map.get(node_id, []):
                    if child_id in node_lookup:
                        children.append(build_node(child_id, level + 1))
                
                return {
                    'id': node_id,
                    'name': node.get('name', node_id),
                    'display_name': node.get('display_name'),
                    'type': 'class',
                    'level': level,
                    'parent_id': parent_map.get(node_id),
                    'children': children,
                    'attributes': node.get('attributes', []),
                    'instance_count': node.get('instance_count', 0),
                    'collapsed': False,
                    'metadata': node.get('metadata', {})
                }
            
            root_nodes = [build_node(rid) for rid in root_ids]
            
            return {
                'schema_id': nodes[0].get('schema_id', '') if nodes else '',
                'root_nodes': root_nodes,
                'max_depth': max((node.get('level', 0) for node in nodes), default=0) + 1,
                'total_nodes': len(nodes),
                'metadata': {}
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to build hierarchy tree: {str(e)}")
            return {
                'schema_id': '',
                'root_nodes': [],
                'max_depth': 0,
                'total_nodes': 0,
                'metadata': {}
            }