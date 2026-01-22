// frontend/src/components/lineage/HierarchyTreeMUI.tsx
// FULLY FIXED for @mui/x-tree-view v6+

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
  Search,
  Add,
  Edit,
  Delete,
  Key as KeyIcon,
  Link as LinkIcon,
  Folder,
  TableChart,
  ViewColumn,
  ExpandMore,
  ChevronRight,
} from '@mui/icons-material';
import type { HierarchyTree as HierarchyTreeType, HierarchyNode, Attribute } from '../../types/lineage';

// ============================================
// TYPES
// ============================================

interface HierarchyTreeProps {
  hierarchy: HierarchyTreeType | null;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onAddSubclass?: (parentId: string) => void;
  onEditClass?: (nodeId: string) => void;
  onDeleteClass?: (nodeId: string) => void;
  onAttributeClick?: (attributeId: string, nodeId: string) => void;
  showAttributes?: boolean;
  showInstanceCounts?: boolean;
  editable?: boolean;
}

interface NodeMap {
  [key: string]: {
    node?: HierarchyNode;
    attribute?: Attribute;
    isAttribute: boolean;
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function flattenTreeNodes(nodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  const traverse = (node: HierarchyNode) => {
    result.push(node);
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return result;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const HierarchyTreeMUI: React.FC<HierarchyTreeProps> = ({
  hierarchy,
  selectedNodeId,
  onNodeSelect,
  onAddSubclass,
  onEditClass,
  onDeleteClass,
  onAttributeClick,
  showAttributes = true,
  showInstanceCounts = true,
  editable = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Build node map for quick lookups
  const nodeMap = useMemo<NodeMap>(() => {
    if (!hierarchy || !hierarchy.root_nodes) return {};

    const map: NodeMap = {};
    const allNodes = flattenTreeNodes(hierarchy.root_nodes);

    allNodes.forEach((node) => {
      map[node.id] = { node, isAttribute: false };

      if (showAttributes && node.attributes) {
        node.attributes.forEach((attr) => {
          const attrId = `attr_${node.id}_${attr.id}`;
          map[attrId] = { node, attribute: attr, isAttribute: true };
        });
      }
    });

    return map;
  }, [hierarchy, showAttributes]);

  const handleExpandedItemsChange = (
    _event: React.SyntheticEvent | null,
    itemIds: string[]
  ) => {
    setExpandedItems(itemIds);
  };

  const handleSelectedItemsChange = (
    _event: React.SyntheticEvent | null,
    itemId: string | null
  ) => {
    if (!itemId) return;

    const item = nodeMap[itemId];
    if (!item) return;

    if (item.isAttribute && item.attribute && item.node && onAttributeClick) {
      onAttributeClick(item.attribute.id, item.node.id);
    } else if (!item.isAttribute && item.node && onNodeSelect) {
      onNodeSelect(item.node.id);
    }
  };

  // Render node label
  const renderNodeLabel = useCallback(
    (node: HierarchyNode) => {
      const hasChildren = node.children && node.children.length > 0;
      const instanceCount = node.instance_count ?? 0;

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
          }}
        >
          {hasChildren ? (
            <Folder sx={{ fontSize: 18, color: 'primary.main' }} />
          ) : (
            <TableChart sx={{ fontSize: 18, color: 'action.active' }} />
          )}

          <Typography variant="body2" fontWeight={node.level === 0 ? 600 : 500}>
            {node.display_name || node.name}
          </Typography>

          {node.level > 0 && (
            <Chip
              label={`L${node.level}`}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}

          {showInstanceCounts && instanceCount > 0 && (
            <Chip
              label={`${instanceCount}`}
              size="small"
              color="success"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}

          {editable && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ ml: 'auto' }}
              onClick={(e) => e.stopPropagation()}
            >
              {onAddSubclass && (
                <Tooltip title="Add Subclass">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSubclass(node.id);
                    }}
                    sx={{ padding: 0.5 }}
                  >
                    <Add fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {onEditClass && (
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditClass(node.id);
                    }}
                    sx={{ padding: 0.5 }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {onDeleteClass && (
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClass(node.id);
                    }}
                    sx={{ padding: 0.5 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          )}
        </Box>
      );
    },
    [showInstanceCounts, editable, onAddSubclass, onEditClass, onDeleteClass]
  );

  // Render attribute label
  const renderAttributeLabel = useCallback((attr: Attribute) => {
    const getIcon = () => {
      if (attr.is_primary_key) return <KeyIcon sx={{ fontSize: 14, color: 'warning.main' }} />;
      if (attr.is_foreign_key) return <LinkIcon sx={{ fontSize: 14, color: 'secondary.main' }} />;
      return <ViewColumn sx={{ fontSize: 14, color: 'info.main' }} />;
    };

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          py: 0.25,
        }}
      >
        {getIcon()}
        <Typography variant="caption" fontFamily="monospace">
          {attr.name}
        </Typography>
        <Chip
          label={attr.data_type}
          size="small"
          sx={{
            height: 16,
            fontSize: '0.65rem',
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Box>
    );
  }, []);

  // Recursively render tree nodes
  const renderTreeNode = useCallback(
    (node: HierarchyNode): React.ReactElement => {
      const hasChildren = node.children && node.children.length > 0;
      const hasAttributes = showAttributes && node.attributes && node.attributes.length > 0;

      return (
        <TreeItem
          key={node.id}
          itemId={node.id}
          label={renderNodeLabel(node)}
          sx={{
            '& .MuiTreeItem-content': {
              padding: '4px 8px',
              '&:hover': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              },
              '&.Mui-selected': {
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                '&:hover': {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                },
              },
            },
          }}
        >
          {/* Render attributes first */}
          {hasAttributes &&
            node.attributes.map((attr) => (
              <TreeItem
                key={`attr_${node.id}_${attr.id}`}
                itemId={`attr_${node.id}_${attr.id}`}
                label={renderAttributeLabel(attr)}
                sx={{
                  '& .MuiTreeItem-content': {
                    padding: '2px 8px',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.info.main, 0.08),
                    },
                  },
                }}
              />
            ))}

          {/* Render child nodes */}
          {hasChildren && node.children.map((child) => renderTreeNode(child))}
        </TreeItem>
      );
    },
    [showAttributes, renderNodeLabel, renderAttributeLabel]
  );

  if (!hierarchy || !hierarchy.root_nodes || hierarchy.root_nodes.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">No hierarchy available</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search Bar */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search classes and attributes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Tree View */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <SimpleTreeView
          expandedItems={expandedItems}
          onExpandedItemsChange={handleExpandedItemsChange}
          selectedItems={selectedNodeId}
          onSelectedItemsChange={handleSelectedItemsChange}
          slots={{
            collapseIcon: ExpandMore,
            expandIcon: ChevronRight,
          }}
        >
          {hierarchy.root_nodes.map((node) => renderTreeNode(node))}
        </SimpleTreeView>
      </Box>
    </Box>
  );
};

export default HierarchyTreeMUI;