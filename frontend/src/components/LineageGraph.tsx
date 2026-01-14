// frontend/src/components/LineageGraph.tsx - FIXED WITH HANDLES
import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  ConnectionLineType,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Globe, Database, Tag, Shield } from 'lucide-react';

interface NodeData {
  label: string;
  nodeType: string;
  [key: string]: any;
}

interface LineageGraphProps {
  nodes: Node[];
  edges: Edge[];
  loading: boolean;
  onNodeClick?: (node: Node) => void;
}

// FIXED: Custom Node with proper source/target handles
const CustomNode: React.FC<{ data: NodeData }> = ({ data }) => {
  const getIcon = () => {
    switch (data.nodeType) {
      case 'Country':
        return <Globe size={18} className="text-red-600" />;
      case 'Database':
        return <Database size={18} className="text-gray-700" />;
      case 'Attribute':
        return <Tag size={18} className="text-gray-600" />;
      default:
        return <Shield size={18} className="text-gray-500" />;
    }
  };

  return (
    <div className={`node-card ${data.nodeType.toLowerCase()} ${data.highlighted ? 'highlighted' : ''}`}>
      {/* CRITICAL FIX: Add handles for edges to connect */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: '#7A7A7A',
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />
      
      <div className="node-inner">
        {/* Type with icon */}
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
          {getIcon()}
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {data.nodeType}
          </div>
        </div>
        
        {/* Node name */}
        <div className="font-semibold text-base text-gray-900 mb-3">
          {data.label}
        </div>
        
        {/* Details */}
        <div className="text-xs text-gray-600 space-y-2">
          {data.nodeType === 'Country' && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Region</span>
                <span className="font-medium text-gray-900">{data.region}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  data.adequacyStatus === 'Adequate' 
                    ? 'bg-green-50 text-green-700 border border-green-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {data.adequacyStatus}
                </span>
              </div>
            </>
          )}
          {data.nodeType === 'Database' && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{data.type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Classification</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  data.classification === 'Restricted' 
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : data.classification === 'Confidential'
                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {data.classification}
                </span>
              </div>
            </>
          )}
          {data.nodeType === 'Attribute' && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Type</span>
                <span className="font-medium text-gray-900">{data.dataType}</span>
              </div>
              {data.isPII && (
                <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-semibold mt-2">
                  <Shield size={12} />
                  PII
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* CRITICAL FIX: Add source handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: '#7A7A7A',
          width: 10,
          height: 10,
          border: '2px solid white',
        }}
      />
    </div>
  );
};

export const LineageGraph: React.FC<LineageGraphProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  loading,
  onNodeClick,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const nodeTypes = useMemo(
    () => ({
      custom: CustomNode,
    }),
    []
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  // FIXED: Proper edge configuration with visible styling
  const defaultEdgeOptions = {
    type: 'smoothstep',
    animated: true,
    style: {
      strokeWidth: 2.5,
      stroke: '#6B7280', // Visible gray-500
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 22,
      height: 22,
      color: '#6B7280',
    },
  };

  const proOptions = { hideAttribution: true };

  return (
    <div className="w-full h-full bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{
          padding: 0.15,
          includeHiddenNodes: false,
          minZoom: 0.2,
          maxZoom: 1.5,
        }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={proOptions}
      >
        <Background 
          color="#D1D5DB" 
          gap={20} 
          size={1}
        />
        
        <Controls 
          className="!bg-white !border !border-gray-300 !shadow-lg !rounded-lg"
        />
        
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as NodeData;
            return data.nodeType === 'Country'
              ? '#DC2626'
              : data.nodeType === 'Database'
              ? '#4B5563'
              : '#6B7280';
          }}
          maskColor="rgba(0, 0, 0, 0.05)"
          className="!bg-white !border !border-gray-300 !shadow-lg !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
};