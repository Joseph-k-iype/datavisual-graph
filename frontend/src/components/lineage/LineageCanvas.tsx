// frontend/src/components/lineage/LineageCanvas.tsx
// FIXED: Proper names, filtered edges, tree view for subclasses

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

  // Build parent-child relationships from HAS_SUBCLASS edges
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

  // Build hierarchy for all nodes
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

function convertToFlowNodes(
  lineageNodes: LineageGraphNode[],
  hierarchyData: Map<string, HierarchyNode>,
  highlightedNodes: string[] = [],
  onAttributeClick?: (attributeId: string, nodeId: string) => void
): Node[] {
  // Filter out subclasses - they'll be shown in tree view
  const rootNodes = lineageNodes.filter(node => !node.parent_id);
  
  return rootNodes.map((node, index) => {
    const hierarchy = hierarchyData.get(node.id);

    const flowNode: Node = {
      id: node.id,
      type: 'class',
      position: node.position || { x: index * 400, y: index * 200 },
      data: {
        id: node.id,
        name: node.name || (node as any).label || 'Unknown',
        label: node.display_name || node.name || (node as any).label || 'Unknown',
        type: node.type,
        attributes: node.attributes || [],
        instance_count: node.instance_count,
        collapsed: node.collapsed !== false,
        highlighted: highlightedNodes.includes(node.id),
        selected: node.selected || false,
        has_upstream: node.has_upstream || false,
        has_downstream: node.has_downstream || false,
        level: node.level || 0,
        hierarchy: hierarchy,
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
  // CRITICAL: Filter out HAS_SUBCLASS and HAS_CLASS edges - only show SCHEMA_REL
  const schemaRelEdges = lineageEdges.filter(edge => {
    const edgeType = (edge.type || '').toLowerCase();
    const edgeLabel = (edge.label || '').toLowerCase();
    
    // Only include schema_relationship edges, exclude internal relationships
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
}) => {
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [relationshipDialog, setRelationshipDialog] = React.useState<{
    open: boolean;
    source: string | null;
    target: string | null;
  }>({ open: false, source: null, target: null });
  
  const [relationshipName, setRelationshipName] = React.useState('');
  const [cardinality, setCardinality] = React.useState<Cardinality>(Cardinality.ONE_TO_MANY);
  
  const graphVersionRef = useRef<string>('');
  
  // Build hierarchy tree from graph
  const hierarchyMap = useMemo(() => {
    if (!graph || !graph.nodes) return new Map();
    console.log('🌳 Building hierarchy tree from graph nodes...');
    
    // Log nodes to debug
    console.log('📊 Nodes:', graph.nodes.map(n => ({
      id: n.id,
      name: n.name,
      label: n.label,
      parent_id: n.parent_id
    })));
    
    const map = buildHierarchyTree(graph.nodes, graph.edges || []);
    console.log('✅ Hierarchy map built:', map.size, 'root nodes');
    return map;
  }, [graph?.schema_id, graph?.nodes?.length, graph?.edges?.length]);

  // Update nodes when graph changes
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
    
    console.log('🔄 Converting graph to React Flow nodes...');
    console.log(`   Total nodes: ${graph.nodes.length}`);
    console.log(`   Root nodes: ${graph.nodes.filter(n => !n.parent_id).length}`);
    console.log(`   Subclass nodes: ${graph.nodes.filter(n => n.parent_id).length}`);
    
    const flowNodes = convertToFlowNodes(
      graph.nodes,
      hierarchyMap,
      highlightedNodes,
      onAttributeClick
    );
    
    console.log(`✅ Created ${flowNodes.length} flow nodes (subclasses in tree view)`);
    setNodes(flowNodes);
  }, [graph, hierarchyMap, highlightedNodes, onAttributeClick, setNodes]);

  // Update edges when graph changes
  useEffect(() => {
    if (!graph || !graph.edges) {
      setEdges([]);
      return;
    }
    
    console.log('🔗 Processing edges...');
    console.log(`   Total edges: ${graph.edges.length}`);
    
    // Log edge types
    const edgeTypes = graph.edges.map(e => ({
      type: e.type,
      label: e.label,
      source: e.source,
      target: e.target
    }));
    console.log('   Edge types:', edgeTypes);
    
    const flowEdges = convertToFlowEdges(graph.edges, highlightedEdges);
    
    console.log(`✅ Created ${flowEdges.length} flow edges (filtered to SCHEMA_REL only)`);
    console.log('   Edges with labels:', flowEdges.filter(e => e.label).map(e => e.label));
    
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
      if (!connection.source || !connection.target) return;
      
      setRelationshipDialog({
        open: true,
        source: connection.source,
        target: connection.target,
      });
    },
    []
  );

  const handleSaveRelationship = useCallback(async () => {
    if (!graph?.schema_id || !relationshipDialog.source || !relationshipDialog.target) {
      return;
    }
    
    if (!relationshipName.trim()) {
      alert('Please enter a relationship name');
      return;
    }
    
    try {
      console.log('💾 Saving relationship to backend...');
      
      const newRelationship = await apiService.createRelationship(
        graph.schema_id,
        relationshipDialog.source,
        relationshipDialog.target,
        relationshipName,
        cardinality
      );
      
      console.log('✅ Relationship saved:', newRelationship);
      
      const newEdge: Edge = {
        id: newRelationship.id,
        source: relationshipDialog.source,
        target: relationshipDialog.target,
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

        <Panel position="top-right">
          <Stack spacing={1}>
            <ButtonGroup orientation="vertical" size="small">
              <Tooltip title="Zoom In">
                <IconButton onClick={() => zoomIn()}>
                  <ZoomIn />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton onClick={() => zoomOut()}>
                  <ZoomOut />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit View">
                <IconButton onClick={() => fitView()}>
                  <CenterFocusStrong />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
          </Stack>
        </Panel>

        <Panel position="top-left">
          <Stack spacing={1}>
            <Chip label={`${nodes.length} Classes`} size="small" />
            <Chip label={`${edges.length} Relationships`} size="small" color="primary" />
          </Stack>
        </Panel>
      </ReactFlow>

      {/* Relationship Dialog */}
      <Dialog
        open={relationshipDialog.open}
        onClose={() => setRelationshipDialog({ open: false, source: null, target: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Relationship</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
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