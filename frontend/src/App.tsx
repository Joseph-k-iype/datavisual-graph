// frontend/src/App.tsx - COMPLETE FIXED VERSION

import React, { useState, useEffect, useCallback } from 'react';
import { Node as FlowNode } from 'reactflow';
import { LandingPage } from './components/LandingPage';
import { SchemaBuilder } from './components/SchemaBuilder';
import { DataLoader } from './components/DataLoader';
import { EnhancedLineageGraph } from './components/EnhancedLineageGraph'; // FIXED: Removed WithProvider
import {
  Upload,
  ArrowLeft,
  Loader,
  AlertCircle,
  Zap,
  RefreshCw,
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
  
  // Selection mode for path finding
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [pathFindingInProgress, setPathFindingInProgress] = useState(false);

  // Define loadLineageGraph first (before loadSchema that uses it)
  const loadLineageGraph = useCallback(
    async (schemaId: string, expanded: string[]) => {
      try {
        const graph = await apiService.getLineageGraph(schemaId, expanded);
        setLineageGraph(graph);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lineage graph');
      }
    },
    []
  );

  // Load schema and visualization
  const loadSchema = useCallback((schemaId: string) => {
    (async () => {
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
    })();
  }, [loadLineageGraph]);

  const handleToggleExpand = useCallback(
    (classId: string) => {
      setExpandedClasses((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(classId)) {
          newExpanded.delete(classId);
        } else {
          newExpanded.add(classId);
        }
        return newExpanded;
      });
    },
    []
  );

  const handleNodeClick = useCallback((node: FlowNode) => {
    setSelectedNode(node);
    
    // In selection mode, add to selected nodes for path finding
    if (selectionMode) {
      setSelectedNodeIds(prev => {
        if (prev.includes(node.id)) {
          return prev.filter(id => id !== node.id);
        } else {
          return [...prev, node.id];
        }
      });
    }
  }, [selectionMode]);

  // SchemaBuilder passes schemaId (string) not the full schema object
  const handleSchemaCreated = useCallback((schemaId: string) => {
    (async () => {
      try {
        // Load the full schema
        const schema = await apiService.getSchema(schemaId);
        setCurrentSchema(schema);
        await loadLineageGraph(schemaId, []);
        setView('data-loader');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      }
    })();
  }, [loadLineageGraph]);

  const handleDataLoaded = useCallback(() => {
    if (currentSchema) {
      // Reload lineage with current expanded state
      loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
      
      // Reload stats
      apiService.getSchemaStats(currentSchema.id).then(setSchemaStats);
    }
  }, [currentSchema, expandedClasses, loadLineageGraph]);

  // Find all paths between selected nodes
  const findAllPaths = useCallback(async () => {
    if (!currentSchema || selectedNodeIds.length < 2) {
      return;
    }

    try {
      setPathFindingInProgress(true);
      setError(null);

      const response = await apiService.findAllPaths(
        currentSchema.id,
        selectedNodeIds,
        10 // max_depth
      );

      setHighlightedPath(response);
      
      console.log('=== PATH FINDING RESULT ===');
      console.log(`Found ${response.paths.length} paths between selected nodes`);
      console.log('Highlighted Nodes:', response.highlighted_nodes);
      console.log('Highlighted Edges:', response.highlighted_edges);
      console.log('===========================');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to find paths');
    } finally {
      setPathFindingInProgress(false);
    }
  }, [currentSchema, selectedNodeIds]);

  // Auto-find paths when 2+ nodes are selected in selection mode
  useEffect(() => {
    if (selectionMode && selectedNodeIds.length >= 2) {
      findAllPaths();
    }
  }, [selectionMode, selectedNodeIds, findAllPaths]);

  // Clear highlights when search changes
  useEffect(() => {
    if (!searchQuery) {
      setHighlightedPath(null);
    }
  }, [searchQuery]);

  // Reload lineage when expanded classes change
  useEffect(() => {
    if (currentSchema) {
      loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
    }
  }, [currentSchema, expandedClasses, loadLineageGraph]);

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
                  setSelectedNodeIds([]);
                  setSelectionMode(false);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft size={16} />
                <span className="text-sm font-medium">Back to Schemas</span>
              </button>

              <h1 className="text-2xl font-bold text-black mb-2">{currentSchema.name}</h1>
              {currentSchema.description && (
                <p className="text-sm text-gray-600">{currentSchema.description}</p>
              )}
            </div>

            {/* Stats */}
            {schemaStats && (
              <div className="p-6 border-b border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Classes</span>
                  <span className="text-lg font-semibold text-black">
                    {schemaStats.total_classes}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Instances</span>
                  <span className="text-lg font-semibold text-black">
                    {schemaStats.total_instances}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Relationships</span>
                  <span className="text-lg font-semibold text-black">
                    {schemaStats.total_relationships}
                  </span>
                </div>
              </div>
            )}

            {/* Path Finding Controls */}
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-black mb-3">Path Finding</h3>
              
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedNodeIds([]);
                  setHighlightedPath(null);
                }}
                className={`w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  selectionMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                <Zap size={16} />
                <span className="text-sm font-medium">
                  {selectionMode ? 'Exit Path Mode' : 'Find All Paths'}
                </span>
              </button>

              {selectionMode && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-900 mb-2">
                    Click nodes to select them. All paths between selected nodes will be shown.
                  </p>
                  <p className="text-xs font-semibold text-blue-900">
                    Selected: {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? 's' : ''}
                  </p>
                  {highlightedPath && (
                    <p className="text-xs text-blue-900 mt-1">
                      Found: {highlightedPath.paths.length} path{highlightedPath.paths.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  {selectedNodeIds.length >= 2 && (
                    <button
                      onClick={() => {
                        setSelectedNodeIds([]);
                        setHighlightedPath(null);
                      }}
                      className="mt-2 w-full py-1 px-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}

              {pathFindingInProgress && (
                <div className="mt-3 flex items-center justify-center gap-2 text-gray-600">
                  <Loader size={16} className="animate-spin" />
                  <span className="text-xs">Finding paths...</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 space-y-3">
              <button
                onClick={() => setView('data-loader')}
                className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                <span className="text-sm font-medium">Load Data</span>
              </button>

              <button
                onClick={() => handleDataLoaded()}
                className="w-full py-2 px-4 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} />
                <span className="text-sm font-medium">Refresh Graph</span>
              </button>
            </div>
          </div>

          {/* Main Graph Area */}
          <div className="flex-1 relative">
            {loading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <Loader size={24} className="animate-spin text-blue-600" />
                  <span className="text-gray-900">Loading graph...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-600" />
                  <span className="text-sm text-red-900">{error}</span>
                </div>
              </div>
            )}

            {/* FIXED: Using EnhancedLineageGraph directly (includes ReactFlowProvider internally) */}
            <EnhancedLineageGraph
              nodes={lineageGraph.nodes}
              edges={lineageGraph.edges}
              highlightedNodes={highlightedPath?.highlighted_nodes || []}
              highlightedEdges={highlightedPath?.highlighted_edges || []}
              selectedNodeIds={selectedNodeIds}
              selectionMode={selectionMode}
              onNodeClick={handleNodeClick}
              onToggleExpand={handleToggleExpand}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;