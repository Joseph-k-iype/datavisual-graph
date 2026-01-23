// frontend/src/components/lineage/LineageCanvas.tsx
// ✅ FIXED: Only root nodes visible, subclasses shown INSIDE nodes

import React, { useCallback, useMemo, useEffect, useState } from 'react';
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
  MarkerType,
  ReactFlowProvider,
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
      parent_id: graphNode.parent_id || undefined,
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
  hierarchyMap: Map<string, HierarchyNode>,
  highlightedNodes: string[] = []
): Node[] {
  const nodes: Node[] = [];

  // Find root nodes (no parent)
  const rootNodes = lineageNodes.filter(node => !node.parent_id);

  console.log(`🌲 Converting ${rootNodes.length} ROOT nodes (subclasses inside)`);

  // ✅ Calculate better positioning based on number of nodes
  const COLS = Math.ceil(Math.sqrt(rootNodes.length));
  const COL_SPACING = 500;
  const ROW_SPACING = 400;

  rootNodes.forEach((rootNode, index) => {
    const hierarchy = hierarchyMap.get(rootNode.id);
    if (!hierarchy) {
      console.warn(`⚠️ No hierarchy found for root node ${rootNode.id}`);
      return;
    }

    const displayName = rootNode.display_name || rootNode.name || (rootNode as any).label || 'Unknown';
    const nodeName = rootNode.name || displayName;

    // ✅ Calculate grid position to prevent overlaps
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const xPos = col * COL_SPACING + 50;
    const yPos = row * ROW_SPACING + 50;

    // ✅ Create single node for root class (children shown inside via TreeView)
    nodes.push({
      id: rootNode.id,
      type: 'class',
      position: {
        x: xPos,
        y: yPos,
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
      // ✅ Set explicit width/height to help React Flow calculate layout
      style: {
        width: 350,
      },
    });
  });

  console.log(`✅ Created ${nodes.length} React Flow nodes (root classes only)`);

  return nodes;
}

function convertToFlowEdges(
  lineageEdges: LineageGraphEdge[],
  lineageNodes: LineageGraphNode[],
  highlightedEdges: string[] = []
): Edge[] {
  console.log(`🔍 Processing ${lineageEdges.length} total edges from backend`);

  // Build a map to find root parent for any node
  const nodeToRootMap = new Map<string, string>();
  lineageNodes.forEach(node => {
    // Find the root by traversing up the parent chain
    let currentNode = node;
    let rootId = node.id;
    const visited = new Set<string>();

    while (currentNode.parent_id && !visited.has(currentNode.id)) {
      visited.add(currentNode.id);
      const parentNode = lineageNodes.find(n => n.id === currentNode.parent_id);
      if (parentNode) {
        rootId = parentNode.id;
        currentNode = parentNode;
      } else {
        break;
      }
    }
    nodeToRootMap.set(node.id, rootId);
  });

  // Filter out hierarchy edges since hierarchy is shown inside nodes
  const schemaRelEdges = lineageEdges.filter(edge => {
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();

    const isSchemaRel = edgeType === 'schema_relationship' || edgeType === 'schema_rel';
    const isNotHierarchy = edgeType !== 'hierarchy' &&
                          !edgeLabel.includes('subclass') &&
                          !edgeLabel.includes('has_class');

    const shouldInclude = isSchemaRel || isNotHierarchy;

    if (!shouldInclude) {
      console.log(`  ⏭️ Skipping hierarchy edge: ${edge.id} (${edge.type})`);
    }

    return shouldInclude;
  });

  console.log(`✅ Filtered to ${schemaRelEdges.length} schema relationship edges`);

  return schemaRelEdges.map((edge): Edge => {
    const isHighlighted = highlightedEdges.includes(edge.id) || edge.highlighted;

    // Map subclass nodes to their root parents for edge rendering
    const sourceRoot = nodeToRootMap.get(edge.source) || edge.source;
    const targetRoot = nodeToRootMap.get(edge.target) || edge.target;

    const sourceNode = lineageNodes.find(n => n.id === edge.source);
    const targetNode = lineageNodes.find(n => n.id === edge.target);

    // Enhanced label showing subclass relationship if applicable
    let enhancedLabel = edge.label || '';
    if (sourceNode && targetNode) {
      if (edge.source !== sourceRoot || edge.target !== targetRoot) {
        // Edge involves subclasses
        const sourceName = sourceNode.display_name || sourceNode.name || 'Unknown';
        const targetName = targetNode.display_name || targetNode.name || 'Unknown';
        enhancedLabel = `${sourceName} → ${targetName}${edge.label ? ` (${edge.label})` : ''}`;
      }
    }

    console.log(`🔗 Edge: ${edge.id} | ${edge.source} (root:${sourceRoot}) → ${edge.target} (root:${targetRoot}) | ${enhancedLabel}`);

    return {
      id: edge.id,
      source: sourceRoot,
      target: targetRoot,
      sourceHandle: edge.source !== sourceRoot ? edge.source : undefined,
      targetHandle: edge.target !== targetRoot ? edge.target : undefined,
      type: 'custom',
      label: enhancedLabel,
      animated: isHighlighted,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: isHighlighted ? '#10B981' : '#718096',
      },
      data: {
        type: edge.type,
        highlighted: isHighlighted,
        cardinality: edge.cardinality,
        label: enhancedLabel,
        originalSource: edge.source,
        originalTarget: edge.target,
      },
      style: {
        stroke: isHighlighted ? '#10B981' : '#718096',
        strokeWidth: isHighlighted ? 3 : 2,
      },
    };
  });
}

// ============================================
// MAIN COMPONENT
// ============================================

const LineageCanvas: React.FC<LineageCanvasProps> = ({
  graph,
  onNodeClick,
  onEdgeClick,
  highlightedNodes = [],
  highlightedEdges = [],
  onRefresh,
}) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // 🔍 DEBUG: Log what data we're receiving
  console.log('📊 LineageCanvas render:', {
    hasGraph: !!graph,
    nodeCount: graph?.nodes?.length || 0,
    edgeCount: graph?.edges?.length || 0,
    schemaId: graph?.schema_id,
    schemaName: graph?.schema_name,
  });

  if (graph?.nodes) {
    console.log('📝 Sample nodes:', graph.nodes.slice(0, 2));
  }
  if (graph?.edges) {
    console.log('🔗 Sample edges:', graph.edges.slice(0, 2));
  }

  // Build hierarchy tree
  const hierarchyMap = useMemo(() => {
    if (!graph) return new Map();
    return buildHierarchyTree(graph.nodes, graph.edges || []);
  }, [graph]);

  // Convert to React Flow format - ONLY root nodes
  const initialNodes = useMemo(() => {
    if (!graph) return [];
    return convertToFlowNodes(graph.nodes, hierarchyMap, highlightedNodes);
  }, [graph, hierarchyMap, highlightedNodes]);

  const initialEdges = useMemo(() => {
    if (!graph) return [];
    return convertToFlowEdges(graph.edges || [], graph.nodes, highlightedEdges);
  }, [graph, highlightedEdges]);

  // ✅ FIX: Use key prop to force re-mount when graph changes instead of useEffect
  const graphKey = useMemo(() => graph?.schema_id || 'no-graph', [graph?.schema_id]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // ✅ NEW: State for lineage tracing
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 🔍 DEBUG: Log what's being passed to ReactFlow
  console.log('🎯 ReactFlow state:', {
    nodesCount: nodes.length,
    edgesCount: edges.length,
    graphKey,
  });

  // Relationship creation dialog
  const [relationshipDialog, setRelationshipDialog] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [relationshipName, setRelationshipName] = useState('');
  const [cardinality, setCardinality] = useState<Cardinality>(Cardinality.ONE_TO_MANY);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // ✅ FIX: Fit view only once when graph loads
  useEffect(() => {
    if (nodes.length > 0 && graph) {
      // Use timeout to ensure nodes are rendered before fitting view
      const timer = setTimeout(() => {
        fitView({ padding: 0.2, duration: 200 });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [graph?.schema_id]); // Only run when schema changes

  // ✅ NEW: Trace lineage path when node is clicked
  const traceLineagePath = useCallback((nodeId: string) => {
    if (!graph) return;

    console.log(`🔍 Tracing lineage for node: ${nodeId}`);

    // Find all connected nodes (upstream and downstream)
    const connectedNodeIds = new Set<string>();
    const connectedEdgeIds = new Set<string>();

    connectedNodeIds.add(nodeId);

    // BFS to find all connected nodes through schema relationships
    const queue: string[] = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentNodeId = queue.shift()!;
      if (visited.has(currentNodeId)) continue;
      visited.add(currentNodeId);

      // Find edges connected to this node
      edges.forEach(edge => {
        const isConnected = edge.source === currentNodeId || edge.target === currentNodeId;
        const isSchemaRel = edge.data?.type !== 'hierarchy';

        if (isConnected && isSchemaRel) {
          connectedEdgeIds.add(edge.id);

          // Add the other node to the path
          const otherNodeId = edge.source === currentNodeId ? edge.target : edge.source;
          if (!visited.has(otherNodeId)) {
            connectedNodeIds.add(otherNodeId);
            queue.push(otherNodeId);
          }
        }
      });
    }

    console.log(`✅ Found lineage path:`, {
      nodes: Array.from(connectedNodeIds),
      edges: Array.from(connectedEdgeIds),
    });

    // Update nodes to highlight the path
    setNodes(currentNodes =>
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          highlighted: connectedNodeIds.has(n.id),
          selected: n.id === nodeId,
        },
      }))
    );

    // Update edges to highlight the path
    setEdges(currentEdges =>
      currentEdges.map(e => ({
        ...e,
        animated: connectedEdgeIds.has(e.id),
        data: {
          ...e.data,
          highlighted: connectedEdgeIds.has(e.id),
        },
        style: {
          ...e.style,
          stroke: connectedEdgeIds.has(e.id) ? '#10B981' : e.style?.stroke || '#718096',
          strokeWidth: connectedEdgeIds.has(e.id) ? 3 : e.style?.strokeWidth || 2,
        },
      }))
    );
  }, [graph, edges, setNodes, setEdges]);

  // ✅ NEW: Clear lineage highlighting
  const clearLineageHighlight = useCallback(() => {
    console.log('🧹 Clearing lineage highlight');

    setNodes(currentNodes =>
      currentNodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          highlighted: false,
          selected: false,
        },
      }))
    );

    setEdges(currentEdges =>
      currentEdges.map(e => ({
        ...e,
        animated: false,
        data: {
          ...e.data,
          highlighted: false,
        },
        style: {
          ...e.style,
          stroke: e.data?.type === 'hierarchy' ? '#CBD5E0' : '#718096',
          strokeWidth: e.data?.type === 'hierarchy' ? 1 : 2,
        },
      }))
    );

    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Toggle lineage highlighting
      if (selectedNodeId === node.id) {
        // Clicking same node again clears highlight
        clearLineageHighlight();
      } else {
        // Trace lineage for clicked node
        setSelectedNodeId(node.id);
        traceLineagePath(node.id);
      }

      if (onNodeClick) {
        onNodeClick(node);
      }
    },
    [onNodeClick, selectedNodeId, traceLineagePath, clearLineageHighlight]
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
    <Box sx={{ width: '100%', height: '100%', position: 'relative', minHeight: '600px' }}>
      <ReactFlow
        key={graphKey}
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
        fitViewOptions={{ padding: 0.2, minZoom: 0.1, maxZoom: 1.5 }}
        attributionPosition="bottom-right"
        connectionLineType={ConnectionLineType.SmoothStep}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'custom',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.highlighted) return '#10B981';
            if (node.data.selected) return '#DB0011';
            return '#FFFFFF';
          }}
          nodeStrokeColor={(node) => {
            if (node.data.highlighted) return '#059669';
            return '#E2E8F0';
          }}
          nodeStrokeWidth={1.5}
          zoomable
          pannable
          style={{
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
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
            {selectedNodeId && (
              <Chip
                label="Lineage Traced (click to clear)"
                size="small"
                color="warning"
                onDelete={clearLineageHighlight}
                sx={{ cursor: 'pointer' }}
              />
            )}
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

// Wrapper component with ReactFlowProvider
const LineageCanvasWithProvider: React.FC<LineageCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <LineageCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default LineageCanvasWithProvider;
export { LineageCanvas };