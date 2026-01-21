// frontend/src/components/lineage/HierarchyTree.tsx - COMPLETE FIXED VERSION

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
import { TreeView, TreeItem } from '@mui/x-tree-view';
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
  nodeId: string;
  parentNodeId: string;
  onAttributeClick?: (attributeId: string, nodeId: string) => void;
}> = React.memo(({ attribute, nodeId, parentNodeId, onAttributeClick }) => {
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
      nodeId={nodeId}
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
    <Folder sx={{ fontSize: 20, color: 'primary.main' }} />
  ) : (
    <TableChart sx={{ fontSize: 20, color: 'info.main' }} />
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.5,
        width: '100%',
      }}
      onContextMenu={onContextMenu}
    >
      {nodeIcon}
      <Typography variant="body2" fontWeight={500} sx={{ flexGrow: 1 }}>
        {node.display_name || node.name}
      </Typography>
      {showInstanceCounts && node.instance_count !== undefined && (
        <Chip
          size="small"
          label={`${node.instance_count} instances`}
          color="primary"
          variant="outlined"
          sx={{ height: 22 }}
        />
      )}
      {node.type === 'subclass' && (
        <Chip
          size="small"
          label="Subclass"
          color="info"
          variant="outlined"
          sx={{ height: 22 }}
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

  // Filter hierarchy based on search
  const filteredHierarchy = useMemo(() => {
    if (!hierarchy || !searchQuery) return hierarchy;

    const query = searchQuery.toLowerCase();
    const allNodes = flattenTree(hierarchy.root_nodes);
    const matchingNodeIds = new Set(
      allNodes
        .filter(
          (node) =>
            node.name.toLowerCase().includes(query) ||
            node.display_name?.toLowerCase().includes(query) ||
            node.attributes.some((attr) =>
              attr.name.toLowerCase().includes(query)
            )
        )
        .map((node) => node.id)
    );

    // Include parent nodes of matches
    const includeNode = (node: HierarchyNode): boolean => {
      if (matchingNodeIds.has(node.id)) return true;
      return node.children.some(includeNode);
    };

    const filterTree = (node: HierarchyNode): HierarchyNode | null => {
      if (!includeNode(node)) return null;

      return {
        ...node,
        children: node.children
          .map(filterTree)
          .filter((child): child is HierarchyNode => child !== null),
      };
    };

    return {
      ...hierarchy,
      root_nodes: hierarchy.root_nodes
        .map(filterTree)
        .filter((node): node is HierarchyNode => node !== null),
    };
  }, [hierarchy, searchQuery]);

  // Event handlers
  const handleToggle = useCallback(
    (event: React.SyntheticEvent, nodeIds: string[]) => {
      setExpanded(nodeIds);
    },
    []
  );

  const handleSelect = useCallback(
    (event: React.SyntheticEvent, nodeId: string) => {
      if (onNodeSelect) {
        onNodeSelect(nodeId);
      }
    },
    [onNodeSelect]
  );

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

  // Render tree node with attributes as children - FIXED WITH PROPER KEYS
  const renderTreeNode = useCallback(
    (node: HierarchyNode): React.ReactElement => {
      const hasAttributes = showAttributes && node.attributes.length > 0;
      const hasChildren = node.children.length > 0;

      return (
        <TreeItem
          key={node.id}
          nodeId={node.id}
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
          {/* FIXED: Attributes as expandable tree items with proper keys */}
          {hasAttributes &&
            node.attributes.map((attr) => (
              <AttributeTreeItem
                key={`${node.id}-attr-${attr.id}`}
                attribute={attr}
                nodeId={`${node.id}-attr-${attr.id}`}
                parentNodeId={node.id}
                onAttributeClick={onAttributeClick}
              />
            ))}

          {/* FIXED: Child class nodes with proper keys */}
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
          {/* FIXED: Root nodes with proper keys */}
          {filteredHierarchy?.root_nodes.map((rootNode) =>
            renderTreeNode(rootNode)
          )}
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
            <ListItemText>Edit Class</ListItemText>
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
            <ListItemText>Delete Class</ListItemText>
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

export default HierarchyTreeComponent;