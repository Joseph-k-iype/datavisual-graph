// frontend/src/components/NodeEditor.tsx - CLEAN & FUNCTIONAL
import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { NodeType, NodeCreate, NodeUpdate } from '../types';
import { X, Save, Plus, Trash2 } from 'lucide-react';

interface NodeEditorProps {
  node: Node | null;
  mode: 'create' | 'edit';
  onClose: () => void;
  onUpdate: (nodeId: string, nodeType: NodeType, data: NodeUpdate) => Promise<void>;
  onDelete: (nodeId: string, nodeType: NodeType) => Promise<void>;
  onCreate: (data: NodeCreate) => Promise<void>;
}

export const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  mode,
  onClose,
  onUpdate,
  onDelete,
  onCreate,
}) => {
  const [nodeType, setNodeType] = useState<NodeType>(
    node?.data.nodeType || 'Country'
  );
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (node && mode === 'edit') {
      setNodeType(node.data.nodeType);
      setFormData(node.data);
    }
  }, [node, mode]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      if (mode === 'create') {
        await onCreate({
          nodeType,
          properties: formData,
        });
      } else if (node) {
        await onUpdate(node.id, nodeType, {
          properties: formData,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!node || !window.confirm('Delete this node?')) return;

    setSaving(true);
    try {
      await onDelete(node.id, nodeType);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const renderFormFields = () => {
    switch (nodeType) {
      case 'Country':
        return (
          <>
            <FormField label="Country Name" required>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="United States"
              />
            </FormField>
            <FormField label="Country Code" required>
              <input
                type="text"
                value={formData.code || ''}
                onChange={(e) => handleInputChange('code', e.target.value)}
                className="form-input"
                placeholder="US"
                maxLength={2}
              />
            </FormField>
            <FormField label="Region" required>
              <select
                value={formData.region || ''}
                onChange={(e) => handleInputChange('region', e.target.value)}
                className="form-input"
              >
                <option value="">Select Region</option>
                <option value="North America">North America</option>
                <option value="Europe">Europe</option>
                <option value="Asia Pacific">Asia Pacific</option>
                <option value="Latin America">Latin America</option>
                <option value="Middle East">Middle East</option>
                <option value="Africa">Africa</option>
              </select>
            </FormField>
            <FormField label="Data Protection Regime" required>
              <input
                type="text"
                value={formData.dataProtectionRegime || ''}
                onChange={(e) =>
                  handleInputChange('dataProtectionRegime', e.target.value)
                }
                className="form-input"
                placeholder="GDPR, CCPA"
              />
            </FormField>
            <FormField label="Adequacy Status" required>
              <select
                value={formData.adequacyStatus || ''}
                onChange={(e) =>
                  handleInputChange('adequacyStatus', e.target.value)
                }
                className="form-input"
              >
                <option value="Adequate">Adequate</option>
                <option value="Not Adequate">Not Adequate</option>
                <option value="Partial">Partial</option>
              </select>
            </FormField>
          </>
        );

      case 'Database':
        return (
          <>
            <FormField label="Database Name" required>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="Customer Database"
              />
            </FormField>
            <FormField label="Database Type" required>
              <select
                value={formData.type || ''}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="form-input"
              >
                <option value="">Select Type</option>
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="MySQL">MySQL</option>
                <option value="MongoDB">MongoDB</option>
                <option value="Oracle">Oracle</option>
                <option value="SQL Server">SQL Server</option>
              </select>
            </FormField>
            <FormField label="Classification" required>
              <select
                value={formData.classification || ''}
                onChange={(e) =>
                  handleInputChange('classification', e.target.value)
                }
                className="form-input"
              >
                <option value="Public">Public</option>
                <option value="Internal">Internal</option>
                <option value="Confidential">Confidential</option>
                <option value="Restricted">Restricted</option>
              </select>
            </FormField>
            <FormField label="Owner" required>
              <input
                type="text"
                value={formData.owner || ''}
                onChange={(e) => handleInputChange('owner', e.target.value)}
                className="form-input"
                placeholder="Data Team"
              />
            </FormField>
          </>
        );

      case 'Attribute':
        return (
          <>
            <FormField label="Attribute Name" required>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="Email Address"
              />
            </FormField>
            <FormField label="Data Type" required>
              <select
                value={formData.dataType || ''}
                onChange={(e) => handleInputChange('dataType', e.target.value)}
                className="form-input"
              >
                <option value="">Select Type</option>
                <option value="String">String</option>
                <option value="Integer">Integer</option>
                <option value="Float">Float</option>
                <option value="Boolean">Boolean</option>
                <option value="Date">Date</option>
                <option value="Timestamp">Timestamp</option>
                <option value="JSON">JSON</option>
              </select>
            </FormField>
            <FormField label="Category" required>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="form-input"
                placeholder="Contact Information"
              />
            </FormField>
            <FormField label="Sensitivity" required>
              <select
                value={formData.sensitivity || ''}
                onChange={(e) =>
                  handleInputChange('sensitivity', e.target.value)
                }
                className="form-input"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </FormField>
            <FormField label="PII Classification">
              <label className="flex items-center gap-3 p-3 card rounded-lg cursor-pointer hover:shadow-md transition-all">
                <input
                  type="checkbox"
                  checked={formData.isPII || false}
                  onChange={(e) =>
                    handleInputChange('isPII', e.target.checked)
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-900">
                  Contains Personally Identifiable Information
                </span>
              </label>
            </FormField>
          </>
        );
    }
  };

  if (!node && mode === 'edit') return null;

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
        className="card rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-1">
              {mode === 'create' ? 'Create Node' : 'Edit Node'}
            </h2>
            <p className="text-sm text-gray-600">
              {mode === 'create'
                ? 'Add a new node to the lineage graph'
                : 'Update node properties'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {mode === 'create' && (
              <FormField label="Node Type" required>
                <select
                  value={nodeType}
                  onChange={(e) => setNodeType(e.target.value as NodeType)}
                  className="form-input"
                >
                  <option value="Country">Country</option>
                  <option value="Database">Database</option>
                  <option value="Attribute">Attribute</option>
                </select>
              </FormField>
            )}

            {renderFormFields()}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          {mode === 'edit' && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border-2 border-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 font-medium text-sm"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={onClose}
              disabled={saving}
              className="btn-secondary px-6 py-2.5"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-2.5"
            >
              {mode === 'create' ? <Plus size={16} /> : <Save size={16} />}
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : mode === 'create' ? (
                'Create'
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface FormFieldProps {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({ label, required, children }) => {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
};