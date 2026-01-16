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

  React.useEffect(() => {
    console.log('=== GRAPH UPDATE ===');
    console.log('Highlighted Nodes:', highlightedNodes);
    console.log('Highlighted Edges:', highlightedEdges);
    console.log('Lineage Edges Available:', lineageEdges.map(e => e.id));
    
    const flowNodes = convertToFlowNodes(lineageNodes, highlightedNodes, selectedNodeIds);
    const flowEdges = convertToFlowEdges(lineageEdges, highlightedEdges);
    
    console.log('Flow Nodes with highlighting:', flowNodes.filter(n => n.data.isHighlighted).length);
    console.log('Flow Edges with highlighting:', flowEdges.filter(e => e.animated).length);
    console.log('Flow Edges IDs:', flowEdges.map(e => ({ id: e.id, animated: e.animated })));
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
          if (selectedNodeIds.includes(node.id)) return '#2563EB';
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
            {selectionMode && <LegendItem color="#2563EB" label="Selected" />}
            {highlightedNodes.length > 0 && <LegendItem color="#EAB308" label="Highlighted Path" />}
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
  console.log('Converting edges:', {
    totalEdges: lineageEdges.length,
    highlightedEdges: highlightedEdges.length,
    edgeIds: lineageEdges.map(e => e.id),
    highlightIds: highlightedEdges
  });

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
        strokeWidth: isHighlighted ? 4 : 2,
      },
      labelStyle: {
        fill: '#374151',
        fontSize: 12,
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: 'white',
        fillOpacity: 0.9,
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
          <button 
            onClick={handleToggle} 
            className="p-2 hover:bg-gray-100 rounded transition-colors" 
            title={data.collapsed ? 'Expand to see data' : 'Collapse'}
          >
            {data.collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {data.attributes && data.attributes.length > 0 && (
        <div className="text-xs text-gray-600 space-y-1">
          {data.attributes.slice(0, 3).map((attr, i) => (
            <div key={i}>{attr}</div>
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
    >
      <Handle type="target" position={Position.Top} id="top" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: '#3B82F6', width: 12, height: 12, border: '2px solid white' }} />

      <div className="flex items-center gap-2 mb-2">
        <Circle size={14} className="text-blue-500" fill="currentColor" />
        <div className="font-medium text-sm text-black">{data.label}</div>
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