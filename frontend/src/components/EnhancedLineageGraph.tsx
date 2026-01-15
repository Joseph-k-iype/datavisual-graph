// frontend/src/components/EnhancedLineageGraph.tsx - COMPLETE WITH PROPER HIGHLIGHTING

import React, { useCallback, useMemo } from 'react';
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

export const EnhancedLineageGraph: React.FC<EnhancedLineageGraphProps> = ({
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

  React.useEffect(() => {
    console.log('=== GRAPH UPDATE ===');
    console.log('Highlighted Nodes:', highlightedNodes);
    console.log('Highlighted Edges:', highlightedEdges);
    
    const flowNodes = convertToFlowNodes(lineageNodes, highlightedNodes, selectedNodeIds);
    const flowEdges = convertToFlowEdges(lineageEdges, highlightedEdges);
    
    console.log('Flow Nodes with highlighting:', flowNodes.filter(n => n.data.isHighlighted));
    console.log('Flow Edges with highlighting:', flowEdges.filter(e => e.animated));
    console.log('==================');
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [lineageNodes, lineageEdges, highlightedNodes, highlightedEdges, selectedNodeIds, setNodes, setEdges]);

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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: false,
      }}
      connectionLineType={ConnectionLineType.SmoothStep}
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      <Controls />
      <MiniMap
        nodeColor={(node) => {
          if (highlightedNodes.includes(node.id)) return '#EAB308';
          return node.data.color || '#6B7280';
        }}
        maskColor="rgba(0, 0, 0, 0.1)"
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
            <LegendItem color="#EAB308" label="Highlighted Path" />
          </div>
        </div>
      </Panel>
    </ReactFlow>
  );
};

const LegendItem: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
    <span>{label}</span>
  </div>
);

// Convert lineage nodes to React Flow nodes
function convertToFlowNodes(
  lineageNodes: LineageNode[],
  highlightedNodes: string[],
  selectedNodeIds: string[]
): FlowNode<FlowNodeData>[] {
  const schemaClasses = lineageNodes.filter(n => n.type === 'schema_class');
  const dataInstances = lineageNodes.filter(n => n.type === 'data_instance');
  
  const nodes: FlowNode<FlowNodeData>[] = [];
  
  // Schema classes
  schemaClasses.forEach((node, index) => {
    const isSelected = selectedNodeIds.includes(node.id);
    const isHighlighted = highlightedNodes.includes(node.id);
    
    nodes.push({
      id: node.id,
      type: 'schemaClass',
      position: node.position || { x: index * 350, y: 0 },
      data: {
        label: node.name,
        type: node.type,
        nodeType: node.type,
        schema_id: node.schema_id,
        class_id: node.class_id,
        parent_id: node.parent_id,
        collapsed: node.collapsed,
        instance_count: node.data.instance_count,
        attributes: node.data.attributes,
        data: node.data,
        color: node.data.color,
        icon: node.data.icon,
        isHighlighted,
        isSelected,
      },
      style: isSelected ? {
        border: '3px solid #2563EB',
        boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.2)',
      } : undefined,
    });
  });
  
  // Data instances
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
    
    instances.forEach((instance, index) => {
      const isSelected = selectedNodeIds.includes(instance.id);
      const isHighlighted = highlightedNodes.includes(instance.id);
      
      nodes.push({
        id: instance.id,
        type: 'dataInstance',
        position: instance.position || {
          x: parentX + (index % 3) * 200 - 200,
          y: 200 + Math.floor(index / 3) * 150,
        },
        data: {
          label: instance.name,
          type: instance.type,
          nodeType: instance.type,
          schema_id: instance.schema_id,
          class_id: instance.class_id,
          parent_id: instance.parent_id,
          collapsed: false,
          data: instance.data,
          color: '#3B82F6',
          isHighlighted,
          isSelected,
        },
        style: isSelected ? {
          border: '3px solid #2563EB',
          boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.2)',
        } : undefined,
      });
    });
  });
  
  return nodes;
}

// Convert lineage edges to React Flow edges
function convertToFlowEdges(
  lineageEdges: LineageEdge[],
  highlightedEdges: string[]
): Edge[] {
  return lineageEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: 'bottom',
    targetHandle: 'top',
    type: edge.type === 'parent_child' ? 'straight' : 'smoothstep',
    label: edge.label,
    animated: highlightedEdges.includes(edge.id),
    style: {
      stroke: highlightedEdges.includes(edge.id) ? '#EAB308' : '#9CA3AF',
      strokeWidth: highlightedEdges.includes(edge.id) ? 3 : 2,
    },
    labelStyle: {
      fill: '#374151',
      fontSize: 12,
      fontWeight: 600,
    },
  }));
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
      className={`px-6 py-4 rounded-lg border-2 bg-white shadow-lg transition-all min-w-[200px] ${
        data.isSelected
          ? 'border-blue-600 shadow-blue-200 ring-4 ring-blue-200'
          : data.isHighlighted
          ? 'border-yellow-500 shadow-yellow-200 ring-4 ring-yellow-200'
          : 'border-gray-300 hover:border-gray-400'
      }`}
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
          <div className="font-semibold text-black">{data.label}</div>
        </div>
        
        {hasInstances && (
          <button onClick={handleToggle} className="p-2 hover:bg-gray-100 rounded transition-colors" title={data.collapsed ? 'Expand to see data' : 'Collapse'}>
            {data.collapsed ? <ChevronRight size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
          </button>
        )}
      </div>

      {data.data?.description && <p className="text-xs text-gray-600 mb-2">{data.data.description}</p>}

      <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-200">
        <span className="flex items-center gap-1">
          {data.instance_count || 0} instances
          {hasInstances && data.collapsed && <span className="text-blue-600 font-medium">(click to expand)</span>}
        </span>
        {data.attributes && data.attributes.length > 0 && <span>{data.attributes.length} attrs</span>}
      </div>
    </div>
  );
};

// Data Instance Node Component
const DataInstanceNode: React.FC<{ data: FlowNodeData }> = ({ data }) => {
  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 bg-white shadow-md transition-all min-w-[150px] ${
        data.isSelected
          ? 'border-blue-600 shadow-blue-200 ring-4 ring-blue-200'
          : data.isHighlighted
          ? 'border-yellow-500 shadow-yellow-200 ring-4 ring-yellow-200'
          : 'border-blue-300 hover:border-blue-400'
      }`}
    >
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />

      <div className="flex items-center gap-2 mb-1">
        <Circle size={14} className="text-blue-600" />
        <div className="text-sm font-medium text-black">{data.label}</div>
      </div>

      {data.data && Object.keys(data.data).length > 0 && (
        <div className="text-xs text-gray-600 mt-2 space-y-1">
          {Object.entries(data.data).slice(0, 3).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="font-medium">{key}:</span>
              <span className="truncate">{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Wrap with ReactFlowProvider
export const EnhancedLineageGraphWithProvider: React.FC<EnhancedLineageGraphProps> = (props) => (
  <ReactFlowProvider>
    <EnhancedLineageGraph {...props} />
  </ReactFlowProvider>
);