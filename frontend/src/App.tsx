import { useState } from 'react';
import { Node as FlowNode } from 'reactflow';  // ← Renamed to avoid DOM Node conflict
import { LineageGraph } from './components/LineageGraph';
import { NodeEditor } from './components/NodeEditor';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { ContextMenu } from './components/ContextMenu';
import { useLineageData } from './hooks/useLineageData';
import { useGraphLayout } from './hooks/useGraphLayout';
import { AlertCircle, X, Activity, Network, LayoutGrid, Circle, Share2, GitBranch } from 'lucide-react';
import { getConnectedNodes } from './utils/graphUtils';

type EditorMode = 'edit' | 'create' | null;

function App() {
  const {
    nodes,
    edges,
    stats,
    loading,
    error,
    loadFullLineage,
    createNode,
    updateNode,
    deleteNode,
    selectedNode,
    setSelectedNode,
    highlightPathNodes,
    clearAllHighlights,
  } = useLineageData();

  const {
    layoutType,
    setLayoutType,
    applyLayout,
    fitView,
    centerNode,
    isLayouting,
  } = useGraphLayout();

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [showError, setShowError] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    node: FlowNode | null;  // ← Updated type
    position: { x: number; y: number };
  }>({ node: null, position: { x: 0, y: 0 } });

  const handleNodeClick = (node: FlowNode) => {  // ← Updated type
    setSelectedNode(node);
    setEditorMode('edit');
  };

  const handleCreateNode = () => {
    setSelectedNode(null);
    setEditorMode('create');
  };

  const handleCloseEditor = () => {
    setEditorMode(null);
    setSelectedNode(null);
  };

  const handleRefresh = () => {
    loadFullLineage();
  };

  const handleNodeContextMenu = (event: React.MouseEvent, node: FlowNode) => {  // ← Updated type
    event.preventDefault();
    setContextMenu({
      node,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const handleViewLineage = (node: FlowNode) => {  // ← Updated type
    const connected = getConnectedNodes(node.id, edges, 'both');
    highlightPathNodes([node.id, ...connected]);
    setContextMenu({ node: null, position: { x: 0, y: 0 } });
  };

  const handleCopyId = (node: FlowNode) => {  // ← Updated type
    navigator.clipboard.writeText(node.id);
    // Optional: Show toast notification
  };

  const handleNodeSelect = (node: FlowNode) => {  // ← Updated type
    setSelectedNode(node);
    centerNode(node.id);
  };

  const handleLayoutChange = async (type: 'hierarchical' | 'circular' | 'grid' | 'force') => {
    setLayoutType(type);
    await applyLayout(nodes, edges, {
      type,
      direction: 'DOWN',
      spacing: 120,
      layerSpacing: 180,
    });
    // Note: The layout is applied through the useGraphLayout hook
    // which will update the nodes automatically
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 animate-gradient">
      {/* Apple-style Header with Search */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="glass-ultra-light m-6 rounded-3xl shadow-2xl pointer-events-auto">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl"
                  style={{
                    boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.3)'
                  }}
                >
                  <Network size={32} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 tracking-tight">Data Lineage Dashboard</h1>
                  <p className="text-sm text-gray-600 flex items-center gap-2 font-medium">
                    <Activity size={14} className="text-green-500" />
                    <span>Real-time Cross-border Transfer Tracking</span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Layout Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLayoutChange('hierarchical')}
                    className={`p-2 rounded-lg transition-colors ${
                      layoutType === 'hierarchical'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Hierarchical Layout"
                  >
                    <GitBranch size={18} />
                  </button>
                  <button
                    onClick={() => handleLayoutChange('circular')}
                    className={`p-2 rounded-lg transition-colors ${
                      layoutType === 'circular'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Circular Layout"
                  >
                    <Circle size={18} />
                  </button>
                  <button
                    onClick={() => handleLayoutChange('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      layoutType === 'grid'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                    title="Grid Layout"
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    onClick={fitView}
                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Fit View"
                  >
                    <Share2 size={18} />
                  </button>
                </div>

                <div className="px-4 py-2 glass rounded-xl shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg" 
                      style={{
                        boxShadow: '0 0 8px rgba(74, 222, 128, 0.8)'
                      }}
                    ></div>
                    <span className="text-sm font-semibold text-gray-900">Live</span>
                  </div>
                </div>
                
                {stats && (
                  <div className="flex items-center gap-2 px-4 py-2 glass rounded-xl shadow-lg">
                    <span className="text-xs text-gray-600 font-medium">Total Nodes:</span>
                    <span className="text-lg font-bold text-gray-900 tracking-tight">
                      {stats.totalCountries + stats.totalDatabases + stats.totalAttributes}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Search Bar */}
            <SearchBar
              nodes={nodes}
              onNodeSelect={handleNodeSelect}
              onNodesHighlight={highlightPathNodes}
              onClearHighlight={clearAllHighlights}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 pt-48 px-6 pb-6 gap-6">
        {/* Sidebar */}
        <Sidebar
          stats={stats}
          onRefresh={handleRefresh}
          onCreateNode={handleCreateNode}
        />

        {/* Graph Area */}
        <div className="flex-1 flex flex-col gap-4">
          {/* Error Banner */}
          {error && showError && (
            <div className="glass border-l-4 border-red-500 rounded-2xl p-4 shadow-xl animate-slide-in-right">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500 bg-opacity-20 flex items-center justify-center">
                  <AlertCircle className="text-red-600" size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900">Error</p>
                  <p className="text-sm text-gray-700">{error}</p>
                </div>
                <button
                  onClick={() => setShowError(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {isLayouting && (
            <div className="glass rounded-2xl p-3 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-gray-700">Calculating layout...</span>
              </div>
            </div>
          )}

          {/* Graph Container */}
          <div className="flex-1">
            <LineageGraph
              nodes={nodes}
              edges={edges}
              loading={loading}
              onNodeClick={handleNodeClick}
              onNodeContextMenu={handleNodeContextMenu}
            />
          </div>
        </div>
      </div>

      {/* Node Editor Modal */}
      {editorMode && (
        <NodeEditor
          node={selectedNode}
          mode={editorMode}
          onClose={handleCloseEditor}
          onUpdate={updateNode}
          onDelete={deleteNode}
          onCreate={createNode}
        />
      )}

      {/* Context Menu */}
      {contextMenu.node && (
        <ContextMenu
          node={contextMenu.node}
          position={contextMenu.position}
          onClose={() => setContextMenu({ node: null, position: { x: 0, y: 0 } })}
          onEdit={(node) => {
            setSelectedNode(node);
            setEditorMode('edit');
          }}
          onDelete={(node) => deleteNode(node.id, node.data.nodeType)}
          onViewLineage={handleViewLineage}
          onCopyId={handleCopyId}
          onViewDetails={(node) => {
            setSelectedNode(node);
            // Show details panel or modal
          }}
        />
      )}
    </div>
  );
}

export default App;