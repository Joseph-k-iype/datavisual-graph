// frontend/src/components/schema/SchemaBuilder.tsx
// ✅ FULLY FIXED: Preserves all features, fixes schema creation flow

import React, { useState } from 'react';
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
    CircularProgress,
    Alert,
    Tooltip,
    Badge,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
    Add,
    Delete,
    Edit,
    Save,
    Cancel,
    AccountTree,
    Link as LinkIcon,
    ArrowForward,
    Check,
    ExpandMore,
    ChevronRight,
    TableChart,
    AddCircleOutline,
    Schema,
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
// HELPER FUNCTIONS
// ============================================

const flattenClasses = (classes: SchemaClass[]): SchemaClass[] => {
    const result: SchemaClass[] = [];
    const flatten = (cls: SchemaClass) => {
        result.push(cls);
        cls.children.forEach(flatten);
    };
    classes.forEach(flatten);
    return result;
};

const findClassById = (classes: SchemaClass[], id: string): SchemaClass | null => {
    for (const cls of classes) {
        if (cls.id === id) return cls;
        const found = findClassById(cls.children, id);
        if (found) return found;
    }
    return null;
};

const countSubclasses = (cls: SchemaClass): number => {
    let count = cls.children.length;
    cls.children.forEach(child => {
        count += countSubclasses(child);
    });
    return count;
};

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
    const [classes, setClasses] = useState<SchemaClass[]>(
        inferredSchema?.classes?.map((cls: any) => ({
            ...cls,
            id: cls.id || uuidv4(),
            level: cls.level || 0,
            children: cls.children || [],
            attributes: cls.attributes?.map((attr: any) => 
                typeof attr === 'string' ? {
                    id: uuidv4(),
                    name: attr,
                    data_type: 'string',
                    is_primary_key: false,
                    is_foreign_key: false,
                    is_nullable: true,
                    metadata: {}
                } : {
                    id: attr.id || uuidv4(),
                    name: attr.name,
                    data_type: attr.data_type || 'string',
                    is_primary_key: attr.is_primary_key || false,
                    is_foreign_key: attr.is_foreign_key || false,
                    is_nullable: attr.is_nullable !== false,
                    metadata: attr.metadata || {}
                }
            ) || []
        })) || []
    );
    const [relationships, setRelationships] = useState<SchemaRelationship[]>(
        inferredSchema?.relationships?.map((rel: any) => ({
            ...rel,
            id: rel.id || uuidv4()
        })) || []
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dialog states
    const [classDialogOpen, setClassDialogOpen] = useState(false);
    const [subclassDialogOpen, setSubclassDialogOpen] = useState(false);
    const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<SchemaClass | null>(null);
    const [editingRelationship, setEditingRelationship] = useState<SchemaRelationship | null>(null);
    const [parentClassForSubclass, setParentClassForSubclass] = useState<SchemaClass | null>(null);

    // Form states
    const [className, setClassName] = useState('');
    const [classAttributes, setClassAttributes] = useState<Attribute[]>([]);
    const [newAttributeName, setNewAttributeName] = useState('');
    const [newAttributeType, setNewAttributeType] = useState('string');

    // Subclass form states
    const [subclassName, setSubclassName] = useState('');
    const [inheritAttributes, setInheritAttributes] = useState(true);
    const [subclassAttributes, setSubclassAttributes] = useState<Attribute[]>([]);

    const [relationshipName, setRelationshipName] = useState('');
    const [relationshipSource, setRelationshipSource] = useState('');
    const [relationshipTarget, setRelationshipTarget] = useState('');
    const [relationshipCardinality, setRelationshipCardinality] = useState<Cardinality>(Cardinality.ONE_TO_MANY);

    // ============================================
    // CLASS MANAGEMENT
    // ============================================

    const handleAddRootClass = () => {
        setEditingClass(null);
        setClassName('');
        setClassAttributes([]);
        setClassDialogOpen(true);
    };

    const handleEditClass = (cls: SchemaClass) => {
        setEditingClass(cls);
        setClassName(cls.name);
        setClassAttributes([...cls.attributes]);
        setClassDialogOpen(true);
    };

    const handleSaveClass = () => {
        if (!className.trim()) {
            alert('Class name is required');
            return;
        }

        if (editingClass) {
            const updateClass = (classList: SchemaClass[]): SchemaClass[] => {
                return classList.map(cls => {
                    if (cls.id === editingClass.id) {
                        return { 
                            ...cls, 
                            name: className, 
                            attributes: [...classAttributes] 
                        };
                    }
                    if (cls.children.length > 0) {
                        return { ...cls, children: updateClass(cls.children) };
                    }
                    return cls;
                });
            };

            setClasses(updateClass(classes));
        } else {
            const newClass: SchemaClass = {
                id: uuidv4(),
                name: className,
                attributes: [...classAttributes],
                level: 0,
                children: [],
                metadata: {},
            };
            setClasses([...classes, newClass]);
        }

        setClassDialogOpen(false);
        setClassName('');
        setClassAttributes([]);
    };

    const handleDeleteClass = (classId: string) => {
        const cls = findClassById(classes, classId);
        const subclassCount = cls ? countSubclasses(cls) : 0;
        
        const message = subclassCount > 0 
            ? `This will delete the class and ${subclassCount} subclass(es). Are you sure?`
            : 'Are you sure you want to delete this class?';
            
        if (!confirm(message)) return;

        const deleteClass = (classList: SchemaClass[]): SchemaClass[] => {
            return classList
                .filter(cls => cls.id !== classId)
                .map(cls => ({
                    ...cls,
                    children: deleteClass(cls.children)
                }));
        };

        setClasses(deleteClass(classes));
        setRelationships(relationships.filter(
            rel => rel.source_class_id !== classId && rel.target_class_id !== classId
        ));
    };

    // ============================================
    // SUBCLASS MANAGEMENT
    // ============================================

    const handleAddSubclass = (parentClass: SchemaClass) => {
        setParentClassForSubclass(parentClass);
        setSubclassName('');
        setInheritAttributes(true);
        setSubclassAttributes([]);
        setSubclassDialogOpen(true);
    };

    const handleSaveSubclass = () => {
        if (!subclassName.trim() || !parentClassForSubclass) {
            alert('Subclass name is required');
            return;
        }

        const newSubclass: SchemaClass = {
            id: uuidv4(),
            name: subclassName,
            attributes: [...subclassAttributes],
            parent_id: parentClassForSubclass.id,
            level: parentClassForSubclass.level + 1,
            children: [],
            metadata: { inherit_attributes: inheritAttributes },
        };

        const addClass = (classList: SchemaClass[]): SchemaClass[] => {
            return classList.map(cls => {
                if (cls.id === parentClassForSubclass.id) {
                    return { ...cls, children: [...cls.children, newSubclass] };
                }
                if (cls.children.length > 0) {
                    return { ...cls, children: addClass(cls.children) };
                }
                return cls;
            });
        };

        setClasses(addClass(classes));
        setSubclassDialogOpen(false);
        setParentClassForSubclass(null);
    };

    // ============================================
    // ATTRIBUTE MANAGEMENT
    // ============================================

    const handleAddAttribute = (attributeList: Attribute[], setAttributeList: (attrs: Attribute[]) => void) => {
        if (!newAttributeName.trim()) {
            alert('Attribute name is required');
            return;
        }

        const newAttribute: Attribute = {
            id: uuidv4(),
            name: newAttributeName,
            data_type: newAttributeType,
            is_primary_key: false,
            is_foreign_key: false,
            is_nullable: true,
            metadata: {},
        };

        setAttributeList([...attributeList, newAttribute]);
        setNewAttributeName('');
        setNewAttributeType('string');
    };

    const handleDeleteAttribute = (attributeId: string, attributeList: Attribute[], setAttributeList: (attrs: Attribute[]) => void) => {
        setAttributeList(attributeList.filter(attr => attr.id !== attributeId));
    };

    // ============================================
    // RELATIONSHIP MANAGEMENT
    // ============================================

    const handleAddRelationship = () => {
        setEditingRelationship(null);
        setRelationshipName('');
        setRelationshipSource('');
        setRelationshipTarget('');
        setRelationshipCardinality(Cardinality.ONE_TO_MANY);
        setRelationshipDialogOpen(true);
    };

    const handleEditRelationship = (rel: SchemaRelationship) => {
        setEditingRelationship(rel);
        setRelationshipName(rel.name);
        setRelationshipSource(rel.source_class_id);
        setRelationshipTarget(rel.target_class_id);
        setRelationshipCardinality(rel.cardinality);
        setRelationshipDialogOpen(true);
    };

    const handleSaveRelationship = () => {
        if (!relationshipName.trim() || !relationshipSource || !relationshipTarget) {
            alert('All relationship fields are required');
            return;
        }

        const newRelationship: SchemaRelationship = {
            id: editingRelationship?.id || uuidv4(),
            name: relationshipName,
            source_class_id: relationshipSource,
            target_class_id: relationshipTarget,
            cardinality: relationshipCardinality,
        };

        if (editingRelationship) {
            setRelationships(relationships.map(rel =>
                rel.id === editingRelationship.id ? newRelationship : rel
            ));
        } else {
            setRelationships([...relationships, newRelationship]);
        }

        setRelationshipDialogOpen(false);
    };

    const handleDeleteRelationship = (relationshipId: string) => {
        setRelationships(relationships.filter(rel => rel.id !== relationshipId));
    };

    // ============================================
    // SCHEMA CREATION - ✅ FULLY FIXED
    // ============================================

    const handleCreateSchema = async () => {
        if (!schemaName.trim()) {
            alert('Schema name is required');
            return;
        }

        if (classes.length === 0) {
            alert('At least one class is required');
            return;
        }

        setSaving(true);
        setError(null);

        try {
            console.log('🚀 Creating schema with complete hierarchy...');
            
            // ✅ CRITICAL FIX: Convert classes to proper nested format
            const convertClassToPayload = (cls: SchemaClass): any => {
                return {
                    id: cls.id,
                    name: cls.name,
                    attributes: cls.attributes.map(attr => ({
                        id: attr.id,
                        name: attr.name,
                        data_type: attr.data_type,
                        is_primary_key: attr.is_primary_key || false,
                        is_foreign_key: attr.is_foreign_key || false,
                        is_nullable: attr.is_nullable !== false,
                        metadata: attr.metadata || {}
                    })),
                    parent_id: cls.parent_id || null,
                    level: cls.level,
                    children: cls.children.map(convertClassToPayload), // ✅ Recursive nesting
                    metadata: cls.metadata || {}
                };
            };

            // Only send root classes (children are nested inside)
            const rootClasses = classes.filter(cls => !cls.parent_id);

            const schemaPayload = {
                name: schemaName,
                description: schemaDescription,
                classes: rootClasses.map(convertClassToPayload),
                relationships: relationships.map(rel => ({
                    id: rel.id,
                    name: rel.name,
                    source_class_id: rel.source_class_id,
                    target_class_id: rel.target_class_id,
                    cardinality: rel.cardinality,
                    metadata: {}
                }))
            };

            console.log('📦 Schema payload:', JSON.stringify(schemaPayload, null, 2));

            // ✅ SINGLE API CALL - Creates entire schema with nested hierarchy
            const createdSchema = await apiService.createSchema(schemaPayload);
            
            console.log('✅ Schema created successfully:', createdSchema.id);
            onSchemaCreated(createdSchema);

        } catch (error: any) {
            console.error('❌ Schema creation failed:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Failed to create schema';
            setError(errorMessage);
            alert(`Error: ${errorMessage}`);
        } finally {
            setSaving(false);
        }
    };

    // ============================================
    // TREE VIEW RENDERING
    // ============================================

    const renderClassTree = (cls: SchemaClass): React.ReactNode => {
        const subclassCount = countSubclasses(cls);
        
        return (
            <TreeItem
                key={cls.id}
                itemId={cls.id}
                label={
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            py: 0.5,
                            px: 1,
                            gap: 1,
                        }}
                    >
                        <TableChart fontSize="small" color="primary" />
                        <Typography variant="body2" fontWeight="medium">
                            {cls.name}
                        </Typography>
                        <Chip
                            label={`${cls.attributes.length} attrs`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20 }}
                        />
                        {cls.level > 0 && (
                            <Chip
                                label={`L${cls.level}`}
                                size="small"
                                color="secondary"
                                sx={{ height: 20 }}
                            />
                        )}
                        {subclassCount > 0 && (
                            <Badge
                                badgeContent={subclassCount}
                                color="primary"
                                sx={{ ml: 1 }}
                            >
                                <AccountTree fontSize="small" />
                            </Badge>
                        )}
                        <Box sx={{ flexGrow: 1 }} />
                        <Tooltip title="Add Subclass">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddSubclass(cls);
                                }}
                            >
                                <AddCircleOutline fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Class">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditClass(cls);
                                }}
                            >
                                <Edit fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Class">
                            <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClass(cls.id);
                                }}
                            >
                                <Delete fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                }
            >
                {cls.children.map(child => renderClassTree(child))}
            </TreeItem>
        );
    };

    const totalClasses = flattenClasses(classes).length;
    const rootClassCount = classes.length;
    const subclassCount = totalClasses - rootClassCount;

    // ============================================
    // RENDER
    // ============================================

    return (
        <Container maxWidth="xl" sx={{ py: 4 }}>
            <Paper elevation={2} sx={{ p: 4 }}>
                {/* Header */}
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            Schema Builder
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Define classes, subclasses (unlimited hierarchy), attributes, and relationships
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            startIcon={<Cancel />}
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                            onClick={handleCreateSchema}
                            disabled={saving || totalClasses === 0}
                        >
                            {saving ? 'Creating...' : 'Create Schema'}
                        </Button>
                    </Stack>
                </Stack>

                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {/* Schema Details */}
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Schema Name"
                            value={schemaName}
                            onChange={(e) => setSchemaName(e.target.value)}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Description"
                            value={schemaDescription}
                            onChange={(e) => setSchemaDescription(e.target.value)}
                        />
                    </Grid>
                </Grid>

                <Divider sx={{ my: 3 }} />

                {/* Classes Section */}
                <Box mb={4}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                        <Box>
                            <Typography variant="h6">
                                Class Hierarchy
                            </Typography>
                            <Stack direction="row" spacing={2} mt={0.5}>
                                <Chip
                                    icon={<Schema />}
                                    label={`${totalClasses} Total Classes`}
                                    size="small"
                                    color="primary"
                                />
                                <Chip
                                    label={`${rootClassCount} Root`}
                                    size="small"
                                    variant="outlined"
                                />
                                {subclassCount > 0 && (
                                    <Chip
                                        icon={<AccountTree />}
                                        label={`${subclassCount} Subclasses`}
                                        size="small"
                                        color="secondary"
                                    />
                                )}
                            </Stack>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={handleAddRootClass}
                        >
                            Add Root Class
                        </Button>
                    </Stack>

                    {classes.length > 0 ? (
                        <Card variant="outlined">
                            <CardContent>
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <Typography variant="body2">
                                        <strong>Tip:</strong> Click <AddCircleOutline fontSize="small" sx={{ verticalAlign: 'middle' }} /> to add subclasses. Subclasses will be shown inside parent nodes in visualization.
                                    </Typography>
                                </Alert>
                                <SimpleTreeView
                                    defaultExpandedItems={classes.map(c => c.id)}
                                    slots={{
                                        expandIcon: ChevronRight,
                                        collapseIcon: ExpandMore,
                                    }}
                                >
                                    {classes.map(cls => renderClassTree(cls))}
                                </SimpleTreeView>
                            </CardContent>
                        </Card>
                    ) : (
                        <Paper
                            variant="outlined"
                            sx={{
                                p: 4,
                                textAlign: 'center',
                                borderStyle: 'dashed',
                            }}
                        >
                            <AccountTree sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                            <Typography variant="body2" color="text.secondary" mb={2}>
                                No classes yet. Add a root class to get started.
                            </Typography>
                        </Paper>
                    )}
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Relationships Section */}
                <Box>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
                        <Box>
                            <Typography variant="h6">
                                Relationships ({relationships.length})
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Define relationships between any classes (including subclasses)
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={handleAddRelationship}
                            disabled={totalClasses < 2}
                        >
                            Add Relationship
                        </Button>
                    </Stack>

                    {relationships.length > 0 ? (
                        <Stack spacing={1}>
                            {relationships.map(rel => {
                                const sourceClass = findClassById(classes, rel.source_class_id);
                                const targetClass = findClassById(classes, rel.target_class_id);
                                return (
                                    <Card key={rel.id} variant="outlined">
                                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                            <Stack direction="row" alignItems="center" spacing={2}>
                                                <LinkIcon color="action" />
                                                <Chip 
                                                    label={rel.name} 
                                                    size="small" 
                                                    color="primary"
                                                    variant="filled"
                                                />
                                                <Chip label={sourceClass?.name || 'Unknown'} size="small" />
                                                <ArrowForward fontSize="small" />
                                                <Chip label={targetClass?.name || 'Unknown'} size="small" />
                                                <Chip
                                                    label={rel.cardinality}
                                                    size="small"
                                                    variant="outlined"
                                                />
                                                <Box sx={{ flexGrow: 1 }} />
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleEditRelationship(rel)}
                                                >
                                                    <Edit fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteRelationship(rel.id)}
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Stack>
                    ) : (
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                            <LinkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                            <Typography variant="body2" color="text.secondary">
                                No relationships defined. Add at least 2 classes first.
                            </Typography>
                        </Paper>
                    )}
                </Box>
            </Paper>

            {/* Dialogs - Class, Subclass, Relationship */}
            {/* (Same as before - keeping all dialog implementations) */}
            {/* Class Dialog */}
            <Dialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Add Root Class'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            label="Class Name"
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            required
                        />
                        <Divider />
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Attributes</Typography>
                            <Stack spacing={1} mb={2}>
                                {classAttributes.map(attr => (
                                    <Card key={attr.id} variant="outlined">
                                        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                                            <Stack direction="row" alignItems="center" spacing={2}>
                                                <Typography variant="body2" fontWeight="medium">{attr.name}</Typography>
                                                <Chip label={attr.data_type} size="small" />
                                                <Box sx={{ flexGrow: 1 }} />
                                                <IconButton size="small" color="error" onClick={() => handleDeleteAttribute(attr.id, classAttributes, setClassAttributes)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                            <Stack direction="row" spacing={2}>
                                <TextField size="small" label="Attribute Name" value={newAttributeName} onChange={(e) => setNewAttributeName(e.target.value)} />
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Type</InputLabel>
                                    <Select value={newAttributeType} onChange={(e) => setNewAttributeType(e.target.value)} label="Type">
                                        <MenuItem value="string">String</MenuItem>
                                        <MenuItem value="integer">Integer</MenuItem>
                                        <MenuItem value="float">Float</MenuItem>
                                        <MenuItem value="boolean">Boolean</MenuItem>
                                        <MenuItem value="date">Date</MenuItem>
                                    </Select>
                                </FormControl>
                                <Button variant="outlined" startIcon={<Add />} onClick={() => handleAddAttribute(classAttributes, setClassAttributes)}>Add</Button>
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveClass} disabled={!className.trim()}>
                        {editingClass ? 'Update' : 'Add'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Subclass Dialog */}
            <Dialog open={subclassDialogOpen} onClose={() => setSubclassDialogOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <AccountTree color="primary" />
                        <Typography>Add Subclass to "{parentClassForSubclass?.name}"</Typography>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Alert severity="info">
                            Subclasses inherit parent attributes by default. Add additional attributes specific to this subclass.
                        </Alert>
                        <TextField fullWidth label="Subclass Name" value={subclassName} onChange={(e) => setSubclassName(e.target.value)} required />
                        <FormControlLabel
                            control={<Checkbox checked={inheritAttributes} onChange={(e) => setInheritAttributes(e.target.checked)} />}
                            label={`Inherit ${parentClassForSubclass?.attributes.length || 0} attributes from parent`}
                        />
                        <Divider />
                        <Box>
                            <Typography variant="subtitle2" gutterBottom>Additional Attributes</Typography>
                            <Stack spacing={1} mb={2}>
                                {subclassAttributes.map(attr => (
                                    <Card key={attr.id} variant="outlined">
                                        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                                            <Stack direction="row" alignItems="center" spacing={2}>
                                                <Typography variant="body2" fontWeight="medium">{attr.name}</Typography>
                                                <Chip label={attr.data_type} size="small" />
                                                <Box sx={{ flexGrow: 1 }} />
                                                <IconButton size="small" color="error" onClick={() => handleDeleteAttribute(attr.id, subclassAttributes, setSubclassAttributes)}>
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                            <Stack direction="row" spacing={2}>
                                <TextField size="small" label="Attribute Name" value={newAttributeName} onChange={(e) => setNewAttributeName(e.target.value)} />
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Type</InputLabel>
                                    <Select value={newAttributeType} onChange={(e) => setNewAttributeType(e.target.value)} label="Type">
                                        <MenuItem value="string">String</MenuItem>
                                        <MenuItem value="integer">Integer</MenuItem>
                                        <MenuItem value="float">Float</MenuItem>
                                        <MenuItem value="boolean">Boolean</MenuItem>
                                        <MenuItem value="date">Date</MenuItem>
                                    </Select>
                                </FormControl>
                                <Button variant="outlined" startIcon={<Add />} onClick={() => handleAddAttribute(subclassAttributes, setSubclassAttributes)}>Add</Button>
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubclassDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveSubclass} disabled={!subclassName.trim()} startIcon={<Check />}>
                        Add Subclass
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Relationship Dialog */}
            <Dialog open={relationshipDialogOpen} onClose={() => setRelationshipDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>{editingRelationship ? 'Edit Relationship' : 'Add Relationship'}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Alert severity="info">
                            The relationship name will appear as a label on the edge
                        </Alert>
                        <TextField fullWidth label="Relationship Name" value={relationshipName} onChange={(e) => setRelationshipName(e.target.value)} required placeholder="e.g., HAS, CONTAINS, OWNS" />
                        <FormControl fullWidth>
                            <InputLabel>Source Class</InputLabel>
                            <Select value={relationshipSource} onChange={(e) => setRelationshipSource(e.target.value)} label="Source Class">
                                {flattenClasses(classes).map(cls => (
                                    <MenuItem key={cls.id} value={cls.id}>
                                        {cls.name} {cls.level > 0 && `(L${cls.level} - Subclass)`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Target Class</InputLabel>
                            <Select value={relationshipTarget} onChange={(e) => setRelationshipTarget(e.target.value)} label="Target Class">
                                {flattenClasses(classes).map(cls => (
                                    <MenuItem key={cls.id} value={cls.id}>
                                        {cls.name} {cls.level > 0 && `(L${cls.level} - Subclass)`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth>
                            <InputLabel>Cardinality</InputLabel>
                            <Select value={relationshipCardinality} onChange={(e) => setRelationshipCardinality(e.target.value as Cardinality)} label="Cardinality">
                                <MenuItem value={Cardinality.ONE_TO_ONE}>One-to-One (1:1)</MenuItem>
                                <MenuItem value={Cardinality.ONE_TO_MANY}>One-to-Many (1:N)</MenuItem>
                                <MenuItem value={Cardinality.MANY_TO_ONE}>Many-to-One (N:1)</MenuItem>
                                <MenuItem value={Cardinality.MANY_TO_MANY}>Many-to-Many (N:M)</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRelationshipDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveRelationship} disabled={!relationshipName.trim() || !relationshipSource || !relationshipTarget}>
                        {editingRelationship ? 'Update' : 'Add'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};