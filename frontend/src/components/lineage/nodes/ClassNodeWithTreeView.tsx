// frontend/src/components/lineage/nodes/ClassNodeWithTreeView.tsx
// FIXED VERSION - Compatible with existing types and MUI Tree View

import React, { memo, useCallback, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Typography,
  IconButton,
  Collapse,
  Stack,
} from '@mui/material';
import {
  TableChart,
  ExpandMore as ExpandMoreIcon,
  ChevronRight,
  Circle,
  Folder,
  FolderOpen,
} from '@mui/icons-material';
import { TreeView, TreeItem } from '@mui/x-tree-view';

// Import types from your existing codebase
import { Attribute } from '../../../types/lineage';

// ============================================
// TYPES
// ============================================

interface HierarchyNode {
  id: string;
  name: string;
  display_name?: string;
  type: 'class' | 'subclass';
  level: number;
  parent_id?: string;
  children: HierarchyNode[];
  attributes?: Attribute[];
  instance_count?: number;
}

interface ClassNodeData {
  label: string;
  name: string;
  type: string;
  attributes?: Attribute[];
  instance_count?: number;
  collapsed: boolean;
  highlighted: boolean;
  selected: boolean;
  has_upstream: boolean;
  has_downstream: boolean;
  level: number;
  color?: string;
  hierarchy?: HierarchyNode;
  onAttributeClick?: (attributeId: string) => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getAttributeColor = (attr: Attribute): "warning" | "secondary" | "default" => {
  if (attr.is_primary_key) return 'warning';
  if (attr.is_foreign_key) return 'secondary';
  return 'default';
};

const getAttributeIcon = (attr: Attribute): string => {
  if (attr.is_primary_key) return '🔑';
  if (attr.is_foreign_key) return '🔗';
  return '📊';
};

// ============================================
// TREE ITEM COMPONENT
// ============================================

const HierarchyTreeItemComponent: React.FC<{
  node: HierarchyNode;
  onAttributeClick?: (attrId: string) => void;
}> = memo(({ node, onAttributeClick }) => {
  const hasChildren = node.children && node.children.length > 0;
  const hasAttributes = node.attributes && node.attributes.length > 0;

  return (
    <TreeItem
      nodeId={node.id}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.5 }}>
          {hasChildren ? (
            <Folder sx={{ fontSize: 16, color: 'primary.main' }} />
          ) : (
            <TableChart sx={{ fontSize: 16, color: 'info.main' }} />
          )}
          <Typography variant="body2" fontWeight={500}>
            {node.display_name || node.name}
          </Typography>
          {node.type === 'subclass' && (
            <Chip
              size="small"
              label="Sub"
              color="info"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          )}
          {node.instance_count !== undefined && node.instance_count > 0 && (
            <Chip
              size="small"
              label={node.instance_count}
              color="default"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.65rem', minWidth: 24 }}
            />
          )}
        </Box>
      }
    >
      {/* Attributes */}
      {hasAttributes && node.attributes!.map((attr) => (
        <TreeItem
          key={attr.id}
          nodeId={`${node.id}-attr-${attr.id}`}
          label={
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                py: 0.3,
                cursor: onAttributeClick ? 'pointer' : 'default',
              }}
              onClick={(e: React.MouseEvent) => {
                if (onAttributeClick) {
                  e.stopPropagation();
                  onAttributeClick(attr.id);
                }
              }}
            >
              <Circle
                sx={{
                  fontSize: 8,
                  color:
                    attr.is_primary_key
                      ? 'warning.main'
                      : attr.is_foreign_key
                      ? 'secondary.main'
                      : 'action.disabled',
                }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                {attr.name}
              </Typography>
              <Chip
                size="small"
                label={attr.data_type}
                variant="outlined"
                sx={{ height: 16, fontSize: '0.6rem' }}
              />
            </Box>
          }
        />
      ))}

      {/* Subclasses */}
      {hasChildren && node.children.map((child) => (
        <HierarchyTreeItemComponent
          key={child.id}
          node={child}
          onAttributeClick={onAttributeClick}
        />
      ))}
    </TreeItem>
  );
});

HierarchyTreeItemComponent.displayName = 'HierarchyTreeItemComponent';

// ============================================
// MAIN CLASS NODE COMPONENT
// ============================================

export const ClassNodeWithTreeView = memo<NodeProps<ClassNodeData>>(({ data }) => {
  const [treeExpanded, setTreeExpanded] = useState(false);
  const [attributesExpanded, setAttributesExpanded] = useState(!data.collapsed);
  const [expandedTreeItems, setExpandedTreeItems] = useState<string[]>([]);

  const handleToggleAttributes = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setAttributesExpanded(prev => !prev);
  }, []);

  const handleToggleTree = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setTreeExpanded(prev => !prev);
  }, []);

  const handleAttributeClick = useCallback((e: React.MouseEvent, attrId: string) => {
    e.stopPropagation();
    if (data.onAttributeClick) {
      data.onAttributeClick(attrId);
    }
  }, [data]);

  const handleTreeItemClick = useCallback((attrId: string) => {
    if (data.onAttributeClick) {
      data.onAttributeClick(attrId);
    }
  }, [data]);

  const handleTreeToggle = useCallback((_event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpandedTreeItems(nodeIds);
  }, []);

  const hasHierarchy = data.hierarchy && data.hierarchy.children && data.hierarchy.children.length > 0;

  return (
    <>
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: data.highlighted ? '#ffc107' : '#1976d2',
          width: 10,
          height: 10,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: data.highlighted ? '#ffc107' : '#1976d2',
          width: 10,
          height: 10,
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={{
          background: data.highlighted ? '#ffc107' : '#1976d2',
          width: 10,
          height: 10,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={{
          background: data.highlighted ? '#ffc107' : '#1976d2',
          width: 10,
          height: 10,
        }}
      />

      <Card
        sx={{
          minWidth: 320,
          maxWidth: 450,
          border: 2,
          borderColor: data.highlighted
            ? 'warning.main'
            : data.selected
            ? 'primary.main'
            : 'divider',
          boxShadow: data.highlighted ? 4 : 2,
          backgroundColor: data.highlighted
            ? 'warning.50'
            : data.selected
            ? 'primary.50'
            : 'background.paper',
        }}
      >
        {/* Card Header */}
        <CardHeader
          avatar={<TableChart color="primary" />}
          title={
            <Typography variant="h6" fontWeight={600}>
              {data.label}
            </Typography>
          }
          subheader={
            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
              <Chip size="small" label={`Level ${data.level}`} variant="outlined" />
              {data.instance_count !== undefined && (
                <Chip
                  size="small"
                  label={`${data.instance_count} instances`}
                  color="primary"
                  variant="outlined"
                />
              )}
            </Stack>
          }
          sx={{ pb: 1 }}
        />

        <CardContent sx={{ pt: 0 }}>
          {/* Hierarchy Tree View */}
          {hasHierarchy && (
            <Box sx={{ mb: 2 }}>
              <Box
                onClick={handleToggleTree}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  mb: 1,
                  p: 0.5,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <FolderOpen sx={{ fontSize: 18 }} color="primary" />
                  <Typography variant="subtitle2" fontWeight={600}>
                    Hierarchy ({data.hierarchy!.children.length} subclasses)
                  </Typography>
                </Stack>
                <IconButton size="small">
                  <ExpandMoreIcon
                    sx={{
                      transform: treeExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: '0.3s',
                    }}
                  />
                </IconButton>
              </Box>

              <Collapse in={treeExpanded}>
                <Box
                  sx={{
                    maxHeight: 300,
                    overflowY: 'auto',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1,
                    bgcolor: 'background.default',
                  }}
                >
                  <TreeView
                    defaultCollapseIcon={<ExpandMoreIcon />}
                    defaultExpandIcon={<ChevronRight />}
                    expanded={expandedTreeItems}
                    onNodeToggle={handleTreeToggle}
                  >
                    <HierarchyTreeItemComponent
                      node={data.hierarchy!}
                      onAttributeClick={handleTreeItemClick}
                    />
                  </TreeView>
                </Box>
              </Collapse>
            </Box>
          )}

          {/* Attributes Section */}
          {data.attributes && data.attributes.length > 0 && (
            <Box>
              <Box
                onClick={handleToggleAttributes}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  mb: 1,
                  p: 0.5,
                  borderRadius: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <Typography variant="subtitle2" fontWeight={600}>
                  Attributes ({data.attributes.length})
                </Typography>
                <IconButton size="small">
                  <ExpandMoreIcon
                    sx={{
                      transform: attributesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: '0.3s',
                    }}
                  />
                </IconButton>
              </Box>

              <Collapse in={attributesExpanded}>
                <Stack spacing={0.5} sx={{ maxHeight: 200, overflowY: 'auto' }}>
                  {data.attributes.map((attr) => (
                    <Box
                      key={attr.id}
                      onClick={(e) => handleAttributeClick(e, attr.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 0.75,
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: '0.2s',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{getAttributeIcon(attr)}</Typography>
                        <Typography variant="body2" fontWeight={500}>
                          {attr.name}
                        </Typography>
                      </Stack>
                      <Chip
                        size="small"
                        label={attr.data_type}
                        color={getAttributeColor(attr)}
                        variant="outlined"
                      />
                    </Box>
                  ))}
                </Stack>
              </Collapse>
            </Box>
          )}
        </CardContent>
      </Card>
    </>
  );
});

ClassNodeWithTreeView.displayName = 'ClassNodeWithTreeView';

export default ClassNodeWithTreeView;