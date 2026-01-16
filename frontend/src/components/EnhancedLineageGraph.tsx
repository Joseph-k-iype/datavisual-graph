// frontend/src/components/EnhancedLineageGraph.tsx - COMPLETELY FIXED VERSION

import React, { useCallback, useMemo, useEffect, useState } from 'react';
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
  const [initialized, setInitialized] = useState(false);
  const { fitView } = useReactFlow();

  console.log('📥 EnhancedLineageGraph received:', {
    lineageNodes: lineageNodes?.length || 0,
    lineageEdges: lineageEdges?.length || 0,
    highlightedNodes: highlightedNodes.length,
    highlightedEdges: highlightedEdges.length,
  });
  
  // DEBUG: Log actual edge data
  if (lineageEdges && lineageEdges.length > 0) {
    console.log('🔗 Edges received:', lineageEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type
    })));
  } else {
    console.warn('⚠️ NO EDGES RECEIVED - Check if schema has relationships');
  }

  // Convert lineage data to React Flow format
  useEffect(() => {
    console.log('🔄 Converting lineage data...');
    
    if (!lineageNodes || lineageNodes.length === 0) {
      console.log('⚠️ No lineage nodes to display');
      setNodes([]);
      setEdges([]);
      setInitialized(false);
      return;
    }

    const flowNodes = convertToFlowNodes(lineageNodes, highlightedNodes, selectedNodeIds, onToggleExpand);
    const flowEdges = convertToFlowEdges(lineageEdges || [], highlightedEdges);
    
    console.log('✅ Converted to React Flow format:', { 
      nodes: flowNodes.length, 
      edges: flowEdges.length 
    });
    
    setNodes(flowNodes);
    setEdges(flowEdges);
    
    // Mark as initialized and trigger fitView
    setInitialized(true);
  }, [lineageNodes, lineageEdges, highlightedNodes, highlightedEdges, selectedNodeIds, onToggleExpand, setNodes, setEdges]);

  // Fit view once after initialization
  useEffect(() => {
    if (initialized && nodes.length > 0) {
      console.log('🎯 Fitting view to', nodes.length, 'nodes');
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            fitView({ 
              padding: 0.2, 
              duration: 500,
              maxZoom: 1.2,
              minZoom: 0.3
            });
            console.log('✅ View fitted successfully');
          } catch (err) {
            console.error('❌ fitView failed:', err);
          }
        }, 100);
      });
    }
  }, [initialized, nodes.length, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      console.log('🖱️ Node clicked:', node.id);
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  // Define custom node types
  const nodeTypes = useMemo(() => ({
    schemaClass: (props: any) => <SchemaClassNode {...props} onToggleExpand={onToggleExpand || (() => {})} />,
    dataInstance: DataInstanceNode,
  }), [onToggleExpand]);

  if (!lineageNodes || lineageNodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <Box size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 font-medium">No data to display</p>
          <p className="text-sm text-gray-400 mt-1">Load a schema to visualize lineage</p>
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
        fitView={false} // Manual control via useEffect
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={16} 
          size={1} 
          color="#e5e7eb" 
        />
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
  selectedNodeIds: string[],
  onToggleExpand?: (classId: string) => void
): FlowNode<FlowNodeData>[] {
  const schemaClasses = lineageNodes.filter(n => n.type === 'schema_class');
  const dataInstances = lineageNodes.filter(n => n.type === 'data_instance');
  
  console.log('📦 Converting nodes:', { 
    schemaClasses: schemaClasses.length, 
    dataInstances: dataInstances.length 
  });
  
  // Log each class with its instance count
  schemaClasses.forEach(cls => {
    console.log(`  Class: ${cls.name}, instance_count: ${cls.data?.instance_count}, has data: ${!!cls.data}`);
  });

  const nodes: FlowNode<FlowNodeData>[] = [];
  
  // Layout configuration for better visibility with attributes
  const classSpacing = 450;  // Increased for wider nodes with attributes
  const rowHeight = 380;     // Increased vertical spacing
  const instanceOffsetX = 200;
  const instanceOffsetY = 140;
  const instanceSpacing = 100;
  
  // Create schema class nodes
  schemaClasses.forEach((node, index) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isHighlighted = highlightedNodes.includes(node.id);
    
    const col = index % 3;
    const row = Math.floor(index / 3);
    
    const position = { 
      x: col * classSpacing, 
      y: row * rowHeight 
    };
    
    console.log(`  Creating schema class: ${node.name} at (${position.x}, ${position.y})`);
    
    // Get instance count
    const instances = dataInstances.filter(inst => inst.parent_id === node.id);
    
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
        collapsed: node.collapsed !== false,
        instance_count: instances.length,
        attributes: node.data?.attributes || [],
        data: node.data || {},
        color: node.data?.color || '#6B7280',
        icon: node.data?.icon || 'Box',
        isHighlighted,
        isSelected,
      },
    });
  });
  
  // Create data instance nodes
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
      
      // Arrange instances in a grid below parent
      const col = index % 3;
      const row = Math.floor(index / 3);
      
      nodes.push({
        id: instance.id,
        type: 'dataInstance',
        position: {
          x: parentX - instanceOffsetX + (col * instanceSpacing),
          y: parentY + instanceOffsetY + (row * instanceSpacing),
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
        stroke: isHighlighted ? '#EAB308' : (edge.type === 'parent_child' ? '#9CA3AF' : '#60A5FA'),
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
      console.log('🔄 Toggling expand for:', data.class_id, 'current collapsed:', data.collapsed);
      onToggleExpand(data.class_id);
    }
  }, [data.class_id, onToggleExpand]);

  const hasInstances = data.instance_count !== undefined && data.instance_count > 0;
  const attributes = data.attributes || [];
  
  // Debug logging
  console.log(`SchemaClassNode ${data.label}:`, {
    instance_count: data.instance_count,
    hasInstances,
    collapsed: data.collapsed,
    class_id: data.class_id
  });

  return (
    <div
      className={`px-6 py-4 rounded-lg border-2 bg-white shadow-lg transition-all min-w-[240px] max-w-[320px] ${
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
      
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${data.color}20`, color: data.color }}
          >
            <Box size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate" title={data.label}>
              {data.label}
            </div>
            <div className="text-xs text-gray-500">Schema Class</div>
          </div>
        </div>
        
        {/* ALWAYS show chevron button, even if count is 0 - for debugging */}
        <button
          onClick={handleToggle}
          className={`transition-colors p-1 hover:bg-gray-100 rounded flex-shrink-0 ${
            hasInstances ? 'text-gray-700 hover:text-gray-900' : 'text-gray-300 hover:text-gray-400'
          }`}
          title={hasInstances ? 
            (data.collapsed ? 'Expand to show instances' : 'Collapse instances') : 
            'No instances to expand (but click to try)'}
        >
          {data.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      
      {/* Attributes Section */}
      {attributes.length > 0 && (
        <div className="border-t border-gray-200 pt-3 mb-3">
          <div className="text-xs font-medium text-gray-500 mb-2">Attributes</div>
          <div className="flex flex-wrap gap-1">
            {attributes.slice(0, 6).map((attr, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 border border-gray-200"
                title={attr}
              >
                {attr}
              </span>
            ))}
            {attributes.length > 6 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-500">
                +{attributes.length - 6} more
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Instance Count Section */}
      <div className="text-xs text-gray-600 border-t border-gray-200 pt-3">
        {hasInstances ? (
          <span className="flex items-center gap-1">
            <Circle size={8} className="text-blue-500" fill="currentColor" />
            <span className="font-medium">{data.instance_count}</span>
            <span>instance{data.instance_count !== 1 ? 's' : ''}</span>
            {data.collapsed ? 
              <span className="text-gray-400 italic ml-1">(click ▶ to expand)</span> : 
              <span className="text-blue-500 font-medium ml-1">(expanded)</span>
            }
          </span>
        ) : (
          <span className="text-gray-400 italic flex items-center gap-1">
            <Circle size={8} className="text-gray-300" />
            No instances (click ▶ to debug)
          </span>
        )}
      </div>
    </div>
  );
});

const DataInstanceNode: React.FC<{ data: FlowNodeData }> = React.memo(({ data }) => {
  // Extract data properties
  const instanceData = data.data || {};
  
  // Use 'name' from data as the label, fallback to node label
  const displayName = instanceData.name || data.label || 'Unnamed Instance';
  
  // Get other properties (exclude 'name', 'id', internal fields)
  const otherProps = Object.entries(instanceData)
    .filter(([key]) => 
      key !== 'name' && 
      key !== 'id' && 
      !key.startsWith('_') && 
      key !== 'class_id' &&
      key !== 'schema_id'
    )
    .slice(0, 4); // Show max 4 additional properties

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white shadow-md transition-all min-w-[200px] max-w-[280px] ${
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
      
      <div className="flex items-start gap-2 mb-2">
        <Circle size={12} className="text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate" title={displayName}>
            {displayName}
          </div>
          <div className="text-xs text-gray-500">Data Instance</div>
        </div>
      </div>
      
      {otherProps.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1 mt-2 border-t border-gray-200 pt-2">
          {otherProps.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-gray-500 font-medium min-w-[80px] truncate" title={key}>
                {key}:
              </span>
              <span className="text-gray-900 truncate flex-1" title={String(value)}>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
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