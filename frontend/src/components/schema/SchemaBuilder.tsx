// frontend/src/components/schema/SchemaBuilder.tsx
// COMPLETE VERSION WITH VISIBLE RELATIONSHIP/EDGE CREATION

import React, { useState, useCallback } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Stack,
  Chip,
  Divider,
  Card,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Delete,
  Save,
  Cancel,
  AccountTree,
  Link as LinkIcon,
  ArrowForward,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import apiService from '../../services/api';
import { Cardinality } from '../../types';

// ============================================
// INTERFACES
// ============================================

interface SchemaClass {
  id: string;
  name: string;
  attributes: Attribute[];
  parent_id?: string;
  level: number;
  children: SchemaClass[];
  metadata?: any;
}

interface Attribute {
  id: string;
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  is_nullable?: boolean;
  metadata?: any;
}

interface SchemaRelationship {
  id: string;
  name: string;
  source_class_id: string;
  target_class_id: string;
  cardinality: Cardinality;
}

interface SchemaBuilderProps {
  inferredSchema?: {
    name: string;
    description: string;
    classes: any[];
    relationships: any[];
  } | null;
  onSchemaCreated: (schema: any) => void;
  onCancel: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({
  inferredSchema,
  onSchemaCreated,
  onCancel,
}) => {
  const [schemaName, setSchemaName] = useState(inferredSchema?.name || '');
  const [schemaDescription, setSchemaDescription] = useState(inferredSchema?.description || '');
  const [classes, setClasses] = useState<SchemaClass[]>(inferredSchema?.classes || []);
  const [relationships, setRelationships] = useState<SchemaRelationship[]>(
    inferredSchema?.relationships || []
  );
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchemaClass | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newAttributes, setNewAttributes] = useState<Attribute[]>([]);
  const [parentClassId, setParentClassId] = useState<string>('');
  const [inheritAttributes, setInheritAttributes] = useState(true);

  // Relationship form state
  const [relationshipForm, setRelationshipForm] = useState({
    name: '',
    source_class_id: '',
    target_class_id: '',
    cardinality: Cardinality.ONE_TO_MANY,
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const findClassById = useCallback((id: string, classList: SchemaClass[] = classes): SchemaClass | null => {
    for (const cls of classList) {
      if (cls.id === id) return cls;
      const found = findClassById(id, cls.children);
      if (found) return found;
    }
    return null;
  }, [classes]);

  const flattenClasses = useCallback((classList: SchemaClass[]): SchemaClass[] => {
    const result: SchemaClass[] = [];
    const flatten = (items: SchemaClass[]) => {
      items.forEach((item) => {
        result.push(item);
        if (item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    flatten(classList);
    return result;
  }, []);

  const createDefaultAttribute = (): Attribute => ({
    id: uuidv4(),
    name: '',
    data_type: 'string',
    is_primary_key: false,
    is_foreign_key: false,
    is_nullable: true,
  });

  // ============================================
  // CLASS HANDLERS
  // ============================================

  const handleAddClass = useCallback(() => {
    setEditingClass(null);
    setNewClassName('');
    setNewAttributes([createDefaultAttribute()]);
    setParentClassId('');
    setInheritAttributes(true);
    setClassDialogOpen(true);
  }, []);

  const handleSaveClass = useCallback(() => {
    if (!newClassName.trim()) {
      alert('Class name is required');
      return;
    }

    const filteredAttributes = newAttributes.filter((attr) => attr.name.trim() !== '');

    if (editingClass) {
      const updateClass = (classList: SchemaClass[]): SchemaClass[] => {
        return classList.map((cls) => {
          if (cls.id === editingClass.id) {
            return {
              ...cls,
              name: newClassName,
              attributes: filteredAttributes,
              parent_id: parentClassId || undefined,
              level: parentClassId ? (findClassById(parentClassId)?.level || 0) + 1 : 0,
            };
          }
          if (cls.children.length > 0) {
            return {
              ...cls,
              children: updateClass(cls.children),
            };
          }
          return cls;
        });
      };

      setClasses(updateClass(classes));
    } else {
      const newClass: SchemaClass = {
        id: uuidv4(),
        name: newClassName,
        attributes: filteredAttributes,
        parent_id: parentClassId || undefined,
        level: parentClassId ? (findClassById(parentClassId)?.level || 0) + 1 : 0,
        children: [],
        metadata: {
          level: parentClassId ? (findClassById(parentClassId)?.level || 0) + 1 : 0,
          parent_id: parentClassId || undefined,
          inherit_attributes: inheritAttributes,
        },
      };

      if (parentClassId) {
        const addToParent = (classList: SchemaClass[]): SchemaClass[] => {
          return classList.map((cls) => {
            if (cls.id === parentClassId) {
              return {
                ...cls,
                children: [...cls.children, newClass],
              };
            }
            if (cls.children.length > 0) {
              return {
                ...cls,
                children: addToParent(cls.children),
              };
            }
            return cls;
          });
        };

        setClasses(addToParent(classes));
      } else {
        setClasses([...classes, newClass]);
      }
    }

    setClassDialogOpen(false);
    setNewClassName('');
    setNewAttributes([]);
    setParentClassId('');
    setEditingClass(null);
  }, [
    newClassName,
    newAttributes,
    parentClassId,
    inheritAttributes,
    editingClass,
    classes,
    findClassById,
  ]);

  const handleDeleteClass = useCallback((classId: string) => {
    if (!confirm('Delete this class and all its subclasses?')) return;

    const deleteFromTree = (classList: SchemaClass[]): SchemaClass[] => {
      return classList
        .filter((cls) => cls.id !== classId)
        .map((cls) => ({
          ...cls,
          children: deleteFromTree(cls.children),
        }));
    };

    setClasses(deleteFromTree(classes));
    setRelationships(
      relationships.filter(
        (rel) => rel.source_class_id !== classId && rel.target_class_id !== classId
      )
    );
  }, [classes, relationships]);

  // ============================================
  // RELATIONSHIP HANDLERS
  // ============================================

  const handleAddRelationship = useCallback(() => {
    setRelationshipForm({
      name: '',
      source_class_id: '',
      target_class_id: '',
      cardinality: Cardinality.ONE_TO_MANY,
    });
    setRelationshipDialogOpen(true);
  }, []);

  const handleSaveRelationship = useCallback(() => {
    if (!relationshipForm.name.trim() || !relationshipForm.source_class_id || !relationshipForm.target_class_id) {
      alert('All fields are required');
      return;
    }

    if (relationshipForm.source_class_id === relationshipForm.target_class_id) {
      alert('Source and target classes must be different');
      return;
    }

    const newRelationship: SchemaRelationship = {
      id: uuidv4(),
      name: relationshipForm.name,
      source_class_id: relationshipForm.source_class_id,
      target_class_id: relationshipForm.target_class_id,
      cardinality: relationshipForm.cardinality,
    };

    setRelationships([...relationships, newRelationship]);
    setRelationshipDialogOpen(false);
  }, [relationshipForm, relationships]);

  const handleDeleteRelationship = useCallback((relationshipId: string) => {
    if (!confirm('Delete this relationship?')) return;
    setRelationships(relationships.filter((rel) => rel.id !== relationshipId));
  }, [relationships]);

  // ============================================
  // SCHEMA CREATION
  // ============================================

  const handleCreateSchema = async () => {
    if (!schemaName.trim()) {
      alert('Schema name is required');
      return;
    }

    if (flattenClasses(classes).length === 0) {
      alert('At least one class is required');
      return;
    }

    setSaving(true);

    try {
      console.log('🚀 Creating schema with hierarchy...');

      const rootClasses = classes.filter((cls) => !cls.parent_id);
      const allClasses = flattenClasses(classes);

      const schemaPayload = {
        name: schemaName,
        description: schemaDescription,
        classes: rootClasses.map((cls) => ({
          id: cls.id,
          name: cls.name,
          attributes: cls.attributes,
          metadata: cls.metadata,
        })),
        relationships: relationships,
      };

      console.log('📝 Creating schema with root classes:', schemaPayload);
      const createdSchema = await apiService.createSchema(schemaPayload);
      console.log('✅ Schema created:', createdSchema);

      const subclassesToCreate = allClasses.filter((cls) => cls.parent_id);

      for (const subclass of subclassesToCreate) {
        console.log(`➕ Creating subclass: ${subclass.name} under parent: ${subclass.parent_id}`);

        const createSubclassRequest = {
          parent_class_id: subclass.parent_id!,
          name: subclass.name,
          display_name: subclass.name,
          description: subclass.metadata?.description || '',
          inherit_attributes: subclass.metadata?.inherit_attributes !== false,
          additional_attributes: subclass.attributes,
          metadata: subclass.metadata || {},
        };

        try {
          const createdSubclass = await apiService.createSubclass(
            createdSchema.id,
            createSubclassRequest
          );
          console.log('✅ Subclass created:', createdSubclass);
        } catch (error) {
          console.error(`❌ Failed to create subclass ${subclass.name}:`, error);
          throw error;
        }
      }

      console.log('✅ Schema with full hierarchy created successfully!');
      alert('Schema created successfully with all subclasses!');
      onSchemaCreated(createdSchema);
    } catch (error: any) {
      console.error('❌ Error creating schema:', error);
      
      // Better error message extraction
      let errorMessage = 'Unknown error';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (Array.isArray(detail)) {
          // Pydantic validation errors
          errorMessage = detail.map((e: any) => {
            const loc = e.loc ? e.loc.join(' -> ') : '';
            return `${loc}: ${e.msg || e}`;
          }).join('\n');
        } else {
          errorMessage = detail;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Error creating schema:\n${errorMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={2} mb={2}>
            <AccountTree color="primary" fontSize="large" />
            <Typography variant="h4" fontWeight={600}>
              Schema Builder
            </Typography>
          </Stack>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Schema Name"
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              required
              variant="outlined"
            />
            <TextField
              fullWidth
              label="Description"
              value={schemaDescription}
              onChange={(e) => setSchemaDescription(e.target.value)}
              multiline
              rows={2}
              variant="outlined"
            />
          </Stack>
        </Paper>

        {/* Classes and Relationships Grid */}
        <Grid container spacing={3}>
          {/* Classes Section */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Classes ({flattenClasses(classes).length})
                </Typography>
                <Button variant="contained" startIcon={<Add />} onClick={handleAddClass}>
                  Add Class
                </Button>
              </Stack>

              {classes.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <AccountTree sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No classes defined yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Classes are the building blocks of your schema
                  </Typography>
                  <Button variant="outlined" startIcon={<Add />} onClick={handleAddClass}>
                    Add Your First Class
                  </Button>
                </Box>
              ) : (
                <Stack spacing={1.5} sx={{ maxHeight: 500, overflowY: 'auto' }}>
                  {flattenClasses(classes).map((cls) => (
                    <Card key={cls.id} variant="outlined">
                      <CardContent sx={{ pb: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Stack spacing={0.5} flex={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle1" fontWeight={600}>
                                {cls.name}
                              </Typography>
                              {cls.level > 0 && (
                                <Chip size="small" label={`Level ${cls.level}`} color="info" />
                              )}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">
                              {cls.attributes.length} attribute{cls.attributes.length !== 1 ? 's' : ''}
                            </Typography>
                          </Stack>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteClass(cls.id)}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>

          {/* Relationships Section */}
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6" fontWeight={600}>
                  Relationships / Edges ({relationships.length})
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleAddRelationship}
                  disabled={flattenClasses(classes).length < 2}
                >
                  Add Edge
                </Button>
              </Stack>

              {flattenClasses(classes).length < 2 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <LinkIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    Add at least 2 classes first
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Relationships connect your classes together
                  </Typography>
                </Box>
              ) : relationships.length === 0 ? (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 6,
                    border: '2px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <LinkIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    No relationships defined yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Connect your classes with relationships
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Add />}
                    onClick={handleAddRelationship}
                  >
                    Add First Relationship
                  </Button>
                </Box>
              ) : (
                <Stack spacing={1.5} sx={{ maxHeight: 500, overflowY: 'auto' }}>
                  {relationships.map((rel) => {
                    const sourceClass = findClassById(rel.source_class_id);
                    const targetClass = findClassById(rel.target_class_id);

                    return (
                      <Card key={rel.id} variant="outlined">
                        <CardContent sx={{ pb: 1 }}>
                          <Stack spacing={1}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                              <Typography variant="subtitle1" fontWeight={600}>
                                {rel.name}
                              </Typography>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteRelationship(rel.id)}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Chip
                                label={sourceClass?.name || 'Unknown'}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                              <ArrowForward fontSize="small" color="action" />
                              <Chip
                                label={targetClass?.name || 'Unknown'}
                                size="small"
                                color="secondary"
                                variant="outlined"
                              />
                            </Stack>
                            <Chip
                              label={rel.cardinality}
                              size="small"
                              variant="filled"
                              sx={{ width: 'fit-content' }}
                            />
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>

        {/* Actions */}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={onCancel}
              disabled={saving}
              size="large"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? undefined : <Save />}
              onClick={handleCreateSchema}
              disabled={saving || !schemaName.trim() || flattenClasses(classes).length === 0}
              size="large"
            >
              {saving ? 'Creating...' : 'Create Schema'}
            </Button>
          </Stack>
        </Paper>
      </Stack>

      {/* Class Dialog */}
      <Dialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Class Name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              required
            />

            <FormControl fullWidth>
              <InputLabel>Parent Class (Optional)</InputLabel>
              <Select
                value={parentClassId}
                onChange={(e) => setParentClassId(e.target.value)}
                label="Parent Class (Optional)"
              >
                <MenuItem value="">
                  <em>None (Root Level)</em>
                </MenuItem>
                {flattenClasses(classes)
                  .filter((c) => !editingClass || c.id !== editingClass.id)
                  .map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      {cls.name} (Level {cls.level})
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>

            {parentClassId && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={inheritAttributes}
                    onChange={(e) => setInheritAttributes(e.target.checked)}
                  />
                }
                label="Inherit parent attributes"
              />
            )}

            <Divider />

            <Typography variant="subtitle2" fontWeight={600}>
              Attributes
            </Typography>

            {newAttributes.map((attr, index) => (
              <Stack key={attr.id} direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Name"
                  value={attr.name}
                  onChange={(e) => {
                    const updated = [...newAttributes];
                    updated[index] = { ...attr, name: e.target.value };
                    setNewAttributes(updated);
                  }}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <TextField
                  select
                  label="Type"
                  value={attr.data_type}
                  onChange={(e) => {
                    const updated = [...newAttributes];
                    updated[index] = { ...attr, data_type: e.target.value };
                    setNewAttributes(updated);
                  }}
                  size="small"
                  sx={{ width: 120 }}
                >
                  <MenuItem value="string">String</MenuItem>
                  <MenuItem value="integer">Integer</MenuItem>
                  <MenuItem value="float">Float</MenuItem>
                  <MenuItem value="boolean">Boolean</MenuItem>
                  <MenuItem value="date">Date</MenuItem>
                </TextField>
                <IconButton
                  onClick={() => {
                    setNewAttributes(newAttributes.filter((_, i) => i !== index));
                  }}
                  disabled={newAttributes.length === 1}
                  size="small"
                >
                  <Delete />
                </IconButton>
              </Stack>
            ))}

            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={() => setNewAttributes([...newAttributes, createDefaultAttribute()])}
            >
              Add Attribute
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveClass} variant="contained">
            Save Class
          </Button>
        </DialogActions>
      </Dialog>

      {/* Relationship Dialog */}
      <Dialog
        open={relationshipDialogOpen}
        onClose={() => setRelationshipDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LinkIcon />
            <Typography variant="h6">Add Relationship / Edge</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Relationship Name"
              value={relationshipForm.name}
              onChange={(e) =>
                setRelationshipForm({ ...relationshipForm, name: e.target.value })
              }
              required
              placeholder="e.g., owns, contains, manages"
            />

            <FormControl fullWidth required>
              <InputLabel>Source Class</InputLabel>
              <Select
                value={relationshipForm.source_class_id}
                onChange={(e) =>
                  setRelationshipForm({
                    ...relationshipForm,
                    source_class_id: e.target.value,
                  })
                }
                label="Source Class"
              >
                {flattenClasses(classes).map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Target Class</InputLabel>
              <Select
                value={relationshipForm.target_class_id}
                onChange={(e) =>
                  setRelationshipForm({
                    ...relationshipForm,
                    target_class_id: e.target.value,
                  })
                }
                label="Target Class"
              >
                {flattenClasses(classes).map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel>Cardinality</InputLabel>
              <Select
                value={relationshipForm.cardinality}
                onChange={(e) =>
                  setRelationshipForm({
                    ...relationshipForm,
                    cardinality: e.target.value as Cardinality,
                  })
                }
                label="Cardinality"
              >
                <MenuItem value={Cardinality.ONE_TO_ONE}>1:1 (One to One)</MenuItem>
                <MenuItem value={Cardinality.ONE_TO_MANY}>1:N (One to Many)</MenuItem>
                <MenuItem value={Cardinality.MANY_TO_ONE}>N:1 (Many to One)</MenuItem>
                <MenuItem value={Cardinality.MANY_TO_MANY}>N:M (Many to Many)</MenuItem>
              </Select>
            </FormControl>

            <Box
              sx={{
                p: 2,
                bgcolor: 'info.50',
                borderRadius: 1,
                border: 1,
                borderColor: 'info.main',
              }}
            >
              <Typography variant="body2" color="info.dark">
                <strong>Preview:</strong> {relationshipForm.source_class_id && relationshipForm.target_class_id
                  ? `${findClassById(relationshipForm.source_class_id)?.name || '?'} → ${findClassById(relationshipForm.target_class_id)?.name || '?'}`
                  : 'Select classes to preview'}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelationshipDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveRelationship}
            variant="contained"
            disabled={
              !relationshipForm.name.trim() ||
              !relationshipForm.source_class_id ||
              !relationshipForm.target_class_id
            }
          >
            Add Relationship
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};