import { useEffect, useRef } from 'react';
import { Node } from 'reactflow';
import {
  Edit3,
  Trash2,
  Copy,
  Share2,
  Eye,
  GitBranch,
  Info,
  X,
} from 'lucide-react';

interface ContextMenuProps {
  node: Node | null;
  position: { x: number; y: number };
  onClose: () => void;
  onEdit: (node: Node) => void;
  onDelete: (node: Node) => void;
  onViewLineage: (node: Node) => void;
  onCopyId: (node: Node) => void;
  onViewDetails: (node: Node) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  node,
  position,
  onClose,
  onEdit,
  onDelete,
  onViewLineage,
  onCopyId,
  onViewDetails,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!node) return null;

  const menuItems = [
    {
      icon: Info,
      label: 'View Details',
      onClick: () => {
        onViewDetails(node);
        onClose();
      },
      color: 'text-blue-600',
    },
    {
      icon: GitBranch,
      label: 'View Lineage',
      onClick: () => {
        onViewLineage(node);
        onClose();
      },
      color: 'text-purple-600',
    },
    {
      icon: Edit3,
      label: 'Edit Node',
      onClick: () => {
        onEdit(node);
        onClose();
      },
      color: 'text-gray-700',
    },
    {
      icon: Copy,
      label: 'Copy ID',
      onClick: () => {
        onCopyId(node);
        onClose();
      },
      color: 'text-gray-700',
    },
    {
      icon: Share2,
      label: 'Share',
      onClick: () => {
        // Implement share functionality
        navigator.clipboard.writeText(`${window.location.origin}?node=${node.id}`);
        onClose();
      },
      color: 'text-gray-700',
    },
    {
      icon: Trash2,
      label: 'Delete Node',
      onClick: () => {
        if (window.confirm(`Are you sure you want to delete "${node.data.label}"?`)) {
          onDelete(node);
        }
        onClose();
      },
      color: 'text-red-600',
      divider: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-50 glass rounded-2xl shadow-2xl overflow-hidden animate-fade-in"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        minWidth: '220px',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {node.data.nodeType}
            </p>
            <p className="text-sm font-bold text-gray-900 truncate max-w-[160px]">
              {node.data.label}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <div className="py-2">
        {menuItems.map((item, index) => (
          <div key={index}>
            {item.divider && <div className="my-2 border-t border-gray-200" />}
            <button
              onClick={item.onClick}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left group"
            >
              <item.icon size={18} className={`${item.color} group-hover:scale-110 transition-transform`} />
              <span className={`text-sm font-medium ${item.color}`}>
                {item.label}
              </span>
            </button>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          ID: <span className="font-mono text-gray-700">{node.id}</span>
        </p>
      </div>
    </div>
  );
};