// frontend/src/App.tsx
// FULLY FIXED - All TypeScript errors resolved

import { useState, useCallback, useEffect, useMemo } from 'react';
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
import SchemaTreeCard from './components/schema/SchemaTreeCard';
import { SchemaLanding } from './components/schema/SchemaLanding';
import { SchemaBuilder } from './components/schema/SchemaBuilder';
import { FileUploader, FileFormat } from './components/data/FileUploader';
import { useLineageGraph } from './hooks/useLineageGraph';
import apiService from './services/api';
import {
  SchemaDefinition,
  SchemaClass,
  DataLoadRequest,
  ClassDataMapping,
  ColumnMapping,
} from './types';
import { HierarchyTree, HierarchyNode, LineageGraphEdge } from './types/lineage';

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

// Helper function for fuzzy column matching
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

  // Build hierarchy tree from graph nodes
  const hierarchyTree = useMemo<HierarchyTree | null>(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return null;
    }

    try {
      // Build parent-child map from edges (only hierarchy edges)
      const parentMap = new Map<string, string>();
      const childrenMap = new Map<string, string[]>();

      // Safe access to edge properties with proper typing
      (graph.edges || []).forEach((edge: LineageGraphEdge) => {
        // Look for hierarchy relationship types
        const hierarchyTypes = ['inherits', 'is_a', 'subclass_of', 'extends', 'hierarchy'];
        const edgeType = (edge.type || '').toLowerCase();
        const edgeLabel = (edge.label || '').toLowerCase();
        
        if (hierarchyTypes.some((type: string) => edgeType.includes(type) || edgeLabel.includes(type))) {
          parentMap.set(edge.target, edge.source);
          if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
          }
          childrenMap.get(edge.source)!.push(edge.target);
        }
      });

      const rootNodeIds = graph.nodes
        .filter((node) => node.type === 'class' && !parentMap.has(node.id))
        .map((node) => node.id);

      console.log('🌲 Building hierarchy tree:', {
        totalNodes: graph.nodes.length,
        rootNodes: rootNodeIds.length,
        classNodes: graph.nodes.filter((n) => n.type === 'class').length,
      });

      // Build hierarchy recursively
      const buildHierarchyNode = (nodeId: string, level: number): HierarchyNode => {
        const graphNode = graph.nodes.find((n) => n.id === nodeId);
        if (!graphNode) {
          throw new Error(`Node ${nodeId} not found`);
        }

        const children = (childrenMap.get(nodeId) || [])
          .map((childId: string) => buildHierarchyNode(childId, level + 1));

        // Safe attribute extraction
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

        // ✅ FIXED: Use only 'name' and 'display_name' properties (no 'label')
        const nodeName = graphNode.name || 'Unknown';
        const displayName = graphNode.display_name || graphNode.name || 'Unknown';
        
        return {
          id: nodeId,
          name: nodeName,
          display_name: displayName,
          type: children.length > 0 ? ('subclass' as const) : ('class' as const),
          level,
          parent_id: parentMap.get(nodeId) || undefined, // ✅ FIXED: Convert to undefined
          children,
          attributes: attributes,
          instance_count: graphNode.instance_count || 0,
          collapsed: false,
          metadata: graphNode.metadata || {},
        };
      };

      const rootNodes = rootNodeIds.map((id: string) => buildHierarchyNode(id, 0));

      const maxDepth = Math.max(
        ...rootNodes.map((node) => {
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
      const data = await apiService.listSchemas();
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
      
      // Fetch full schema details including classes with attributes
      console.log('📊 Loading full schema details:', schema.id);
      const fullSchema = await apiService.getSchema(schema.id);
      setCurrentSchema(fullSchema);
      
      console.log('📊 Loading graph for schema:', fullSchema.id);
      await loadGraph(fullSchema.id);
      
      setView('visualization');
      setLeftDrawerOpen(true);
    } catch (error) {
      showSnackbar('Failed to load schema', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [loadGraph, showSnackbar]);

  const handleCreateNewSchema = useCallback(() => {
    setView('schema-builder');
    setInferredSchema(null);
  }, []);

  const handleUploadData = useCallback(async (files: File[], formats: FileFormat[]) => {
    if (files.length === 0) return;

    try {
      setLoading(true);
      const file = files[0];
      const format = formats[0];

      console.log('📄 Inferring schema from file:', file.name);
      
      if (files.length > 1) {
        // Multi-file schema inference
        const result = await apiService.inferSchemaMulti(files, formats);
        setInferredSchema({
          name: result.suggested_name,
          description: result.description,
          classes: result.classes,
          relationships: result.relationships,
          sourceFile: files.map((f) => f.name).join(', '),
        });
      } else {
        // Single file schema inference
        const result = await apiService.inferSchema(file, format);
        setInferredSchema({
          name: result.suggested_name,
          description: result.description,
          classes: result.classes,
          relationships: result.relationships,
          sourceFile: file.name,
        });
      }

      setView('schema-builder');
      showSnackbar('Schema inferred successfully', 'success');
    } catch (error) {
      showSnackbar('Failed to infer schema', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [showSnackbar]);

  const handleSchemaCreated = useCallback(async (schema: SchemaDefinition) => {
    showSnackbar('Schema created successfully! Loading visualization...', 'success');
    
    await loadSchemas();
    
    setTimeout(() => {
      handleSchemaSelect(schema);
    }, 500);
  }, [loadSchemas, handleSchemaSelect, showSnackbar]);

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

  // Data loading with better column matching
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
      
      // Fetch full schema details with classes and attributes
      console.log('📋 Fetching full schema details...');
      const fullSchema = await apiService.getSchema(currentSchema.id);
      
      if (!fullSchema.classes || fullSchema.classes.length === 0) {
        showSnackbar('Schema has no classes defined', 'error');
        return;
      }
      
      console.log('📄 Parsing file:', file.name);
      const parsed = await apiService.parseFile(file, format);
      
      // Safe array access and log available columns
      const columns = Array.isArray(parsed.columns) ? parsed.columns : [];
      console.log('📊 Available columns in file:', columns);
      console.log('📊 Schema classes:', fullSchema.classes.map((c: SchemaClass) => ({
        name: c.name,
        attributes: c.attributes
      })));
      
      // Better column matching with fuzzy logic
      const classMappings: ClassDataMapping[] = (fullSchema.classes || []).map((cls: SchemaClass) => {
        console.log(`\n🔍 Matching columns for class: ${cls.name}`);
        console.log(`   Attributes: ${(cls.attributes || []).join(', ')}`);
        
        const columnMappings: ColumnMapping[] = (cls.attributes || [])
          .map((attr: string) => {
            // Use fuzzy matching function
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
      }).filter((mapping: ClassDataMapping) => mapping.column_mappings.length > 0);

      console.log(`\n📋 Final class mappings: ${classMappings.length} classes with mappings`);

      if (classMappings.length === 0) {
        showSnackbar(
          'No matching columns found for any class. Check that column names match schema attributes.',
          'warning'
        );
        console.error('❌ No column mappings found!');
        console.error('Available columns:', columns);
        console.error('Schema attributes:', fullSchema.classes.flatMap((c: SchemaClass) => c.attributes || []));
        return;
      }

      const loadRequest: DataLoadRequest = {
        schema_id: fullSchema.id,
        format,
        file_name: file.name,
        class_mappings: classMappings,
      };

      console.log('📤 Sending load request:', loadRequest);
      const result = await apiService.loadData(loadRequest);
      
      if (result.success) {
        showSnackbar(
          `Loaded ${result.instances_created} instances, ${result.relationships_created} relationships`,
          'success'
        );
        
        // Update currentSchema with full schema details
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

  // Single node ID handler matching tree card expected type
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
          {/* ✅ Use SchemaTreeCard */}
          <Drawer
            anchor="left"
            open={leftDrawerOpen}
            onClose={() => setLeftDrawerOpen(false)}
            variant="persistent"
            sx={{
              width: 350,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 350,
                boxSizing: 'border-box',
                top: 64,
                height: 'calc(100% - 64px)',
                p: 2,
              },
            }}
          >
            <SchemaTreeCard
              hierarchy={hierarchyTree}
              selectedNodeId={selectedNodeId}
              onNodeSelect={handleNodeSelect}
              showAttributes={true}
              editable={false}
            />
          </Drawer>

          <Box
            component="main"
            sx={{
              flexGrow: 1,
              p: 0,
              ml: leftDrawerOpen ? '350px' : 0,
              height: 'calc(100vh - 64px)',
              transition: 'margin 0.3s',
            }}
          >
            {graphLoading ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CircularProgress size={60} />
              </Box>
            ) : (
              <LineageCanvas
                graph={graph}
                onRefresh={() => loadGraph(currentSchema.id)}
              />
            )}
          </Box>
        </>
      );
    }

    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          {view === 'visualization' && (
            <IconButton
              edge="start"
              color="inherit"
              onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Data Lineage Platform
            {currentSchema && ` - ${currentSchema.name}`}
          </Typography>

          <Stack direction="row" spacing={1}>
            {view === 'visualization' && (
              <>
                <Button
                  color="inherit"
                  startIcon={<Upload />}
                  onClick={() => setDataLoaderOpen(true)}
                >
                  Load Data
                </Button>
                <IconButton color="inherit" onClick={handleRefresh}>
                  <Refresh />
                </IconButton>
              </>
            )}
            {view !== 'landing' && (
              <IconButton color="inherit" onClick={handleBackToLanding}>
                <Home />
              </IconButton>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {renderContent()}
      </Box>

      {/* Data Loader Modal */}
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
          <Box sx={{ maxWidth: 600, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Load Data into Schema</Typography>
                  <IconButton size="small" onClick={() => setDataLoaderOpen(false)}>
                    <Close />
                  </IconButton>
                </Stack>
                <FileUploader
                  onFileSelect={handleFileUpload}
                  multiFile={false}
                  acceptedFormats={['csv', 'excel', 'json', 'xml']}
                />
              </Stack>
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