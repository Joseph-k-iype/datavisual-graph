// frontend/src/components/SchemaBuilder.tsx

import React, { useState } from 'react';
import {
  Plus,
  X,
  Save,
  ArrowRight,
  Trash2,
  Edit2,
  Box,
  Link as LinkIcon,
} from 'lucide-react';
import {
  SchemaClass,
  SchemaRelationship,
  Cardinality,
  SchemaCreateRequest,
} from '../types';
import apiService from '../services/api';

interface SchemaBuilderProps {
  onComplete: (schemaId: string) => void;
  onCancel: () => void;
}

export const SchemaBuilder: React.FC<SchemaBuilderProps> = ({
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<'basic' | 'classes' | 'relationships'>('basic');
  const [schemaName, setSchemaName] = useState('');
  const [schemaDescription, setSchemaDescription] = useState('');
  const [classes, setClasses] = useState<SchemaClass[]>([]);
  const [relationships, setRelationships] = useState<SchemaRelationship[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Class editing state
  const [editingClass, setEditingClass] = useState<SchemaClass | null>(null);
  const [showClassDialog, setShowClassDialog] = useState(false);

  // Relationship editing state
  const [editingRelationship, setEditingRelationship] = useState<SchemaRelationship | null>(null);
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false);

  const handleSave = async () => {
    if (!schemaName.trim()) {
      setError('Schema name is required');
      return;
    }

    if (classes.length === 0) {
      setError('At least one class is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const request: SchemaCreateRequest = {
        name: schemaName,
        description: schemaDescription,
        classes,
        relationships,
      };

      const schema = await apiService.createSchema(request);
      onComplete(schema.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schema');
    } finally {
      setSaving(false);
    }
  };

  const handleAddClass = (cls: SchemaClass) => {
    setClasses([...classes, cls]);
    setShowClassDialog(false);
    setEditingClass(null);
  };

  const handleUpdateClass = (cls: SchemaClass) => {
    setClasses(classes.map((c) => (c.id === cls.id ? cls : c)));
    setShowClassDialog(false);
    setEditingClass(null);
  };

  const handleDeleteClass = (classId: string) => {
    setClasses(classes.filter((c) => c.id !== classId));
    // Also remove relationships involving this class
    setRelationships(
      relationships.filter(
        (r) => r.source_class_id !== classId && r.target_class_id !== classId
      )
    );
  };

  const handleAddRelationship = (rel: SchemaRelationship) => {
    setRelationships([...relationships, rel]);
    setShowRelationshipDialog(false);
    setEditingRelationship(null);
  };

  const handleUpdateRelationship = (rel: SchemaRelationship) => {
    setRelationships(relationships.map((r) => (r.id === rel.id ? rel : r)));
    setShowRelationshipDialog(false);
    setEditingRelationship(null);
  };

  const handleDeleteRelationship = (relId: string) => {
    setRelationships(relationships.filter((r) => r.id !== relId));
  };

  const canProceed = () => {
    if (step === 'basic') return schemaName.trim().length > 0;
    if (step === 'classes') return classes.length > 0;
    return true;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Create Schema</h1>
              <p className="text-sm text-gray-600 mt-1">
                Step {step === 'basic' ? '1' : step === 'classes' ? '2' : '3'} of 3
              </p>
            </div>
            <button onClick={onCancel} className="btn-secondary">
              <X size={20} />
              Cancel
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-6 flex gap-2">
            <div className={`h-1 flex-1 rounded ${step === 'basic' || step === 'classes' || step === 'relationships' ? 'bg-black' : 'bg-gray-200'}`} />
            <div className={`h-1 flex-1 rounded ${step === 'classes' || step === 'relationships' ? 'bg-black' : 'bg-gray-200'}`} />
            <div className={`h-1 flex-1 rounded ${step === 'relationships' ? 'bg-black' : 'bg-gray-200'}`} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {error && (
          <div className="mb-6 card rounded-lg p-4 bg-red-50 border-red-200">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {step === 'basic' && (
          <BasicInfoStep
            name={schemaName}
            description={schemaDescription}
            onNameChange={setSchemaName}
            onDescriptionChange={setSchemaDescription}
          />
        )}

        {step === 'classes' && (
          <ClassesStep
            classes={classes}
            onAddClass={() => {
              setEditingClass(null);
              setShowClassDialog(true);
            }}
            onEditClass={(cls) => {
              setEditingClass(cls);
              setShowClassDialog(true);
            }}
            onDeleteClass={handleDeleteClass}
          />
        )}

        {step === 'relationships' && (
          <RelationshipsStep
            classes={classes}
            relationships={relationships}
            onAddRelationship={() => {
              setEditingRelationship(null);
              setShowRelationshipDialog(true);
            }}
            onEditRelationship={(rel) => {
              setEditingRelationship(rel);
              setShowRelationshipDialog(true);
            }}
            onDeleteRelationship={handleDeleteRelationship}
          />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={() => {
              if (step === 'classes') setStep('basic');
              else if (step === 'relationships') setStep('classes');
            }}
            className="btn-secondary"
            disabled={step === 'basic'}
          >
            Back
          </button>

          {step === 'relationships' ? (
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={!canProceed() || saving}
            >
              {saving ? (
                'Creating...'
              ) : (
                <>
                  <Save size={20} />
                  Create Schema
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                if (step === 'basic') setStep('classes');
                else if (step === 'classes') setStep('relationships');
              }}
              className="btn-primary"
              disabled={!canProceed()}
            >
              Next
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showClassDialog && (
        <ClassDialog
          classData={editingClass}
          onSave={editingClass ? handleUpdateClass : handleAddClass}
          onClose={() => {
            setShowClassDialog(false);
            setEditingClass(null);
          }}
        />
      )}

      {showRelationshipDialog && (
        <RelationshipDialog
          classes={classes}
          relationshipData={editingRelationship}
          onSave={editingRelationship ? handleUpdateRelationship : handleAddRelationship}
          onClose={() => {
            setShowRelationshipDialog(false);
            setEditingRelationship(null);
          }}
        />
      )}
    </div>
  );
};

// Basic Info Step
interface BasicInfoStepProps {
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  name,
  description,
  onNameChange,
  onDescriptionChange,
}) => {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-black mb-6">Basic Information</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Schema Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Customer Orders Schema"
            className="input-field"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-black mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe the purpose of this schema..."
            rows={4}
            className="input-field"
          />
        </div>
      </div>
    </div>
  );
};

// Classes Step
interface ClassesStepProps {
  classes: SchemaClass[];
  onAddClass: () => void;
  onEditClass: (cls: SchemaClass) => void;
  onDeleteClass: (classId: string) => void;
}

const ClassesStep: React.FC<ClassesStepProps> = ({
  classes,
  onAddClass,
  onEditClass,
  onDeleteClass,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-black">Define Classes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create classes that represent your data entities
          </p>
        </div>
        <button onClick={onAddClass} className="btn-primary">
          <Plus size={20} />
          Add Class
        </button>
      </div>

      {classes.length === 0 ? (
        <div className="card rounded-lg p-12 text-center">
          <Box size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-black mb-2">No Classes Yet</h3>
          <p className="text-gray-600 mb-6">
            Start by adding your first class
          </p>
          <button onClick={onAddClass} className="btn-primary">
            <Plus size={20} />
            Add Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="card rounded-lg p-6 hover:border-gray-400 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: cls.color || '#6B7280' }}
                >
                  <Box size={24} className="text-white" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onEditClass(cls)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete class "${cls.name}"?`)) {
                        onDeleteClass(cls.id);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-black mb-1">
                {cls.name}
              </h3>
              
              {cls.description && (
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {cls.description}
                </p>
              )}

              <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                {cls.attributes.length} attributes
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Relationships Step
interface RelationshipsStepProps {
  classes: SchemaClass[];
  relationships: SchemaRelationship[];
  onAddRelationship: () => void;
  onEditRelationship: (rel: SchemaRelationship) => void;
  onDeleteRelationship: (relId: string) => void;
}

const RelationshipsStep: React.FC<RelationshipsStepProps> = ({
  classes,
  relationships,
  onAddRelationship,
  onEditRelationship,
  onDeleteRelationship,
}) => {
  const getClassName = (classId: string) => {
    return classes.find((c) => c.id === classId)?.name || 'Unknown';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-black">Define Relationships</h2>
          <p className="text-sm text-gray-600 mt-1">
            Connect classes with relationships and cardinality
          </p>
        </div>
        <button onClick={onAddRelationship} className="btn-primary">
          <Plus size={20} />
          Add Relationship
        </button>
      </div>

      {relationships.length === 0 ? (
        <div className="card rounded-lg p-12 text-center">
          <LinkIcon size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-black mb-2">
            No Relationships Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Define how your classes relate to each other
          </p>
          <button onClick={onAddRelationship} className="btn-primary">
            <Plus size={20} />
            Add Relationship
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {relationships.map((rel) => (
            <div
              key={rel.id}
              className="card rounded-lg p-6 hover:border-gray-400 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-sm font-medium text-black">
                    {getClassName(rel.source_class_id)}
                  </span>
                  <ArrowRight size={20} className="text-gray-400" />
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-gray-900">
                      {rel.name}
                    </span>
                    <span className="text-xs text-gray-500">{rel.cardinality}</span>
                  </div>
                  <ArrowRight size={20} className="text-gray-400" />
                  <span className="text-sm font-medium text-black">
                    {getClassName(rel.target_class_id)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onEditRelationship(rel)}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-600" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete relationship "${rel.name}"?`)) {
                        onDeleteRelationship(rel.id);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Trash2 size={16} className="text-red-600" />
                  </button>
                </div>
              </div>

              {rel.description && (
                <p className="text-sm text-gray-600 mt-3">{rel.description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Class Dialog
interface ClassDialogProps {
  classData: SchemaClass | null;
  onSave: (cls: SchemaClass) => void;
  onClose: () => void;
}

const ClassDialog: React.FC<ClassDialogProps> = ({
  classData,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(classData?.name || '');
  const [description, setDescription] = useState(classData?.description || '');
  const [attributes, setAttributes] = useState<string[]>(classData?.attributes || []);
  const [newAttribute, setNewAttribute] = useState('');
  const [color, setColor] = useState(classData?.color || '#6B7280');

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      id: classData?.id || `class_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      attributes,
      color,
      icon: 'Box',
    });
  };

  const handleAddAttribute = () => {
    if (newAttribute.trim() && !attributes.includes(newAttribute.trim())) {
      setAttributes([...attributes, newAttribute.trim()]);
      setNewAttribute('');
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-black">
            {classData ? 'Edit Class' : 'Add Class'}
          </h2>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Class Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Customer, Order, Product"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this class..."
              rows={3}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {['#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#2563EB', '#7C3AED', '#6B7280'].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    color === c ? 'border-black scale-110' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Attributes
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newAttribute}
                onChange={(e) => setNewAttribute(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddAttribute();
                  }
                }}
                placeholder="Add attribute name..."
                className="input-field flex-1"
              />
              <button onClick={handleAddAttribute} className="btn-secondary">
                <Plus size={20} />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {attributes.map((attr, idx) => (
                <span
                  key={idx}
                  className="tag flex items-center gap-2"
                >
                  {attr}
                  <button
                    onClick={() =>
                      setAttributes(attributes.filter((_, i) => i !== idx))
                    }
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={!name.trim()}
          >
            <Save size={20} />
            {classData ? 'Update' : 'Add'} Class
          </button>
        </div>
      </div>
    </div>
  );
};

// Relationship Dialog
interface RelationshipDialogProps {
  classes: SchemaClass[];
  relationshipData: SchemaRelationship | null;
  onSave: (rel: SchemaRelationship) => void;
  onClose: () => void;
}

const RelationshipDialog: React.FC<RelationshipDialogProps> = ({
  classes,
  relationshipData,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(relationshipData?.name || '');
  const [description, setDescription] = useState(relationshipData?.description || '');
  const [sourceClassId, setSourceClassId] = useState(relationshipData?.source_class_id || '');
  const [targetClassId, setTargetClassId] = useState(relationshipData?.target_class_id || '');
  const [cardinality, setCardinality] = useState<Cardinality>(
    relationshipData?.cardinality || Cardinality.ONE_TO_MANY
  );

  const handleSave = () => {
    if (!name.trim() || !sourceClassId || !targetClassId) return;

    onSave({
      id: relationshipData?.id || `rel_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      source_class_id: sourceClassId,
      target_class_id: targetClassId,
      cardinality,
      bidirectional: false,
    });
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-black">
            {relationshipData ? 'Edit Relationship' : 'Add Relationship'}
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Relationship Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., places, contains, owns"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this relationship..."
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Source Class *
              </label>
              <select
                value={sourceClassId}
                onChange={(e) => setSourceClassId(e.target.value)}
                className="input-field"
              >
                <option value="">Select class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Target Class *
              </label>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="input-field"
              >
                <option value="">Select class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Cardinality *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.values(Cardinality).map((card) => (
                <button
                  key={card}
                  onClick={() => setCardinality(card)}
                  className={`p-3 rounded-lg border-2 transition-all text-sm font-medium ${
                    cardinality === card
                      ? 'border-black bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {card}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={!name.trim() || !sourceClassId || !targetClassId}
          >
            <Save size={20} />
            {relationshipData ? 'Update' : 'Add'} Relationship
          </button>
        </div>
      </div>
    </div>
  );
};