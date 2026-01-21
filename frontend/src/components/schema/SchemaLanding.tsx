// frontend/src/components/schema/SchemaLanding.tsx - FIXED async handler type
import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Stack,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Divider,
  alpha,
} from '@mui/material';
import {
  Add,
  Upload,
  Delete,
  Visibility,
  Schema as SchemaIcon,
  DataObject,
  AccountTree,
  CloudUpload,
  FolderOpen,
} from '@mui/icons-material';
import { FileUploader, FileFormat } from '../data/FileUploader';
import { SchemaDefinition } from '../../types';

// FIXED: Change onUploadData to return Promise<void>
interface SchemaLandingProps {
  schemas: SchemaDefinition[];
  onSchemaSelect: (schema: SchemaDefinition) => void;
  onCreateNew: () => void;
  onUploadData: (files: File[], formats: FileFormat[]) => Promise<void>;
  onDeleteSchema: (schemaId: string) => void;
  loading?: boolean;
}

export const SchemaLanding: React.FC<SchemaLandingProps> = ({
  schemas,
  onSchemaSelect,
  onCreateNew,
  onUploadData,
  onDeleteSchema,
  loading = false,
}) => {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [schemaToDelete, setSchemaToDelete] = useState<string | null>(null);

  const handleDeleteClick = useCallback((schemaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSchemaToDelete(schemaId);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (schemaToDelete) {
      onDeleteSchema(schemaToDelete);
      setDeleteDialogOpen(false);
      setSchemaToDelete(null);
    }
  }, [schemaToDelete, onDeleteSchema]);

  // FIXED: Make async to match the prop type
  const handleFileUpload = useCallback(async (files: File[], formats: FileFormat[]) => {
    await onUploadData(files, formats);
    setUploadDialogOpen(false);
  }, [onUploadData]);

  const hasSchemas = schemas.length > 0;

  // Helper function to safely get class count
  const getClassCount = (schema: any) => {
    if (schema.class_count !== undefined) {
      return schema.class_count;
    }
    if (schema.classes && Array.isArray(schema.classes)) {
      return schema.classes.length;
    }
    return 0;
  };

  // Helper function to safely get instance count
  const getInstanceCount = (schema: any) => {
    if (schema.instance_count !== undefined) {
      return schema.instance_count;
    }
    return 0;
  };

  // Helper function to safely get relationship count
  const getRelationshipCount = (schema: any) => {
    if (schema.relationship_count !== undefined) {
      return schema.relationship_count;
    }
    if (schema.relationships && Array.isArray(schema.relationships)) {
      return schema.relationships.length;
    }
    return 0;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ 
        bgcolor: 'primary.main', 
        color: 'primary.contrastText',
        py: 6,
        mb: 4,
      }}>
        <Container maxWidth="lg">
          <Typography variant="h3" gutterBottom fontWeight={600}>
            Data Lineage Visualizer
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9 }}>
            Create schemas, load data, and visualize complex data lineage relationships
          </Typography>
          <Stack direction="row" spacing={2} mt={4}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={onCreateNew}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: alpha('#ffffff', 0.9),
                },
              }}
            >
              Create New Schema
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Upload />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{
                borderColor: 'white',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  bgcolor: alpha('#ffffff', 0.1),
                },
              }}
            >
              Upload Data Files
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="lg">
        {!hasSchemas ? (
          <Paper
            elevation={1}
            sx={{
              p: 6,
              textAlign: 'center',
              border: '2px dashed',
              borderColor: 'divider',
            }}
          >
            <FolderOpen sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              No Schemas Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Get started by creating a schema or uploading data files
            </Typography>

            <Stack direction="row" spacing={2} justifyContent="center" mt={4}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={onCreateNew}
                size="large"
              >
                Create Schema
              </Button>
              <Button
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => setUploadDialogOpen(true)}
                size="large"
              >
                Upload Data
              </Button>
            </Stack>

            {/* Feature Highlights */}
            <Grid container spacing={3} mt={4}>
              <Grid item xs={12} md={4}>
                <Stack spacing={1} alignItems="center">
                  <SchemaIcon fontSize="large" color="primary" />
                  <Typography variant="h6">Hierarchical Classes</Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Create unlimited parent-child class relationships at any depth
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={1} alignItems="center">
                  <DataObject fontSize="large" color="primary" />
                  <Typography variant="h6">Auto Inference</Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Upload multiple files to automatically detect schema with cross-file relationships
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={1} alignItems="center">
                  <AccountTree fontSize="large" color="primary" />
                  <Typography variant="h6">Visual Lineage</Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    Trace data lineage and expand classes to granular attribute level
                  </Typography>
                </Stack>
              </Grid>
            </Grid>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {schemas.map((schema) => (
              <Grid item xs={12} sm={6} md={4} key={schema.id}>
                <Card
                  elevation={2}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6,
                    },
                  }}
                  onClick={() => onSchemaSelect(schema)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="start">
                        <SchemaIcon color="primary" sx={{ fontSize: 40 }} />
                        <IconButton
                          size="small"
                          onClick={(e) => handleDeleteClick(schema.id, e)}
                          sx={{ color: 'text.secondary' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>

                      <Box>
                        <Typography variant="h6" gutterBottom>
                          {schema.name}
                        </Typography>
                        {schema.description && (
                          <Typography variant="body2" color="text.secondary" sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}>
                            {schema.description}
                          </Typography>
                        )}
                      </Box>

                      <Divider />

                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`${getClassCount(schema)} classes`}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${getRelationshipCount(schema)} relationships`}
                          variant="outlined"
                        />
                        {getInstanceCount(schema) > 0 && (
                          <Chip
                            size="small"
                            label={`${getInstanceCount(schema)} instances`}
                            variant="outlined"
                          />
                        )}
                      </Stack>

                      {schema.version && (
                        <Typography variant="caption" color="text.secondary">
                          Version: {schema.version}
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                    <Button
                      size="small"
                      startIcon={<Visibility />}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSchemaSelect(schema);
                      }}
                    >
                      View Lineage
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CloudUpload />
            <Typography variant="h6">Upload Data & Infer Schema</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary" paragraph>
              Upload one or multiple data files (CSV, JSON, XML, or Excel). For multiple files, 
              we'll use FalkorDB to analyze relationships across files and build a unified schema.
            </Typography>
            <FileUploader
              onFileSelect={handleFileUpload}
              acceptedFormats={['csv', 'excel', 'json', 'xml']}
              maxSizeMB={50}
              multiFile={true}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this schema? This action cannot be undone and will remove
            all associated data instances and relationships.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};