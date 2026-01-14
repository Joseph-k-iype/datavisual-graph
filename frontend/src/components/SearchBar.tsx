// frontend/src/components/Sidebar.tsx - ULTRA MINIMAL
import React from 'react';
import { Stats } from '../types';
import {
  BarChart3,
  Globe,
  Database as DatabaseIcon,
  Tag,
  ArrowRightLeft,
  Plus,
  RefreshCw,
  Filter,
} from 'lucide-react';

interface SidebarProps {
  stats: Stats | null;
  onRefresh: () => void;
  onCreateNode: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  stats,
  onRefresh,
  onCreateNode,
}) => {
  return (
    <div className="w-80 sidebar flex flex-col h-full animate-fade-in">
      {/* Header - generous white space */}
      <div className="p-8 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-black mb-2">Data Lineage</h2>
        <p className="text-sm text-gray-600 font-normal leading-relaxed">
          Cross-border Transfer Tracking
        </p>
      </div>

      {/* Quick Actions - generous spacing */}
      <div className="p-6 space-y-3 border-b border-gray-200">
        <button
          onClick={onCreateNode}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Create Node
        </button>
        <button
          onClick={onRefresh}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} />
          Refresh View
        </button>
      </div>

      {/* Stats Section - ultra clean */}
      <div className="p-6 flex-1 overflow-y-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={18} className="text-black" />
            <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
              Statistics
            </h3>
          </div>

          {stats ? (
            <div className="space-y-4 animate-fade-in">
              <StatCard
                icon={<Globe size={18} />}
                label="Countries"
                value={stats.totalCountries}
              />
              <StatCard
                icon={<DatabaseIcon size={18} />}
                label="Databases"
                value={stats.totalDatabases}
              />
              <StatCard
                icon={<Tag size={18} />}
                label="Attributes"
                value={stats.totalAttributes}
              />
              <StatCard
                icon={<ArrowRightLeft size={18} />}
                label="Transfers"
                value={stats.totalTransfers}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 card rounded animate-pulse bg-gray-50"></div>
              ))}
            </div>
          )}
        </div>

        {/* Data Categories - minimal tags */}
        {stats && stats.dataCategories.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <Filter size={18} className="text-black" />
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                Categories
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.dataCategories.map((category) => (
                <span key={category} className="tag cursor-pointer">
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Regions - clean list */}
        {stats && stats.regions.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <Globe size={18} className="text-black" />
              <h3 className="text-sm font-semibold text-black uppercase tracking-wide">
                Regions
              </h3>
            </div>
            <div className="space-y-2">
              {stats.regions.map((region) => (
                <div
                  key={region}
                  className="card rounded p-4 hover:border-black transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-black">{region}</span>
                    <span className="text-xs text-gray-500">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value }) => {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="icon-wrapper">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <div className="text-3xl font-semibold text-black">{value}</div>
        <div className="text-sm text-gray-600 font-normal">{label}</div>
      </div>
    </div>
  );
};