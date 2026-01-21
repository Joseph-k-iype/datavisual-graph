// frontend/src/components/lineage/LineageCanvas.tsx - FIXED infinite loop with lazy loading

import React, { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  NodeMouseHandler,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  ConnectionLineType,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Paper,
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
  AccountTree,
} from '@mui/icons-material';

import { LineageGraph, LineageGraphNode, LineageGraphEdge } from '../../types/lineage';
import { ClassNode } from './nodes/ClassNode';
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
  class: ClassNode,
  attribute: AttributeNode,
};

const EDGE_TYPES = {
  custom: CustomEdge,
};

// ============================================
// HELPER FUNCTIONS - MEMOIZED
// ============================================

function convertToFlowNodes(
  lineageNodes: LineageGraphNode[],
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

    const flowNode: Node = {
      id: node.id,
      type: node.type === 'class' ? 'class' : 'attribute',
      position: {
        x: position.x,
        y: position.y,
      },
      data: {
        ...node.data,
        label: node.display_name || node.name,
        name: node.name,
        type: node.type,
        attributes: showAttributes ? node.attributes : [],
        instance_count: node.instance_count,
        collapsed: node.collapsed,
        highlighted: highlightedNodes.includes(node.id),
        selected: node.selected,
        has_upstream: node.has_upstream,
        has_downstream: node.has_downstream,
        level: node.level,
        color: node.color,
        icon: node.icon,
        onAttributeClick: onAttributeClick ? (attributeId: string) => {
          onAttributeClick(attributeId, node.id);
        } : undefined,
      },
    };

    return flowNode;
  });
}

function convertToFlowEdges(
  lineageEdges: LineageGraphEdge[],
  highlightedEdges: string[] = []
): Edge[] {
  return lineageEdges.map((edge) => {
    const isHighlighted = highlightedEdges.includes(edge.id);
    
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'custom',
      label: edge.label,
      sourceHandle: edge.type === 'hierarchy' ? 'bottom' : 'right',
      targetHandle: edge.type === 'hierarchy' ? 'top' : 'left',
      animated: isHighlighted || edge.animated,
      style: {
        stroke: isHighlighted ? '#ffc107' : edge.color || '#64b5f6',
        strokeWidth: isHighlighted ? 3 : edge.width || 2,
        strokeDasharray: edge.style === 'dashed' ? '5,5' : undefined,
      },
      data: {
        label: edge.label,
        type: edge.type,
        highlighted: isHighlighted,
        transformation: edge.transformation_applied,
        cardinality: edge.cardinality,
      },
    };
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

const LineageCanvasInner: React.FC<LineageCanvasProps> = ({
  graph,
  onNodeClick,
  onAttributeClick,
  onEdgeClick,
  showAttributes = true,
  highlightedNodes = [],
  highlightedEdges = [],
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  
  // FIXED: Use ref to track if we've already loaded this graph
  const loadedGraphId = useRef<string | null>(null);

  // Stats computed from nodes/edges state
  const stats = useMemo(
    () => ({
      totalNodes: nodes.length,
      totalEdges: edges.length,
      classNodes: nodes.filter((n) => n.type === 'class').length,
      attributeNodes: nodes.filter((n) => n.type === 'attribute').length,
    }),
    [nodes, edges]
  );

  // FIXED: Convert and load graph data only when graph changes
  // Using useEffect with ONLY graph.schema_id as dependency to prevent infinite loops
  useEffect(() => {
    if (!graph || !graph.nodes.length) {
      console.log('⚠️ No graph data available');
      setNodes([]);
      setEdges([]);
      loadedGraphId.current = null;
      return;
    }

    // FIXED: Only reload if this is a new graph
    if (loadedGraphId.current === graph.schema_id) {
      console.log('✅ Graph already loaded, skipping conversion');
      return;
    }

    console.log('🔄 Loading new graph:', {
      schema_id: graph.schema_id,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
    });

    try {
      const flowNodes = convertToFlowNodes(
        graph.nodes,
        highlightedNodes,
        showAttributes,
        onAttributeClick
      );
      
      const flowEdges = convertToFlowEdges(graph.edges, highlightedEdges);

      // Validate all nodes have positions
      const invalidNodes = flowNodes.filter(
        (n) => !n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number'
      );
      
      if (invalidNodes.length > 0) {
        console.error('❌ Invalid nodes found:', invalidNodes.map(n => n.id));
        return;
      }

      console.log('✅ Converted to React Flow:', {
        nodes: flowNodes.length,
        edges: flowEdges.length,
      });

      // FIXED: Set nodes and edges once
      setNodes(flowNodes);
      setEdges(flowEdges);
      loadedGraphId.current = graph.schema_id;

      // Fit view after a short delay to ensure rendering is complete
      setTimeout(() => {
        fitView({ padding: 0.15, duration: 400 });
        console.log('✅ View fitted for graph:', graph.schema_id);
      }, 150);
      
    } catch (error) {
      console.error('❌ Error converting graph:', error);
    }
  }, [graph?.schema_id]); // FIXED: Only depend on schema_id

  // FIXED: Separate effect for highlighting changes (no re-conversion)
  useEffect(() => {
    if (!graph || nodes.length === 0) return;

    // Update highlighted state on existing nodes without full re-conversion
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          highlighted: highlightedNodes.includes(node.id),
        },
      }))
    );

    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        animated: highlightedEdges.includes(edge.id) || edge.animated,
        style: {
          ...edge.style,
          stroke: highlightedEdges.includes(edge.id) ? '#ffc107' : edge.style?.stroke || '#64b5f6',
          strokeWidth: highlightedEdges.includes(edge.id) ? 3 : edge.style?.strokeWidth || 2,
        },
      }))
    );
  }, [highlightedNodes, highlightedEdges]); // FIXED: Only update when highlights change

  // Handle node click
  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      console.log('🖱️ Node clicked:', node.id, node.type);
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  // Handle edge click
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.stopPropagation();
      console.log('🖱️ Edge clicked:', edge.id);
      if (onEdgeClick) {
        onEdgeClick(edge);
      }
    },
    [onEdgeClick]
  );

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.15, duration: 400 });
  }, [fitView]);

  // Empty state
  if (!graph || nodes.length === 0) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
        }}
      >
        <Stack spacing={2} alignItems="center">
          <AccountTree sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="h6" color="text.secondary">
            No lineage data to display
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {graph ? 'Graph is empty' : 'Load a schema to visualize lineage'}
          </Typography>
        </Stack>
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
        fitView={false}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.highlighted) return '#ffc107';
            if (node.data?.selected) return '#2196f3';
            return node.data?.color || '#64b5f6';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-right"
          style={{
            backgroundColor: 'white',
            border: '1px solid rgba(0,0,0,0.12)',
            borderRadius: 8,
          }}
        />

        {/* Top-left: Stats */}
        <Panel position="top-left">
          <Paper elevation={2} sx={{ p: 2, minWidth: 200 }}>
            <Typography variant="subtitle2" gutterBottom>
              Graph Statistics
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <Chip
                size="small"
                label={`${stats.totalNodes} nodes`}
                variant="outlined"
              />
              <Chip
                size="small"
                label={`${stats.totalEdges} edges`}
                variant="outlined"
              />
            </Stack>
          </Paper>
        </Panel>

        {/* Top-right: Zoom Controls */}
        <Panel position="top-right">
          <Paper elevation={2} sx={{ p: 0.5 }}>
            <ButtonGroup orientation="vertical" size="small">
              <Tooltip title="Zoom In" placement="left">
                <IconButton onClick={handleZoomIn} size="small">
                  <ZoomIn fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out" placement="left">
                <IconButton onClick={handleZoomOut} size="small">
                  <ZoomOut fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit View" placement="left">
                <IconButton onClick={handleFitView} size="small">
                  <CenterFocusStrong fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
          </Paper>
        </Panel>
      </ReactFlow>
    </Box>
  );
};

// Wrap with ReactFlowProvider
export const LineageCanvas: React.FC<LineageCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <LineageCanvasInner {...props} />
    </ReactFlowProvider>
  );
};