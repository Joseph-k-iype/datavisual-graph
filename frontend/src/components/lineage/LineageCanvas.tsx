// frontend/src/components/lineage/LineageCanvas.tsx
// ✅ FIXED: Only root nodes visible, subclasses shown INSIDE nodes

import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
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
  Alert,
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
  highlightedNodes?: string[];
  highlightedEdges?: string[];
  onRefresh?: () => void;
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

const ROOT_SPACING_X = 600;

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

  // Build parent-child relationships from edges
  edges.forEach((edge) => {
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();
    
    if (edgeType === 'hierarchy' || edgeLabel.includes('subclass') || 
        edgeLabel === 'has_subclass') {
      parentMap.set(edge.target, edge.source);
      if (!childrenMap.has(edge.source)) {
        childrenMap.set(edge.source, []);
      }
      childrenMap.get(edge.source)!.push(edge.target);
    }
  });

  // Also use parent_id from nodes
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

  // Build hierarchy recursively
  const buildNode = (nodeId: string, processedIds: Set<string>): HierarchyNode | null => {
    if (processedIds.has(nodeId)) return null;
    processedIds.add(nodeId);

    const graphNode = nodes.find((n) => n.id === nodeId);
    if (!graphNode) return null;

    const childIds = childrenMap.get(nodeId) || [];
    const children = childIds
      .map((childId) => buildNode(childId, new Set(processedIds)))
      .filter((child): child is HierarchyNode => child !== null);

    let attributes: Attribute[] = [];
    if (graphNode.attributes && Array.isArray(graphNode.attributes)) {
      attributes = graphNode.attributes;
    }

    // ✅ Robust name handling
    const displayName = graphNode.display_name || graphNode.name || (graphNode as any).label || 'Unknown';
    const nodeName = graphNode.name || displayName;

    return {
      id: nodeId,
      name: nodeName,
      display_name: displayName,
      type: children.length > 0 || graphNode.parent_id ? 'subclass' : 'class',
      level: graphNode.level ?? 0,
      parent_id: graphNode.parent_id || null,
      children: children,
      attributes: attributes,
      instance_count: graphNode.instance_count ?? 0,
      collapsed: graphNode.collapsed ?? false,
      metadata: graphNode.metadata || {},
    };
  };

  // Build hierarchy for all nodes
  nodes.forEach((node) => {
    if (!hierarchyMap.has(node.id)) {
      const hierarchyNode = buildNode(node.id, new Set());
      if (hierarchyNode) {
        hierarchyMap.set(node.id, hierarchyNode);
      }
    }
  });

  return hierarchyMap;
}

// ✅ CRITICAL: Only create React Flow nodes for ROOT classes
function convertToFlowNodes(
  lineageNodes: LineageGraphNode[],
  lineageEdges: LineageGraphEdge[],
  hierarchyMap: Map<string, HierarchyNode>,
  highlightedNodes: string[] = []
): Node[] {
  const nodes: Node[] = [];

  // Find root nodes (no parent)
  const rootNodes = lineageNodes.filter(node => !node.parent_id);

  console.log(`🌲 Converting ${rootNodes.length} ROOT nodes (subclasses inside)`);

  let rootXOffset = 50;

  rootNodes.forEach((rootNode, rootIndex) => {
    const hierarchy = hierarchyMap.get(rootNode.id);
    if (!hierarchy) {
      console.warn(`⚠️ No hierarchy found for root node ${rootNode.id}`);
      return;
    }

    const displayName = rootNode.display_name || rootNode.name || (rootNode as any).label || 'Unknown';
    const nodeName = rootNode.name || displayName;

    // ✅ Create single node for root class (children shown inside via TreeView)
    nodes.push({
      id: rootNode.id,
      type: 'class',
      position: {
        x: rootXOffset,
        y: 100,
      },
      data: {
        label: displayName,
        name: nodeName,
        display_name: displayName,
        type: rootNode.type || 'class',
        attributes: rootNode.attributes || [],
        instance_count: rootNode.instance_count || 0,
        collapsed: rootNode.collapsed || false,
        highlighted: highlightedNodes.includes(rootNode.id),
        selected: false,
        level: rootNode.level || 0,
        hierarchy: hierarchy,  // ✅ Pass full hierarchy including all descendants
      },
    });

    rootXOffset += ROOT_SPACING_X;
  });

  console.log(`✅ Created ${nodes.length} React Flow nodes (root classes only)`);

  return nodes;
}

function convertToFlowEdges(
  lineageEdges: LineageGraphEdge[],
  highlightedEdges: string[] = []
): Edge[] {
  // Only show SCHEMA_REL edges (user-defined relationships)
  // Filter out hierarchy edges since hierarchy is shown inside nodes
  const schemaRelEdges = lineageEdges.filter(edge => {
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();
    
    return edgeType === 'schema_relationship' || 
           edgeType === 'schema_rel' ||
           (edgeType !== 'hierarchy' && 
            !edgeLabel.includes('subclass') && 
            !edgeLabel.includes('has_class'));
  });

  return schemaRelEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'custom',
    label: edge.label || '',
    animated: highlightedEdges.includes(edge.id) || edge.highlighted,
    data: {
      type: edge.type,
      highlighted: highlightedEdges.includes(edge.id) || edge.highlighted,
      cardinality: edge.cardinality,
      label: edge.label,
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
  highlightedNodes = [],
  highlightedEdges = [],
  onRefresh,
}) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  
  // Build hierarchy tree
  const hierarchyMap = useMemo(() => {
    if (!graph) return new Map();
    return buildHierarchyTree(graph.nodes, graph.edges || []);
  }, [graph]);

  // Convert to React Flow format - ONLY root nodes
  const initialNodes = useMemo(() => {
    if (!graph) return [];
    return convertToFlowNodes(graph.nodes, graph.edges || [], hierarchyMap, highlightedNodes);
  }, [graph, hierarchyMap, highlightedNodes]);

  const initialEdges = useMemo(() => {
    if (!graph) return [];
    return convertToFlowEdges(graph.edges || [], highlightedEdges);
  }, [graph, highlightedEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Relationship creation dialog
  const [relationshipDialog, setRelationshipDialog] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [relationshipName, setRelationshipName] = useState('');
  const [cardinality, setCardinality] = useState<Cardinality>(Cardinality.ONE_TO_MANY);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Update nodes/edges when graph changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (onEdgeClick) {
        onEdgeClick(edge);
      }
    },
    [onEdgeClick]
  );

  const onConnect = useCallback((connection: Connection) => {
    console.log('🔗 Connection initiated:', connection);
    setPendingConnection(connection);
    setRelationshipName('');
    setCardinality(Cardinality.ONE_TO_MANY);
    setError(null);
    setRelationshipDialog(true);
  }, []);

  const handleCreateRelationship = useCallback(async () => {
    if (!pendingConnection || !relationshipName.trim() || !graph) {
      setError('Relationship name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      console.log('🔗 Creating relationship:', {
        name: relationshipName,
        source: pendingConnection.source,
        target: pendingConnection.target,
        cardinality: cardinality,
      });

      // ✅ Use correct schema_id from graph
      const createdRelationship = await apiService.createRelationship(
        graph.schema_id,
        pendingConnection.source!,
        pendingConnection.target!,
        relationshipName,
        cardinality
      );

      console.log('✅ Relationship created:', createdRelationship);

      // Add edge to canvas
      const newEdge: Edge = {
        id: createdRelationship.id,
        source: createdRelationship.source_class_id,
        target: createdRelationship.target_class_id,
        type: 'custom',
        label: createdRelationship.name,
        animated: false,
        data: {
          type: 'schema_relationship',
          highlighted: false,
          cardinality: createdRelationship.cardinality,
          label: createdRelationship.name,
        },
      };

      setEdges((eds) => addEdge(newEdge, eds));
      setRelationshipDialog(false);
      setPendingConnection(null);
      setRelationshipName('');

      // Refresh graph if callback provided
      if (onRefresh) {
        setTimeout(() => onRefresh(), 500);
      }
    } catch (err: any) {
      console.error('❌ Failed to create relationship:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to create relationship');
    } finally {
      setCreating(false);
    }
  }, [pendingConnection, graph, relationshipName, cardinality, setEdges, onRefresh]);

  const handleCancelRelationship = useCallback(() => {
    setRelationshipDialog(false);
    setPendingConnection(null);
    setRelationshipName('');
    setCardinality(Cardinality.ONE_TO_MANY);
    setError(null);
  }, []);

  if (!graph) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h6" color="text.secondary">No lineage data available</Typography>
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
            return '#2196f3';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />

        <Panel position="top-right">
          <Stack spacing={1}>
            <ButtonGroup orientation="vertical" size="small">
              <Tooltip title="Zoom In">
                <IconButton onClick={() => zoomIn()}><ZoomIn /></IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton onClick={() => zoomOut()}><ZoomOut /></IconButton>
              </Tooltip>
              <Tooltip title="Fit View">
                <IconButton onClick={() => fitView()}><CenterFocusStrong /></IconButton>
              </Tooltip>
            </ButtonGroup>
          </Stack>
        </Panel>

        <Panel position="top-left">
          <Stack spacing={1}>
            <Chip label={`${nodes.length} Root Classes`} size="small" color="primary" />
            <Chip label={`${edges.length} Relationships`} size="small" color="primary" />
          </Stack>
        </Panel>
      </ReactFlow>

      {/* Relationship Creation Dialog */}
      <Dialog open={relationshipDialog} onClose={handleCancelRelationship} maxWidth="sm" fullWidth>
        <DialogTitle>Create Relationship</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
            
            <TextField
              label="Relationship Name"
              value={relationshipName}
              onChange={(e) => setRelationshipName(e.target.value)}
              fullWidth
              required
              autoFocus
              placeholder="e.g., contains, references, depends_on"
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
              Source: {pendingConnection?.source ? (nodes.find(n => n.id === pendingConnection.source)?.data.name || 'Unknown') : 'Not selected'}
              <br />
              Target: {pendingConnection?.target ? (nodes.find(n => n.id === pendingConnection.target)?.data.name || 'Unknown') : 'Not selected'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelRelationship}>Cancel</Button>
          <Button 
            onClick={handleCreateRelationship} 
            variant="contained" 
            disabled={creating || !relationshipName.trim()}
          >
            {creating ? 'Creating...' : 'Create Relationship'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LineageCanvas;