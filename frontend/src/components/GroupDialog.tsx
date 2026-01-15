// frontend/src/components/GroupDialog.tsx
import React, { useState, useEffect } from 'react';
import { X, Users, Folder, Trash2, Check } from 'lucide-react';
import { useGroups } from '../hooks/useGroups';

interface GroupDialogProps {
  selectedNodeIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export const GroupDialog: React.FC<GroupDialogProps> = ({
  selectedNodeIds,
  onClose,
  onSuccess,
}) => {
  const [groupName, setGroupName] = useState('');
  const [existingGroups, setExistingGroups] = useState<string[]>([]);
  const [selectedExistingGroup, setSelectedExistingGroup] = useState<string>('');
  const [useExisting, setUseExisting] = useState(false);
  const { loading, error, groupNodes, ungroupNodes, getAllGroups } = useGroups();

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const groups = await getAllGroups();
      setExistingGroups(groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  const handleGroup = async () => {
    try {
      const finalGroupName = useExisting ? selectedExistingGroup : groupName;
      
      if (!finalGroupName.trim()) {
        return;
      }

      await groupNodes(selectedNodeIds, finalGroupName);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to group nodes:', err);
    }
  };

  const handleUngroup = async () => {
    try {
      await ungroupNodes(selectedNodeIds);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to ungroup nodes:', err);
    }
  };

  const isValid = useExisting 
    ? selectedExistingGroup.trim().length > 0 
    : groupName.trim().length > 0;

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
        className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Group Nodes
              </h2>
              <p className="text-sm text-gray-600">
                {selectedNodeIds.length} node{selectedNodeIds.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Toggle between new and existing group */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setUseExisting(false)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                !useExisting
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              New Group
            </button>
            <button
              onClick={() => setUseExisting(true)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                useExisting
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Existing Group
            </button>
          </div>

          {/* New Group Input */}
          {!useExisting && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={100}
              />
            </div>
          )}

          {/* Existing Group Selection */}
          {useExisting && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Group
              </label>
              {existingGroups.length > 0 ? (
                <select
                  value={selectedExistingGroup}
                  onChange={(e) => setSelectedExistingGroup(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a group...</option>
                  {existingGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  No existing groups found. Create a new one instead.
                </p>
              )}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Folder className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-blue-900">
                Grouped nodes will have a 'group' property added in FalkorDB that you can use for filtering and visualization.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleUngroup}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 font-medium text-sm"
          >
            <Trash2 size={16} />
            Remove Group
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleGroup}
              disabled={loading || !isValid}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Grouping...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Apply Group</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};