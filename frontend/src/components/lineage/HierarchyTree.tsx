// frontend/src/components/lineage/HierarchyTree.tsx - NEW FILE

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  Collapse,
  Divider,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import {
  ChevronRight,
  ExpandMore,
  Search,
  FilterList,
  MoreVert,
  Folder,
  FolderOpen,
  TableChart,
  ViewColumn,
  Add,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { HierarchyTree, HierarchyNode, Attribute } from '../../types/lineage';

// ============================================
// TYPES
// ============================================

interface HierarchyTreeProps {
  hierarchy: HierarchyTree | null;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onNodeExpand?: (nodeId: string) => void;
  onNodeCollapse?: (nodeId: string) => void;
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

function getNodeIcon(node: HierarchyNode, expanded: boolean): React.ReactElement {
  if (node.children.length > 0) {
    return expanded ? (
      <FolderOpen sx={{ color: 'primary.main' }} />
    ) : (
      <Folder sx={{ color: 'primary.main' }} />
    );
  }
  return <TableChart sx={{ color: 'info.main' }} />;
}

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
// COMPONENTS
// ============================================

const AttributeChip: React.FC<{
  attribute: Attribute;
  onClick?: () => void;
}> = React.memo(({ attribute, onClick }) => {
  const getAttributeColor = () => {
    if (attribute.is_primary_key) return 'warning';
    if (attribute.is_foreign_key) return 'secondary';
    return 'default';
  };

  const getAttributeIcon = () => {
    if (attribute.is_primary_key) return '🔑';
    if (attribute.is_foreign_key) return '🔗';
    return '📊';
  };

  return (
    <Chip
      size="small"
      variant="outlined"
      color={getAttributeColor()}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <span>{getAttributeIcon()}</span>
          <span>{attribute.name}</span>
          <Typography
            component="span"
            variant="caption"
            sx={{ color: 'text.secondary', ml: 0.5 }}
          >
            ({attribute.data_type})
          </Typography>
        </Box>
      }
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      sx={{
        cursor: 'pointer',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    />
  );
});

const TreeNodeContent: React.FC<{
  node: HierarchyNode;
  showAttributes: boolean;
  showInstanceCounts: boolean;
  onAttributeClick?: (attributeId: string) => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}> = React.memo(
  ({
    node,
    showAttributes,
    showInstanceCounts,
    onAttributeClick,
    onContextMenu,
  }) => {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          py: 0.5,
          width: '100%',
        }}
        onContextMenu={onContextMenu}
      >
        {/* Node Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            {node.display_name || node.name}
          </Typography>
          {showInstanceCounts && node.instance_count !== undefined && (
            <Chip
              size="small"
              label={`${node.instance_count} instances`}
              color="primary"
              variant="outlined"
            />
          )}
          {node.type === 'subclass' && (
            <Chip size="small" label="Subclass" color="info" variant="outlined" />
          )}
        </Box>

        {/* Attributes */}
        {showAttributes && node.attributes.length > 0 && (
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {node.attributes.map((attr) => (
              <AttributeChip
                key={attr.id}
                attribute={attr}
                onClick={() => {
                  if (onAttributeClick) {
                    onAttributeClick(attr.id);
                  }
                }}
              />
            ))}
          </Stack>
        )}
      </Box>
    );
  }
);

// ============================================
// MAIN COMPONENT
// ============================================

export const HierarchyTreeComponent: React.FC<HierarchyTreeProps> = ({
  hierarchy,
  selectedNodeId,
  onNodeSelect,
  onNodeExpand,
  onNodeCollapse,
  onAttributeClick,
  onAddSubclass,
  onEditClass,
  onDeleteClass,
  showAttributes = true,
  showInstanceCounts = true,
  editable = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState>({
    mouseX: 0,
    mouseY: 0,
    nodeId: null,
    nodeName: null,
  });

  // Filter nodes based on search
  const filteredHierarchy = React.useMemo(() => {
    if (!hierarchy || !searchQuery) return hierarchy;

    const allNodes = flattenTree(hierarchy.root_nodes);
    const matchingNodes = allNodes.filter(
      (node) =>
        node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.attributes.some((attr) =>
          attr.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    // Expand all parent nodes of matching nodes
    const expandedIds = new Set<string>();
    matchingNodes.forEach((node) => {
      let current: HierarchyNode | undefined = node;
      while (current?.parent_id) {
        expandedIds.add(current.parent_id);
        current = allNodes.find((n) => n.id === current?.parent_id);
      }
    });

    setExpanded(Array.from(expandedIds));

    return hierarchy;
  }, [hierarchy, searchQuery]);

  // Handle node toggle
  const handleToggle = useCallback(
    (event: React.SyntheticEvent, nodeIds: string[]) => {
      setExpanded(nodeIds);
      
      // Determine which node was expanded/collapsed
      const newExpanded = nodeIds.filter((id) => !expanded.includes(id));
      const newCollapsed = expanded.filter((id) => !nodeIds.includes(id));

      if (newExpanded.length > 0 && onNodeExpand) {
        newExpanded.forEach((id) => onNodeExpand(id));
      }
      if (newCollapsed.length > 0 && onNodeCollapse) {
        newCollapsed.forEach((id) => onNodeCollapse(id));
      }
    },
    [expanded, onNodeExpand, onNodeCollapse]
  );

  // Handle node select
  const handleSelect = useCallback(
    (event: React.SyntheticEvent, nodeId: string) => {
      if (onNodeSelect) {
        onNodeSelect(nodeId);
      }
    },
    [onNodeSelect]
  );

  // Handle context menu
  const handleContextMenu = useCallback(
    (event: React.MouseEvent, nodeId: string, nodeName: string) => {
      if (!editable) return;
      
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
        nodeId,
        nodeName,
      });
    },
    [editable]
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu({
      mouseX: 0,
      mouseY: 0,
      nodeId: null,
      nodeName: null,
    });
  }, []);

  // Render tree node
  const renderTreeNode = useCallback(
    (node: HierarchyNode) => {
      return (
        <TreeItem
          key={node.id}
          nodeId={node.id}
          label={
            <TreeNodeContent
              node={node}
              showAttributes={showAttributes}
              showInstanceCounts={showInstanceCounts}
              onAttributeClick={(attrId) => {
                if (onAttributeClick) {
                  onAttributeClick(attrId, node.id);
                }
              }}
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
                bgcolor: 'primary.light',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              },
            },
          }}
        >
          {node.children.length > 0 && node.children.map(renderTreeNode)}
        </TreeItem>
      );
    },
    [
      showAttributes,
      showInstanceCounts,
      onAttributeClick,
      handleContextMenu,
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
      {/* Header */}
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" gutterBottom>
          Schema Hierarchy
        </Typography>
        <TextField
          size="small"
          fullWidth
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

      <Divider />

      {/* Stats */}
      <Box sx={{ px: 2, py: 1 }}>
        <Stack direction="row" spacing={1}>
          <Chip
            size="small"
            label={`${hierarchy.total_nodes} classes`}
            variant="outlined"
          />
          <Chip
            size="small"
            label={`Max depth: ${hierarchy.max_depth}`}
            variant="outlined"
          />
        </Stack>
      </Box>

      <Divider />

      {/* Tree */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <TreeView
          expanded={expanded}
          selected={selectedNodeId || ''}
          onNodeToggle={handleToggle}
          onNodeSelect={handleSelect}
          defaultCollapseIcon={<ExpandMore />}
          defaultExpandIcon={<ChevronRight />}
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
          }}
        >
          {filteredHierarchy?.root_nodes.map(renderTreeNode)}
        </TreeView>
      </Box>

      {/* Context Menu */}
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
          <MenuItem
            onClick={() => {
              if (contextMenu.nodeId && onAddSubclass) {
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
          <MenuItem
            onClick={() => {
              if (contextMenu.nodeId && onEditClass) {
                onEditClass(contextMenu.nodeId);
              }
              handleCloseContextMenu();
            }}
          >
            <ListItemIcon>
              <Edit fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              if (contextMenu.nodeId && onDeleteClass) {
                onDeleteClass(contextMenu.nodeId);
              }
              handleCloseContextMenu();
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <Delete fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};