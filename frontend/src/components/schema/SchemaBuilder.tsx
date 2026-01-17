// frontend/src/components/schema/SchemaBuilder.tsx
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Add,
  Delete,
  ExpandMore,
  Save,
  Cancel,
  AccountTree,
  DataObject,
  Link as LinkIcon,
  EditNote,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import { SchemaDefinition, Cardinality } from '../../types';
import apiService from '../../services/api';
import { v4 as uuidv4 } from 'uuid';

interface SchemaBuilderProps {
  inferredSchema?: {
    name: string;
    description: string;
    classes: any[];
    relationships: any[];
    sourceFile?: string;
  } | null;
  onSchemaCreated: (schema: SchemaDefinition) => void;
  onCancel: () => void;
}

interface SchemaClass {
  id: string;
  name: string;
  attributes: string[];
  parent_id?: string;
  level: number;
  children: SchemaClass[];
  metadata?: any;
}

interface SchemaRelationship {
  id: string;
  name: string;
  source_class_id: string;
  target_class_id: string;
  cardinality: Cardinality;
}

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({
  inferredSchema,
  onSchemaCreated,
  onCancel,
}) => {
  const [schemaName, setSchemaName] = useState(inferredSchema?.name || '');
  const [schemaDescription, setSchemaDescription] = useState(inferredSchema?.description || '');
  const [classes, setClasses] = useState<SchemaClass[]>(
    inferredSchema?.classes || []
  );
  const [relationships, setRelationships] = useState<SchemaRelationship[]>(
    inferredSchema?.relationships || []
  );
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchemaClass | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newAttributes, setNewAttributes] = useState<string[]>(['']);
  const [parentClassId, setParentClassId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Relationship form state
  const [relationshipForm, setRelationshipForm] = useState({
    name: '',
    source_class_id: '',
    target_class_id: '',
    cardinality: Cardinality.ONE_TO_MANY,
  });

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

  const handleAddClass = useCallback(() => {
    setEditingClass(null);
    setNewClassName('');
    setNewAttributes(['']);
    setParentClassId('');
    setClassDialogOpen(true);
  }, []);

  const handleEditClass = useCallback((classId: string) => {
    const cls = findClassById(classId);
    if (cls) {
      setEditingClass(cls);
      setNewClassName(cls.name);
      setNewAttributes(cls.attributes.length > 0 ? cls.attributes : ['']);
      setParentClassId(cls.parent_id || '');
      setClassDialogOpen(true);
    }
  }, [findClassById]);

  const handleSaveClass = useCallback(() => {
    if (!newClassName.trim()) return;

    const filteredAttributes = newAttributes.filter(attr => attr.trim() !== '');
    
    if (editingClass) {
      // Update existing class
      const updateClass = (classList: SchemaClass[]): SchemaClass[] => {
        return classList.map((cls) => {
          if (cls.id === editingClass.id) {
            return {
              ...cls,
              name: newClassName,
              attributes: filteredAttributes,
            };
          }
          return {
            ...cls,
            children: updateClass(cls.children),
          };
        });
      };
      setClasses(updateClass(classes));
    } else {
      // Add new class
      const newClass: SchemaClass = {
        id: uuidv4(),
        name: newClassName,
        attributes: filteredAttributes,
        parent_id: parentClassId || undefined,
        level: 0,
        children: [],
      };

      if (parentClassId) {
        // Add as child
        const addChild = (classList: SchemaClass[]): SchemaClass[] => {
          return classList.map((cls) => {
            if (cls.id === parentClassId) {
              newClass.level = cls.level + 1;
              return {
                ...cls,
                children: [...cls.children, newClass],
              };
            }
            return {
              ...cls,
              children: addChild(cls.children),
            };
          });
        };
        setClasses(addChild(classes));
      } else {
        // Add as root
        setClasses([...classes, newClass]);
      }
    }

    setClassDialogOpen(false);
  }, [editingClass, newClassName, newAttributes, parentClassId, classes]);

  const handleDeleteClass = useCallback((classId: string) => {
    const deleteClass = (classList: SchemaClass[]): SchemaClass[] => {
      return classList
        .filter((cls) => cls.id !== classId)
        .map((cls) => ({
          ...cls,
          children: deleteClass(cls.children),
        }));
    };

    setClasses(deleteClass(classes));
    
    // Remove relationships involving this class
    setRelationships(
      relationships.filter(
        (rel) => rel.source_class_id !== classId && rel.target_class_id !== classId
      )
    );
  }, [classes, relationships]);

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
    if (!relationshipForm.source_class_id || !relationshipForm.target_class_id) return;

    const newRelationship: SchemaRelationship = {
      id: uuidv4(),
      name: relationshipForm.name || 'related to',
      source_class_id: relationshipForm.source_class_id,
      target_class_id: relationshipForm.target_class_id,
      cardinality: relationshipForm.cardinality,
    };

    setRelationships([...relationships, newRelationship]);
    setRelationshipDialogOpen(false);
  }, [relationshipForm, relationships]);

  const handleDeleteRelationship = useCallback((relationshipId: string) => {
    setRelationships(relationships.filter((rel) => rel.id !== relationshipId));
  }, [relationships]);

  const handleSaveSchema = useCallback(async () => {
    if (!schemaName.trim()) {
      alert('Please provide a schema name');
      return;
    }

    if (classes.length === 0) {
      alert('Please add at least one class');
      return;
    }

    try {
      setSaving(true);

      const flatClasses = flattenClasses(classes);

      const schemaRequest = {
        name: schemaName,
        description: schemaDescription,
        classes: flatClasses.map((cls) => ({
          id: cls.id,
          name: cls.name,
          attributes: cls.attributes,
          metadata: {
            parent_id: cls.parent_id,
            level: cls.level,
          },
        })),
        relationships: relationships.map((rel) => ({
          id: rel.id,
          name: rel.name,
          source_class_id: rel.source_class_id,
          target_class_id: rel.target_class_id,
          cardinality: rel.cardinality,
        })),
      };

      const createdSchema = await apiService.createSchema(schemaRequest);
      onSchemaCreated(createdSchema);
    } catch (error: any) {
      alert(error.response?.data?.detail || 'Failed to create schema');
      console.error(error);
    } finally {
      setSaving(false);
    }
  }, [schemaName, schemaDescription, classes, relationships, flattenClasses, onSchemaCreated]);

  const handleAttributeChange = useCallback((index: number, value: string) => {
    const updated = [...newAttributes];
    updated[index] = value;
    setNewAttributes(updated);
  }, [newAttributes]);

  const handleAddAttribute = useCallback(() => {
    setNewAttributes([...newAttributes, '']);
  }, [newAttributes]);

  const handleRemoveAttribute = useCallback((index: number) => {
    setNewAttributes(newAttributes.filter((_, i) => i !== index));
  }, [newAttributes]);

  const renderClassTree = useCallback((classList: SchemaClass[]) => {
    return classList.map((cls) => (
      <TreeItem
        key={cls.id}
        nodeId={cls.id}
        label={
          <Stack direction="row" alignItems="center" spacing={1} py={0.5}>
            <DataObject fontSize="small" />
            <Typography variant="body2">{cls.name}</Typography>
            <Chip size="small" label={`${cls.attributes.length} attrs`} />
            <Box sx={{ flexGrow: 1 }} />
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEditClass(cls.id); }}>
              <EditNote fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls.id); }}
              sx={{ color: 'error.main' }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Stack>
        }
      >
        {cls.children.length > 0 && renderClassTree(cls.children)}
      </TreeItem>
    ));
  }, [handleEditClass, handleDeleteClass]);

  const allFlatClasses = flattenClasses(classes);

  return (
    <Box
      sx={{
        minHeight: '100%',
        background: (theme) => alpha(theme.palette.background.default, 0.95),
        py: 4,
      }}
    >
      <Container maxWidth="xl">
        <Stack spacing={4}>
          {/* Header */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h4" fontWeight="bold">
                {inferredSchema ? 'Review & Customize Inferred Schema' : 'Create New Schema'}
              </Typography>
              {inferredSchema?.sourceFile && (
                <Chip
                  icon={<CheckCircle />}
                  label={`Inferred from: ${inferredSchema.sourceFile}`}
                  color="success"
                  variant="outlined"
                />
              )}
              <TextField
                fullWidth
                label="Schema Name"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label="Description"
                value={schemaDescription}
                onChange={(e) => setSchemaDescription(e.target.value)}
                multiline
                rows={2}
              />
            </Stack>
          </Paper>

          {/* Main Content */}
          <Grid container spacing={3}>
            {/* Classes Section */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '600px', overflow: 'auto' }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                      <AccountTree sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Class Hierarchy
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add />}
                      onClick={handleAddClass}
                    >
                      Add Class
                    </Button>
                  </Stack>

                  <Divider />

                  {classes.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <DataObject sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No classes defined yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Add classes to build your schema hierarchy
                      </Typography>
                    </Box>
                  ) : (
                    <TreeView
                      defaultCollapseIcon={<ExpandMore />}
                      defaultExpandIcon={<ExpandMore style={{ transform: 'rotate(-90deg)' }} />}
                    >
                      {renderClassTree(classes)}
                    </TreeView>
                  )}
                </Stack>
              </Paper>
            </Grid>

            {/* Relationships Section */}
            <Grid item xs={12} md={6}>
              <Paper elevation={2} sx={{ p: 3, height: '600px', overflow: 'auto' }}>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">
                      <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Relationships
                    </Typography>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<Add />}
                      onClick={handleAddRelationship}
                      disabled={allFlatClasses.length < 2}
                    >
                      Add Relationship
                    </Button>
                  </Stack>

                  <Divider />

                  {relationships.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 6 }}>
                      <LinkIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="body1" color="text.secondary">
                        No relationships defined yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Link classes together to show their connections
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={2}>
                      {relationships.map((rel) => {
                        const sourceClass = findClassById(rel.source_class_id);
                        const targetClass = findClassById(rel.target_class_id);
                        return (
                          <Card key={rel.id} variant="outlined">
                            <CardContent>
                              <Stack spacing={1}>
                                <Typography variant="subtitle2">{rel.name}</Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Chip size="small" label={sourceClass?.name} />
                                  <Typography variant="caption">→</Typography>
                                  <Chip size="small" label={targetClass?.name} />
                                </Stack>
                                <Chip
                                  size="small"
                                  label={rel.cardinality}
                                  variant="outlined"
                                  sx={{ width: 'fit-content' }}
                                />
                              </Stack>
                            </CardContent>
                            <CardActions>
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteRelationship(rel.id)}
                                sx={{ color: 'error.main' }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </CardActions>
                          </Card>
                        );
                      })}
                    </Stack>
                  )}
                </Stack>
              </Paper>
            </Grid>
          </Grid>

          {/* Action Buttons */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack direction="row" spacing={2}>
                <Chip icon={<DataObject />} label={`${allFlatClasses.length} classes`} />
                <Chip icon={<LinkIcon />} label={`${relationships.length} relationships`} />
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  startIcon={<Cancel />}
                  onClick={onCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveSchema}
                  disabled={saving || !schemaName || classes.length === 0}
                >
                  {saving ? 'Creating...' : 'Create Schema'}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Stack>
      </Container>

      {/* Class Dialog */}
      <Dialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Class Name"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              required
            />

            {!editingClass && (
              <FormControl fullWidth>
                <InputLabel>Parent Class (Optional)</InputLabel>
                <Select
                  value={parentClassId}
                  onChange={(e) => setParentClassId(e.target.value)}
                  label="Parent Class (Optional)"
                >
                  <MenuItem value="">None (Root Level)</MenuItem>
                  {allFlatClasses.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id}>
                      {cls.name} (Level {cls.level})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Divider />

            <Typography variant="subtitle2">Attributes</Typography>
            {newAttributes.map((attr, index) => (
              <Stack key={index} direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Attribute ${index + 1}`}
                  value={attr}
                  onChange={(e) => handleAttributeChange(index, e.target.value)}
                />
                <IconButton
                  size="small"
                  onClick={() => handleRemoveAttribute(index)}
                  disabled={newAttributes.length === 1}
                >
                  <Delete />
                </IconButton>
              </Stack>
            ))}
            <Button size="small" startIcon={<Add />} onClick={handleAddAttribute}>
              Add Attribute
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveClass} variant="contained" disabled={!newClassName.trim()}>
            {editingClass ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Relationship Dialog */}
      <Dialog open={relationshipDialogOpen} onClose={() => setRelationshipDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Relationship</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Relationship Name"
              value={relationshipForm.name}
              onChange={(e) => setRelationshipForm({ ...relationshipForm, name: e.target.value })}
              placeholder="e.g., has, contains, belongs to"
            />

            <FormControl fullWidth required>
              <InputLabel>Source Class</InputLabel>
              <Select
                value={relationshipForm.source_class_id}
                onChange={(e) => setRelationshipForm({ ...relationshipForm, source_class_id: e.target.value })}
                label="Source Class"
              >
                {allFlatClasses.map((cls) => (
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
                onChange={(e) => setRelationshipForm({ ...relationshipForm, target_class_id: e.target.value })}
                label="Target Class"
              >
                {allFlatClasses.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Cardinality</InputLabel>
              <Select
                value={relationshipForm.cardinality}
                onChange={(e) => setRelationshipForm({ ...relationshipForm, cardinality: e.target.value as Cardinality })}
                label="Cardinality"
              >
                <MenuItem value={Cardinality.ONE_TO_ONE}>One to One (1:1)</MenuItem>
                <MenuItem value={Cardinality.ONE_TO_MANY}>One to Many (1:N)</MenuItem>
                <MenuItem value={Cardinality.MANY_TO_ONE}>Many to One (N:1)</MenuItem>
                <MenuItem value={Cardinality.MANY_TO_MANY}>Many to Many (N:M)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelationshipDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSaveRelationship}
            variant="contained"
            disabled={!relationshipForm.source_class_id || !relationshipForm.target_class_id}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};