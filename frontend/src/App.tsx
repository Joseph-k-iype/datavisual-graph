// frontend/src/App.tsx - FIXED (no hierarchy error)

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  Stack,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Add,
  Upload,
  Refresh,
  Close,
} from '@mui/icons-material';
import { Node as FlowNode } from 'reactflow';

import { LineageCanvas } from './components/lineage/LineageCanvas';
import { HierarchyTreeComponent } from './components/lineage/HierarchyTree';
import { FileUploader, FileFormat } from './components/data/FileUploader';
import { useLineageGraph } from './hooks/useLineageGraph';
import apiService from './services/api';
import {
  SchemaDefinition,
  DataLoadRequest,
  ClassDataMapping,
  ColumnMapping,
} from './types';

type AppView = 'landing' | 'visualization';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
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

  // Load schemas on mount
  useEffect(() => {
    loadSchemas();
  }, []);

  // Load schemas
  const loadSchemas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getSchemas();
      setSchemas(data);
      
      // Auto-select first schema if available
      if (data.length > 0 && !currentSchema) {
        await handleSelectSchema(data[0]);
      }
    } catch (error) {
      showSnackbar('Failed to load schemas', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSchema]);

  // Select schema
  const handleSelectSchema = useCallback(async (schema: SchemaDefinition) => {
    try {
      setLoading(true);
      setCurrentSchema(schema);
      await loadGraph(schema.id);
      setView('visualization');
      showSnackbar(`Loaded schema: ${schema.name}`, 'success');
    } catch (error) {
      showSnackbar('Failed to load schema', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadGraph]);

  // Refresh current schema
  const handleRefresh = useCallback(async () => {
    if (currentSchema) {
      try {
        setLoading(true);
        await loadGraph(currentSchema.id);
        showSnackbar('Schema refreshed', 'success');
      } catch (error) {
        showSnackbar('Failed to refresh schema', 'error');
      } finally {
        setLoading(false);
      }
    }
  }, [currentSchema, loadGraph]);

  // Handle node click
  const handleNodeClick = useCallback((node: FlowNode) => {
    console.log('Node clicked:', node);
    setSelectedNodeIds([node.id]);
  }, []);

  // Handle attribute click
  const handleAttributeClick = useCallback(async (attributeId: string, nodeId: string) => {
    console.log('Attribute clicked:', attributeId, 'in node:', nodeId);
    
    try {
      setLoading(true);
      const trace = await apiService.traceAttributeLineage({
        attribute_id: attributeId,
        direction: 'both',
        max_depth: 10,
      });
      
      setHighlightedNodes(trace.highlighted_nodes);
      setHighlightedEdges(trace.highlighted_edges);
      setRightDrawerOpen(true);
      showSnackbar('Attribute lineage traced', 'success');
    } catch (error) {
      showSnackbar('Failed to trace attribute lineage', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File, format: FileFormat) => {
    if (!currentSchema) {
      showSnackbar('No schema selected', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Parse file
      const parsed = await apiService.parseFile(file, format);
      console.log('Parsed file:', parsed);
      
      // Auto-map columns to attributes (simple 1:1 mapping by name)
      const classMappings: ClassDataMapping[] = currentSchema.classes.map(cls => {
        const columnMappings: ColumnMapping[] = cls.attributes
          .map(attr => {
            // Try to find matching column by name
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
        setLoading(false);
        return;
      }

      // Create load request
      const loadRequest: DataLoadRequest = {
        schema_id: currentSchema.id,
        format,
        file_name: file.name,
        class_mappings: classMappings,
      };

      // Load data
      const result = await apiService.loadData(currentSchema.id, file, loadRequest);
      
      if (result.success) {
        showSnackbar(
          `Loaded ${result.instances_created} instances, ${result.relationships_created} relationships`,
          'success'
        );
        setDataLoaderOpen(false);
        await handleRefresh();
      } else {
        showSnackbar(`Load failed: ${result.errors.join(', ')}`, 'error');
      }
    } catch (error) {
      showSnackbar('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentSchema, handleRefresh]);

  // Show snackbar
  const showSnackbar = useCallback(
    (message: string, severity: SnackbarState['severity']) => {
      setSnackbar({ open: true, message, severity });
    },
    []
  );

  // Close snackbar
  const handleCloseSnackbar = useCallback(() => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  // Clear highlights
  const handleClearHighlights = useCallback(() => {
    setHighlightedNodes([]);
    setHighlightedEdges([]);
  }, []);

  // Landing view
  if (view === 'landing' || !currentSchema) {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar */}
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Data Lineage Dashboard
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Content */}
        <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Stack spacing={3} alignItems="center" maxWidth={600}>
            <Typography variant="h3" fontWeight={600} textAlign="center">
              Enterprise Data Lineage
            </Typography>
            <Typography variant="body1" color="text.secondary" textAlign="center">
              Visualize and trace data flows across your entire data ecosystem with
              fine-grain column-level lineage tracking.
            </Typography>

            {loading ? (
              <CircularProgress />
            ) : schemas.length > 0 ? (
              <Stack spacing={2} sx={{ width: '100%' }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Select a Schema:
                </Typography>
                {schemas.map(schema => (
                  <Button
                    key={schema.id}
                    variant="outlined"
                    size="large"
                    onClick={() => handleSelectSchema(schema)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography variant="subtitle2">{schema.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {schema.classes.length} classes, {schema.relationships.length} relationships
                      </Typography>
                    </Box>
                  </Button>
                ))}
              </Stack>
            ) : (
              <Alert severity="info">
                No schemas found. Create a schema to get started.
              </Alert>
            )}

            <Button
              variant="contained"
              startIcon={<Add />}
              size="large"
              onClick={loadSchemas}
            >
              Reload Schemas
            </Button>
          </Stack>
        </Box>
      </Box>
    );
  }

  // Main visualization view
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setLeftDrawerOpen(!leftDrawerOpen)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, ml: 2 }}>
            {currentSchema.name}
          </Typography>
          
          {highlightedNodes.length > 0 && (
            <Button
              color="inherit"
              startIcon={<Close />}
              onClick={handleClearHighlights}
              sx={{ mr: 2 }}
            >
              Clear Highlights ({highlightedNodes.length})
            </Button>
          )}

          <Button
            color="inherit"
            startIcon={<Upload />}
            onClick={() => setDataLoaderOpen(true)}
            sx={{ mr: 2 }}
          >
            Load Data
          </Button>
          
          <IconButton
            color="inherit"
            onClick={handleRefresh}
            disabled={loading || graphLoading}
          >
            {loading || graphLoading ? <CircularProgress size={24} color="inherit" /> : <Refresh />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar - Hierarchy */}
        <Drawer
          variant="persistent"
          anchor="left"
          open={leftDrawerOpen}
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
              position: 'relative',
            },
          }}
        >
          <HierarchyTreeComponent
            hierarchy={null}
            selectedNodeId={selectedNodeIds[0]}
            onNodeSelect={(nodeId) => setSelectedNodeIds([nodeId])}
            onAttributeClick={handleAttributeClick}
            showAttributes={true}
            showInstanceCounts={true}
          />
        </Drawer>

        {/* Main Canvas */}
        <Box sx={{ flexGrow: 1, position: 'relative' }}>
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
              onNodeClick={handleNodeClick}
              onAttributeClick={handleAttributeClick}
              showAttributes={true}
              highlightedNodes={highlightedNodes}
              highlightedEdges={highlightedEdges}
            />
          )}
        </Box>

        {/* Right Sidebar - Details */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={rightDrawerOpen}
          sx={{
            width: 320,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 320,
              boxSizing: 'border-box',
              position: 'relative',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Lineage Details</Typography>
              <IconButton size="small" onClick={() => setRightDrawerOpen(false)}>
                <Close />
              </IconButton>
            </Stack>
            
            {highlightedNodes.length > 0 ? (
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  Showing lineage for {highlightedNodes.length} nodes
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleClearHighlights}
                >
                  Clear Selection
                </Button>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Click an attribute to trace its lineage
              </Typography>
            )}
          </Box>
        </Drawer>
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