import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Database, Globe, Tag, Loader2, Sparkles } from 'lucide-react';
import { NodeType } from '../types';

interface CustomNodeData {
  label: string;
  nodeType: NodeType;
  color: string;
  highlighted?: boolean;
  [key: string]: any;
}

interface LineageGraphProps {
  nodes: Node[];
  edges: Edge[];
  loading: boolean;
  onNodeClick?: (node: Node) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
}

const CustomNode: React.FC<{ data: CustomNodeData; selected: boolean }> = ({ data, selected }) => {
  const Icon = data.nodeType === 'Country' 
    ? Globe 
    : data.nodeType === 'Database' 
    ? Database 
    : Tag;

  const gradientClass = data.nodeType === 'Country'
    ? 'country'
    : data.nodeType === 'Database'
    ? 'database'
    : 'attribute';

  return (
    <div className={`node-card ${gradientClass} ${data.highlighted ? 'highlighted' : ''} ${selected ? 'ring-4 ring-white ring-opacity-50' : ''}`}>
      <div className="node-inner">
        <div className="flex items-start gap-3 mb-3">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${
            data.nodeType === 'Country' 
              ? 'from-indigo-500 to-purple-600' 
              : data.nodeType === 'Database'
              ? 'from-pink-500 to-rose-600'
              : 'from-cyan-500 to-blue-600'
          } shadow-lg`}>
            <Icon size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {data.nodeType}
            </div>
            <div className="text-base font-bold text-gray-900 truncate">
              {data.label}
            </div>
          </div>
        </div>
        
        <div className="space-y-2 text-xs text-gray-600">
          {data.nodeType === 'Country' && (
            <>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Region</span>
                <span className="font-semibold text-gray-900">{data.region}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  data.adequacyStatus === 'Adequate' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {data.adequacyStatus}
                </span>
              </div>
            </>
          )}
          {data.nodeType === 'Database' && (
            <>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Type</span>
                <span className="font-semibold text-gray-900">{data.type}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Class</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  data.classification === 'Restricted' 
                    ? 'bg-red-100 text-red-700'
                    : data.classification === 'Confidential'
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {data.classification}
                </span>
              </div>
            </>
          )}
          {data.nodeType === 'Attribute' && (
            <>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Type</span>
                <span className="font-semibold text-gray-900">{data.dataType}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-500">Category</span>
                <span className="font-semibold text-gray-900 truncate">{data.category}</span>
              </div>
              {data.isPII && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg">
                  <Sparkles size={12} />
                  <span className="text-xs font-semibold">PII Data</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const LineageGraph: React.FC<LineageGraphProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  loading,
  onNodeClick,
  onNodeContextMenu,
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

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      onNodeContextMenu?.(event, node);
    },
    [onNodeContextMenu]
  );

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden shadow-2xl">
      {loading && (
        <div className="absolute inset-0 glass flex items-center justify-center z-50 animate-fade-in">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0"></div>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">Loading Lineage</p>
              <p className="text-sm text-gray-600">Analyzing data flows...</p>
            </div>
          </div>
        </div>
      )}
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2.5 },
        }}
        style={{
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        }}
      >
        <defs>
          <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#667eea" />
            <stop offset="100%" stopColor="#764ba2" />
          </linearGradient>
        </defs>
        
        <Background color="#ddd" gap={20} size={1} />
        <Controls className="shadow-xl" />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as CustomNodeData;
            return data.nodeType === 'Country' 
              ? '#667eea' 
              : data.nodeType === 'Database'
              ? '#f093fb'
              : '#4facfe';
          }}
          maskColor="rgba(0, 0, 0, 0.05)"
          className="shadow-xl"
        />
        
        <Panel position="top-left" className="glass rounded-2xl shadow-xl">
          <div className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Node Types
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg"></div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Country</div>
                  <div className="text-xs text-gray-500">Jurisdictions</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg"></div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Database</div>
                  <div className="text-xs text-gray-500">Data Stores</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg"></div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Attribute</div>
                  <div className="text-xs text-gray-500">Data Fields</div>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel position="top-right" className="glass rounded-2xl shadow-xl">
          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-gray-900">
                Live Tracking
              </span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};