// frontend/src/components/LandingPage.tsx

import React, { useState, useEffect } from 'react';
import { Plus, Database, FileText, TrendingUp, ArrowRight } from 'lucide-react';
import { SchemaListItem } from '../types';
import apiService from '../services/api';

interface LandingPageProps {
  onCreateSchema: () => void;
  onOpenSchema: (schemaId: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onCreateSchema,
  onOpenSchema,
}) => {
  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchemas();
  }, []);

  const loadSchemas = async () => {
    try {
      setLoading(true);
      const data = await apiService.listSchemas();
      setSchemas(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schemas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8 py-16">
          <div className="text-center">
            <h1 className="text-5xl font-semibold text-black mb-4">
              Data Lineage Dashboard
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Define schemas, load data, and visualize cross-border data transfers
              with hierarchical lineage tracking
            </p>
            
            <button
              onClick={onCreateSchema}
              className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-3"
            >
              <Plus size={24} />
              Create New Schema
            </button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <FeatureCard
            icon={<Database size={32} />}
            title="Define Schema"
            description="Create classes, objects, and relationships with custom cardinality"
          />
          <FeatureCard
            icon={<FileText size={32} />}
            title="Load Data"
            description="Import data from CSV, Excel, JSON, or XML files with intelligent mapping"
          />
          <FeatureCard
            icon={<TrendingUp size={32} />}
            title="Visualize Lineage"
            description="Explore hierarchical views with expandable schemas and highlighted paths"
          />
        </div>

        {/* Existing Schemas */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-black">Your Schemas</h2>
            <button
              onClick={loadSchemas}
              className="btn-secondary text-sm"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="card rounded-lg h-48 animate-pulse bg-gray-100"
                />
              ))}
            </div>
          ) : error ? (
            <div className="card rounded-lg p-8 text-center">
              <div className="text-red-600 mb-4">⚠️ {error}</div>
              <button onClick={loadSchemas} className="btn-secondary">
                Try Again
              </button>
            </div>
          ) : schemas.length === 0 ? (
            <div className="card rounded-lg p-12 text-center">
              <Database size={48} className="mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Schemas Yet
              </h3>
              <p className="text-gray-600 mb-6">
                Get started by creating your first schema
              </p>
              <button onClick={onCreateSchema} className="btn-primary">
                <Plus size={20} />
                Create Schema
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schemas.map((schema) => (
                <SchemaCard
                  key={schema.id}
                  schema={schema}
                  onOpen={onOpenSchema}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className="card rounded-lg p-8 text-center hover:border-gray-400 transition-all">
      <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-gray-50 flex items-center justify-center text-black">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-black mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
};

interface SchemaCardProps {
  schema: SchemaListItem;
  onOpen: (schemaId: string) => void;
}

const SchemaCard: React.FC<SchemaCardProps> = ({ schema, onOpen }) => {
  return (
    <div
      className="card rounded-lg p-6 hover:border-gray-400 transition-all cursor-pointer group"
      onClick={() => onOpen(schema.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center text-black">
          <Database size={24} />
        </div>
        <ArrowRight
          size={20}
          className="text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all"
        />
      </div>
      
      <h3 className="text-lg font-semibold text-black mb-1 truncate">
        {schema.name}
      </h3>
      
      {schema.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {schema.description}
        </p>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-200">
        <span>{schema.class_count} classes</span>
        <span>v{schema.version}</span>
      </div>
    </div>
  );
};