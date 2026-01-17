// frontend/src/components/lineage/LineageCanvas.tsx - FIXED (position error)

import React, { useCallback, useMemo, useEffect, useState } from 'react';
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
// HELPER FUNCTIONS
// ============================================

function convertToFlowNodes(
  lineageNodes: LineageGraphNode[],
  highlightedNodes: string[] = [],
  showAttributes: boolean = true,
  onAttributeClick?: (attributeId: string, nodeId: string) => void
): Node[] {
  console.log('📦 Converting nodes:', lineageNodes);
  
  return lineageNodes.map((node, index) => {
    // Ensure position exists with valid x and y
    const position = node.position || { x: 0, y: 0 };
    
    // Validate position has x and y
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

    console.log(`  ✅ Node ${node.id} at (${flowNode.position.x}, ${flowNode.position.y})`);
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
  const [initialized, setInitialized] = useState(false);

  // Stats
  const stats = useMemo(
    () => ({
      totalNodes: nodes.length,
      totalEdges: edges.length,
      classNodes: nodes.filter((n) => n.type === 'class').length,
      attributeNodes: nodes.filter((n) => n.type === 'attribute').length,
    }),
    [nodes, edges]
  );

  // Convert lineage data to React Flow format
  useEffect(() => {
    if (!graph || !graph.nodes.length) {
      console.log('⚠️ No graph data');
      setNodes([]);
      setEdges([]);
      setInitialized(false);
      return;
    }

    console.log('🔄 Converting lineage graph:', {
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

      console.log('✅ Converted to React Flow:', {
        nodes: flowNodes.length,
        edges: flowEdges.length,
      });

      // Validate all nodes have positions
      const invalidNodes = flowNodes.filter(
        (n) => !n.position || typeof n.position.x !== 'number' || typeof n.position.y !== 'number'
      );
      
      if (invalidNodes.length > 0) {
        console.error('❌ Invalid nodes found:', invalidNodes);
        return;
      }

      setNodes(flowNodes);
      setEdges(flowEdges);
      setInitialized(true);
    } catch (error) {
      console.error('❌ Error converting graph:', error);
    }
  }, [
    graph,
    highlightedNodes,
    highlightedEdges,
    showAttributes,
    onAttributeClick,
    setNodes,
    setEdges,
  ]);

  // Fit view after initialization
  useEffect(() => {
    if (initialized && nodes.length > 0) {
      setTimeout(() => {
        try {
          fitView({ padding: 0.15, duration: 400 });
          console.log('✅ View fitted');
        } catch (error) {
          console.error('❌ fitView failed:', error);
        }
      }, 100);
    }
  }, [initialized, nodes.length, fitView]);

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

        {/* Top-left: Legend */}
        <Panel position="top-left">
          <Paper
            elevation={2}
            sx={{
              p: 2,
              minWidth: 200,
              bgcolor: 'background.paper',
            }}
          >
            <Typography variant="subtitle2" gutterBottom fontWeight={600}>
              Legend
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    bgcolor: '#64b5f6',
                    borderRadius: 1,
                  }}
                />
                <Typography variant="caption">Schema Class</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    bgcolor: '#4fc3f7',
                    borderRadius: 1,
                  }}
                />
                <Typography variant="caption">Attribute</Typography>
              </Box>
              {highlightedNodes.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      bgcolor: '#ffc107',
                      borderRadius: 1,
                    }}
                  />
                  <Typography variant="caption">Highlighted Path</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        </Panel>

        {/* Top-right: Stats & Controls */}
        <Panel position="top-right">
          <Stack spacing={1}>
            {/* Stats */}
            <Paper elevation={2} sx={{ px: 2, py: 1 }}>
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

            {/* Zoom Controls */}
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
          </Stack>
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