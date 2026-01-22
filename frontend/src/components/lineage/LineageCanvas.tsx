// frontend/src/components/lineage/LineageCanvas.tsx
// ✅ HYBRID: Visual grouping + Full connectivity for ALL nodes

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

    return {
      id: nodeId,
      name: graphNode.name || (graphNode as any).label || 'Unknown',
      display_name: graphNode.display_name || graphNode.name || (graphNode as any).label || 'Unknown',
      type: children.length > 0 || graphNode.parent_id ? 'subclass' : 'class',
      level: graphNode.level ?? 0,
      parent_id: graphNode.parent_id || undefined,
      children,
      attributes,
      instance_count: graphNode.instance_count || 0,
      collapsed: graphNode.collapsed !== false,
      metadata: graphNode.metadata || {},
    };
  };

  nodes.forEach((node) => {
    if (!parentMap.has(node.id)) {
      const hierarchyNode = buildNode(node.id, new Set());
      if (hierarchyNode) {
        hierarchyMap.set(node.id, hierarchyNode);
      }
    }
  });

  return hierarchyMap;
}

// ✅ CRITICAL: ALL nodes become React Flow nodes, positioned intelligently
function convertToFlowNodes(
  lineageNodes: LineageGraphNode[],
  hierarchyData: Map<string, HierarchyNode>,
  highlightedNodes: string[] = [],
  onAttributeClick?: (attributeId: string, nodeId: string) => void
): Node[] {
  const nodes: Node[] = [];
  const processedIds = new Set<string>();
  
  let rootXOffset = 0;
  const ROOT_SPACING_X = 500;
  const LEVEL_OFFSET_X = 80;
  const LEVEL_OFFSET_Y = 250;
  
  // Process root nodes and their hierarchies
  lineageNodes.filter(n => !n.parent_id).forEach((rootNode) => {
    const hierarchy = hierarchyData.get(rootNode.id);
    
    // Add root node
    nodes.push({
      id: rootNode.id,
      type: 'class',
      position: rootNode.position || { x: rootXOffset, y: 0 },
      data: {
        id: rootNode.id,
        name: rootNode.display_name || rootNode.name || 'Unknown',
        label: rootNode.display_name || rootNode.name || 'Unknown',
        type: 'class',
        attributes: rootNode.attributes || [],
        instance_count: rootNode.instance_count,
        collapsed: false,
        highlighted: highlightedNodes.includes(rootNode.id),
        selected: false,
        level: 0,
        hierarchy: hierarchy,  // Pass for visual indicator
        isStandaloneNode: true,  // ✅ Flag to show it's a separate node
        onAttributeClick: onAttributeClick
          ? (attrId: string) => onAttributeClick(attrId, rootNode.id)
          : undefined,
      },
    });
    
    processedIds.add(rootNode.id);
    
    // ✅ Add all descendants as separate nodes with smart positioning
    if (hierarchy) {
      const addDescendants = (parent: HierarchyNode, baseX: number, currentY: number): number => {
        let yOffset = currentY;
        
        parent.children.forEach((child) => {
          if (processedIds.has(child.id)) return;
          
          const childX = baseX + (child.level * LEVEL_OFFSET_X);
          const childY = yOffset;
          
          nodes.push({
            id: child.id,
            type: 'class',
            position: { x: childX, y: childY },
            data: {
              id: child.id,
              name: child.display_name || child.name,
              label: child.display_name || child.name,
              type: 'subclass',
              attributes: child.attributes || [],
              instance_count: child.instance_count,
              collapsed: false,
              highlighted: highlightedNodes.includes(child.id),
              selected: false,
              level: child.level,
              hierarchy: child.children.length > 0 ? child : undefined,
              isStandaloneNode: true,  // ✅ Flag
              parentId: parent.id,  // For visual reference
              onAttributeClick: onAttributeClick
                ? (attrId: string) => onAttributeClick(attrId, child.id)
                : undefined,
            },
          });
          
          processedIds.add(child.id);
          yOffset += LEVEL_OFFSET_Y;
          
          // Recursively add children
          if (child.children.length > 0) {
            yOffset = addDescendants(child, baseX, yOffset);
          }
        });
        
        return yOffset;
      };
      
      addDescendants(hierarchy, rootXOffset, LEVEL_OFFSET_Y);
    }
    
    rootXOffset += ROOT_SPACING_X;
  });
  
  console.log(`✅ Created ${nodes.length} React Flow nodes (all connectable)`);
  console.log(`   Root nodes: ${nodes.filter(n => n.data.level === 0).length}`);
  console.log(`   Subclass nodes: ${nodes.filter(n => n.data.type === 'subclass').length}`);
  
  return nodes;
}

function convertToFlowEdges(
  lineageEdges: LineageGraphEdge[],
  highlightedEdges: string[] = []
): Edge[] {
  const schemaRelEdges = lineageEdges.filter(edge => {
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();
    
    return edgeType === 'schema_relationship' || 
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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [relationshipDialog, setRelationshipDialog] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [relationshipName, setRelationshipName] = useState('');
  const [cardinality, setCardinality] = useState<Cardinality>(Cardinality.ONE_TO_MANY);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  
  const graphVersionRef = useRef<string>('');
  
  const hierarchyMap = useMemo(() => {
    if (!graph || !graph.nodes) return new Map();
    const map = buildHierarchyTree(graph.nodes, graph.edges || []);
    return map;
  }, [graph?.schema_id, graph?.nodes?.length, graph?.edges?.length]);

  useEffect(() => {
    if (!graph || !graph.nodes) {
      setNodes([]);
      return;
    }
    
    const currentVersion = `${graph.schema_id}-${graph.nodes.length}-${graph.edges?.length || 0}`;
    
    if (currentVersion === graphVersionRef.current) {
      return;
    }
    
    graphVersionRef.current = currentVersion;
    
    const flowNodes = convertToFlowNodes(
      graph.nodes,
      hierarchyMap,
      highlightedNodes,
      onAttributeClick
    );
    
    setNodes(flowNodes);
  }, [graph, hierarchyMap, highlightedNodes, onAttributeClick, setNodes]);

  useEffect(() => {
    if (!graph || !graph.edges) {
      setEdges([]);
      return;
    }
    
    const flowEdges = convertToFlowEdges(graph.edges, highlightedEdges);
    setEdges(flowEdges);
  }, [graph?.edges, highlightedEdges, setEdges]);

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

  const onConnect = useCallback(
    (connection: Connection) => {
      // ✅ Proper null checks for TypeScript
      if (!connection.source || !connection.target) {
        setError('Invalid connection: missing source or target');
        return;
      }
      
      console.log('🔗 Creating connection:', connection.source, '→', connection.target);
      
      setPendingConnection(connection);
      setRelationshipDialog(true);
      setError(null);
    },
    []
  );

  const handleCreateRelationship = useCallback(async () => {
    if (!pendingConnection || !graph) return;
    
    // ✅ Explicit null checks with TypeScript safety
    const sourceId = pendingConnection.source;
    const targetId = pendingConnection.target;
    
    if (!sourceId || !targetId) {
      setError('Invalid connection: missing source or target');
      return;
    }
    
    if (!relationshipName.trim()) {
      setError('Relationship name is required');
      return;
    }
    
    setCreating(true);
    setError(null);
    
    try {
      const relationship = await apiService.createRelationship(
        graph.schema_id,
        sourceId,
        targetId,
        relationshipName,
        cardinality
      );
      
      const newEdge: Edge = {
        id: relationship.id,
        source: sourceId,
        target: targetId,
        type: 'custom',
        label: relationshipName,
        data: {
          type: 'schema_relationship',
          cardinality: cardinality,
          label: relationshipName,
        },
        style: {
          stroke: '#64b5f6',
          strokeWidth: 2,
        },
      };
      
      setEdges((eds) => addEdge(newEdge, eds));
      
      setRelationshipDialog(false);
      setPendingConnection(null);
      setRelationshipName('');
      setCardinality(Cardinality.ONE_TO_MANY);
      
      if (onRefresh) {
        onRefresh();
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
            if (node.data.type === 'subclass') return '#9c27b0';
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
            <Chip label={`${nodes.length} Total Nodes`} size="small" />
            <Chip 
              label={`${nodes.filter(n => n.data.type === 'subclass').length} Subclasses`} 
              size="small" 
              color="secondary" 
            />
            <Chip label={`${edges.length} Relationships`} size="small" color="primary" />
          </Stack>
        </Panel>
      </ReactFlow>

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
              <Select value={cardinality} onChange={(e) => setCardinality(e.target.value as Cardinality)} label="Cardinality">
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
          <Button onClick={handleCreateRelationship} variant="contained" disabled={creating || !relationshipName.trim()}>
            {creating ? 'Creating...' : 'Create Relationship'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LineageCanvas;