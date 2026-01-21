// frontend/src/App.tsx - FIXED column matching with better logic
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  Stack,
  Snackbar,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Upload,
  Refresh,
  Home,
  Close,
} from '@mui/icons-material';

import { LineageCanvas } from './components/lineage/LineageCanvas';
import { HierarchyTreeComponent } from './components/lineage/HierarchyTree';
import { SchemaLanding } from './components/schema/SchemaLanding';
import { SchemaBuilder } from './components/schema/SchemaBuilder';
import { FileUploader, FileFormat } from './components/data/FileUploader';
import { useLineageGraph } from './hooks/useLineageGraph';
import apiService from './services/api';
import {
  SchemaDefinition,
  DataLoadRequest,
  ClassDataMapping,
  ColumnMapping,
  HierarchyTree,
  HierarchyNode,
} from './types';

type AppView = 'landing' | 'schema-builder' | 'visualization';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
}

interface InferredSchema {
  name: string;
  description: string;
  classes: any[];
  relationships: any[];
  sourceFile: string;
}

// FIXED: Helper function for fuzzy column matching
function normalizeColumnName(name: string): string {
  return name.toLowerCase().trim().replace(/[_\s-]+/g, '');
}

function findMatchingColumn(
  attribute: string,
  columns: string[]
): string | null {
  const normalizedAttr = normalizeColumnName(attribute);
  
  // Try exact match first (case-insensitive, trimmed)
  for (const col of columns) {
    if (col.toLowerCase().trim() === attribute.toLowerCase().trim()) {
      return col;
    }
  }
  
  // Try fuzzy match (no spaces, underscores, dashes)
  for (const col of columns) {
    if (normalizeColumnName(col) === normalizedAttr) {
      return col;
    }
  }
  
  // Try partial match
  for (const col of columns) {
    const normalizedCol = normalizeColumnName(col);
    if (normalizedCol.includes(normalizedAttr) || normalizedAttr.includes(normalizedCol)) {
      return col;
    }
  }
  
  return null;
}

function App() {
  // State
  const [view, setView] = useState<AppView>('landing');
  const [currentSchema, setCurrentSchema] = useState<SchemaDefinition | null>(null);
  const [schemas, setSchemas] = useState<SchemaDefinition[]>([]);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [dataLoaderOpen, setDataLoaderOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [inferredSchema, setInferredSchema] = useState<InferredSchema | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Hooks
  const { graph, loading: graphLoading, loadGraph } = useLineageGraph({
    onError: (error) => {
      showSnackbar(error.message, 'error');
    },
  });

  // FIXED: Build hierarchy tree from graph nodes with correct types
  const hierarchyTree = useMemo<HierarchyTree | null>(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return null;
    }

    try {
      // Build parent-child map from edges (only hierarchy edges)
      const parentMap = new Map<string, string>();
      const childrenMap = new Map<string, string[]>();

      // FIXED: Safe access to edge properties
      (graph.edges || []).forEach(edge => {
        // Look for hierarchy relationship types
        const hierarchyTypes = ['inherits', 'is_a', 'subclass_of', 'extends', 'hierarchy'];
        const edgeType = (edge.type || '').toLowerCase();
        const edgeLabel = (edge.label || '').toLowerCase();
        
        if (hierarchyTypes.some(type => edgeType.includes(type) || edgeLabel.includes(type))) {
          parentMap.set(edge.target, edge.source);
          if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
          }
          childrenMap.get(edge.source)!.push(edge.target);
        }
      });

      const rootNodeIds = graph.nodes
        .filter(node => node.type === 'class' && !parentMap.has(node.id))
        .map(node => node.id);

      console.log('🌲 Building hierarchy tree:', {
        totalNodes: graph.nodes.length,
        rootNodes: rootNodeIds.length,
        classNodes: graph.nodes.filter(n => n.type === 'class').length,
      });

      // Build hierarchy recursively
      const buildHierarchyNode = (nodeId: string, level: number): HierarchyNode => {
        const graphNode = graph.nodes.find(n => n.id === nodeId);
        if (!graphNode) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const children = (childrenMap.get(nodeId) || [])
          .map(childId => buildHierarchyNode(childId, level + 1));

        // FIXED: Safe attribute extraction
        let attributes = graphNode.attributes || [];
        
        if (typeof attributes === 'string') {
          try {
            attributes = JSON.parse(attributes);
          } catch {
            attributes = [];
          }
        }

        if (!Array.isArray(attributes)) {
          attributes = [];
        }

        // FIXED: Use 'subclass' instead of 'category' to match HierarchyNode type
        return {
          id: nodeId,
          name: graphNode.name,
          display_name: graphNode.display_name || graphNode.name,
          type: children.length > 0 ? 'subclass' : 'class',
          level,
          parent_id: parentMap.get(nodeId),
          children,
          attributes: attributes,
          instance_count: graphNode.instance_count || 0,
          collapsed: false,
          metadata: graphNode.metadata || {},
        };
      };

      const rootNodes = rootNodeIds.map(id => buildHierarchyNode(id, 0));

      const maxDepth = Math.max(
        ...rootNodes.map(node => {
          const getMaxDepth = (n: HierarchyNode): number => {
            if (n.children.length === 0) return n.level;
            return Math.max(...n.children.map(getMaxDepth));
          };
          return getMaxDepth(node);
        }),
        0
      );

      return {
        schema_id: graph.schema_id,
        root_nodes: rootNodes,
        max_depth: maxDepth + 1,
        total_nodes: rootNodes.reduce((sum, node) => {
          const countNodes = (n: HierarchyNode): number => {
            return 1 + n.children.reduce((s, c) => s + countNodes(c), 0);
          };
          return sum + countNodes(node);
        }, 0),
        metadata: {},
      };
    } catch (error) {
      console.error('Failed to build hierarchy tree:', error);
      return null;
    }
  }, [graph]);

  // Load schemas on mount
  useEffect(() => {
    loadSchemas();
  }, []);

  // Helper functions
  const showSnackbar = useCallback(
    (message: string, severity: SnackbarState['severity'] = 'info') => {
      setSnackbar({ open: true, message, severity });
    },
    []
  );

  const handleCloseSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }, []);

  const loadSchemas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getSchemas();
      setSchemas(data);
    } catch (error) {
      showSnackbar('Failed to load schemas', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  // Navigation handlers
  const handleBackToLanding = useCallback(() => {
    setView('landing');
    setCurrentSchema(null);
    setInferredSchema(null);
    loadSchemas();
  }, [loadSchemas]);

  const handleSchemaSelect = useCallback(async (schema: SchemaDefinition) => {
    try {
      setLoading(true);
      
      // FIXED: Fetch full schema details including classes with attributes
      console.log('📊 Loading full schema details:', schema.id);
      const fullSchema = await apiService.getSchema(schema.id);
      setCurrentSchema(fullSchema);
      
      console.log('📊 Loading graph for schema:', fullSchema.id);
      await loadGraph(fullSchema.id);
      
      setView('visualization');
      setLeftDrawerOpen(true);
      
      showSnackbar('Schema loaded successfully', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Failed to load schema visualization', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [loadGraph, showSnackbar]);

  const handleCreateNewSchema = useCallback(() => {
    setView('schema-builder');
    setInferredSchema(null);
  }, []);

  // FIXED: Renamed to match SchemaLanding's expected prop name
  const handleUploadData = useCallback(async (files: File[], formats: FileFormat[]) => {
    try {
      setLoading(true);
      
      console.log('📁 Processing files for inference:', files.map(f => f.name));
      
      if (files.length === 1) {
        showSnackbar('Analyzing file and inferring schema...', 'info');
        const result = await apiService.inferSchema(files[0], formats[0]);
        
        // FIXED: Validate result structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response from server');
        }

        // FIXED: Safe array access with defaults
        const classes = Array.isArray(result.classes) ? result.classes : [];
        const relationships = Array.isArray(result.relationships) ? result.relationships : [];
        
        if (classes.length === 0) {
          showSnackbar('No classes could be inferred from the file', 'warning');
          return;
        }

        setInferredSchema({
          name: result.suggested_name || `Schema from ${files[0].name}`,
          description: result.description || `Auto-generated schema from ${formats[0].toUpperCase()} file`,
          classes: classes,
          relationships: relationships,
          sourceFile: files[0].name,
        });
      } else {
        showSnackbar(
          `🔍 Analyzing ${files.length} files using FalkorDB to detect cross-file relationships...`,
          'info'
        );
        
        const result = await apiService.inferSchemaMulti(files, formats);
        
        // FIXED: Validate result structure
        if (!result || typeof result !== 'object') {
          throw new Error('Invalid response from server');
        }

        // FIXED: Safe array access with defaults
        const classes = Array.isArray(result.classes) ? result.classes : [];
        const relationships = Array.isArray(result.relationships) ? result.relationships : [];
        
        if (classes.length === 0) {
          showSnackbar('No classes could be inferred from the files', 'warning');
          return;
        }

        setInferredSchema({
          name: result.suggested_name || `Unified Schema (${files.length} files)`,
          description: result.description || `Auto-generated unified schema from ${files.length} files`,
          classes: classes,
          relationships: relationships,
          sourceFile: files.map(f => f.name).join(', '),
        });
        
        if (result.metadata?.source_files) {
          console.log('📊 Multi-file inference metadata:', result.metadata);
        }
      }

      setView('schema-builder');
      showSnackbar(
        files.length === 1 
          ? 'Schema inferred successfully!' 
          : `✨ Unified schema inferred from ${files.length} files with cross-file relationships!`,
        'success'
      );
    } catch (error: any) {
      console.error('❌ Schema inference error:', error);
      
      // FIXED: Better error messages
      let errorMessage = 'Failed to infer schema';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showSnackbar(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  const handleSchemaCreated = useCallback(async (schema: SchemaDefinition) => {
    console.log('✅ Schema created:', schema);
    showSnackbar('Schema created successfully! Loading visualization...', 'success');
    
    await loadSchemas();
    
    setTimeout(() => {
      handleSchemaSelect(schema);
    }, 500);
  }, [loadSchemas, handleSchemaSelect, showSnackbar]);

  // FIXED: Renamed to match SchemaLanding's expected prop name
  const handleDeleteSchema = useCallback(async (schemaId: string) => {
    try {
      setLoading(true);
      await apiService.deleteSchema(schemaId);
      showSnackbar('Schema deleted successfully', 'success');
      await loadSchemas();
      if (currentSchema?.id === schemaId) {
        handleBackToLanding();
      }
    } catch (error) {
      showSnackbar('Failed to delete schema', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentSchema, loadSchemas, showSnackbar, handleBackToLanding]);

  // FIXED: Data loading with better column matching
  const handleFileUpload = useCallback(async (files: File[], formats: FileFormat[]) => {
    if (!currentSchema) {
      showSnackbar('No schema selected', 'error');
      return;
    }

    if (files.length === 0) {
      showSnackbar('No file selected', 'error');
      return;
    }

    const file = files[0];
    const format = formats[0];

    try {
      setLoading(true);
      
      // FIXED: Fetch full schema details with classes and attributes
      console.log('📋 Fetching full schema details...');
      const fullSchema = await apiService.getSchema(currentSchema.id);
      
      if (!fullSchema.classes || fullSchema.classes.length === 0) {
        showSnackbar('Schema has no classes defined', 'error');
        return;
      }
      
      console.log('📄 Parsing file:', file.name);
      const parsed = await apiService.parseFile(file, format);
      
      // FIXED: Safe array access and log available columns
      const columns = Array.isArray(parsed.columns) ? parsed.columns : [];
      console.log('📊 Available columns in file:', columns);
      console.log('📊 Schema classes:', fullSchema.classes.map(c => ({
        name: c.name,
        attributes: c.attributes
      })));
      
      // FIXED: Better column matching with fuzzy logic
      const classMappings: ClassDataMapping[] = (fullSchema.classes || []).map(cls => {
        console.log(`\n🔍 Matching columns for class: ${cls.name}`);
        console.log(`   Attributes: ${(cls.attributes || []).join(', ')}`);
        
        const columnMappings: ColumnMapping[] = (cls.attributes || [])
          .map(attr => {
            // FIXED: Use fuzzy matching function
            const matchingColumn = findMatchingColumn(attr, columns);
            
            if (matchingColumn) {
              console.log(`   ✅ Matched: ${attr} → ${matchingColumn}`);
              return {
                source_column: matchingColumn,
                target_attribute: attr,
              };
            } else {
              console.log(`   ❌ No match for: ${attr}`);
            }
            return null;
          })
          .filter((mapping): mapping is ColumnMapping => mapping !== null);
        
        console.log(`   Total mappings for ${cls.name}: ${columnMappings.length}`);
        
        return {
          class_id: cls.id,
          column_mappings: columnMappings,
        };
      }).filter(mapping => mapping.column_mappings.length > 0);

      console.log(`\n📋 Final class mappings: ${classMappings.length} classes with mappings`);

      if (classMappings.length === 0) {
        showSnackbar(
          'No matching columns found for any class. Check that column names match schema attributes.',
          'warning'
        );
        console.error('❌ No column mappings found!');
        console.error('Available columns:', columns);
        console.error('Schema attributes:', fullSchema.classes.flatMap(c => c.attributes || []));
        return;
      }

      const loadRequest: DataLoadRequest = {
        schema_id: fullSchema.id,
        format,
        file_name: file.name,
        class_mappings: classMappings,
      };

      console.log('📤 Sending load request:', loadRequest);
      const result = await apiService.loadData(fullSchema.id, file, loadRequest);
      
      if (result.success) {
        showSnackbar(
          `Loaded ${result.instances_created} instances, ${result.relationships_created} relationships`,
          'success'
        );
        
        // FIXED: Update currentSchema with full schema details
        setCurrentSchema(fullSchema);
        
        await loadGraph(fullSchema.id);
        setDataLoaderOpen(false);
      } else {
        showSnackbar('Data loading completed with errors', 'warning');
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Failed to load data', 'error');
      console.error('❌ Data loading error:', error);
    } finally {
      setLoading(false);
    }
  }, [currentSchema, loadGraph, showSnackbar]);

  const handleRefresh = useCallback(async () => {
    if (view === 'landing') {
      await loadSchemas();
    } else if (view === 'visualization' && currentSchema) {
      await loadGraph(currentSchema.id);
    }
  }, [view, currentSchema, loadSchemas, loadGraph]);

  // FIXED: Single node ID handler matching HierarchyTree expected type
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Render content based on view
  const renderContent = () => {
    if (view === 'landing') {
      return (
        <SchemaLanding
          schemas={schemas}
          onSchemaSelect={handleSchemaSelect}
          onCreateNew={handleCreateNewSchema}
          onUploadData={handleUploadData}
          onDeleteSchema={handleDeleteSchema}
          loading={loading}
        />
      );
    }

    if (view === 'schema-builder') {
      return (
        <SchemaBuilder
          inferredSchema={inferredSchema}
          onSchemaCreated={handleSchemaCreated}
          onCancel={handleBackToLanding}
        />
      );
    }

    if (view === 'visualization' && currentSchema) {
      return (
        <>
          <Drawer
            anchor="left"
            open={leftDrawerOpen}
            onClose={() => setLeftDrawerOpen(false)}
            variant="persistent"
            sx={{
              width: 300,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 300,
                boxSizing: 'border-box',
                top: 64,
                height: 'calc(100% - 64px)',
              },
            }}
          >
            <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
              <Typography variant="h6" gutterBottom>
                Schema Hierarchy
              </Typography>
              {hierarchyTree ? (
                <HierarchyTreeComponent
                  hierarchy={hierarchyTree}
                  onNodeSelect={handleNodeSelect}
                  selectedNodeId={selectedNodeId}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hierarchy available
                </Typography>
              )}
            </Box>
          </Drawer>

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 0,
              ml: leftDrawerOpen ? '300px' : 0,
              mr: rightDrawerOpen ? '300px' : 0,
              height: 'calc(100vh - 64px)',
              transition: 'margin 0.3s',
            }}
          >
            {graphLoading ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <CircularProgress />
              </Box>
            ) : graph ? (
              <LineageCanvas
                graph={graph}
                onNodeClick={(node) => handleNodeSelect(node.id)}
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <Typography>No graph data available</Typography>
              </Box>
            )}
          </Box>

          <Drawer
            anchor="right"
            open={rightDrawerOpen}
            onClose={() => setRightDrawerOpen(false)}
            variant="persistent"
            sx={{
              width: 300,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 300,
                boxSizing: 'border-box',
                top: 64,
                height: 'calc(100% - 64px)',
              },
            }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              {selectedNodeId && graph && (
                <Stack spacing={2}>
                  {(() => {
                    const node = graph.nodes.find((n) => n.id === selectedNodeId);
                    return node ? (
                      <Paper key={selectedNodeId} sx={{ p: 2 }}>
                        <Typography variant="subtitle2">{node.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Type: {node.type}
                        </Typography>
                      </Paper>
                    ) : null;
                  })()}
                </Stack>
              )}
            </Box>
          </Drawer>
        </>
      );
    }

    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
            sx={{ mr: 2, display: view === 'visualization' ? 'block' : 'none' }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Data Lineage Visualizer
            {currentSchema && ` - ${currentSchema.name}`}
          </Typography>

          <Stack direction="row" spacing={1}>
            {view !== 'landing' && (
              <Button
                color="inherit"
                startIcon={<Home />}
                onClick={handleBackToLanding}
              >
                Home
              </Button>
            )}

            {view === 'visualization' && (
              <>
                <Button
                  color="inherit"
                  startIcon={<Upload />}
                  onClick={() => setDataLoaderOpen(true)}
                >
                  Load Data
                </Button>
                <Button
                  color="inherit"
                  startIcon={<Refresh />}
                  onClick={handleRefresh}
                >
                  Refresh
                </Button>
              </>
            )}

            {view === 'landing' && (
              <Button
                color="inherit"
                startIcon={<Refresh />}
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {renderContent()}
      </Box>

      {/* Data Loader Dialog */}
      {dataLoaderOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
          }}
          onClick={() => setDataLoaderOpen(false)}
        >
          <Box
            sx={{ maxWidth: 600, width: '100%', p: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Paper sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Load Data</Typography>
                <IconButton onClick={() => setDataLoaderOpen(false)}>
                  <Close />
                </IconButton>
              </Stack>
              <FileUploader
                onFileSelect={handleFileUpload}
                multiFile={false}
                acceptedFormats={['csv', 'excel', 'json', 'xml']}
              />
            </Paper>
          </Box>
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Loading Overlay */}
      {loading && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <CircularProgress size={60} />
        </Box>
      )}
    </Box>
  );
}

export default App;