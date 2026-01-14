// frontend/src/App.tsx - FIXED & WORKING
import React, { useState, useEffect, useCallback } from 'react';
import { Node as FlowNode } from 'reactflow';
import { LineageGraph } from './components/LineageGraph';
import { NodeEditor } from './components/NodeEditor';
import { useLineageData } from './hooks/useLineageData';
import { useGraphLayout } from './hooks/useGraphLayout';
import { Search, GitBranch, Circle, Grid, Plus, RefreshCw } from 'lucide-react';

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
    setSelectedNode(node);
  }, []);

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

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* FIXED: Top Navigation - No overlap */}
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
                  Real-time Cross-border Transfer Tracking
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Quick Actions */}
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setEditorMode('create');
                }}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              >
                <Plus size={16} />
                Create Node
              </button>
              
              <button
                onClick={loadFullLineage}
                className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
              >
                <RefreshCw size={16} />
                Refresh
              </button>

              {/* Layout Controls */}
              <div className="flex items-center gap-1 border-2 border-gray-300 rounded-lg p-1 bg-white">
                <button
                  onClick={() => handleLayoutChange('hierarchical')}
                  className={`p-2 rounded transition-all ${
                    layoutType === 'hierarchical'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Hierarchical"
                >
                  <GitBranch size={16} />
                </button>
                <button
                  onClick={() => handleLayoutChange('circular')}
                  className={`p-2 rounded transition-all ${
                    layoutType === 'circular'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Circular"
                >
                  <Circle size={16} />
                </button>
                <button
                  onClick={() => handleLayoutChange('grid')}
                  className={`p-2 rounded transition-all ${
                    layoutType === 'grid'
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Grid"
                >
                  <Grid size={16} />
                </button>
              </div>

              {/* Live Indicator */}
              <div className="status-live">
                Live
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search nodes by name, ID, region, type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input pl-10 w-full"
            />
          </div>
        </div>
      </header>

      {/* Main Content - Full Width, No Sidebar */}
      <main className="flex-1 relative overflow-hidden">
        {/* Loading Indicator */}
        {loading && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20 card rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-gray-900">Loading...</span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-20 bg-white border-2 border-red-600 rounded-lg p-4 max-w-md shadow-lg">
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Graph - FIXED: Now with proper handles */}
        <LineageGraph
          nodes={nodes}
          edges={edges}
          loading={loading}
          onNodeClick={handleNodeClick}
        />
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
    </div>
  );
}

export default App;