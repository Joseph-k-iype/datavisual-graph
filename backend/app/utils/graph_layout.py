# backend/app/utils/graph_layout.py - FIXED VERSION WITH CYCLE DETECTION
"""
Graph Layout Utilities
Auto-generates tree layout positions for nodes with proper cycle detection
"""

from typing import List, Dict, Any, Set
import logging

logger = logging.getLogger(__name__)


class GraphLayoutEngine:
    """Generates automatic layout positions for graph nodes"""
    
    # Layout constants
    HORIZONTAL_SPACING = 300  # Pixels between nodes horizontally
    VERTICAL_SPACING = 200    # Pixels between levels vertically
    ROOT_X = 400             # Starting X position
    ROOT_Y = 50              # Starting Y position
    MAX_DEPTH = 100          # Maximum tree depth to prevent infinite recursion
    
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
            List of nodes with calculated positions (modifies nodes in-place)
        """
        try:
            if not nodes:
                logger.warning("No nodes to layout")
                return nodes
            
            # Build adjacency list (parent -> children)
            children_map: Dict[str, List[str]] = {}
            parent_map: Dict[str, str] = {}
            
            for edge in edges:
                # Handle both formats: edge dict with 'source'/'target' 
                # or 'source_class_id'/'target_class_id'
                source = edge.get('source') or edge.get('source_class_id')
                target = edge.get('target') or edge.get('target_class_id')
                
                if source and target:
                    if source not in children_map:
                        children_map[source] = []
                    children_map[source].append(target)
                    parent_map[target] = source
            
            # Detect and log cycles
            cycles = GraphLayoutEngine._detect_cycles(children_map, parent_map)
            if cycles:
                logger.warning(f"⚠️ Detected {len(cycles)} cycles in graph structure:")
                for cycle in cycles[:5]:  # Log first 5 cycles
                    logger.warning(f"  Cycle: {' -> '.join(cycle)}")
            
            # Find root nodes (nodes with no parents)
            node_ids = {node['id'] for node in nodes}
            root_ids = [nid for nid in node_ids if nid not in parent_map]
            
            logger.info(f"Found {len(root_ids)} root nodes out of {len(nodes)} total nodes")
            
            # If no clear roots, use nodes with level=0 or first node as root
            if not root_ids and nodes:
                root_ids = [node['id'] for node in nodes if node.get('level', 0) == 0]
                if not root_ids:
                    root_ids = [nodes[0]['id']]
                logger.warning(f"No root nodes found by parent relationships, using level-based roots: {root_ids}")
            
            # Calculate positions using tree layout with cycle detection
            positions = {}
            visited = set()  # Track nodes in current traversal path
            
            if root_ids:
                # Calculate layout for each root tree
                x_offset = GraphLayoutEngine.ROOT_X
                
                for root_id in root_ids:
                    tree_width = GraphLayoutEngine._layout_tree(
                        root_id, 
                        children_map, 
                        positions, 
                        visited,
                        x_offset, 
                        GraphLayoutEngine.ROOT_Y,
                        0
                    )
                    x_offset += tree_width + GraphLayoutEngine.HORIZONTAL_SPACING * 2
            
            # Apply positions to nodes (nodes are dicts, so we can modify them)
            for node in nodes:
                node_id = node['id']
                if node_id in positions:
                    node['position'] = positions[node_id]
                else:
                    # Fallback position for orphan nodes
                    fallback_x = GraphLayoutEngine.ROOT_X + len(positions) * GraphLayoutEngine.HORIZONTAL_SPACING
                    fallback_y = GraphLayoutEngine.ROOT_Y + node.get('level', 0) * GraphLayoutEngine.VERTICAL_SPACING
                    node['position'] = {'x': fallback_x, 'y': fallback_y}
                    logger.warning(f"Node {node_id} ({node.get('name', 'unknown')}) has no calculated position, using fallback")
            
            logger.info(f"✅ Calculated positions for {len(positions)} nodes")
            return nodes
            
        except Exception as e:
            logger.error(f"❌ Failed to calculate layout: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            
            # Return nodes with default positions as fallback
            for i, node in enumerate(nodes):
                if 'position' not in node or not node.get('position'):
                    level = node.get('level', 0)
                    node['position'] = {
                        'x': GraphLayoutEngine.ROOT_X + (i % 5) * GraphLayoutEngine.HORIZONTAL_SPACING,
                        'y': GraphLayoutEngine.ROOT_Y + level * GraphLayoutEngine.VERTICAL_SPACING
                    }
            return nodes
    
    @staticmethod
    def _detect_cycles(
        children_map: Dict[str, List[str]],
        parent_map: Dict[str, str]
    ) -> List[List[str]]:
        """
        Detect cycles in the graph structure
        
        Returns:
            List of cycles, where each cycle is a list of node IDs
        """
        cycles = []
        visited = set()
        rec_stack = set()
        
        def dfs(node: str, path: List[str]) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for child in children_map.get(node, []):
                if child not in visited:
                    dfs(child, path.copy())
                elif child in rec_stack:
                    # Found a cycle
                    cycle_start = path.index(child)
                    cycle = path[cycle_start:] + [child]
                    cycles.append(cycle)
            
            rec_stack.remove(node)
        
        # Start DFS from all nodes
        all_nodes = set(children_map.keys()) | set(parent_map.keys())
        for node in all_nodes:
            if node not in visited:
                dfs(node, [])
        
        return cycles
    
    @staticmethod
    def _layout_tree(
        node_id: str,
        children_map: Dict[str, List[str]],
        positions: Dict[str, Dict[str, float]],
        visited: Set[str],
        x: float,
        y: float,
        level: int
    ) -> float:
        """
        Recursively layout tree using post-order traversal with cycle detection
        
        Args:
            node_id: Current node ID
            children_map: Map of parent ID -> list of child IDs
            positions: Dictionary to store calculated positions
            visited: Set of nodes currently in traversal path (for cycle detection)
            x: Starting X position
            y: Starting Y position
            level: Current depth level
            
        Returns:
            Width of the subtree
        """
        # Check for maximum depth to prevent stack overflow
        if level > GraphLayoutEngine.MAX_DEPTH:
            logger.error(f"⚠️ Maximum tree depth ({GraphLayoutEngine.MAX_DEPTH}) exceeded at node {node_id}")
            positions[node_id] = {'x': x, 'y': y}
            return GraphLayoutEngine.HORIZONTAL_SPACING
        
        # Check if already positioned (node was processed from another path)
        if node_id in positions:
            return GraphLayoutEngine.HORIZONTAL_SPACING
        
        # Check for cycle (node is in current traversal path)
        if node_id in visited:
            logger.warning(f"🔄 Cycle detected at node {node_id} at level {level}")
            positions[node_id] = {'x': x, 'y': y}
            return GraphLayoutEngine.HORIZONTAL_SPACING
        
        # Add to visited set for cycle detection
        visited.add(node_id)
        
        try:
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
                child_width = GraphLayoutEngine._layout_tree(
                    child_id,
                    children_map,
                    positions,
                    visited,
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
        
        finally:
            # Remove from visited set when backtracking
            visited.discard(node_id)
    
    @staticmethod
    def build_hierarchy_tree(
        nodes: List[Dict[str, Any]], 
        edges: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Build hierarchical tree structure from flat nodes and edges
        
        Args:
            nodes: List of node dictionaries
            edges: List of edge dictionaries
            
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
            
            # Track visited nodes to prevent infinite recursion in cycles
            visited_in_tree = set()
            
            # Build hierarchy recursively with cycle protection
            def build_node(node_id: str, level: int = 0) -> Dict[str, Any]:
                node = node_lookup.get(node_id)
                if not node:
                    return None
                
                # Check for cycles
                if node_id in visited_in_tree:
                    logger.warning(f"🔄 Cycle detected in hierarchy tree at node {node_id}")
                    return None
                
                # Check max depth
                if level > GraphLayoutEngine.MAX_DEPTH:
                    logger.warning(f"⚠️ Max depth exceeded in hierarchy tree at node {node_id}")
                    return None
                
                visited_in_tree.add(node_id)
                
                try:
                    children = []
                    for child_id in children_map.get(node_id, []):
                        if child_id in node_lookup and child_id not in visited_in_tree:
                            child_node = build_node(child_id, level + 1)
                            if child_node:
                                children.append(child_node)
                    
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
                finally:
                    visited_in_tree.discard(node_id)
            
            root_nodes = []
            for rid in root_ids:
                root_node = build_node(rid)
                if root_node:
                    root_nodes.append(root_node)
            
            return {
                'schema_id': nodes[0].get('schema_id', '') if nodes else '',
                'root_nodes': root_nodes,
                'max_depth': max((node.get('level', 0) for node in nodes), default=0) + 1,
                'total_nodes': len(nodes),
                'metadata': {}
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to build hierarchy tree: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'schema_id': '',
                'root_nodes': [],
                'max_depth': 0,
                'total_nodes': 0,
                'metadata': {}
            }