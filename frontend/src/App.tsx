// frontend/src/App.tsx - FIXED TYPE ERRORS
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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Upload,
  Refresh,
  Home,
  Close,
} from '@mui/icons-material';
import { Node } from 'reactflow';

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

function App() {
  // State
  const [view, setView] = useState<AppView>('landing');
  const [currentSchema, setCurrentSchema] = useState<SchemaDefinition | null>(null);
  const [schemas, setSchemas] = useState<SchemaDefinition[]>([]);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(true);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [dataLoaderOpen, setDataLoaderOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);
  const [highlightedEdges, setHighlightedEdges] = useState<string[]>([]);
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

  // FIXED: Build hierarchy tree from graph nodes
  const hierarchyTree = useMemo<HierarchyTree | null>(() => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return null;
    }

    try {
      // Build parent-child map from edges (only hierarchy edges)
      const parentMap = new Map<string, string>();
      const childrenMap = new Map<string, string[]>();

      // FIXED: Check edge.type and edge.label (not edge.name which doesn't exist)
      graph.edges.forEach(edge => {
        // Look for hierarchy relationship types
        const hierarchyTypes = ['inherits', 'is_a', 'subclass_of', 'extends', 'hierarchy'];
        const edgeType = edge.type?.toLowerCase() || '';
        const edgeLabel = edge.label?.toLowerCase() || '';
        
        if (hierarchyTypes.some(type => edgeType.includes(type) || edgeLabel.includes(type))) {
          parentMap.set(edge.target, edge.source);
          if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
          }
          childrenMap.get(edge.source)!.push(edge.target);
        }
      });

      // FIXED: node.type is 'class' | 'attribute' | 'instance' | 'attribute_value', not 'schema_class'
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

        // Extract attributes from node
        let attributes = graphNode.attributes || [];
        
        // If attributes is a string, parse it
        if (typeof attributes === 'string') {
          try {
            attributes = JSON.parse(attributes);
          } catch {
            attributes = [];
          }
        }

        // Ensure attributes is an array
        if (!Array.isArray(attributes)) {
          attributes = [];
        }

        return {
          id: nodeId,
          name: graphNode.name,
          display_name: graphNode.display_name || graphNode.name,
          type: children.length > 0 ? 'class' : 'class',
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
      setCurrentSchema(schema);
      
      console.log('📊 Loading graph for schema:', schema.id);
      await loadGraph(schema.id);
      
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

  const handleFileUploadForInference = useCallback(async (files: File[], formats: FileFormat[]) => {
    try {
      setLoading(true);
      
      if (files.length === 1) {
        showSnackbar('Analyzing file and inferring schema...', 'info');
        const result = await apiService.inferSchema(files[0], formats[0]);
        
        setInferredSchema({
          name: result.suggested_name || `Schema from ${files[0].name}`,
          description: result.description || `Auto-generated schema from ${formats[0].toUpperCase()} file`,
          classes: result.classes,
          relationships: result.relationships,
          sourceFile: files[0].name,
        });
      } else {
        showSnackbar(
          `🔍 Analyzing ${files.length} files using FalkorDB to detect cross-file relationships...`,
          'info'
        );
        
        const result = await apiService.inferSchemaMulti(files, formats);
        
        setInferredSchema({
          name: result.suggested_name || `Unified Schema (${files.length} files)`,
          description: result.description || `Auto-generated unified schema from ${files.length} files`,
          classes: result.classes,
          relationships: result.relationships,
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
      showSnackbar(error.response?.data?.detail || 'Failed to infer schema', 'error');
      console.error(error);
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

  const handleSchemaDelete = useCallback(async (schemaId: string) => {
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

  // Data loading handlers
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
      
      const parsed = await apiService.parseFile(file, format);
      
      const classMappings: ClassDataMapping[] = currentSchema.classes.map(cls => {
        const columnMappings: ColumnMapping[] = cls.attributes
          .map(attr => {
            const matchingColumn = parsed.columns.find(col => 
              col.toLowerCase() === attr.toLowerCase()
            );
            
            if (matchingColumn) {
              return {
                source_column: matchingColumn,
                target_attribute: attr,
              };
            }
            return null;
          })
          .filter((mapping): mapping is ColumnMapping => mapping !== null);
        
        return {
          class_id: cls.id,
          column_mappings: columnMappings,
        };
      }).filter(mapping => mapping.column_mappings.length > 0);

      if (classMappings.length === 0) {
        showSnackbar('No matching columns found for any class', 'warning');
        return;
      }

      const loadRequest: DataLoadRequest = {
        schema_id: currentSchema.id,
        format,
        file_name: file.name,
        class_mappings: classMappings,
      };

      const result = await apiService.loadData(currentSchema.id, file, loadRequest);
      
      if (result.success) {
        showSnackbar(
          `Loaded ${result.instances_created} instances, ${result.relationships_created} relationships`,
          'success'
        );
        await loadGraph(currentSchema.id);
        setDataLoaderOpen(false);
      } else {
        showSnackbar('Data loading completed with errors', 'warning');
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Failed to load data', 'error');
      console.error(error);
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

  const handleNodeClick = useCallback((node: Node) => {
    setSelectedNodeIds([node.id]);
  }, []);

  // Render different views
  const renderView = () => {
    if (loading && view === 'landing') {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height="100%">
          <CircularProgress />
        </Box>
      );
    }

    switch (view) {
      case 'landing':
        return (
          <SchemaLanding
            schemas={schemas}
            onSchemaSelect={handleSchemaSelect}
            onCreateNew={handleCreateNewSchema}
            onUploadData={handleFileUploadForInference}
            onDeleteSchema={handleSchemaDelete}
            loading={loading}
          />
        );
      
      case 'schema-builder':
        return (
          <SchemaBuilder
            inferredSchema={inferredSchema}
            onSchemaCreated={handleSchemaCreated}
            onCancel={handleBackToLanding}
          />
        );
      
      case 'visualization':
        return (
          <Box sx={{ display: 'flex', height: '100%' }}>
            {/* Left Drawer - Hierarchy */}
            <Drawer
              variant="persistent"
              anchor="left"
              open={leftDrawerOpen}
              sx={{
                width: 320,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                  width: 320,
                  position: 'relative',
                  height: '100%',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                },
              }}
            >
              {hierarchyTree ? (
                <HierarchyTreeComponent
                  hierarchy={hierarchyTree}
                  onNodeSelect={(nodeId) => setSelectedNodeIds([nodeId])}
                  showAttributes={true}
                  showInstanceCounts={true}
                />
              ) : (
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Loading hierarchy...
                  </Typography>
                </Box>
              )}
            </Drawer>

            {/* Main Canvas - FIXED: Pass graph object, not nodes/edges */}
            <Box sx={{ flexGrow: 1, position: 'relative', height: '100%' }}>
              {graphLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <CircularProgress />
                </Box>
              ) : graph && graph.nodes.length > 0 ? (
                <LineageCanvas
                  graph={graph}
                  onNodeClick={handleNodeClick}
                  highlightedNodes={highlightedNodes}
                  highlightedEdges={highlightedEdges}
                />
              ) : (
                <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                  <Typography variant="h6" color="text.secondary">
                    No data to display. Load some data to see the lineage graph.
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      
      default:
        return null;
    }
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
            {view === 'landing' && 'Data Lineage - Schemas'}
            {view === 'schema-builder' && 'Schema Builder'}
            {view === 'visualization' && currentSchema && `${currentSchema.name} - Lineage Visualization`}
          </Typography>

          <Stack direction="row" spacing={1}>
            {view !== 'landing' && (
              <Button
                color="inherit"
                startIcon={<Home />}
                onClick={handleBackToLanding}
              >
                Back to Schemas
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
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {renderView()}
      </Box>

      {/* Data Loader Dialog */}
      <Drawer
        anchor="bottom"
        open={dataLoaderOpen}
        onClose={() => setDataLoaderOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            height: '80vh',
            p: 3,
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Load Data</Typography>
          <IconButton onClick={() => setDataLoaderOpen(false)}>
            <Close />
          </IconButton>
        </Stack>
        
        <FileUploader
          onFileSelect={handleFileUpload}
          acceptedFormats={['csv', 'excel', 'json', 'xml']}
          maxSizeMB={50}
          multiFile={false}
        />
      </Drawer>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default App;