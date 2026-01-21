// frontend/src/components/lineage/HierarchyTreeMUI.tsx - FIXED FOR @mui/lab/TreeView

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Chip,
  Stack,
  Paper,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';
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
import { HierarchyTree, HierarchyNode, Attribute } from '../../types/lineage';

// ============================================
// TYPES
// ============================================

interface HierarchyTreeProps {
  hierarchy: HierarchyTree | null;
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
  const [expanded, setExpanded] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(selectedNodeId || '');

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

  // Update selected when prop changes
  React.useEffect(() => {
    if (selectedNodeId) {
      setSelected(selectedNodeId);
    }
  }, [selectedNodeId]);

  // Filter nodes based on search
  const shouldShowNode = useCallback(
    (node: HierarchyNode): boolean => {
      if (!searchQuery) return true;

      const query = searchQuery.toLowerCase();
      
      // Check node name
      if (node.name.toLowerCase().includes(query) || 
          node.display_name?.toLowerCase().includes(query)) {
        return true;
      }

      // Check attributes
      if (node.attributes.some((attr) => attr.name.toLowerCase().includes(query))) {
        return true;
      }

      // Check children
      if (node.children.some(shouldShowNode)) {
        return true;
      }

      return false;
    },
    [searchQuery]
  );

  const filteredRootNodes = useMemo(() => {
    if (!hierarchy || !hierarchy.root_nodes) return [];
    if (!searchQuery) return hierarchy.root_nodes;
    
    return hierarchy.root_nodes.filter(shouldShowNode);
  }, [hierarchy, searchQuery, shouldShowNode]);

  // Event handlers
  const handleToggle = useCallback(
    (event: React.SyntheticEvent, nodeIds: string[]) => {
      setExpanded(nodeIds);
    },
    []
  );

  const handleSelect = useCallback(
    (event: React.SyntheticEvent, nodeId: string) => {
      setSelected(nodeId);
      
      const item = nodeMap[nodeId];
      
      if (item) {
        if (item.isAttribute && item.attribute && item.node) {
          // Attribute clicked
          if (onAttributeClick) {
            onAttributeClick(item.attribute.id, item.node.id);
          }
        } else if (item.node) {
          // Node clicked
          if (onNodeSelect) {
            onNodeSelect(nodeId);
          }
        }
      }
    },
    [nodeMap, onNodeSelect, onAttributeClick]
  );

  // Render attribute label
  const renderAttributeLabel = useCallback(
    (attr: Attribute) => {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            py: 0.5,
          }}
        >
          <ViewColumn sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            {attr.name}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {attr.data_type}
          </Typography>
          {attr.is_primary_key && (
            <Tooltip title="Primary Key">
              <KeyIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            </Tooltip>
          )}
          {attr.is_foreign_key && (
            <Tooltip title="Foreign Key">
              <LinkIcon sx={{ fontSize: 16, color: 'info.main' }} />
            </Tooltip>
          )}
        </Box>
      );
    },
    []
  );

  // Render node label
  const renderNodeLabel = useCallback(
    (node: HierarchyNode) => {
      const hasChildren = node.children && node.children.length > 0;
      const icon = hasChildren ? (
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
        >
          {icon}
          <Typography variant="body2" fontWeight={500} sx={{ flexGrow: 1 }}>
            {node.display_name || node.name}
          </Typography>
          {showInstanceCounts && node.instance_count !== undefined && (
            <Chip
              size="small"
              label={`${node.instance_count}`}
              color="primary"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.75rem' }}
            />
          )}
          {node.type === 'subclass' && (
            <Chip
              size="small"
              label="Subclass"
              color="secondary"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          )}
          {editable && (
            <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
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

  // Recursively render tree nodes
  const renderTreeNode = useCallback(
    (node: HierarchyNode): React.ReactElement => {
      const hasChildren = node.children && node.children.length > 0;
      const hasAttributes = showAttributes && node.attributes && node.attributes.length > 0;
      
      return (
        <TreeItem
          key={node.id}
          nodeId={node.id}
          label={renderNodeLabel(node)}
          sx={{
            '& .MuiTreeItem-content': {
              padding: '4px 8px',
              '&:hover': {
                bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.08),
              },
              '&.Mui-selected': {
                bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.12),
                '&:hover': {
                  bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.16),
                },
              },
            },
          }}
        >
          {/* Render attributes first */}
          {hasAttributes && node.attributes.map((attr) => (
            <TreeItem
              key={`attr_${node.id}_${attr.id}`}
              nodeId={`attr_${node.id}_${attr.id}`}
              label={renderAttributeLabel(attr)}
              sx={{
                '& .MuiTreeItem-content': {
                  padding: '2px 8px',
                  '&:hover': {
                    bgcolor: (theme: any) => alpha(theme.palette.info.main, 0.08),
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

      {/* Hierarchy Stats */}
      <Box 
        sx={{ 
          p: 2, 
          borderBottom: 1, 
          borderColor: 'divider', 
          bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.05) 
        }}
      >
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Typography variant="caption" color="text.secondary">
            Total Classes: <strong>{hierarchy.total_nodes}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Max Depth: <strong>{hierarchy.max_depth}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Root Nodes: <strong>{hierarchy.root_nodes.length}</strong>
          </Typography>
        </Stack>
      </Box>

      {/* Tree View */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Paper variant="outlined" sx={{ height: '100%', overflow: 'auto' }}>
          <TreeView
            expanded={expanded}
            selected={selected}
            onNodeToggle={handleToggle}
            onNodeSelect={handleSelect}
            defaultCollapseIcon={<ExpandMore />}
            defaultExpandIcon={<ChevronRight />}
            sx={{
              padding: 1,
              minHeight: '100%',
            }}
          >
            {filteredRootNodes.map((node) => renderTreeNode(node))}
          </TreeView>
        </Paper>
      </Box>
    </Box>
  );
};

export default HierarchyTreeMUI;