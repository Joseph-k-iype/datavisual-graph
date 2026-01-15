// frontend/src/components/CustomNode.tsx - FIXED VERSION
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Globe,
  Database as DatabaseIcon,
  FileText,
  Shield,
  AlertCircle,
  Lock,
  Users,
  Folder,
} from 'lucide-react';

interface CustomNodeData {
  nodeType: string;
  label: string;
  color: string;
  isSelected?: boolean;
  isHighlighted?: boolean;
  group?: string;
  // Country specific
  name?: string;
  code?: string;
  region?: string;
  dataProtectionRegime?: string;
  adequacyStatus?: string;
  // Database specific
  type?: string;
  classification?: string;
  owner?: string;
  // Attribute specific
  dataType?: string;
  category?: string;
  sensitivity?: string;
  isPII?: boolean;
  // Any other properties
  [key: string]: any;
}

const CustomNode: React.FC<NodeProps<CustomNodeData>> = ({ data, selected }) => {
  const nodeType = data.nodeType || 'Unknown';
  const isCountry = nodeType === 'Country';
  const isDatabase = nodeType === 'Database';
  const isAttribute = nodeType === 'Attribute';

  // Get icon based on node type
  const getIcon = () => {
    switch (nodeType) {
      case 'Country':
        return <Globe size={20} />;
      case 'Database':
        return <DatabaseIcon size={20} />;
      case 'Attribute':
        return <FileText size={20} />;
      default:
        return <FileText size={20} />;
    }
  };

  // Get sensitivity badge color
  const getSensitivityColor = (sensitivity: string) => {
    switch (sensitivity?.toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Get classification badge color
  const getClassificationColor = (classification: string) => {
    switch (classification?.toLowerCase()) {
      case 'production':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'staging':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'development':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'test':
        return 'bg-green-100 text-green-700 border-green-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-lg border-2 transition-all duration-200 ${
        selected || data.isSelected
          ? 'ring-4 ring-blue-200'
          : 'hover:shadow-xl hover:scale-105'
      } ${data.isHighlighted ? 'ring-2 ring-yellow-300' : ''}`}
      style={{
        borderColor: data.color || '#9CA3AF',
        minWidth: isCountry ? '220px' : isDatabase ? '200px' : '180px',
        minHeight: isCountry ? '140px' : isDatabase ? '120px' : '100px',
      }}
    >
      {/* Top Handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Header */}
      <div
        className="px-4 py-2 rounded-t-lg flex items-center justify-between"
        style={{ backgroundColor: data.color || '#9CA3AF' }}
      >
        <div className="flex items-center gap-2 text-white">
          {getIcon()}
          <span className="font-semibold text-sm">{nodeType}</span>
        </div>
        {data.group && (
          <div className="flex items-center gap-1 bg-white bg-opacity-20 px-2 py-0.5 rounded text-xs text-white">
            <Folder size={12} />
            <span className="truncate max-w-[80px]" title={data.group}>
              {data.group}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Name/Label */}
        <div className="font-semibold text-gray-900 text-sm truncate" title={data.label}>
          {data.label || data.name || 'Unnamed'}
        </div>

        {/* Country Specific */}
        {isCountry && (
          <>
            {data.code && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium">Code:</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded font-mono">{data.code}</span>
              </div>
            )}
            {data.region && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Globe size={12} />
                <span className="truncate" title={data.region}>{data.region}</span>
              </div>
            )}
            {data.adequacyStatus && (
              <div className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded border ${
                  data.adequacyStatus.toLowerCase() === 'adequate'
                    ? 'bg-green-100 text-green-700 border-green-300'
                    : 'bg-yellow-100 text-yellow-700 border-yellow-300'
                }`}>
                  {data.adequacyStatus}
                </span>
              </div>
            )}
          </>
        )}

        {/* Database Specific */}
        {isDatabase && (
          <>
            {data.type && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <DatabaseIcon size={12} />
                <span className="truncate" title={data.type}>{data.type}</span>
              </div>
            )}
            {data.classification && (
              <div className="flex items-center gap-1">
                <span className={`text-xs px-2 py-0.5 rounded border ${getClassificationColor(data.classification)}`}>
                  {data.classification}
                </span>
              </div>
            )}
            {data.owner && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Users size={12} />
                <span className="truncate" title={data.owner}>{data.owner}</span>
              </div>
            )}
          </>
        )}

        {/* Attribute Specific */}
        {isAttribute && (
          <>
            {data.dataType && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="font-medium">Type:</span>
                <span className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">
                  {data.dataType}
                </span>
              </div>
            )}
            {data.category && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <FileText size={12} />
                <span className="truncate" title={data.category}>{data.category}</span>
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {data.sensitivity && (
                <span className={`text-xs px-2 py-0.5 rounded border ${getSensitivityColor(data.sensitivity)}`}>
                  <Shield size={10} className="inline mr-1" />
                  {data.sensitivity}
                </span>
              )}
              {data.isPII && (
                <span className="text-xs px-2 py-0.5 rounded border bg-purple-100 text-purple-700 border-purple-300">
                  <Lock size={10} className="inline mr-1" />
                  PII
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Left Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Right Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="w-3 h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Selection Indicator */}
      {(selected || data.isSelected) && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
      )}

      {/* Highlight Indicator */}
      {data.isHighlighted && !data.isSelected && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
      )}
    </div>
  );
};

// SINGLE EXPORT - Use this component
export default CustomNode;