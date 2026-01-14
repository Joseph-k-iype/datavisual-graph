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
  TrendingUp,
  Shield,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  stats: Stats | null;
  onRefresh: () => void;
  onCreateNode: () => void;
  onFilterChange?: (filters: any) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  stats,
  onRefresh,
  onCreateNode,
}) => {
  return (
    <div className="w-80 glass-thick flex flex-col h-full shadow-2xl animate-slide-in-right">
      {/* Header with Apple-style vibrancy */}
      <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 shimmer"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl glass-ultra-light flex items-center justify-center shadow-lg">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Data Lineage
              </h1>
            </div>
          </div>
          <p className="text-indigo-100 text-sm font-medium">
            Cross-border Transfer Tracking
          </p>
        </div>
      </div>

      {/* Quick Actions with glass buttons */}
      <div className="p-4 space-y-3 border-b border-white border-opacity-10">
        <button
          onClick={onCreateNode}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 shadow-lg font-semibold tracking-wide"
          style={{
            boxShadow: '0 8px 16px rgba(99, 102, 241, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          }}
        >
          <Plus size={18} />
          Create Node
        </button>
        <button
          onClick={onRefresh}
          className="btn-glass w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-2xl font-semibold tracking-wide"
        >
          <RefreshCw size={18} />
          Refresh View
        </button>
      </div>

      {/* Stats Section */}
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={20} className="text-indigo-300" />
            <h2 className="text-base font-bold text-white tracking-tight">Live Statistics</h2>
          </div>

          {stats ? (
            <div className="space-y-3 animate-fade-in">
              <StatCard
                icon={<Globe size={20} className="text-white" />}
                label="Countries"
                value={stats.totalCountries}
                gradient="from-indigo-500 to-purple-600"
                trend="+2"
              />
              <StatCard
                icon={<DatabaseIcon size={20} className="text-white" />}
                label="Databases"
                value={stats.totalDatabases}
                gradient="from-pink-500 to-rose-600"
                trend="+5"
              />
              <StatCard
                icon={<Tag size={20} className="text-white" />}
                label="Attributes"
                value={stats.totalAttributes}
                gradient="from-cyan-500 to-blue-600"
                trend="+12"
              />
              <StatCard
                icon={<ArrowRightLeft size={20} className="text-white" />}
                label="Transfers"
                value={stats.totalTransfers}
                gradient="from-green-500 to-emerald-600"
                trend="+3"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 glass rounded-2xl animate-pulse"></div>
              ))}
            </div>
          )}
        </div>

        {/* Data Categories with glass tags */}
        {stats && stats.dataCategories.length > 0 && (
          <div className="mb-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={20} className="text-indigo-300" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Data Categories
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.dataCategories.map((category) => (
                <span
                  key={category}
                  className="tag px-3 py-2 text-xs text-white rounded-full font-semibold shadow-lg cursor-pointer"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Regions with glass cards */}
        {stats && stats.regions.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={20} className="text-indigo-300" />
              <h2 className="text-base font-bold text-white tracking-tight">Regions</h2>
            </div>
            <div className="space-y-2">
              {stats.regions.map((region) => (
                <div
                  key={region}
                  className="card-glass px-4 py-3 rounded-2xl text-sm text-white font-medium cursor-pointer"
                >
                  {region}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white border-opacity-10 glass">
        <div className="flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-yellow-300" />
            <span className="font-medium">Powered by FalkorDB</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg" style={{
              boxShadow: '0 0 8px rgba(74, 222, 128, 0.8)'
            }}></div>
            <span className="font-medium">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  gradient: string;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, gradient, trend }) => {
  return (
    <div className="stat-card rounded-2xl p-4 cursor-pointer group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}
            style={{
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3)'
            }}
          >
            {icon}
          </div>
          <span className="text-sm text-gray-200 font-medium">{label}</span>
        </div>
        {trend && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
            style={{
              background: 'rgba(34, 197, 94, 0.2)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'rgb(134, 239, 172)'
            }}
          >
            <TrendingUp size={12} />
            {trend}
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white group-hover:scale-105 transition-transform duration-300 tracking-tight">
        {value}
      </div>
    </div>
  );
};