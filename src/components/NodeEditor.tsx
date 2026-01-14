import React, { useState, useEffect } from 'react';
import { Node } from 'reactflow';
import { X, Save, Trash2, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { NodeType, NodeUpdate, NodeCreate } from '../types';

interface NodeEditorProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (nodeId: string, nodeType: NodeType, data: NodeUpdate) => Promise<void>;
  onDelete: (nodeId: string, nodeType: NodeType) => Promise<void>;
  onCreate: (data: NodeCreate) => Promise<void>;
  mode?: 'edit' | 'create';
}

export const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  onClose,
  onUpdate,
  onDelete,
  onCreate,
  mode = 'edit',
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [nodeType, setNodeType] = useState<NodeType>('Country');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (node && mode === 'edit') {
      setFormData(node.data);
      setNodeType(node.data.nodeType);
    } else if (mode === 'create') {
      initializeFormData(nodeType);
    }
  }, [node, mode, nodeType]);

  const initializeFormData = (type: NodeType) => {
    const defaults: Record<NodeType, Record<string, any>> = {
      Country: {
        id: '',
        name: '',
        code: '',
        region: '',
        dataProtectionRegime: '',
        adequacyStatus: 'Not Adequate',
      },
      Database: {
        id: '',
        name: '',
        countryId: '',
        type: 'PostgreSQL',
        classification: 'Internal',
        owner: '',
      },
      Attribute: {
        id: '',
        name: '',
        databaseId: '',
        dataType: 'STRING',
        category: '',
        sensitivity: 'Medium',
        isPII: false,
      },
    };
    setFormData(defaults[type]);
  };

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
        await onUpdate(node.id, nodeType, { properties: formData });
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!node || !window.confirm('Are you sure you want to delete this node?')) {
      return;
    }

    setSaving(true);
    setError(null);
    
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
            <FormField label="ID" required>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => handleInputChange('id', e.target.value)}
                className="form-input"
                disabled={mode === 'edit'}
                placeholder="e.g., france"
              />
            </FormField>
            <FormField label="Name" required>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="e.g., France"
              />
            </FormField>
            <FormField label="Country Code" required>
              <input
                type="text"
                value={formData.code || ''}
                onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                className="form-input"
                maxLength={2}
                placeholder="e.g., FR"
              />
            </FormField>
            <FormField label="Region" required>
              <select
                value={formData.region || ''}
                onChange={(e) => handleInputChange('region', e.target.value)}
                className="form-input"
              >
                <option value="">Select Region</option>
                <option value="Europe">Europe</option>
                <option value="Asia">Asia</option>
                <option value="North America">North America</option>
                <option value="South America">South America</option>
                <option value="Africa">Africa</option>
                <option value="Oceania">Oceania</option>
              </select>
            </FormField>
            <FormField label="Data Protection Regime">
              <input
                type="text"
                value={formData.dataProtectionRegime || ''}
                onChange={(e) => handleInputChange('dataProtectionRegime', e.target.value)}
                className="form-input"
                placeholder="e.g., GDPR"
              />
            </FormField>
            <FormField label="Adequacy Status" required>
              <select
                value={formData.adequacyStatus || ''}
                onChange={(e) => handleInputChange('adequacyStatus', e.target.value)}
                className="form-input"
              >
                <option value="Adequate">Adequate</option>
                <option value="Not Adequate">Not Adequate</option>
                <option value="Partially Adequate">Partially Adequate</option>
              </select>
            </FormField>
          </>
        );

      case 'Database':
        return (
          <>
            <FormField label="ID" required>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => handleInputChange('id', e.target.value)}
                className="form-input"
                disabled={mode === 'edit'}
                placeholder="e.g., france_customer_db"
              />
            </FormField>
            <FormField label="Name" required>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="e.g., France Customer Database"
              />
            </FormField>
            <FormField label="Country ID" required>
              <input
                type="text"
                value={formData.countryId || ''}
                onChange={(e) => handleInputChange('countryId', e.target.value)}
                className="form-input"
                placeholder="e.g., france"
              />
            </FormField>
            <FormField label="Database Type" required>
              <select
                value={formData.type || ''}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="form-input"
              >
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="MySQL">MySQL</option>
                <option value="MongoDB">MongoDB</option>
                <option value="Snowflake">Snowflake</option>
                <option value="BigQuery">BigQuery</option>
                <option value="Oracle">Oracle</option>
                <option value="SQL Server">SQL Server</option>
              </select>
            </FormField>
            <FormField label="Classification" required>
              <select
                value={formData.classification || ''}
                onChange={(e) => handleInputChange('classification', e.target.value)}
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
                placeholder="e.g., Data Engineering Team"
              />
            </FormField>
          </>
        );

      case 'Attribute':
        return (
          <>
            <FormField label="ID" required>
              <input
                type="text"
                value={formData.id || ''}
                onChange={(e) => handleInputChange('id', e.target.value)}
                className="form-input"
                disabled={mode === 'edit'}
                placeholder="e.g., customer_email"
              />
            </FormField>
            <FormField label="Name" required>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="form-input"
                placeholder="e.g., email_address"
              />
            </FormField>
            <FormField label="Database ID" required>
              <input
                type="text"
                value={formData.databaseId || ''}
                onChange={(e) => handleInputChange('databaseId', e.target.value)}
                className="form-input"
                placeholder="e.g., france_customer_db"
              />
            </FormField>
            <FormField label="Data Type" required>
              <select
                value={formData.dataType || ''}
                onChange={(e) => handleInputChange('dataType', e.target.value)}
                className="form-input"
              >
                <option value="STRING">STRING</option>
                <option value="INTEGER">INTEGER</option>
                <option value="DECIMAL">DECIMAL</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="DATE">DATE</option>
                <option value="TIMESTAMP">TIMESTAMP</option>
                <option value="JSON">JSON</option>
                <option value="TEXT">TEXT</option>
              </select>
            </FormField>
            <FormField label="Category" required>
              <input
                type="text"
                value={formData.category || ''}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="form-input"
                placeholder="e.g., Personal Data"
              />
            </FormField>
            <FormField label="Sensitivity" required>
              <select
                value={formData.sensitivity || ''}
                onChange={(e) => handleInputChange('sensitivity', e.target.value)}
                className="form-input"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </FormField>
            <FormField label="PII Classification">
              <label className="flex items-center gap-3 cursor-pointer p-3 glass rounded-xl">
                <input
                  type="checkbox"
                  checked={formData.isPII || false}
                  onChange={(e) => handleInputChange('isPII', e.target.checked)}
                  className="w-5 h-5 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500 focus:ring-2"
                />
                <span className="text-sm font-medium text-gray-700">Contains Personally Identifiable Information</span>
              </label>
            </FormField>
          </>
        );
    }
  };

  if (!node && mode === 'edit') return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in"
      style={{
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <div className="glass rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-slide-in-right">
        {/* Header with gradient */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl glass-ultra-light flex items-center justify-center shadow-lg">
              {mode === 'create' ? <Plus size={24} className="text-white" /> : <Save size={24} className="text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {mode === 'create' ? 'Create New Node' : 'Edit Node'}
              </h2>
              <p className="text-sm text-indigo-100 font-medium">
                {mode === 'create' ? 'Add a new node to your lineage graph' : 'Update node properties'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors p-2 glass-ultra-light rounded-xl"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {mode === 'create' && (
            <FormField label="Node Type" required>
              <select
                value={nodeType}
                onChange={(e) => {
                  const newType = e.target.value as NodeType;
                  setNodeType(newType);
                  initializeFormData(newType);
                }}
                className="form-input"
              >
                <option value="Country">Country</option>
                <option value="Database">Database</option>
                <option value="Attribute">Attribute</option>
              </select>
            </FormField>
          )}

          {renderFormFields()}

          {error && (
            <div className="glass-ultra-light border-l-4 border-red-500 rounded-2xl p-4 flex items-start gap-3 animate-fade-in shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-red-500 bg-opacity-20 flex items-center justify-center">
                <AlertCircle className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="glass-ultra-light border-l-4 border-green-500 rounded-2xl p-4 flex items-start gap-3 animate-fade-in shadow-lg">
              <div className="w-10 h-10 rounded-xl bg-green-500 bg-opacity-20 flex items-center justify-center">
                <CheckCircle2 className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-900">Success</p>
                <p className="text-sm text-green-700">Node saved successfully!</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 glass rounded-b-3xl">
          {mode === 'edit' && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl font-semibold tracking-wide"
              style={{
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              }}
            >
              <Trash2 size={18} />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg font-semibold tracking-wide"
            style={{
              boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            }}
          >
            {mode === 'create' ? <Plus size={18} /> : <Save size={18} />}
            {saving ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin-smooth"></div>
                <span>Saving...</span>
              </div>
            ) : (
              mode === 'create' ? 'Create Node' : 'Save Changes'
            )}
          </button>
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
      <label className="block text-sm font-semibold text-gray-700 mb-2 tracking-tight">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
};