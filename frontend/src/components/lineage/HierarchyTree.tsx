// frontend/src/components/lineage/HierarchyTree.tsx
// FULLY FIXED for @mui/x-tree-view v6+

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
  ChevronRight,
  ExpandMore,
  Search,
  Folder,
  FolderOpen,
  TableChart,
  ViewColumn,
  Add,
  Edit,
  Delete,
  Key as KeyIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { HierarchyTree as HierarchyTreeType, HierarchyNode, Attribute } from '../../types/lineage';

// ============================================
// TYPES
// ============================================

interface HierarchyTreeProps {
  hierarchy: HierarchyTreeType | null;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onAttributeClick?: (attributeId: string, nodeId: string) => void;
  onAddSubclass?: (parentId: string) => void;
  onEditClass?: (nodeId: string) => void;
  onDeleteClass?: (nodeId: string) => void;
  showAttributes?: boolean;
  showInstanceCounts?: boolean;
  editable?: boolean;
}

interface NodeContextMenuState {
  mouseX: number;
  mouseY: number;
  nodeId: string | null;
  nodeName: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function flattenTree(nodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  const traverse = (node: HierarchyNode) => {
    result.push(node);
    node.children.forEach(traverse);
  };
  nodes.forEach(traverse);
  return result;
}

// ============================================
// SUB-COMPONENTS
// ============================================

const AttributeTreeItem: React.FC<{
  attribute: Attribute;
  itemId: string;
  parentNodeId: string;
  onAttributeClick?: (attributeId: string, nodeId: string) => void;
}> = React.memo(({ attribute, itemId, parentNodeId, onAttributeClick }) => {
  const getAttributeIcon = () => {
    if (attribute.is_primary_key) {
      return <KeyIcon sx={{ fontSize: 16, color: 'warning.main' }} />;
    }
    if (attribute.is_foreign_key) {
      return <LinkIcon sx={{ fontSize: 16, color: 'secondary.main' }} />;
    }
    return <ViewColumn sx={{ fontSize: 16, color: 'info.main' }} />;
  };

  const getAttributeColor = () => {
    if (attribute.is_primary_key) return 'warning';
    if (attribute.is_foreign_key) return 'secondary';
    return 'default';
  };

  return (
    <TreeItem
      itemId={itemId}
      label={
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onAttributeClick) {
              onAttributeClick(attribute.id, parentNodeId);
            }
          }}
        >
          {getAttributeIcon()}
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {attribute.name}
          </Typography>
          <Chip
            size="small"
            label={attribute.data_type}
            color={getAttributeColor()}
            variant="outlined"
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
          {attribute.is_primary_key && (
            <Chip
              size="small"
              label="PK"
              color="warning"
              sx={{ height: 20, fontSize: '0.65rem', minWidth: 32 }}
            />
          )}
          {attribute.is_foreign_key && (
            <Chip
              size="small"
              label="FK"
              color="secondary"
              sx={{ height: 20, fontSize: '0.65rem', minWidth: 32 }}
            />
          )}
        </Box>
      }
      sx={{
        '& .MuiTreeItem-content': {
          py: 0.5,
          '&:hover': {
            bgcolor: alpha('#1976d2', 0.08),
          },
          '&.Mui-selected': {
            bgcolor: alpha('#1976d2', 0.12),
            '&:hover': {
              bgcolor: alpha('#1976d2', 0.16),
            },
          },
        },
      }}
    />
  );
});

const ClassNodeLabel: React.FC<{
  node: HierarchyNode;
  showInstanceCounts: boolean;
  onContextMenu?: (event: React.MouseEvent) => void;
}> = React.memo(({ node, showInstanceCounts, onContextMenu }) => {
  const nodeIcon = node.children.length > 0 ? (
    <FolderOpen sx={{ fontSize: 18, color: 'primary.main', mr: 1 }} />
  ) : (
    <TableChart sx={{ fontSize: 18, color: 'action.active', mr: 1 }} />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
      }}
      onContextMenu={onContextMenu}
    >
      {nodeIcon}
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
      {showInstanceCounts && node.instance_count !== undefined && node.instance_count > 0 && (
        <Chip
          label={`${node.instance_count} instances`}
          size="small"
          color="success"
          sx={{ height: 18, fontSize: '0.65rem' }}
        />
      )}
    </Box>
  );
});

// ============================================
// MAIN COMPONENT
// ============================================

export const HierarchyTreeComponent: React.FC<HierarchyTreeProps> = ({
  hierarchy,
  selectedNodeId,
  onNodeSelect,
  onAttributeClick,
  onAddSubclass,
  onEditClass,
  onDeleteClass,
  showAttributes = true,
  showInstanceCounts = true,
  editable = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState>({
    mouseX: 0,
    mouseY: 0,
    nodeId: null,
    nodeName: null,
  });

  const handleContextMenu = useCallback((
    event: React.MouseEvent,
    nodeId: string,
    nodeName: string
  ) => {
    if (!editable) return;
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
      nodeId,
      nodeName,
    });
  }, [editable]);

  const handleCloseContextMenu = () => {
    setContextMenu({ mouseX: 0, mouseY: 0, nodeId: null, nodeName: null });
  };

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
    if (itemId && onNodeSelect) {
      onNodeSelect(itemId);
    }
  };

  // Filter nodes based on search query
  const filteredNodes = useMemo(() => {
    if (!hierarchy || !searchQuery.trim()) return hierarchy?.root_nodes || [];

    const query = searchQuery.toLowerCase();
    const allNodes = flattenTree(hierarchy.root_nodes);
    const matchingNodeIds = new Set(
      allNodes
        .filter((node) =>
          node.name.toLowerCase().includes(query) ||
          node.display_name?.toLowerCase().includes(query)
        )
        .map((node) => node.id)
    );

    // Include ancestors of matching nodes
    const includeAncestors = (node: HierarchyNode): boolean => {
      if (matchingNodeIds.has(node.id)) return true;
      return node.children.some(includeAncestors);
    };

    return hierarchy.root_nodes.filter(includeAncestors);
  }, [hierarchy, searchQuery]);

  // Render tree node recursively
  const renderTreeNode = useCallback(
    (node: HierarchyNode): React.ReactElement => {
      const hasChildren = node.children && node.children.length > 0;
      const hasAttributes = showAttributes && node.attributes && node.attributes.length > 0;

      return (
        <TreeItem
          key={node.id}
          itemId={node.id}
          label={
            <ClassNodeLabel
              node={node}
              showInstanceCounts={showInstanceCounts}
              onContextMenu={(e) => handleContextMenu(e, node.id, node.name)}
            />
          }
          sx={{
            '& .MuiTreeItem-content': {
              borderRadius: 1,
              mb: 0.5,
              '&:hover': {
                bgcolor: 'action.hover',
              },
              '&.Mui-selected': {
                bgcolor: alpha('#1976d2', 0.12),
                '&:hover': {
                  bgcolor: alpha('#1976d2', 0.16),
                },
              },
            },
          }}
        >
          {/* Attributes as tree items */}
          {hasAttributes &&
            node.attributes.map((attr) => (
              <AttributeTreeItem
                key={`${node.id}-attr-${attr.id}`}
                itemId={`${node.id}-attr-${attr.id}`}
                attribute={attr}
                parentNodeId={node.id}
                onAttributeClick={onAttributeClick}
              />
            ))}

          {/* Child nodes recursively */}
          {hasChildren &&
            node.children.map((childNode) => renderTreeNode(childNode))}
        </TreeItem>
      );
    },
    [
      showAttributes,
      showInstanceCounts,
      handleContextMenu,
      onAttributeClick,
    ]
  );

  // Empty state
  if (!hierarchy || hierarchy.root_nodes.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Folder sx={{ fontSize: 64, color: 'text.disabled' }} />
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No hierarchy to display
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Search bar */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search classes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Tree view */}
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
          {filteredNodes.map((node) => renderTreeNode(node))}
        </SimpleTreeView>
      </Box>

      {/* Context menu */}
      {editable && (
        <Menu
          open={contextMenu.nodeId !== null}
          onClose={handleCloseContextMenu}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu.mouseY !== 0 && contextMenu.mouseX !== 0
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
        >
          {onAddSubclass && (
            <MenuItem
              onClick={() => {
                if (contextMenu.nodeId) {
                  onAddSubclass(contextMenu.nodeId);
                }
                handleCloseContextMenu();
              }}
            >
              <ListItemIcon>
                <Add fontSize="small" />
              </ListItemIcon>
              <ListItemText>Add Subclass</ListItemText>
            </MenuItem>
          )}
          {onEditClass && (
            <MenuItem
              onClick={() => {
                if (contextMenu.nodeId) {
                  onEditClass(contextMenu.nodeId);
                }
                handleCloseContextMenu();
              }}
            >
              <ListItemIcon>
                <Edit fontSize="small" />
              </ListItemIcon>
              <ListItemText>Edit Class</ListItemText>
            </MenuItem>
          )}
          {onDeleteClass && (
            <>
              <Divider />
              <MenuItem
                onClick={() => {
                  if (contextMenu.nodeId) {
                    onDeleteClass(contextMenu.nodeId);
                  }
                  handleCloseContextMenu();
                }}
              >
                <ListItemIcon>
                  <Delete fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText>Delete Class</ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      )}
    </Box>
  );
};

export { HierarchyTreeComponent as HierarchyTree };
export default HierarchyTreeComponent;