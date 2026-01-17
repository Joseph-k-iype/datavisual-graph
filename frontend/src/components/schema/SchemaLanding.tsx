// frontend/src/components/schema/SchemaLanding.tsx - FIXED for multi-file
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

interface SchemaLandingProps {
  schemas: SchemaDefinition[];
  onSchemaSelect: (schema: SchemaDefinition) => void;
  onCreateNew: () => void;
  onUploadData: (files: File[], formats: FileFormat[]) => void;  // FIXED: Arrays
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

  const handleFileUpload = useCallback((files: File[], formats: FileFormat[]) => {
    onUploadData(files, formats);  // FIXED: Pass arrays
    setUploadDialogOpen(false);
  }, [onUploadData]);

  const hasSchemas = schemas.length > 0;

  return (
    <Box
      sx={{
        minHeight: '100%',
        background: (theme) =>
          `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(
            theme.palette.secondary.main,
            0.05
          )} 100%)`,
        py: 6,
      }}
    >
      <Container maxWidth="lg">
        {/* Header */}
        <Stack spacing={4} mb={6}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h3" gutterBottom fontWeight="bold">
                Data Lineage Schemas
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Manage your data lineage schemas and visualize hierarchical relationships
              </Typography>
            </Box>
          </Stack>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              size="large"
              startIcon={<Add />}
              onClick={onCreateNew}
              sx={{ minWidth: 200 }}
            >
              Create New Schema
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<Upload />}
              onClick={() => setUploadDialogOpen(true)}
              sx={{ minWidth: 200 }}
            >
              Upload & Infer Schema
            </Button>
          </Stack>
        </Stack>

        {/* Empty State or Schema Grid */}
        {!hasSchemas && !loading ? (
          <Paper
            elevation={0}
            sx={{
              p: 8,
              textAlign: 'center',
              background: (theme) => alpha(theme.palette.background.paper, 0.6),
              backdropFilter: 'blur(10px)',
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 3,
            }}
          >
            <FolderOpen
              sx={{
                fontSize: 120,
                color: 'text.disabled',
                mb: 3,
              }}
            />
            <Typography variant="h5" gutterBottom fontWeight="medium">
              No Schemas Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Get started by creating a new schema or uploading data to automatically infer the schema structure
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center" mt={4}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                onClick={onCreateNew}
              >
                Create Schema
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<CloudUpload />}
                onClick={() => setUploadDialogOpen(true)}
              >
                Upload Data
              </Button>
            </Stack>

            {/* Feature Highlights */}
            <Grid container spacing={3} mt={6}>
              <Grid item xs={12} md={4}>
                <Stack spacing={1} alignItems="center">
                  <SchemaIcon fontSize="large" color="primary" />
                  <Typography variant="h6">Hierarchical Schemas</Typography>
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
                          sx={{ color: 'error.main' }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>

                      <Box>
                        <Typography variant="h6" gutterBottom fontWeight="bold">
                          {schema.name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            minHeight: 40,
                          }}
                        >
                          {schema.description || 'No description'}
                        </Typography>
                      </Box>

                      <Divider />

                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip
                          size="small"
                          label={`${schema.classes.length} classes`}
                          icon={<DataObject />}
                          variant="outlined"
                        />
                        <Chip
                          size="small"
                          label={`${schema.relationships.length} relations`}
                          icon={<AccountTree />}
                          variant="outlined"
                        />
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