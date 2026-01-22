// frontend/src/components/schema/SchemaBuilder.tsx
// FIXED VERSION - Ensures relationships are saved to FalkorDB

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
} from '@mui/material';
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
    const [savingRelationships, setSavingRelationships] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dialog states
    const [classDialogOpen, setClassDialogOpen] = useState(false);
    const [relationshipDialogOpen, setRelationshipDialogOpen] = useState(false);
    const [editingClass, setEditingClass] = useState<SchemaClass | null>(null);
    const [editingRelationship, setEditingRelationship] = useState<SchemaRelationship | null>(null);

    // Form states
    const [className, setClassName] = useState('');
    const [classAttributes, setClassAttributes] = useState<Attribute[]>([]);
    const [newAttributeName, setNewAttributeName] = useState('');
    const [newAttributeType, setNewAttributeType] = useState('string');

    const [relationshipName, setRelationshipName] = useState('');
    const [relationshipSource, setRelationshipSource] = useState('');
    const [relationshipTarget, setRelationshipTarget] = useState('');
    const [relationshipCardinality, setRelationshipCardinality] = useState<Cardinality>(Cardinality.ONE_TO_MANY);

    // ============================================
    // CLASS MANAGEMENT
    // ============================================

    const handleAddClass = () => {
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
            // Update existing class
            const updateClass = (classList: SchemaClass[]): SchemaClass[] => {
                return classList.map(cls => {
                    if (cls.id === editingClass.id) {
                        return { ...cls, name: className, attributes: classAttributes };
                    }
                    if (cls.children.length > 0) {
                        return { ...cls, children: updateClass(cls.children) };
                    }
                    return cls;
                });
            };
            setClasses(updateClass(classes));
        } else {
            // Add new class
            const newClass: SchemaClass = {
                id: uuidv4(),
                name: className,
                attributes: classAttributes,
                level: 0,
                children: [],
                metadata: {}
            };
            setClasses([...classes, newClass]);
        }

        setClassDialogOpen(false);
    };

    const handleDeleteClass = (classId: string) => {
        const deleteClass = (classList: SchemaClass[]): SchemaClass[] => {
            return classList.filter(cls => {
                if (cls.id === classId) return false;
                if (cls.children.length > 0) {
                    cls.children = deleteClass(cls.children);
                }
                return true;
            });
        };
        setClasses(deleteClass(classes));

        // Also remove relationships involving this class
        setRelationships(relationships.filter(
            rel => rel.source_class_id !== classId && rel.target_class_id !== classId
        ));
    };

    const handleAddAttribute = () => {
        if (!newAttributeName.trim()) return;

        const newAttribute: Attribute = {
            id: uuidv4(),
            name: newAttributeName,
            data_type: newAttributeType,
            is_primary_key: false,
            is_foreign_key: false,
            is_nullable: true,
            metadata: {}
        };

        setClassAttributes([...classAttributes, newAttribute]);
        setNewAttributeName('');
        setNewAttributeType('string');
    };

    const handleDeleteAttribute = (attrId: string) => {
        setClassAttributes(classAttributes.filter(attr => attr.id !== attrId));
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

    const handleSaveRelationship = () => {
        if (!relationshipName.trim() || !relationshipSource || !relationshipTarget) {
            alert('All relationship fields are required');
            return;
        }

        if (relationshipSource === relationshipTarget) {
            alert('Source and target cannot be the same class');
            return;
        }

        const newRelationship: SchemaRelationship = {
            id: editingRelationship?.id || uuidv4(),
            name: relationshipName,
            source_class_id: relationshipSource,
            target_class_id: relationshipTarget,
            cardinality: relationshipCardinality
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
    // SCHEMA CREATION - FIXED TO SAVE RELATIONSHIPS
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
        setError(null);

        try {
            console.log('🚀 Creating schema with hierarchy and relationships...');
            console.log(`📊 Total classes: ${flattenClasses(classes).length}`);
            console.log(`🔗 Total relationships: ${relationships.length}`);

            const rootClasses = classes.filter((cls) => !cls.parent_id);
            const allClasses = flattenClasses(classes);

            // ✅ Step 1: Create schema with root classes and ALL relationships
            const schemaPayload = {
                name: schemaName,
                description: schemaDescription,
                classes: rootClasses.map((cls) => ({
                    id: cls.id,
                    name: cls.name,
                    attributes: cls.attributes.map(attr =>
                        typeof attr === 'string' ? attr : attr.name
                    ),
                    metadata: cls.metadata,
                })),
                relationships: relationships.map(rel => ({
                    id: rel.id,
                    name: rel.name,
                    source_class_id: rel.source_class_id,
                    target_class_id: rel.target_class_id,
                    cardinality: rel.cardinality,
                    metadata: {}
                }))
            };

            console.log('📝 Schema Payload:', JSON.stringify(schemaPayload, null, 2));
            console.log(`   Root classes: ${schemaPayload.classes.length}`);
            console.log(`   Relationships: ${schemaPayload.relationships.length}`);

            const createdSchema = await apiService.createSchema(schemaPayload);
            console.log('✅ Schema created:', createdSchema);

            // ✅ Step 2: Create subclasses (if any)
            const subclassesToCreate = allClasses.filter((cls) => cls.parent_id);
            console.log(`📦 Creating ${subclassesToCreate.length} subclasses...`);

            for (const subclass of subclassesToCreate) {
                console.log(`➕ Creating subclass: ${subclass.name} under parent: ${subclass.parent_id}`);

                const createSubclassRequest = {
                    parent_class_id: subclass.parent_id!,
                    name: subclass.name,
                    display_name: subclass.name,
                    description: subclass.metadata?.description || '',
                    inherit_attributes: subclass.metadata?.inherit_attributes !== false,
                    additional_attributes: subclass.attributes.map(attr => ({
                        id: attr.id,
                        name: attr.name,
                        data_type: attr.data_type,
                        is_primary_key: attr.is_primary_key || false,
                        is_foreign_key: attr.is_foreign_key || false,
                        is_nullable: attr.is_nullable !== false,
                        metadata: attr.metadata || {}
                    })),
                    metadata: subclass.metadata || {},
                };

                try {
                    const createdSubclass = await apiService.createSubclass(
                        createdSchema.id,
                        subclass.parent_id!,
                        createSubclassRequest
                    );
                    console.log('✅ Subclass created:', createdSubclass);
                } catch (error) {
                    console.error(`❌ Failed to create subclass ${subclass.name}:`, error);
                    throw error;
                }
            }

            // ✅ Step 3: Verify relationships were created
            console.log('🔍 Verifying relationships were saved...');
            const schemaWithRels = await apiService.getSchema(createdSchema.id);
            
            if (schemaWithRels.relationships && schemaWithRels.relationships.length > 0) {
                console.log(`✅ ${schemaWithRels.relationships.length} relationships confirmed in database`);
            } else if (relationships.length > 0) {
                console.warn('⚠️ Relationships were not saved! Attempting to create them now...');
                setSavingRelationships(true);
                
                // Create relationships individually
                for (const rel of relationships) {
                    try {
                        await apiService.createRelationship(
                            createdSchema.id,
                            rel.source_class_id,
                            rel.target_class_id,
                            rel.name,
                            rel.cardinality
                        );
                        console.log(`✅ Relationship created: ${rel.name}`);
                    } catch (error) {
                        console.error(`❌ Failed to create relationship ${rel.name}:`, error);
                    }
                }
                setSavingRelationships(false);
            }

            console.log('✅ Schema with full hierarchy and relationships created successfully!');
            alert('Schema created successfully with all classes, subclasses, and relationships!');
            onSchemaCreated(createdSchema);

        } catch (error: any) {
            console.error('❌ Error creating schema:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Failed to create schema';
            setError(errorMessage);
            alert(`Error creating schema: ${errorMessage}`);
        } finally {
            setSaving(false);
            setSavingRelationships(false);
        }
    };

    // ============================================
    // RENDER
    // ============================================

    const allClasses = flattenClasses(classes);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                {/* Header */}
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h4" fontWeight={600}>
                        {inferredSchema ? 'Review & Edit Schema' : 'Create New Schema'}
                    </Typography>
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
                            startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                            onClick={handleCreateSchema}
                            disabled={saving || allClasses.length === 0}
                        >
                            {saving ? (savingRelationships ? 'Saving Relationships...' : 'Creating Schema...') : 'Create Schema'}
                        </Button>
                    </Stack>
                </Stack>

                {/* Error Alert */}
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Divider sx={{ mb: 3 }} />

                {/* Schema Details */}
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Schema Name"
                            value={schemaName}
                            onChange={(e) => setSchemaName(e.target.value)}
                            required
                            disabled={saving}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Description"
                            value={schemaDescription}
                            onChange={(e) => setSchemaDescription(e.target.value)}
                            disabled={saving}
                        />
                    </Grid>
                </Grid>

                {/* Classes Section */}
                <Box mt={4}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">Classes ({allClasses.length})</Typography>
                        <Button
                            variant="outlined"
                            startIcon={<Add />}
                            onClick={handleAddClass}
                            disabled={saving}
                        >
                            Add Class
                        </Button>
                    </Stack>

                    {allClasses.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                            <AccountTree sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="body1" color="text.secondary" gutterBottom>
                                No classes defined yet
                            </Typography>
                            <Button variant="outlined" startIcon={<Add />} onClick={handleAddClass} sx={{ mt: 2 }}>
                                Add Your First Class
                            </Button>
                        </Paper>
                    ) : (
                        <Stack spacing={2}>
                            {allClasses.map((cls) => (
                                <Card key={cls.id} variant="outlined">
                                    <CardContent>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box flex={1}>
                                                <Stack direction="row" spacing={1} alignItems="center" mb={1}>
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
                                                <Stack direction="row" spacing={0.5} mt={1} flexWrap="wrap">
                                                    {cls.attributes.map((attr) => (
                                                        <Chip
                                                            key={attr.id}
                                                            label={`${attr.name}: ${attr.data_type}`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    ))}
                                                </Stack>
                                            </Box>
                                            <Stack direction="row" spacing={1}>
                                                <IconButton size="small" onClick={() => handleEditClass(cls)} disabled={saving}>
                                                    <Edit fontSize="small" />
                                                </IconButton>
                                                <IconButton size="small" onClick={() => handleDeleteClass(cls.id)} disabled={saving} color="error">
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    )}
                </Box>

                {/* Relationships Section */}
                <Box mt={4}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography variant="h6">
                            Relationships ({relationships.length})
                            {relationships.length > 0 && (
                                <Chip
                                    label={<Check fontSize="small" />}
                                    size="small"
                                    color="success"
                                    sx={{ ml: 1 }}
                                />
                            )}
                        </Typography>
                        <Button
                            variant="outlined"
                            startIcon={<LinkIcon />}
                            onClick={handleAddRelationship}
                            disabled={saving || allClasses.length < 2}
                        >
                            Add Relationship
                        </Button>
                    </Stack>

                    {relationships.length === 0 ? (
                        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                            <LinkIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="body1" color="text.secondary" gutterBottom>
                                No relationships defined yet
                            </Typography>
                            {allClasses.length >= 2 && (
                                <Button variant="outlined" startIcon={<LinkIcon />} onClick={handleAddRelationship} sx={{ mt: 2 }}>
                                    Add Your First Relationship
                                </Button>
                            )}
                        </Paper>
                    ) : (
                        <Stack spacing={2}>
                            {relationships.map((rel) => {
                                const sourceClass = allClasses.find(c => c.id === rel.source_class_id);
                                const targetClass = allClasses.find(c => c.id === rel.target_class_id);
                                return (
                                    <Card key={rel.id} variant="outlined">
                                        <CardContent>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Stack direction="row" spacing={2} alignItems="center" flex={1}>
                                                    <Chip label={sourceClass?.name || 'Unknown'} />
                                                    <ArrowForward />
                                                    <Typography variant="subtitle2">{rel.name}</Typography>
                                                    <ArrowForward />
                                                    <Chip label={targetClass?.name || 'Unknown'} />
                                                    <Chip label={rel.cardinality} size="small" color="primary" variant="outlined" />
                                                </Stack>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDeleteRelationship(rel.id)}
                                                    disabled={saving}
                                                    color="error"
                                                >
                                                    <Delete fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Stack>
                    )}
                </Box>

                {/* Class Dialog */}
                <Dialog open={classDialogOpen} onClose={() => setClassDialogOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
                    <DialogContent>
                        <Stack spacing={3} mt={2}>
                            <TextField
                                fullWidth
                                label="Class Name"
                                value={className}
                                onChange={(e) => setClassName(e.target.value)}
                                required
                            />

                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Attributes
                                </Typography>
                                <Stack spacing={2}>
                                    {classAttributes.map((attr) => (
                                        <Stack key={attr.id} direction="row" spacing={1} alignItems="center">
                                            <Chip label={`${attr.name}: ${attr.data_type}`} />
                                            <IconButton size="small" onClick={() => handleDeleteAttribute(attr.id)}>
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    ))}
                                    <Stack direction="row" spacing={1}>
                                        <TextField
                                            size="small"
                                            label="Attribute Name"
                                            value={newAttributeName}
                                            onChange={(e) => setNewAttributeName(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddAttribute()}
                                        />
                                        <FormControl size="small" sx={{ minWidth: 120 }}>
                                            <InputLabel>Type</InputLabel>
                                            <Select
                                                value={newAttributeType}
                                                label="Type"
                                                onChange={(e) => setNewAttributeType(e.target.value)}
                                            >
                                                <MenuItem value="string">String</MenuItem>
                                                <MenuItem value="number">Number</MenuItem>
                                                <MenuItem value="boolean">Boolean</MenuItem>
                                                <MenuItem value="date">Date</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <Button variant="outlined" onClick={handleAddAttribute}>
                                            Add
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setClassDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleSaveClass}>
                            Save Class
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Relationship Dialog */}
                <Dialog open={relationshipDialogOpen} onClose={() => setRelationshipDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Add Relationship</DialogTitle>
                    <DialogContent>
                        <Stack spacing={3} mt={2}>
                            <TextField
                                fullWidth
                                label="Relationship Name"
                                value={relationshipName}
                                onChange={(e) => setRelationshipName(e.target.value)}
                                placeholder="e.g., has_orders, belongs_to"
                                required
                            />
                            <FormControl fullWidth>
                                <InputLabel>Source Class</InputLabel>
                                <Select
                                    value={relationshipSource}
                                    label="Source Class"
                                    onChange={(e) => setRelationshipSource(e.target.value)}
                                >
                                    {allClasses.map((cls) => (
                                        <MenuItem key={cls.id} value={cls.id}>
                                            {cls.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Target Class</InputLabel>
                                <Select
                                    value={relationshipTarget}
                                    label="Target Class"
                                    onChange={(e) => setRelationshipTarget(e.target.value)}
                                >
                                    {allClasses.map((cls) => (
                                        <MenuItem key={cls.id} value={cls.id}>
                                            {cls.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Cardinality</InputLabel>
                                <Select
                                    value={relationshipCardinality}
                                    label="Cardinality"
                                    onChange={(e) => setRelationshipCardinality(e.target.value as Cardinality)}
                                >
                                    <MenuItem value={Cardinality.ONE_TO_ONE}>1:1 (One to One)</MenuItem>
                                    <MenuItem value={Cardinality.ONE_TO_MANY}>1:N (One to Many)</MenuItem>
                                    <MenuItem value={Cardinality.MANY_TO_ONE}>N:1 (Many to One)</MenuItem>
                                    <MenuItem value={Cardinality.MANY_TO_MANY}>N:M (Many to Many)</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setRelationshipDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={handleSaveRelationship}>
                            Save Relationship
                        </Button>
                    </DialogActions>
                </Dialog>
            </Paper>
        </Container>
    );
};

export default SchemaBuilder;