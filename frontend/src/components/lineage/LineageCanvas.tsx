// frontend/src/components/lineage/LineageCanvas.tsx
// FIXED VERSION - Compatible with existing types

import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  Panel,
  ConnectionLineType,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  IconButton,
  Tooltip,
  ButtonGroup,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
} from '@mui/icons-material';

// Import types from existing codebase
import { 
  LineageGraph, 
  LineageGraphNode, 
  LineageGraphEdge,
  HierarchyNode,
  Attribute
} from '../../types/lineage';

// Import node components
import ClassNodeWithTreeView from './nodes/ClassNodeWithTreeView';
import { AttributeNode } from './nodes/AttributeNode';
import { CustomEdge } from './edges/CustomEdge';

// ============================================
// TYPES
// ============================================

interface LineageCanvasProps {
  graph: LineageGraph | null;
  onNodeClick?: (node: Node) => void;
  onAttributeClick?: (attributeId: string, nodeId: string) => void;
  onEdgeClick?: (edge: Edge) => void;
  showAttributes?: boolean;
  showInstances?: boolean;
  layoutDirection?: 'horizontal' | 'vertical';
  highlightedNodes?: string[];
  highlightedEdges?: string[];
}

// ============================================
// CONSTANTS
// ============================================

const NODE_TYPES = {
  class: ClassNodeWithTreeView,
  attribute: AttributeNode,
};

const EDGE_TYPES = {
  custom: CustomEdge,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function buildHierarchyTree(
  nodes: LineageGraphNode[],
  edges: LineageGraphEdge[]
): Map<string, HierarchyNode> {
  const hierarchyMap = new Map<string, HierarchyNode>();
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();

  // Build parent-child relationships from SUBCLASS_OF edges
  edges.forEach((edge) => {
    const hierarchyTypes = ['subclass_of', 'extends', 'hierarchy'];
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();

    if (hierarchyTypes.some((type: string) => edgeType.includes(type) || edgeLabel.includes(type))) {
      parentMap.set(edge.target, edge.source);
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
    }
  });

  // Recursive function to build hierarchy node
  const buildNode = (nodeId: string, processedIds: Set<string>): HierarchyNode | null => {
    if (processedIds.has(nodeId)) return null;
    processedIds.add(nodeId);

    const graphNode = nodes.find((n) => n.id === nodeId);
    if (!graphNode) return null;

    const childIds = childrenMap.get(nodeId) || [];
    const children = childIds
      .map((childId) => buildNode(childId, new Set(processedIds)))
      .filter((child): child is HierarchyNode => child !== null);

    // Extract attributes safely
    let attributes: Attribute[] = [];
    if (graphNode.attributes && Array.isArray(graphNode.attributes)) {
      attributes = graphNode.attributes;
    }

    return {
      id: nodeId,
      name: graphNode.name,
      display_name: graphNode.display_name || graphNode.name,
      type: children.length > 0 || graphNode.parent_id ? 'subclass' : 'class',
      level: graphNode.level || 0,
      parent_id: graphNode.parent_id,
      children,
      attributes,
      instance_count: graphNode.instance_count,
      collapsed: graphNode.collapsed || false,
      metadata: graphNode.metadata,
    };
  };

  // Build hierarchy for all class nodes
  nodes
    .filter((n) => n.type === 'class')
    .forEach((node) => {
      const hierarchyNode = buildNode(node.id, new Set());
      if (hierarchyNode) {
        hierarchyMap.set(node.id, hierarchyNode);
      }
    });

  return hierarchyMap;
}

function convertToFlowNodes(
  lineageNodes: LineageGraphNode[],
  hierarchyMap: Map<string, HierarchyNode>,
  highlightedNodes: string[] = [],
  showAttributes: boolean = true,
  onAttributeClick?: (attributeId: string, nodeId: string) => void
): Node[] {
  return lineageNodes.map((node, index) => {
    const position = node.position || { x: index * 300, y: node.level * 200 };

    if (typeof position.x !== 'number' || typeof position.y !== 'number') {
      console.warn(`⚠️ Invalid position for node ${node.id}, using default`);
      position.x = index * 300;
      position.y = node.level * 200;
    }

    // Extract attributes safely
    let attributes: Attribute[] = [];
    if (node.attributes && Array.isArray(node.attributes)) {
      attributes = node.attributes;
    }

    // Get hierarchy data for this node (only for class nodes)
    const hierarchyData = node.type === 'class' ? hierarchyMap.get(node.id) : undefined;

    const flowNode: Node = {
      id: node.id,
      type: node.type === 'class' || node.type === 'instance' ? 'class' : 'attribute',
      position: {
        x: position.x,
        y: position.y,
      },
      data: {
        ...node.data,
        label: node.display_name || node.name,
        name: node.name,
        type: node.type,
        attributes: showAttributes ? attributes : [],
        instance_count: node.instance_count,
        collapsed: node.collapsed || false,
        highlighted: highlightedNodes.includes(node.id),
        selected: node.selected || false,
        has_upstream: node.has_upstream || false,
        has_downstream: node.has_downstream || false,
        level: node.level || 0,
        hierarchy: hierarchyData,
        onAttributeClick: onAttributeClick
          ? (attrId: string) => onAttributeClick(attrId, node.id)
          : undefined,
      },
    };

    return flowNode;
  });
}

function convertToFlowEdges(
  lineageEdges: LineageGraphEdge[],
  highlightedEdges: string[] = []
): Edge[] {
  return lineageEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'custom',
    label: edge.label,
    animated: highlightedEdges.includes(edge.id) || edge.highlighted,
    data: {
      type: edge.type,
      highlighted: highlightedEdges.includes(edge.id) || edge.highlighted,
    },
    style: {
      stroke: highlightedEdges.includes(edge.id) || edge.highlighted ? '#ffc107' : '#b1b1b7',
      strokeWidth: highlightedEdges.includes(edge.id) || edge.highlighted ? 3 : 2,
    },
  }));
}

// ============================================
// MAIN COMPONENT
// ============================================

export const LineageCanvas: React.FC<LineageCanvasProps> = ({
  graph,
  onNodeClick,
  onAttributeClick,
  onEdgeClick,
  showAttributes = true,
  highlightedNodes = [],
  highlightedEdges = [],
}) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // Build hierarchy tree from graph
  const hierarchyMap = useMemo(() => {
    if (!graph) return new Map();
    return buildHierarchyTree(graph.nodes, graph.edges);
  }, [graph]);

  // Convert graph data to React Flow format
  const initialNodes = useMemo(() => {
    if (!graph) return [];
    return convertToFlowNodes(
      graph.nodes,
      hierarchyMap,
      highlightedNodes,
      showAttributes,
      onAttributeClick
    );
  }, [graph, hierarchyMap, highlightedNodes, showAttributes, onAttributeClick]);

  const initialEdges = useMemo(() => {
    if (!graph) return [];
    return convertToFlowEdges(graph.edges, highlightedEdges);
  }, [graph, highlightedEdges]);

const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

// Only update when graph ID or node count actually changes
useEffect(() => {
  if (!graph || !graph.nodes) {
    setNodes([]);
    return;
  }
  
  const flowNodes = convertToFlowNodes(
    graph.nodes,
    hierarchyMap,
    highlightedNodes,
    showAttributes,
    onAttributeClick
  );
  
  console.log('🔄 Updating nodes:', flowNodes.length);
  setNodes(flowNodes);
}, [graph?.schema_id, graph?.nodes?.length, hierarchyMap, showAttributes]);

useEffect(() => {
  if (!graph || !graph.edges) {
    setEdges([]);
    return;
  }
  
  const flowEdges = convertToFlowEdges(graph.edges, highlightedEdges);
  console.log('🔄 Updating edges:', flowEdges.length);
  setEdges(flowEdges);
}, [graph?.schema_id, graph?.edges?.length, highlightedEdges]);

  // Fit view on initial load
  useEffect(() => {
    if (nodes.length > 0) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
      }, 100);
    }
  }, [nodes.length, fitView]);

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge);
      }
    },
    [onEdgeClick]
  );

  if (!graph) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No lineage data available
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        fitView
        attributionPosition="bottom-right"
        connectionLineType={ConnectionLineType.SmoothStep}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.highlighted) return '#ffc107';
            if (node.data.selected) return '#1976d2';
            return '#e0e0e0';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />

        {/* Custom Controls Panel */}
        <Panel position="top-right">
          <Stack spacing={1}>
            <ButtonGroup orientation="vertical" size="small">
              <Tooltip title="Zoom In" placement="left">
                <IconButton onClick={() => zoomIn()} size="small">
                  <ZoomIn />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out" placement="left">
                <IconButton onClick={() => zoomOut()} size="small">
                  <ZoomOut />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit View" placement="left">
                <IconButton onClick={() => fitView({ padding: 0.2 })} size="small">
                  <CenterFocusStrong />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
          </Stack>
        </Panel>

        {/* Stats Panel */}
        <Panel position="top-left">
          <Stack direction="row" spacing={1}>
            <Chip label={`${nodes.length} nodes`} size="small" variant="outlined" />
            <Chip label={`${edges.length} edges`} size="small" variant="outlined" />
            {graph.metadata?.total_nodes && (
              <Chip
                label={`${graph.metadata.total_nodes} total`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
        </Panel>
      </ReactFlow>
    </Box>
  );
};

export default LineageCanvas;