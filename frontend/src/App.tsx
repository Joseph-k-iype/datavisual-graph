// frontend/src/App.tsx - WITH GROUP SELECTION
import React, { useState, useEffect, useCallback } from 'react';
import { Node as FlowNode } from 'reactflow';
import { LineageGraph } from './components/LineageGraph';
import { NodeEditor } from './components/NodeEditor';
import { GroupDialog } from './components/GroupDialog';
import { useLineageData } from './hooks/useLineageData';
import { useGraphLayout } from './hooks/useGraphLayout';
import { Search, GitBranch, Circle, Grid, Plus, RefreshCw, Users } from 'lucide-react';

function App() {
  const {
    nodes,
    edges,
    loading,
    error,
    loadFullLineage,
    createNode,
    updateNode,
    deleteNode,
  } = useLineageData();

  const {
    layoutType,
    applyLayout,
    setLayoutType,
    fitView,
  } = useGraphLayout();

  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Group selection state
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    loadFullLineage();
  }, [loadFullLineage]);

  // Auto fit view when nodes load
  useEffect(() => {
    if (nodes.length > 0 && !loading) {
      setTimeout(() => fitView(), 150);
    }
  }, [nodes, loading, fitView]);

  const handleNodeClick = useCallback((node: FlowNode) => {
    if (selectionMode) {
      // In selection mode, toggle node selection
      setSelectedNodeIds(prev => {
        if (prev.includes(node.id)) {
          return prev.filter(id => id !== node.id);
        } else {
          return [...prev, node.id];
        }
      });
    } else {
      // Normal mode, open editor
      setSelectedNode(node);
    }
  }, [selectionMode]);

  const handleLayoutChange = async (type: 'hierarchical' | 'circular' | 'grid') => {
    setLayoutType(type);
    const layoutedResult = await applyLayout(nodes, edges, {
      type,
      direction: 'DOWN',
      spacing: 150,
      layerSpacing: 200,
    });
    setTimeout(() => fitView(), 100);
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      // Entering selection mode - clear previous selections
      setSelectedNodeIds([]);
    }
  };

  const handleOpenGroupDialog = () => {
    if (selectedNodeIds.length === 0) {
      alert('Please select at least one node first');
      return;
    }
    setShowGroupDialog(true);
  };

  const handleGroupSuccess = () => {
    // Reload data to show updated groups
    loadFullLineage();
    setSelectedNodeIds([]);
    setSelectionMode(false);
  };

  const handleClearSelection = () => {
    setSelectedNodeIds([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 shadow-sm z-10">
        <div className="px-6 py-4">
          {/* Top Row: Logo + Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-red-600 flex items-center justify-center shadow-md">
                <span className="text-white font-bold text-sm">DL</span>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Data Lineage Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  {nodes.length} nodes • {edges.length} connections
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Selection Mode Toggle */}
              <button
                onClick={handleToggleSelectionMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  selectionMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Users size={18} />
                {selectionMode ? 'Exit Selection' : 'Select Nodes'}
              </button>

              {/* Group Button - Only show when nodes are selected */}
              {selectedNodeIds.length > 0 && (
                <>
                  <button
                    onClick={handleClearSelection}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm"
                  >
                    Clear ({selectedNodeIds.length})
                  </button>
                  <button
                    onClick={handleOpenGroupDialog}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                  >
                    <Users size={18} />
                    Group Nodes
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setSelectedNode(null);
                  setEditorMode('create');
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
              >
                <Plus size={18} />
                Add Node
              </button>
              <button
                onClick={loadFullLineage}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Bottom Row: Search + Layout Controls */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search nodes by name, type, or properties..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-2 px-1 py-1 bg-gray-100 rounded-lg">
              <LayoutButton
                icon={GitBranch}
                label="Hierarchical"
                active={layoutType === 'hierarchical'}
                onClick={() => handleLayoutChange('hierarchical')}
              />
              <LayoutButton
                icon={Circle}
                label="Circular"
                active={layoutType === 'circular'}
                onClick={() => handleLayoutChange('circular')}
              />
              <LayoutButton
                icon={Grid}
                label="Grid"
                active={layoutType === 'grid'}
                onClick={() => handleLayoutChange('grid')}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative">
        {loading && nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading lineage data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-2xl">⚠</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Data</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={loadFullLineage}
                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <LineageGraph
            nodes={nodes}
            edges={edges}
            onNodeClick={handleNodeClick}
            searchQuery={searchQuery}
            selectedNodeIds={selectionMode ? selectedNodeIds : []}
          />
        )}
      </main>

      {/* Node Editor Modal */}
      {editorMode && (
        <NodeEditor
          node={selectedNode}
          mode={editorMode}
          onClose={() => {
            setEditorMode(null);
            setSelectedNode(null);
          }}
          onUpdate={updateNode}
          onDelete={deleteNode}
          onCreate={createNode}
        />
      )}

      {/* Group Dialog */}
      {showGroupDialog && (
        <GroupDialog
          selectedNodeIds={selectedNodeIds}
          onClose={() => setShowGroupDialog(false)}
          onSuccess={handleGroupSuccess}
        />
      )}
    </div>
  );
}

interface LayoutButtonProps {
  icon: React.FC<any>;
  label: string;
  active: boolean;
  onClick: () => void;
}

const LayoutButton: React.FC<LayoutButtonProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
      active
        ? 'bg-white text-red-600 shadow-sm'
        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
    }`}
    title={label}
  >
    <Icon size={16} />
    <span className="hidden md:inline">{label}</span>
  </button>
);

export default App;