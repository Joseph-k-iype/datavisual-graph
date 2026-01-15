// frontend/src/App.tsx - COMPLETE ENHANCED VERSION

import React, { useState, useEffect, useCallback } from 'react';
import { Node as FlowNode } from 'reactflow';
import { LandingPage } from './components/LandingPage';
import { SchemaBuilder } from './components/SchemaBuilder';
import { DataLoader } from './components/DataLoader';
import { EnhancedLineageGraphWithProvider } from './components/EnhancedLineageGraph';
import {
  Database,
  Upload,
  Eye,
  ArrowLeft,
  Loader,
  AlertCircle,
  Search,
  Zap,
} from 'lucide-react';
import {
  SchemaDefinition,
  LineageGraphResponse,
  LineagePathResponse,
  SchemaStats,
} from './types';
import apiService from './services/api';

type AppView = 'landing' | 'schema-builder' | 'data-loader' | 'visualization';

function App() {
  const [view, setView] = useState<AppView>('landing');
  const [currentSchema, setCurrentSchema] = useState<SchemaDefinition | null>(null);
  const [lineageGraph, setLineageGraph] = useState<LineageGraphResponse | null>(null);
  const [schemaStats, setSchemaStats] = useState<SchemaStats | null>(null);
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null);
  const [highlightedPath, setHighlightedPath] = useState<LineagePathResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection mode for shortest path
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Load schema and visualization
  const loadSchema = useCallback(async (schemaId: string) => {
    try {
      setLoading(true);
      setError(null);

      const [schema, stats] = await Promise.all([
        apiService.getSchema(schemaId),
        apiService.getSchemaStats(schemaId),
      ]);

      setCurrentSchema(schema);
      setSchemaStats(stats);
      
      // Load initial lineage graph (collapsed)
      await loadLineageGraph(schemaId, []);
      
      setView('visualization');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLineageGraph = useCallback(
    async (schemaId: string, expanded: string[]) => {
      try {
        const graph = await apiService.getLineageGraph(schemaId, expanded);
        setLineageGraph(graph);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lineage');
      }
    },
    []
  );

  // Handle node click
  const handleNodeClick = useCallback(
    async (node: FlowNode) => {
      // Selection mode - toggle node selection
      if (selectionMode) {
        setSelectedNodeIds(prev => {
          if (prev.includes(node.id)) {
            return prev.filter(id => id !== node.id);
          } else {
            return [...prev, node.id];
          }
        });
        return;
      }

      // Normal mode - select and trace lineage
      setSelectedNode(node);

      // If it's a schema class, don't trace lineage - that's done by expand/collapse
      if (node.data.type === 'schema_class') {
        // Schema classes are expanded/collapsed via the chevron button
        // Just select the node to show details
        return;
      }

      // Only trace lineage for data instances
      if (node.data.type === 'data_instance' && currentSchema) {
        try {
          const path = await apiService.getLineagePath(currentSchema.id, {
            start_node_id: node.id,
            max_depth: 10,
          });
          setHighlightedPath(path);
        } catch (err) {
          console.error('Failed to get lineage path:', err);
          // Don't show error to user, just log it
        }
      }
    },
    [currentSchema, selectionMode]
  );

  // Handle expand/collapse
  const handleToggleExpand = useCallback(
    async (classId: string) => {
      if (!currentSchema) return;

      const newExpanded = new Set(expandedClasses);
      if (newExpanded.has(classId)) {
        newExpanded.delete(classId);
      } else {
        newExpanded.add(classId);
      }

      setExpandedClasses(newExpanded);
      await loadLineageGraph(currentSchema.id, Array.from(newExpanded));
    },
    [currentSchema, expandedClasses, loadLineageGraph]
  );

  // Toggle selection mode
  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode(!selectionMode);
    if (!selectionMode) {
      // Entering selection mode
      setSelectedNodeIds([]);
      setHighlightedPath(null);
    }
  }, [selectionMode]);

  // Find shortest path between selected nodes
  const handleFindShortestPath = useCallback(async () => {
    if (!currentSchema || selectedNodeIds.length < 2) {
      alert('Please select at least 2 nodes');
      return;
    }

    try {
      setLoading(true);
      const path = await apiService.getShortestPath(currentSchema.id, selectedNodeIds);
      setHighlightedPath(path);
      setSelectionMode(false);
      setSelectedNodeIds([]);
    } catch (err) {
      console.error('Failed to find shortest path:', err);
      alert('Failed to find path between selected nodes');
    } finally {
      setLoading(false);
    }
  }, [currentSchema, selectedNodeIds]);

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds([]);
    setHighlightedPath(null);
  }, []);

  // Handle schema creation
  const handleSchemaCreated = useCallback((schemaId: string) => {
    loadSchema(schemaId);
  }, [loadSchema]);

  // Handle data loaded
  const handleDataLoaded = useCallback(() => {
    if (currentSchema) {
      // Reload lineage with current expanded state
      loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
      
      // Reload stats
      apiService.getSchemaStats(currentSchema.id).then(setSchemaStats);
    }
  }, [currentSchema, expandedClasses, loadLineageGraph]);

  // Clear highlights when search changes
  useEffect(() => {
    if (!searchQuery) {
      setHighlightedPath(null);
    }
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50">
      {view === 'landing' && (
        <LandingPage
          onCreateSchema={() => setView('schema-builder')}
          onOpenSchema={loadSchema}
        />
      )}

      {view === 'schema-builder' && (
        <SchemaBuilder
          onComplete={handleSchemaCreated}
          onCancel={() => setView('landing')}
        />
      )}

      {view === 'data-loader' && currentSchema && (
        <DataLoader
          schema={currentSchema}
          onComplete={handleDataLoaded}
          onCancel={() => setView('visualization')}
        />
      )}

      {view === 'visualization' && currentSchema && lineageGraph && (
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => {
                  setView('landing');
                  setCurrentSchema(null);
                  setLineageGraph(null);
                  setExpandedClasses(new Set());
                  setHighlightedPath(null);
                }}
                className="btn-secondary mb-4 w-full"
              >
                <ArrowLeft size={20} />
                Back to Schemas
              </button>
              
              <h2 className="text-lg font-semibold text-black mb-1">
                {currentSchema.name}
              </h2>
              {currentSchema.description && (
                <p className="text-sm text-gray-600">{currentSchema.description}</p>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 space-y-3 border-b border-gray-200">
              <button
                onClick={() => setView('data-loader')}
                className="btn-primary w-full"
              >
                <Upload size={20} />
                Load Data
              </button>
              
              <button
                onClick={() => {
                  if (currentSchema) {
                    loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
                  }
                }}
                className="btn-secondary w-full"
              >
                <Eye size={20} />
                Refresh View
              </button>
            </div>

            {/* Shortest Path Tools */}
            <div className="p-6 space-y-3 border-b border-gray-200">
              <h3 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                Path Finding
              </h3>
              
              {!selectionMode ? (
                <button
                  onClick={handleToggleSelectionMode}
                  className="btn-secondary w-full"
                >
                  <Zap size={20} />
                  Find Shortest Path
                </button>
              ) : (
                <>
                  <div className="text-sm text-gray-600 mb-2">
                    Select {selectedNodeIds.length >= 2 ? '2+' : '2 or more'} nodes
                    {selectedNodeIds.length > 0 && (
                      <span className="text-black font-medium ml-1">
                        ({selectedNodeIds.length} selected)
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={handleFindShortestPath}
                    disabled={selectedNodeIds.length < 2}
                    className="btn-primary w-full"
                  >
                    <Zap size={20} />
                    Calculate Path
                  </button>
                  
                  <button
                    onClick={handleToggleSelectionMode}
                    className="btn-secondary w-full"
                  >
                    Cancel Selection
                  </button>
                  
                  {selectedNodeIds.length > 0 && (
                    <button
                      onClick={handleClearSelection}
                      className="btn-secondary w-full text-red-600 hover:text-red-700"
                    >
                      Clear Selection
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Search */}
            <div className="p-6 border-b border-gray-200">
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                Search
              </label>
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Stats */}
            {schemaStats && (
              <div className="p-6 flex-1 overflow-y-auto">
                <h3 className="text-sm font-semibold text-black mb-4 uppercase tracking-wide">
                  Statistics
                </h3>
                
                <div className="space-y-4">
                  <StatCard
                    icon={<Database size={18} />}
                    label="Classes"
                    value={schemaStats.total_classes}
                  />
                  <StatCard
                    icon={<Zap size={18} />}
                    label="Relationships"
                    value={schemaStats.total_relationships}
                  />
                  <StatCard
                    icon={<Database size={18} />}
                    label="Data Instances"
                    value={schemaStats.total_instances}
                  />
                  <StatCard
                    icon={<Zap size={18} />}
                    label="Data Links"
                    value={schemaStats.total_data_relationships}
                  />
                </div>

                {Object.keys(schemaStats.instances_by_class).length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-xs font-medium text-gray-600 mb-3 uppercase tracking-wide">
                      Instances by Class
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(schemaStats.instances_by_class).map(
                        ([className, count]) => (
                          <div
                            key={className}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-gray-900">{className}</span>
                            <span className="font-medium text-gray-600">{count}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <Loader className="w-16 h-16 text-black animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Loading visualization...</p>
                </div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                <div className="text-center max-w-md">
                  <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-black mb-2">Error</h3>
                  <p className="text-gray-600 mb-4">{error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      if (currentSchema) {
                        loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
                      }
                    }}
                    className="btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <EnhancedLineageGraphWithProvider
                nodes={lineageGraph.nodes}
                edges={lineageGraph.edges}
                highlightedNodes={highlightedPath?.highlighted_nodes || []}
                highlightedEdges={highlightedPath?.highlighted_edges || []}
                selectedNodeIds={selectedNodeIds}
                selectionMode={selectionMode}
                onNodeClick={handleNodeClick}
                onToggleExpand={handleToggleExpand}
              />
            )}

            {/* Selection Mode Banner */}
            {selectionMode && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="font-medium">
                    Selection Mode: Click nodes to select ({selectedNodeIds.length} selected)
                  </span>
                </div>
              </div>
            )}

            {/* Selected Node Details */}
            {selectedNode && (
              <div className="absolute bottom-6 right-6 bg-white border border-gray-200 rounded-lg shadow-xl p-6 max-w-md z-10">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-black">
                      {selectedNode.data.label}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">
                      {selectedNode.data.type === 'schema_class' ? 'Schema Class' : 'Data Instance'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedNode(null);
                      setHighlightedPath(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                {selectedNode.data.data && (
                  <div className="space-y-2">
                    {Object.entries(selectedNode.data.data).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <span className="font-medium text-gray-900">{key}: </span>
                        <span className="text-gray-600">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {highlightedPath && highlightedPath.paths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-600 mb-2">
                      LINEAGE PATHS: {highlightedPath.paths.length}
                    </div>
                    <div className="text-xs text-gray-600">
                      {highlightedPath.highlighted_nodes.length} nodes highlighted
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => {
  return (
    <div className="card rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="text-gray-600">{icon}</div>
        <div>
          <div className="text-2xl font-semibold text-black">{value}</div>
          <div className="text-xs text-gray-600">{label}</div>
        </div>
      </div>
    </div>
  );
};

export default App;