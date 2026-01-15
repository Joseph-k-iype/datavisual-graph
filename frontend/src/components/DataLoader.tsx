// frontend/src/components/DataLoader.tsx

import React, { useState } from 'react';
import {
  Upload,
  X,
  FileText,
  Table,
  Code,
  File,
  ArrowRight,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react';
import {
  SchemaDefinition,
  DataFormat,
  ClassDataMapping,
  ColumnMapping,
  RelationshipMapping,
} from '../types';
import apiService from '../services/api';

interface DataLoaderProps {
  schema: SchemaDefinition;
  onComplete: () => void;
  onCancel: () => void;
}

export const DataLoader: React.FC<DataLoaderProps> = ({
  schema,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'mapping' | 'loading'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<DataFormat | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [classMappings, setClassMappings] = useState<ClassDataMapping[]>([]);
  const [relationshipMappings, setRelationshipMappings] = useState<RelationshipMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setError(null);
      setFile(selectedFile);

      // Detect format
      let detectedFormat: DataFormat;
      if (selectedFile.name.endsWith('.csv')) {
        detectedFormat = DataFormat.CSV;
      } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        detectedFormat = DataFormat.EXCEL;
      } else if (selectedFile.name.endsWith('.json')) {
        detectedFormat = DataFormat.JSON;
      } else if (selectedFile.name.endsWith('.xml')) {
        detectedFormat = DataFormat.XML;
      } else {
        setError('Unsupported file format');
        return;
      }
      setFormat(detectedFormat);

      // Preview file
      const previewData = await apiService.previewFile(selectedFile);
      setColumns(previewData.columns);
      setPreview(previewData.preview);

      // Initialize mappings
      setClassMappings(
        schema.classes.map((cls) => ({
          class_id: cls.id,
          column_mappings: [],
          primary_key: undefined,
        }))
      );

      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview file');
    }
  };

  const handleUpdateMapping = (
    classId: string,
    columnMappings: ColumnMapping[],
    primaryKey?: string
  ) => {
    setClassMappings(
      classMappings.map((m) =>
        m.class_id === classId
          ? { ...m, column_mappings: columnMappings, primary_key: primaryKey }
          : m
      )
    );
  };

  const handleLoad = async () => {
    if (!file || !format) return;

    try {
      setLoading(true);
      setError(null);
      setStep('loading');

      console.log('Starting data load...');
      console.log('Schema ID:', schema.id);
      console.log('File:', file.name);
      console.log('Format:', format);
      console.log('Class Mappings:', classMappings.filter((m) => m.column_mappings.length > 0));

      const response = await apiService.loadData(schema.id, file, {
        format,
        class_mappings: classMappings.filter((m) => m.column_mappings.length > 0),
        relationship_mappings: relationshipMappings.length > 0 ? relationshipMappings : undefined,
      });

      console.log('Load response:', response);
      setResult(response);
      setLoading(false);
      
      if (response.success) {
        console.log('Load successful! Instances:', response.instances_created);
        // Wait a bit to show success message, then complete
        setTimeout(() => {
          console.log('Calling onComplete...');
          onComplete();
        }, 1500);
      } else {
        console.error('Load failed:', response.errors);
        // Show errors and go back to mapping
        setTimeout(() => {
          setStep('mapping');
        }, 3000);
      }
    } catch (err) {
      console.error('Load error:', err);
      setLoading(false);
      setError(err instanceof Error ? err.message : 'Failed to load data');
      setResult({
        success: false,
        schema_id: schema.id,
        instances_created: 0,
        relationships_created: 0,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
        warnings: [],
      });
      
      // Go back to mapping after showing error
      setTimeout(() => {
        setStep('mapping');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-black">Load Data</h1>
              <p className="text-sm text-gray-600 mt-1">
                {schema.name}
              </p>
            </div>
            <button onClick={onCancel} className="btn-secondary">
              <X size={20} />
              Cancel
            </button>
          </div>

          {/* Progress */}
          {step !== 'loading' && (
            <div className="mt-6 flex gap-2">
              <div className={`h-1 flex-1 rounded ${step === 'upload' || step === 'preview' || step === 'mapping' ? 'bg-black' : 'bg-gray-200'}`} />
              <div className={`h-1 flex-1 rounded ${step === 'preview' || step === 'mapping' ? 'bg-black' : 'bg-gray-200'}`} />
              <div className={`h-1 flex-1 rounded ${step === 'mapping' ? 'bg-black' : 'bg-gray-200'}`} />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8">
        {error && (
          <div className="mb-6 card rounded-lg p-4 bg-red-50 border-red-200 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {step === 'upload' && (
          <UploadStep onFileSelect={handleFileSelect} />
        )}

        {step === 'preview' && (
          <PreviewStep
            file={file!}
            format={format!}
            preview={preview}
            columns={columns}
            onNext={() => setStep('mapping')}
            onBack={() => {
              setStep('upload');
              setFile(null);
              setFormat(null);
              setPreview([]);
              setColumns([]);
            }}
          />
        )}

        {step === 'mapping' && (
          <MappingStep
            schema={schema}
            columns={columns}
            classMappings={classMappings}
            relationshipMappings={relationshipMappings}
            onUpdateMapping={handleUpdateMapping}
            onUpdateRelationships={setRelationshipMappings}
            onLoad={handleLoad}
            onBack={() => setStep('preview')}
          />
        )}

        {step === 'loading' && (
          <LoadingStep result={result} loading={loading} />
        )}
      </div>
    </div>
  );
};

// Upload Step
interface UploadStepProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const UploadStep: React.FC<UploadStepProps> = ({ onFileSelect }) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card rounded-lg p-12 text-center">
        <Upload size={64} className="mx-auto text-gray-400 mb-6" />
        <h2 className="text-2xl font-semibold text-black mb-2">
          Upload Data File
        </h2>
        <p className="text-gray-600 mb-8">
          Select a CSV, Excel, JSON, or XML file to import data
        </p>

        <input
          type="file"
          id="file-upload"
          accept=".csv,.xlsx,.xls,.json,.xml"
          onChange={onFileSelect}
          className="hidden"
        />
        <label htmlFor="file-upload" className="btn-primary inline-flex cursor-pointer">
          <Upload size={20} />
          Select File
        </label>

        <div className="mt-12 grid grid-cols-2 gap-4 text-left">
          <FormatCard
            icon={<Table size={24} />}
            format="CSV"
            description="Comma-separated values"
          />
          <FormatCard
            icon={<FileText size={24} />}
            format="Excel"
            description="Spreadsheet files (.xlsx, .xls)"
          />
          <FormatCard
            icon={<Code size={24} />}
            format="JSON"
            description="JavaScript Object Notation"
          />
          <FormatCard
            icon={<File size={24} />}
            format="XML"
            description="Extensible Markup Language"
          />
        </div>
      </div>
    </div>
  );
};

const FormatCard: React.FC<{
  icon: React.ReactNode;
  format: string;
  description: string;
}> = ({ icon, format, description }) => {
  return (
    <div className="card rounded-lg p-4 flex items-center gap-3">
      <div className="text-gray-600">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-black">{format}</div>
        <div className="text-xs text-gray-600">{description}</div>
      </div>
    </div>
  );
};

// Preview Step
interface PreviewStepProps {
  file: File;
  format: DataFormat;
  preview: any[];
  columns: string[];
  onNext: () => void;
  onBack: () => void;
}

const PreviewStep: React.FC<PreviewStepProps> = ({
  file,
  format,
  preview,
  columns,
  onNext,
  onBack,
}) => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-black mb-6">Preview Data</h2>

      <div className="card rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <FileText size={32} className="text-gray-600" />
            <div>
              <div className="text-sm font-semibold text-black">{file.name}</div>
              <div className="text-xs text-gray-600">
                Format: {format} • {preview.length} rows
              </div>
            </div>
          </div>
          <Check size={24} className="text-green-600" />
        </div>
      </div>

      <div className="card rounded-lg overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {columns.map((col, colIdx) => (
                  <th
                    key={`header-${colIdx}-${col}`}
                    className="px-4 py-3 text-left text-xs font-semibold text-black uppercase tracking-wide"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {preview.slice(0, 5).map((row, rowIdx) => (
                <tr key={`row-${rowIdx}`}>
                  {columns.map((col, colIdx) => (
                    <td key={`cell-${rowIdx}-${colIdx}`} className="px-4 py-3 text-sm text-gray-900">
                      {String(row[col] || '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {preview.length > 5 && (
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            Showing 5 of {preview.length} rows
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button onClick={onNext} className="btn-primary">
          Next: Configure Mapping
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

// Mapping Step
interface MappingStepProps {
  schema: SchemaDefinition;
  columns: string[];
  classMappings: ClassDataMapping[];
  relationshipMappings: RelationshipMapping[];
  onUpdateMapping: (
    classId: string,
    columnMappings: ColumnMapping[],
    primaryKey?: string
  ) => void;
  onUpdateRelationships: (mappings: RelationshipMapping[]) => void;
  onLoad: () => void;
  onBack: () => void;
}

const MappingStep: React.FC<MappingStepProps> = ({
  schema,
  columns,
  classMappings,
  onUpdateMapping,
  onLoad,
  onBack,
}) => {
  const [selectedClass, setSelectedClass] = useState(schema.classes[0]?.id);
  
  const currentClass = schema.classes.find((c) => c.id === selectedClass);
  const currentMapping = classMappings.find((m) => m.class_id === selectedClass);

  const handleAddMapping = (attribute: string) => {
    if (!currentMapping) return;
    
    const newMapping: ColumnMapping = {
      source_column: '',
      target_attribute: attribute,
    };
    
    onUpdateMapping(
      selectedClass!,
      [...currentMapping.column_mappings, newMapping],
      currentMapping.primary_key
    );
  };

  const handleUpdateColumnMapping = (
    index: number,
    sourceColumn: string
  ) => {
    if (!currentMapping) return;
    
    const updated = [...currentMapping.column_mappings];
    updated[index] = { ...updated[index], source_column: sourceColumn };
    
    onUpdateMapping(selectedClass!, updated, currentMapping.primary_key);
  };

  const handleRemoveMapping = (index: number) => {
    if (!currentMapping) return;
    
    onUpdateMapping(
      selectedClass!,
      currentMapping.column_mappings.filter((_, i) => i !== index),
      currentMapping.primary_key
    );
  };

  const handleSetPrimaryKey = (column: string) => {
    if (!currentMapping) return;
    
    onUpdateMapping(
      selectedClass!,
      currentMapping.column_mappings,
      column
    );
  };

  const isValid = classMappings.some((m) => m.column_mappings.length > 0);

  return (
    <div>
      <h2 className="text-xl font-semibold text-black mb-6">Configure Mappings</h2>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="col-span-1">
          <div className="card rounded-lg p-4">
            <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wide">
              Classes
            </h3>
            <div className="space-y-2">
              {schema.classes.map((cls) => {
                const mapping = classMappings.find((m) => m.class_id === cls.id);
                const count = mapping?.column_mappings.length || 0;
                
                return (
                  <button
                    key={cls.id}
                    onClick={() => setSelectedClass(cls.id)}
                    className={`w-full text-left px-3 py-2 rounded transition-colors ${
                      selectedClass === cls.id
                        ? 'bg-gray-100 text-black font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{cls.name}</span>
                      {count > 0 && (
                        <span className="text-xs bg-black text-white px-2 py-0.5 rounded">
                          {count}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="col-span-3">
          {currentClass && currentMapping && (
            <div className="card rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-black">
                    {currentClass.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Map columns to attributes
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {currentMapping.column_mappings.map((mapping, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Source Column
                      </label>
                      <select
                        value={mapping.source_column}
                        onChange={(e) =>
                          handleUpdateColumnMapping(idx, e.target.value)
                        }
                        className="input-field"
                      >
                        <option value="" key="empty-option">Select column...</option>
                        {columns.map((col, colIdx) => (
                          <option key={`col-${colIdx}-${col}`} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>

                    <ArrowRight size={20} className="text-gray-400 flex-shrink-0 mt-6" />

                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Target Attribute
                      </label>
                      <input
                        type="text"
                        value={mapping.target_attribute}
                        readOnly
                        className="input-field bg-white"
                      />
                    </div>

                    <button
                      onClick={() => handleRemoveMapping(idx)}
                      className="p-2 hover:bg-gray-200 rounded transition-colors flex-shrink-0 mt-6"
                    >
                      <X size={20} className="text-gray-600" />
                    </button>
                  </div>
                ))}

                {currentMapping.column_mappings.length === 0 && (
                  <div className="text-center py-8 text-gray-600">
                    No mappings configured. Add attributes below to get started.
                  </div>
                )}

                {/* Unmapped Attributes */}
                {currentClass.attributes.filter(
                  (attr) =>
                    !currentMapping.column_mappings.some(
                      (m) => m.target_attribute === attr
                    )
                ).length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Available Attributes
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {currentClass.attributes
                        .filter(
                          (attr) =>
                            !currentMapping.column_mappings.some(
                              (m) => m.target_attribute === attr
                            )
                        )
                        .map((attr) => (
                          <button
                            key={attr}
                            onClick={() => handleAddMapping(attr)}
                            className="px-3 py-1 text-sm border border-gray-300 rounded hover:border-black transition-colors"
                          >
                            <Plus size={14} className="inline mr-1" />
                            {attr}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Primary Key Selection */}
                <div className="pt-4 border-t border-gray-200">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    Primary Key (for relationships)
                  </label>
                  <select
                    value={currentMapping.primary_key || ''}
                    onChange={(e) => handleSetPrimaryKey(e.target.value)}
                    className="input-field max-w-xs"
                  >
                    <option value="" key="none-option">None</option>
                    {columns.map((col, colIdx) => (
                      <option key={`pk-${colIdx}-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button onClick={onLoad} className="btn-primary" disabled={!isValid}>
          <Upload size={20} />
          Load Data
        </button>
      </div>
    </div>
  );
};

// Loading Step
interface LoadingStepProps {
  result: any;
  loading: boolean;
}

const LoadingStep: React.FC<LoadingStepProps> = ({ result, loading }) => {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="card rounded-lg p-12 text-center">
        {loading ? (
          <>
            <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-black mb-2">
              Loading Data...
            </h2>
            <p className="text-gray-600">
              Processing your file and creating instances
            </p>
          </>
        ) : result?.success ? (
          <>
            <Check size={64} className="mx-auto text-green-600 mb-6" />
            <h2 className="text-2xl font-semibold text-black mb-2">
              Data Loaded Successfully!
            </h2>
            <p className="text-gray-600 mb-8">
              Created {result.instances_created} instances and{' '}
              {result.relationships_created} relationships
            </p>
            {result.warnings && result.warnings.length > 0 && (
              <div className="text-left max-w-md mx-auto mt-6 p-4 bg-yellow-50 rounded-lg">
                <div className="text-sm font-medium text-yellow-800 mb-2">Warnings:</div>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {result.warnings.slice(0, 5).map((warning: string, idx: number) => (
                    <li key={idx}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-sm text-gray-600 mt-6 flex items-center justify-center gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              Redirecting to visualization...
            </div>
          </>
        ) : (
          <>
            <AlertCircle size={64} className="mx-auto text-red-600 mb-6" />
            <h2 className="text-2xl font-semibold text-black mb-2">
              Load Failed
            </h2>
            <p className="text-gray-600 mb-4">
              There were errors loading your data
            </p>
            {result?.errors && result.errors.length > 0 && (
              <div className="text-left max-w-md mx-auto mt-6 p-4 bg-red-50 rounded-lg">
                <div className="text-sm font-medium text-red-800 mb-2">Errors:</div>
                <ul className="text-sm text-red-600 space-y-1">
                  {result.errors.slice(0, 5).map((err: string, idx: number) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="text-sm text-gray-600 mt-6">
              Returning to mapping step...
            </div>
          </>
        )}
      </div>
    </div>
  );
};