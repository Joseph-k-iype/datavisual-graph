// frontend/src/components/EnhancedLineageGraph.tsx - FIXED RENDERING ISSUE

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

  useEffect(() => {
    console.log('=== GRAPH UPDATE ===');
    console.log('Lineage Nodes:', lineageNodes.length);
    console.log('Lineage Edges:', lineageEdges.length);
    console.log('Highlighted Nodes:', highlightedNodes);
    console.log('Highlighted Edges:', highlightedEdges);
    
    if (lineageNodes.length === 0) {
      console.warn('⚠️ No nodes to render!');
      setNodes([]);
      setEdges([]);
      return;
    }

    const flowNodes = convertToFlowNodes(lineageNodes, highlightedNodes, selectedNodeIds);
    const flowEdges = convertToFlowEdges(lineageEdges, highlightedEdges);
    
    console.log('✅ Converted Flow Nodes:', flowNodes.length);
    console.log('✅ Converted Flow Edges:', flowEdges.length);
    console.log('Node positions:', flowNodes.map(n => ({ id: n.id, pos: n.position })));
    
    setNodes(flowNodes);
    setEdges(flowEdges);
    
    // Fit view after nodes are set
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 200 });
    }, 50);
  }, [lineageNodes, lineageEdges, highlightedNodes, highlightedEdges, selectedNodeIds, setNodes, setEdges, fitView]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      console.log('Node clicked:', node.id);
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  const handleToggleExpand = useCallback(
    (classId: string) => {
      console.log('Toggling expand for class:', classId);
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

  // Show message if no nodes
  if (lineageNodes.length === 0) {
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

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, duration: 200, maxZoom: 1.5 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        attributionPosition="bottom-left"
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

        {/* Node Count Panel */}
        <Panel position="top-right" className="bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2">
          <div className="text-xs text-gray-600">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} · {edges.length} edge{edges.length !== 1 ? 's' : ''}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
    <span>{label}</span>
  </div>
);

// Convert lineage nodes to React Flow nodes with PROPER POSITIONING
function convertToFlowNodes(
  lineageNodes: LineageNode[],
  highlightedNodes: string[],
  selectedNodeIds: string[]
): FlowNode<FlowNodeData>[] {
  const schemaClasses = lineageNodes.filter(n => n.type === 'schema_class');
  const dataInstances = lineageNodes.filter(n => n.type === 'data_instance');
  
  console.log('Converting nodes:', {
    schemaClasses: schemaClasses.length,
    dataInstances: dataInstances.length
  });

  const nodes: FlowNode<FlowNodeData>[] = [];
  
  // FIXED: Better positioning for schema classes
  const classSpacing = 400; // Increased spacing
  const rowHeight = 250;
  
  schemaClasses.forEach((node, index) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isHighlighted = highlightedNodes.includes(node.id);
    
    // Calculate position in a grid layout
    const col = index % 3;
    const row = Math.floor(index / 3);
    
    nodes.push({
      id: node.id,
      type: 'schemaClass',
      position: { 
        x: col * classSpacing, 
        y: row * rowHeight 
      },
      data: {
        label: node.name,
        type: node.type,
        nodeType: node.type,
        schema_id: node.schema_id,
        class_id: node.class_id,
        parent_id: node.parent_id,
        collapsed: node.data?.collapsed !== false, // Default to collapsed
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
  
  // FIXED: Better positioning for data instances
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
      
      // Position instances below parent in a grid
      const col = index % 3;
      const row = Math.floor(index / 3);
      
      nodes.push({
        id: instance.id,
        type: 'dataInstance',
        position: {
          x: parentX + (col - 1) * 220,
          y: parentY + 200 + row * 120,
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

// Convert lineage edges to React Flow edges
function convertToFlowEdges(
  lineageEdges: LineageEdge[],
  highlightedEdges: string[]
): Edge[] {
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

// Schema Class Node Component
interface SchemaClassNodeProps {
  data: FlowNodeData;
  onToggleExpand: (classId: string) => void;
}

const SchemaClassNode: React.FC<SchemaClassNodeProps> = ({ data, onToggleExpand }) => {
  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.class_id) {
      onToggleExpand(data.class_id);
    }
  };

  const hasInstances = data.instance_count !== undefined && data.instance_count > 0;

  return (
    <div
      className={`px-6 py-4 rounded-lg border-2 bg-white shadow-lg transition-all min-w-[220px] ${
        data.isSelected
          ? 'border-blue-600 shadow-blue-300 ring-4 ring-blue-200'
          : data.isHighlighted
          ? 'border-yellow-500 shadow-yellow-300 ring-4 ring-yellow-200'
          : 'border-gray-300 hover:border-gray-400'
      }`}
      style={{ cursor: 'pointer' }}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#374151', width: 16, height: 16, border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#374151', width: 16, height: 16, border: '2px solid white' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#374151', width: 16, height: 16, border: '2px solid white' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#374151', width: 16, height: 16, border: '2px solid white' }} />

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: data.color || '#6B7280' }}>
            <Box size={18} className="text-white" />
          </div>
          <div className="font-semibold text-sm text-black">{data.label}</div>
        </div>
        
        {hasInstances && (
          <button 
            onClick={handleToggle} 
            className="p-1.5 hover:bg-gray-100 rounded transition-colors" 
            title={data.collapsed ? 'Expand to see data' : 'Collapse'}
          >
            {data.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {data.attributes && data.attributes.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1 mt-2">
          {data.attributes.slice(0, 3).map((attr, i) => (
            <div key={i} className="truncate">• {attr}</div>
          ))}
          {data.attributes.length > 3 && (
            <div className="text-gray-400">+{data.attributes.length - 3} more</div>
          )}
        </div>
      )}
      
      {hasInstances && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            {data.instance_count} instance{data.instance_count !== 1 ? 's' : ''}
            {data.collapsed && <span className="ml-1 text-blue-600">(click to expand)</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// Data Instance Node Component
interface DataInstanceNodeProps {
  data: FlowNodeData;
}

const DataInstanceNode: React.FC<DataInstanceNodeProps> = ({ data }) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white shadow-md transition-all min-w-[180px] ${
        data.isSelected
          ? 'border-blue-600 shadow-blue-200 ring-4 ring-blue-200'
          : data.isHighlighted
          ? 'border-yellow-500 shadow-yellow-200 ring-4 ring-yellow-200'
          : 'border-blue-300 hover:border-blue-400'
      }`}
      style={{ cursor: 'pointer' }}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />

      <div className="flex items-center gap-2 mb-2">
        <Circle size={12} className="text-blue-500" fill="currentColor" />
        <div className="font-medium text-sm text-black truncate">{data.label}</div>
      </div>

      {data.data && Object.keys(data.data).length > 0 && (
        <div className="text-xs text-gray-600 space-y-1">
          {Object.entries(data.data).slice(0, 2).map(([key, value]) => (
            <div key={key} className="truncate">
              <span className="text-gray-500">{key}:</span> {String(value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Wrapper component with ReactFlowProvider
export const EnhancedLineageGraph: React.FC<EnhancedLineageGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <EnhancedLineageGraphInner {...props} />
    </ReactFlowProvider>
  );
};

export default EnhancedLineageGraph;