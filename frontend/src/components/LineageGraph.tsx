// frontend/src/components/LineageGraph.tsx - FIXED VERSION
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  NodeMouseHandler,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Search, Info } from 'lucide-react';
import CustomNode from './CustomNode';

const nodeTypes = {
  custom: CustomNode,
};

interface LineageGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (node: Node) => void;
  searchQuery?: string;
  selectedNodeIds?: string[];
}

export const LineageGraph: React.FC<LineageGraphProps> = ({
  nodes: initialNodes,
  edges: initialEdges,
  onNodeClick,
  searchQuery = '',
  selectedNodeIds = [],
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when props change
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when props change
  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation();
      onNodeClick?.(node);
    },
    [onNodeClick]
  );

  // Enhance nodes with selection state and search highlighting
  const enhancedNodes = useMemo(() => {
    return nodes.map((node) => {
      const isSelected = selectedNodeIds.includes(node.id);
      const isHighlighted = searchQuery
        ? matchesSearch(node, searchQuery)
        : false;

      return {
        ...node,
        data: {
          ...node.data,
          isSelected,
          isHighlighted,
        },
        style: {
          ...node.style,
          // Add selection border
          ...(isSelected && {
            border: '3px solid #2563eb',
            boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.2)',
            zIndex: 1000,
          }),
          // Dim non-matching nodes during search
          ...(searchQuery && !isHighlighted && {
            opacity: 0.3,
          }),
          // Highlight matching nodes during search
          ...(searchQuery && isHighlighted && {
            boxShadow: '0 0 0 3px rgba(234, 179, 8, 0.5)',
            zIndex: 999,
          }),
        },
      };
    });
  }, [nodes, selectedNodeIds, searchQuery]);

  // Filter edges based on search
  const enhancedEdges = useMemo(() => {
    if (!searchQuery) return edges;

    const visibleNodeIds = new Set(
      enhancedNodes
        .filter((n) => n.data.isHighlighted)
        .map((n) => n.id)
    );

    return edges.map((edge) => {
      const isVisible =
        visibleNodeIds.has(edge.source) || visibleNodeIds.has(edge.target);

      return {
        ...edge,
        style: {
          ...edge.style,
          opacity: isVisible ? 1 : 0.2,
        },
        animated: isVisible,
      };
    });
  }, [edges, enhancedNodes, searchQuery]);

  // Count stats
  const stats = useMemo(() => {
    const totalNodes = enhancedNodes.length;
    const selectedCount = selectedNodeIds.length;
    const highlightedCount = searchQuery
      ? enhancedNodes.filter((n) => n.data.isHighlighted).length
      : totalNodes;

    return { totalNodes, selectedCount, highlightedCount };
  }, [enhancedNodes, selectedNodeIds, searchQuery]);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={enhancedNodes}
        edges={enhancedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{
          padding: 0.2,
          maxZoom: 1.5,
          minZoom: 0.5,
        }}
        minZoom={0.1}
        maxZoom={4}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Background Grid */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#e5e7eb"
        />

        {/* Controls */}
        <Controls
          showInteractive={false}
          className="bg-white border border-gray-300 rounded-lg shadow-md"
        />

        {/* MiniMap */}
        <MiniMap
          nodeColor={(node) => {
            if (selectedNodeIds.includes(node.id)) {
              return '#2563eb'; // Blue for selected
            }
            if (searchQuery && node.data.isHighlighted) {
              return '#eab308'; // Yellow for highlighted
            }
            return node.data.color || '#9CA3AF';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="bg-white border border-gray-300 rounded-lg shadow-md"
        />

        {/* Stats Panel */}
        <Panel position="top-left" className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-900">Graph Stats</span>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Total Nodes:</span>
                <span className="font-medium text-gray-900">{stats.totalNodes}</span>
              </div>
              {searchQuery && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Matching:</span>
                  <span className="font-medium text-yellow-600">{stats.highlightedCount}</span>
                </div>
              )}
              {stats.selectedCount > 0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-gray-600">Selected:</span>
                  <span className="font-medium text-blue-600">{stats.selectedCount}</span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-gray-600">Connections:</span>
                <span className="font-medium text-gray-900">{edges.length}</span>
              </div>
            </div>
          </div>
        </Panel>

        {/* Legend Panel */}
        <Panel position="top-right" className="bg-white border border-gray-200 rounded-lg shadow-md p-4">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-gray-900 mb-2">Node Types</div>
            <div className="space-y-1.5">
              <LegendItem color="#DC2626" label="Country" />
              <LegendItem color="#4B5563" label="Database" />
              <LegendItem color="#6B7280" label="Attribute" />
            </div>
          </div>
        </Panel>
      </ReactFlow>

      {/* Selection Info Banner */}
      {selectedNodeIds.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="font-medium">
              {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      )}

      {/* Search Results Banner */}
      {searchQuery && stats.highlightedCount === 0 && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <Search size={18} />
            <span className="font-medium">No nodes match "{searchQuery}"</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {enhancedNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-gray-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Nodes Found</h3>
            <p className="text-gray-600">
              Add your first node to start building your data lineage graph
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to check if node matches search
const matchesSearch = (node: Node, query: string): boolean => {
  const searchLower = query.toLowerCase();
  const data = node.data;

  return (
    data.name?.toLowerCase().includes(searchLower) ||
    data.nodeType?.toLowerCase().includes(searchLower) ||
    node.id.toLowerCase().includes(searchLower) ||
    data.code?.toLowerCase().includes(searchLower) ||
    data.region?.toLowerCase().includes(searchLower) ||
    data.type?.toLowerCase().includes(searchLower) ||
    data.category?.toLowerCase().includes(searchLower) ||
    data.group?.toLowerCase().includes(searchLower) ||
    data.owner?.toLowerCase().includes(searchLower) ||
    data.classification?.toLowerCase().includes(searchLower) ||
    data.sensitivity?.toLowerCase().includes(searchLower) ||
    data.dataType?.toLowerCase().includes(searchLower)
  );
};

// Legend item component
interface LegendItemProps {
  color: string;
  label: string;
}

const LegendItem: React.FC<LegendItemProps> = ({ color, label }) => (
  <div className="flex items-center gap-2">
    <div
      className="w-3 h-3 rounded-sm"
      style={{ backgroundColor: color }}
    />
    <span className="text-xs text-gray-700">{label}</span>
  </div>
);