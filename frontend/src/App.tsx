// frontend/src/App.tsx - FIXED VERSION WITH SINGLE LOAD

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Node as FlowNode } from 'reactflow';
import { LandingPage } from './components/LandingPage';
import { SchemaBuilder } from './components/SchemaBuilder';
import { DataLoader } from './components/DataLoader';
import { EnhancedLineageGraph } from './components/EnhancedLineageGraph';
import {
  Upload,
  ArrowLeft,
  Loader,
  AlertCircle,
  Zap,
  RefreshCw,
  Database,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [pathFindingInProgress, setPathFindingInProgress] = useState(false);
  
  // Prevent multiple simultaneous loads
  const loadingRef = useRef(false);

  const loadLineageGraph = useCallback(
    async (schemaId: string, expanded: string[]) => {
      // Prevent concurrent loads
      if (loadingRef.current) {
        console.log('⏭️ Skipping concurrent load');
        return;
      }

      try {
        loadingRef.current = true;
        console.log('🔄 Loading lineage graph for:', schemaId, 'expanded:', expanded);
        
        const graph = await apiService.getLineageGraph(schemaId, expanded);
        
        console.log('✅ Loaded graph:', { 
          nodes: graph?.nodes?.length || 0, 
          edges: graph?.edges?.length || 0 
        });
        
        if (!graph || !graph.nodes || graph.nodes.length === 0) {
          console.warn('⚠️ Graph has no nodes!');
        }
        
        setLineageGraph(graph);
      } catch (err) {
        console.error('❌ Load failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load lineage graph');
      } finally {
        loadingRef.current = false;
      }
    },
    []
  );

  const loadSchema = useCallback((schemaId: string) => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('📥 Loading schema:', schemaId);

        const [schema, stats] = await Promise.all([
          apiService.getSchema(schemaId),
          apiService.getSchemaStats(schemaId),
        ]);

        console.log('✅ Schema loaded:', schema);
        console.log('✅ Stats loaded:', stats);

        setCurrentSchema(schema);
        setSchemaStats(stats);
        
        // Load lineage graph once
        await loadLineageGraph(schemaId, []);
        
        setView('visualization');
      } catch (err) {
        console.error('❌ Schema load failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLineageGraph]);

  const handleToggleExpand = useCallback(
    (classId: string) => {
      if (!currentSchema) return;
      
      setExpandedClasses((prev) => {
        const newExpanded = new Set(prev);
        if (newExpanded.has(classId)) {
          newExpanded.delete(classId);
          console.log('🔽 Collapsing class:', classId);
        } else {
          newExpanded.add(classId);
          console.log('🔼 Expanding class:', classId);
        }
        
        const expandedArray = Array.from(newExpanded);
        console.log('📋 New expanded state:', expandedArray);
        
        // Show loading state while reloading
        setLoading(true);
        
        // Reload graph with new expanded state
        setTimeout(() => {
          loadLineageGraph(currentSchema.id, expandedArray).finally(() => {
            setLoading(false);
          });
        }, 100);
        
        return newExpanded;
      });
    },
    [currentSchema, loadLineageGraph]
  );

  const handleNodeClick = useCallback((node: FlowNode) => {
    console.log('🖱️ Node clicked:', node.id);
    setSelectedNode(node);
    
    if (selectionMode) {
      setSelectedNodeIds(prev => {
        const newIds = prev.includes(node.id)
          ? prev.filter(id => id !== node.id)
          : [...prev, node.id];
        console.log('📌 Selected nodes:', newIds);
        return newIds;
      });
    }
  }, [selectionMode]);

  const handleSchemaCreated = useCallback((schemaId: string) => {
    (async () => {
      try {
        console.log('📥 Schema created:', schemaId);
        const schema = await apiService.getSchema(schemaId);
        setCurrentSchema(schema);
        setView('data-loader');
      } catch (err) {
        console.error('❌ Failed to load created schema:', err);
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      }
    })();
  }, []);

  const handleDataLoaded = useCallback(() => {
    if (currentSchema) {
      console.log('🔄 Data loaded, refreshing lineage');
      loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
      apiService.getSchemaStats(currentSchema.id).then(stats => {
        console.log('📊 Stats updated:', stats);
        setSchemaStats(stats);
      });
    }
  }, [currentSchema, expandedClasses, loadLineageGraph]);

  const findAllPaths = useCallback(async () => {
    if (!currentSchema || selectedNodeIds.length < 2) {
      return;
    }

    try {
      setPathFindingInProgress(true);
      setError(null);

      console.log('🔍 Finding paths between', selectedNodeIds.length, 'nodes:', selectedNodeIds);

      const response = await apiService.findAllPaths(
        currentSchema.id,
        selectedNodeIds,
        20
      );

      console.log('✅ Found', response.paths.length, 'paths');
      console.log('📍 Highlighted nodes:', response.highlighted_nodes.length);
      console.log('🔗 Highlighted edges:', response.highlighted_edges.length);
      
      setHighlightedPath(response);
      
    } catch (err) {
      console.error('❌ Path finding failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to find paths');
    } finally {
      setPathFindingInProgress(false);
    }
  }, [currentSchema, selectedNodeIds]);

  // Only find paths when selection changes
  useEffect(() => {
    if (selectionMode && selectedNodeIds.length >= 2) {
      findAllPaths();
    } else {
      setHighlightedPath(null);
    }
  }, [selectionMode, selectedNodeIds.length]); // Only depend on length, not the array itself

  // Reset selection when leaving selection mode
  useEffect(() => {
    if (!selectionMode) {
      setSelectedNodeIds([]);
      setHighlightedPath(null);
    }
  }, [selectionMode]);

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
          onCancel={() => {
            setView('visualization');
            if (currentSchema) {
              loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
            }
          }}
        />
      )}

      {view === 'visualization' && (
        <div className="flex h-screen">
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => {
                  console.log('🔙 Returning to landing');
                  setView('landing');
                  setCurrentSchema(null);
                  setLineageGraph(null);
                  setExpandedClasses(new Set());
                  setHighlightedPath(null);
                  setSelectedNodeIds([]);
                  setSelectionMode(false);
                  setError(null);
                }}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <ArrowLeft size={16} />
                <span className="text-sm font-medium">Back to Schemas</span>
              </button>

              {currentSchema && (
                <>
                  <h1 className="text-2xl font-bold text-black mb-2">{currentSchema.name}</h1>
                  {currentSchema.description && (
                    <p className="text-sm text-gray-600">{currentSchema.description}</p>
                  )}
                </>
              )}
            </div>

            {schemaStats && (
              <div className="p-6 border-b border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Classes</span>
                  <span className="text-lg font-semibold text-black">
                    {schemaStats.total_classes}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Relationships</span>
                  <span className="text-lg font-semibold text-black">
                    {schemaStats.total_relationships}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Instances</span>
                  <span className="text-lg font-semibold text-black">
                    {schemaStats.total_instances}
                  </span>
                </div>
                
                {schemaStats.total_relationships === 0 && (
                  <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    ⚠️ No relationships defined - edges won't be visible
                  </div>
                )}
                
                {schemaStats.total_instances === 0 && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    ℹ️ No data loaded - use Data Loader to import data
                  </div>
                )}
              </div>
            )}

            <div className="p-6 border-b border-gray-200">
              <button
                onClick={() => setSelectionMode(!selectionMode)}
                className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectionMode
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap size={16} />
                  <span>{selectionMode ? 'Exit' : 'Find'} Path Mode</span>
                </div>
              </button>

              {selectionMode && (
                <div className="mt-3 text-xs text-gray-600">
                  <p>Click nodes to select them.</p>
                  <p className="mt-1">
                    Selected: <span className="font-semibold">{selectedNodeIds.length}</span>
                  </p>
                  {selectedNodeIds.length >= 2 && highlightedPath && (
                    <p className="mt-1 text-blue-600">
                      Found {highlightedPath.paths.length} path(s)
                    </p>
                  )}
                </div>
              )}
            </div>

            {currentSchema && (
              <div className="p-6">
                <button
                  onClick={() => {
                    if (currentSchema) {
                      console.log('🔄 Manual refresh requested');
                      loadLineageGraph(currentSchema.id, Array.from(expandedClasses));
                    }
                  }}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  <span>Refresh Graph</span>
                </button>
              </div>
            )}

            {selectedNode && (
              <div className="p-6 border-t border-gray-200 overflow-y-auto">
                <h3 className="font-semibold text-gray-900 mb-2">Selected Node</h3>
                <div className="text-sm space-y-1">
                  <p className="text-gray-600">
                    <span className="font-medium">ID:</span> {selectedNode.id}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">Type:</span> {selectedNode.data?.type}
                  </p>
                  {selectedNode.data?.schema_id && (
                    <p className="text-gray-600">
                      <span className="font-medium">Schema:</span> {selectedNode.data.schema_id}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 relative bg-white">
            {loading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex items-center gap-3">
                  <Loader size={24} className="animate-spin text-blue-600" />
                  <span className="text-gray-900 font-medium">Loading graph...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 shadow-lg">
                  <AlertCircle size={20} className="text-red-600" />
                  <p className="text-red-600">{error}</p>
                </div>
              </div>
            )}

            {!loading && !lineageGraph && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Database size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600 font-medium">No graph data loaded</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Click refresh or select a schema
                  </p>
                </div>
              </div>
            )}

            {lineageGraph && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;