// frontend/src/components/EnhancedLineageGraph.tsx - COMPLETELY FIXED VERSION

import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node as FlowNode,
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
  Handle,
  Position,
  ConnectionLineType,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ChevronDown,
  ChevronRight,
  Box,
  Circle,
  Info,
} from 'lucide-react';
import { LineageNode, LineageEdge, FlowNodeData } from '../types';

interface EnhancedLineageGraphProps {
  nodes: LineageNode[];
  edges: LineageEdge[];
  highlightedNodes?: string[];
  highlightedEdges?: string[];
  selectedNodeIds?: string[];
  selectionMode?: boolean;
  onNodeClick?: (node: FlowNode) => void;
  onToggleExpand?: (classId: string) => void;
}

const EnhancedLineageGraphInner: React.FC<EnhancedLineageGraphProps> = ({
  nodes: lineageNodes,
  edges: lineageEdges,
  highlightedNodes = [],
  highlightedEdges = [],
  selectedNodeIds = [],
  selectionMode = false,
  onNodeClick,
  onToggleExpand,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView } = useReactFlow();

  console.log('📥 EnhancedLineageGraph props:', {
    lineageNodes: lineageNodes?.length || 0,
    lineageEdges: lineageEdges?.length || 0,
  });

  // Convert and update nodes/edges whenever lineage data changes
  useEffect(() => {
    if (!lineageNodes || lineageNodes.length === 0) {
      console.log('⚠️ No lineage nodes');
      setNodes([]);
      setEdges([]);
      return;
    }

    console.log('🔄 Converting lineage data to flow format');
    const flowNodes = convertToFlowNodes(lineageNodes, highlightedNodes, selectedNodeIds);
    const flowEdges = convertToFlowEdges(lineageEdges || [], highlightedEdges);
    
    console.log('✅ Converted:', { nodes: flowNodes.length, edges: flowEdges.length });
    
    setNodes(flowNodes);
    setEdges(flowEdges);

    // FIT VIEW AFTER A DELAY TO ENSURE REACT FLOW IS READY
    if (flowNodes.length > 0) {
      console.log('🎯 Scheduling fitView');
      setTimeout(() => {
        try {
          fitView({ 
            padding: 0.2, 
            duration: 300,
            maxZoom: 1.5,
            minZoom: 0.5
          });
          console.log('✅ fitView completed');
        } catch (err) {
          console.error('❌ fitView failed:', err);
        }
      }, 150);
    }
  }, [lineageNodes, lineageEdges, highlightedNodes, highlightedEdges, selectedNodeIds, setNodes, setEdges, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  const handleToggleExpand = useCallback(
    (classId: string) => {
      onToggleExpand?.(classId);
    },
    [onToggleExpand]
  );

  const nodeTypes = useMemo(
    () => ({
      schemaClass: (props: any) => (
        <SchemaClassNode {...props} onToggleExpand={handleToggleExpand} />
      ),
      dataInstance: DataInstanceNode,
    }),
    [handleToggleExpand]
  );

  if (!lineageNodes || lineageNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Box size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Nodes to Display</h3>
          <p className="text-gray-600">
            The schema has no classes or the graph couldn't be loaded.
          </p>
        </div>
      </div>
    );
  }

  console.log('🎨 Rendering React Flow with:', nodes.length, 'nodes', edges.length, 'edges');

  return (
    <div className="w-full h-full" style={{ minHeight: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5, minZoom: 0.5 }}
        minZoom={0.1}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e5e7eb" />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (highlightedNodes.includes(node.id)) return '#EAB308';
            if (selectedNodeIds.includes(node.id)) return '#2563EB';
            return node.data.color || '#6B7280';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="bottom-right"
        />
        
        <Panel position="top-left" className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">Legend</span>
            </div>
            <div className="text-xs space-y-1">
              <LegendItem color="#6B7280" label="Schema Class" />
              <LegendItem color="#3B82F6" label="Data Instance" />
              {selectionMode && <LegendItem color="#2563EB" label="Selected" />}
              {highlightedNodes.length > 0 && <LegendItem color="#EAB308" label="Highlighted Path" />}
            </div>
          </div>
        </Panel>

        <Panel position="top-right" className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2">
          <div className="text-xs text-gray-600">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = React.memo(({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
    <span>{label}</span>
  </div>
));

function convertToFlowNodes(
  lineageNodes: LineageNode[],
  highlightedNodes: string[],
  selectedNodeIds: string[]
): FlowNode<FlowNodeData>[] {
  const schemaClasses = lineageNodes.filter(n => n.type === 'schema_class');
  const dataInstances = lineageNodes.filter(n => n.type === 'data_instance');
  
  console.log('📦 Node types:', { schemaClasses: schemaClasses.length, dataInstances: dataInstances.length });

  const nodes: FlowNode<FlowNodeData>[] = [];
  
  // BETTER SPACING FOR VISIBILITY
  const classSpacing = 350;
  const rowHeight = 300;
  
  schemaClasses.forEach((node, index) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isHighlighted = highlightedNodes.includes(node.id);
    
    const col = index % 3;
    const row = Math.floor(index / 3);
    
    const position = { 
      x: col * classSpacing, 
      y: row * rowHeight 
    };
    
    console.log(`  Creating node: ${node.name} at (${position.x}, ${position.y})`);
    
    nodes.push({
      id: node.id,
      type: 'schemaClass',
      position,
      data: {
        label: node.name,
        type: node.type,
        nodeType: node.type,
        schema_id: node.schema_id,
        class_id: node.class_id,
        parent_id: node.parent_id,
        collapsed: node.data?.collapsed !== false,
        instance_count: node.data?.instance_count || 0,
        attributes: node.data?.attributes || [],
        data: node.data || {},
        color: node.data?.color || '#6B7280',
        icon: node.data?.icon || 'Box',
        isHighlighted,
        isSelected,
      },
    });
  });
  
  const instancesByParent: Record<string, LineageNode[]> = {};
  dataInstances.forEach(instance => {
    const parentId = instance.parent_id || 'unknown';
    if (!instancesByParent[parentId]) {
      instancesByParent[parentId] = [];
    }
    instancesByParent[parentId].push(instance);
  });
  
  Object.entries(instancesByParent).forEach(([parentId, instances]) => {
    const parentNode = nodes.find(n => n.id === parentId);
    const parentX = parentNode?.position.x || 0;
    const parentY = parentNode?.position.y || 0;
    
    instances.forEach((instance, index) => {
      const isSelected = selectedNodeIds.includes(instance.id);
      const isHighlighted = highlightedNodes.includes(instance.id);
      
      const col = index % 3;
      const row = Math.floor(index / 3);
      
      nodes.push({
        id: instance.id,
        type: 'dataInstance',
        position: {
          x: parentX + (col - 1) * 220,
          y: parentY + 180 + row * 100,
        },
        data: {
          label: instance.name,
          type: instance.type,
          nodeType: instance.type,
          schema_id: instance.schema_id,
          class_id: instance.class_id,
          parent_id: instance.parent_id,
          collapsed: false,
          data: instance.data || {},
          color: '#3B82F6',
          isHighlighted,
          isSelected,
        },
      });
    });
  });
  
  console.log(`✅ Created ${nodes.length} flow nodes`);
  return nodes;
}

function convertToFlowEdges(
  lineageEdges: LineageEdge[],
  highlightedEdges: string[]
): Edge[] {
  console.log('🔗 Converting', lineageEdges.length, 'edges');
  
  return lineageEdges.map((edge) => {
    const isHighlighted = highlightedEdges.includes(edge.id);
    
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.type === 'parent_child' ? 'bottom' : 'right',
      targetHandle: edge.type === 'parent_child' ? 'top' : 'left',
      type: edge.type === 'parent_child' ? 'straight' : 'smoothstep',
      label: edge.label,
      animated: isHighlighted,
      style: {
        stroke: isHighlighted ? '#EAB308' : '#9CA3AF',
        strokeWidth: isHighlighted ? 3 : 2,
      },
      labelStyle: {
        fill: '#374151',
        fontSize: 11,
        fontWeight: 500,
      },
      labelBgStyle: {
        fill: 'white',
        fillOpacity: 0.8,
      },
    };
  });
}

interface SchemaClassNodeProps {
  data: FlowNodeData;
  onToggleExpand: (classId: string) => void;
}

const SchemaClassNode: React.FC<SchemaClassNodeProps> = React.memo(({ data, onToggleExpand }) => {
  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.class_id) {
      onToggleExpand(data.class_id);
    }
  }, [data.class_id, onToggleExpand]);

  const hasInstances = data.instance_count !== undefined && data.instance_count > 0;

  return (
    <div
      className={`px-6 py-4 rounded-lg border-2 bg-white shadow-lg transition-all min-w-[220px] ${
        data.isSelected
          ? 'border-blue-600 shadow-blue-300 ring-4 ring-blue-200'
          : data.isHighlighted
          ? 'border-yellow-500 shadow-yellow-300'
          : 'border-gray-300 hover:border-gray-400'
      }`}
      style={{ cursor: 'pointer' }}
    >
      <Handle type="target" position={Position.Top} id="top" className="!bg-gray-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-gray-400" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-400" />
      
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${data.color}20`, color: data.color }}
          >
            <Box size={16} />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{data.label}</div>
            <div className="text-xs text-gray-500">Schema Class</div>
          </div>
        </div>
        
        {hasInstances && (
          <button
            onClick={handleToggle}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1"
            title={data.collapsed ? 'Expand instances' : 'Collapse instances'}
          >
            {data.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>
      
      {hasInstances && (
        <div className="mt-2 text-xs text-gray-600">
          {data.instance_count} instance{data.instance_count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
});

const DataInstanceNode: React.FC<{ data: FlowNodeData }> = React.memo(({ data }) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white shadow-md transition-all min-w-[180px] ${
        data.isSelected
          ? 'border-blue-600 shadow-blue-300 ring-4 ring-blue-200'
          : data.isHighlighted
          ? 'border-yellow-500 shadow-yellow-300'
          : 'border-blue-300 hover:border-blue-400'
      }`}
      style={{ cursor: 'pointer' }}
    >
      <Handle type="target" position={Position.Top} id="top" className="!bg-blue-400" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-blue-400" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-blue-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-blue-400" />
      
      <div className="flex items-center gap-2">
        <Circle size={12} className="text-blue-500" fill="currentColor" />
        <div>
          <div className="font-medium text-gray-900 text-sm">{data.label}</div>
          <div className="text-xs text-gray-500">Instance</div>
        </div>
      </div>
    </div>
  );
});

export const EnhancedLineageGraph: React.FC<EnhancedLineageGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <EnhancedLineageGraphInner {...props} />
    </ReactFlowProvider>
  );
};