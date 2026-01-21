// frontend/src/components/lineage/LineageCanvas.tsx
// ✅ COMPREHENSIVE FIX - Optimized, Tree View, No Excessive API Calls

import React, { useCallback, useMemo, useEffect, useRef } from 'react';
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
  Connection,
  addEdge,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  CenterFocusStrong,
} from '@mui/icons-material';

import { 
  LineageGraph, 
  LineageGraphNode, 
  LineageGraphEdge,
  HierarchyNode,
  Attribute
} from '../../types/lineage';

// ✅ FIX: Import Cardinality from base types
import { Cardinality } from '../../types';

import ClassNodeWithTreeView from './nodes/ClassNodeWithTreeView';
import { AttributeNode } from './nodes/AttributeNode';
import { CustomEdge } from './edges/CustomEdge';
import apiService from '../../services/api';

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

  // ✅ FIX: Build parent-child relationships from HAS_SUBCLASS edges
  edges.forEach((edge) => {
    // Look for hierarchy edges - HAS_SUBCLASS goes parent->child
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();
    
    // If this is a hierarchy edge, source is parent, target is child
    if (edgeType.includes('hierarchy') || edgeLabel.includes('subclass') || 
        edgeType.includes('subclass') || edgeLabel.includes('has_subclass')) {
      // source -> target means parent -> child
      parentMap.set(edge.target, edge.source);
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
    }
  });

  // Also build from parent_id in nodes
  nodes.forEach((node) => {
    if (node.parent_id) {
      parentMap.set(node.id, node.parent_id);
      if (!childrenMap.has(node.parent_id)) {
        childrenMap.set(node.parent_id, []);
      }
      if (!childrenMap.get(node.parent_id)!.includes(node.id)) {
        childrenMap.get(node.parent_id)!.push(node.id);
      }
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
    } else if (graphNode.data?.attributes && Array.isArray(graphNode.data.attributes)) {
      attributes = graphNode.data.attributes;
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
      collapsed: graphNode.collapsed !== false,
      metadata: graphNode.metadata,
    };
  };

  // Build hierarchy for all class nodes
  nodes
    .filter((n) => n.type === 'class' || n.type === 'schema_class')
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
  return lineageNodes.map((node) => {
    const position = node.position || { x: 0, y: 0 };

    // Validate position
    const validPosition = {
      x: typeof position.x === 'number' ? position.x : 0,
      y: typeof position.y === 'number' ? position.y : 0,
    };

    // Extract attributes
    let attributes: Attribute[] = [];
    if (node.attributes && Array.isArray(node.attributes)) {
      attributes = node.attributes;
    } else if (node.data?.attributes && Array.isArray(node.data.attributes)) {
      attributes = node.data.attributes;
    }

    // Get hierarchy data for this node (only for class nodes)
    // ✅ FIX: Proper type checking for class nodes
    const isClassNode = node.type === 'class' || 
                        node.type === 'schema_class' || 
                        node.type === 'instance';
    
    const hierarchyData = isClassNode ? hierarchyMap.get(node.id) : undefined;

    const flowNode: Node = {
      id: node.id,
      type: (node.type === 'class' || node.type === 'schema_class' || node.type === 'instance') 
        ? 'class' 
        : 'attribute',
      position: validPosition,
      data: {
        ...node.data,
        label: node.display_name || node.name || node.id,
        name: node.name || node.id,
        type: node.type,
        attributes: showAttributes ? attributes : [],
        instance_count: node.instance_count,
        collapsed: node.collapsed !== false,
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
      cardinality: edge.cardinality,
    },
    style: {
      stroke: highlightedEdges.includes(edge.id) || edge.highlighted ? '#ffc107' : '#64b5f6',
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
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // Dialog state for creating relationships
  const [relationshipDialog, setRelationshipDialog] = React.useState<{
    open: boolean;
    source: string | null;
    target: string | null;
  }>({ open: false, source: null, target: null });
  
  const [relationshipName, setRelationshipName] = React.useState('');
  const [cardinality, setCardinality] = React.useState<Cardinality>(Cardinality.ONE_TO_MANY);
  
  // ✅ FIX: Use ref to track graph version to avoid excessive updates
  const graphVersionRef = useRef<string>('');
  
  // Build hierarchy tree from graph (memoized)
  const hierarchyMap = useMemo(() => {
    if (!graph || !graph.nodes) return new Map();
    console.log('🌳 Building hierarchy tree...');
    return buildHierarchyTree(graph.nodes, graph.edges || []);
  }, [graph?.schema_id, graph?.nodes?.length, graph?.edges?.length]);

  // ✅ FIX: Only update nodes when graph actually changes (not on every render)
  useEffect(() => {
    if (!graph || !graph.nodes) {
      setNodes([]);
      return;
    }
    
    // Create a version string based on critical graph properties
    const currentVersion = `${graph.schema_id}-${graph.nodes.length}-${graph.edges?.length || 0}`;
    
    // Only update if version changed
    if (currentVersion === graphVersionRef.current) {
      return;
    }
    
    graphVersionRef.current = currentVersion;
    
    const flowNodes = convertToFlowNodes(
      graph.nodes,
      hierarchyMap,
      highlightedNodes,
      showAttributes,
      onAttributeClick
    );
    
    console.log('🔄 Updating nodes:', flowNodes.length);
    setNodes(flowNodes);
  }, [graph?.schema_id, graph?.nodes?.length, hierarchyMap, showAttributes, highlightedNodes, onAttributeClick]);

  // ✅ FIX: Only update edges when graph edges actually change
  useEffect(() => {
    if (!graph || !graph.edges) {
      setEdges([]);
      return;
    }
    
    const flowEdges = convertToFlowEdges(graph.edges, highlightedEdges);
    console.log('🔄 Updating edges:', flowEdges.length);
    setEdges(flowEdges);
  }, [graph?.schema_id, graph?.edges?.length, highlightedEdges]);

  // Fit view only on initial load
  const hasFittedView = useRef(false);
  useEffect(() => {
    if (nodes.length > 0 && !hasFittedView.current) {
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 300 });
        hasFittedView.current = true;
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

  // ✅ NEW: Handle connection creation (drag from one node to another)
  const onConnect = useCallback(
    (connection: Connection) => {
      console.log('🔗 Connection created:', connection);
      
      if (!connection.source || !connection.target) return;
      
      // Open dialog to configure relationship
      setRelationshipDialog({
        open: true,
        source: connection.source,
        target: connection.target,
      });
    },
    []
  );
  
  // ✅ NEW: Save relationship to backend
  const handleSaveRelationship = useCallback(async () => {
    if (!graph?.schema_id || !relationshipDialog.source || !relationshipDialog.target) {
      return;
    }
    
    if (!relationshipName.trim()) {
      alert('Please enter a relationship name');
      return;
    }
    
    try {
      console.log('💾 Saving relationship to FalkorDB...');
      
      // Call API to create relationship
      const newRelationship = await apiService.createRelationship(
        graph.schema_id,
        relationshipDialog.source,
        relationshipDialog.target,
        relationshipName,
        cardinality
      );
      
      console.log('✅ Relationship saved:', newRelationship);
      
      // Add edge to local state immediately
      const newEdge: Edge = {
        id: newRelationship.id,
        source: relationshipDialog.source,
        target: relationshipDialog.target,
        type: 'custom',
        label: relationshipName,
        data: {
          type: 'schema_relationship',
          cardinality: cardinality,
        },
        style: {
          stroke: '#64b5f6',
          strokeWidth: 2,
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      // Close dialog and reset
      setRelationshipDialog({ open: false, source: null, target: null });
      setRelationshipName('');
      setCardinality(Cardinality.ONE_TO_MANY);
      
      alert('Relationship created successfully!');
    } catch (error) {
      console.error('❌ Failed to save relationship:', error);
      alert('Failed to save relationship: ' + (error as Error).message);
    }
  }, [graph?.schema_id, relationshipDialog, relationshipName, cardinality, setEdges]);

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
        onConnect={onConnect}
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
            {/* ✅ FIX: Safe access to metadata property */}
            {graph.metadata && 'schema_relationships' in graph.metadata && (
              <Chip
                label={`${(graph.metadata as any).schema_relationships} relationships`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
        </Panel>
      </ReactFlow>
      
      {/* Relationship Creation Dialog */}
      <Dialog
        open={relationshipDialog.open}
        onClose={() => setRelationshipDialog({ open: false, source: null, target: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Relationship</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Relationship Name"
              value={relationshipName}
              onChange={(e) => setRelationshipName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., HAS, CONTAINS, REFERENCES"
            />
            
            <FormControl fullWidth>
              <InputLabel>Cardinality</InputLabel>
              <Select
                value={cardinality}
                onChange={(e) => setCardinality(e.target.value as Cardinality)}
                label="Cardinality"
              >
                <MenuItem value={Cardinality.ONE_TO_ONE}>One to One (1:1)</MenuItem>
                <MenuItem value={Cardinality.ONE_TO_MANY}>One to Many (1:N)</MenuItem>
                <MenuItem value={Cardinality.MANY_TO_ONE}>Many to One (N:1)</MenuItem>
                <MenuItem value={Cardinality.MANY_TO_MANY}>Many to Many (N:M)</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="caption" color="text.secondary">
              Source: {nodes.find(n => n.id === relationshipDialog.source)?.data.name || 'Unknown'}
              <br />
              Target: {nodes.find(n => n.id === relationshipDialog.target)?.data.name || 'Unknown'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setRelationshipDialog({ open: false, source: null, target: null })}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSaveRelationship} 
            variant="contained" 
            color="primary"
          >
            Create Relationship
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LineageCanvas;