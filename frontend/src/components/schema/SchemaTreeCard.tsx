// frontend/src/components/schema/SchemaTreeCard.tsx
// Tree View Card Component - FIXED TypeScript errors

import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Stack,
  alpha,
  Collapse,
} from '@mui/material';
import { TreeView, TreeItem } from '@mui/x-tree-view';
import {
  ChevronRight,
  ExpandMore,
  TableChart,
  ViewColumn,
  Key as KeyIcon,
  Link as LinkIcon,
  AccountTree,
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { HierarchyTree, HierarchyNode, Attribute } from '../../types/lineage';

// ============================================
// TYPES
// ============================================

interface SchemaTreeCardProps {
  hierarchy: HierarchyTree | null;
  selectedNodeId?: string;
  onNodeSelect?: (nodeId: string) => void;
  onAddSubclass?: (parentId: string) => void;
  onEditClass?: (nodeId: string) => void;
  onDeleteClass?: (nodeId: string) => void;
  showAttributes?: boolean;
  editable?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const SchemaTreeCard: React.FC<SchemaTreeCardProps> = ({
  hierarchy,
  selectedNodeId,
  onNodeSelect,
  onAddSubclass,
  onEditClass,
  onDeleteClass,
  showAttributes = true,
  editable = false,
}) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const [cardExpanded, setCardExpanded] = useState(true);

  const handleToggle = (event: React.SyntheticEvent, nodeIds: string[]) => {
    setExpanded(nodeIds);
  };

  const handleSelect = (event: React.SyntheticEvent, nodeId: string) => {
    if (onNodeSelect) {
      onNodeSelect(nodeId);
    }
  };

  // Render individual tree node
  const renderTreeNode = (node: HierarchyNode): React.ReactNode => {
    const isRoot = node.level === 0;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const instanceCount = node.instance_count ?? 0; // ✅ FIXED: Handle undefined

    return (
      <TreeItem
        key={node.id}
        nodeId={node.id}
        label={
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              py: 0.5,
              px: 1,
              borderRadius: 1,
              backgroundColor: isSelected
                ? (theme) => alpha(theme.palette.primary.main, 0.1)
                : 'transparent',
              '&:hover': {
                backgroundColor: (theme) =>
                  isSelected
                    ? alpha(theme.palette.primary.main, 0.15)
                    : alpha(theme.palette.action.hover, 0.05),
              },
            }}
          >
            {/* Icon based on type */}
            {isRoot ? (
              <TableChart
                sx={{ mr: 1, fontSize: 20, color: 'primary.main' }}
              />
            ) : (
              <AccountTree
                sx={{ mr: 1, fontSize: 18, color: 'secondary.main' }}
              />
            )}

            {/* Class Name */}
            <Typography
              variant={isRoot ? 'subtitle2' : 'body2'}
              sx={{
                fontWeight: isRoot ? 600 : 500,
                flexGrow: 1,
                color: isSelected ? 'primary.main' : 'text.primary',
              }}
            >
              {node.name}
            </Typography>

            {/* Level Badge */}
            {node.level > 0 && (
              <Chip
                label={`L${node.level}`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  mr: 0.5,
                  bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.1),
                  color: 'secondary.main',
                }}
              />
            )}

            {/* Instance Count */}
            {instanceCount > 0 && (
              <Chip
                label={`${instanceCount}`}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  mr: 0.5,
                }}
              />
            )}

            {/* Action Buttons */}
            {editable && (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onAddSubclass) onAddSubclass(node.id);
                  }}
                  sx={{ p: 0.5 }}
                >
                  <Add fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditClass) onEditClass(node.id);
                  }}
                  sx={{ p: 0.5 }}
                >
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteClass) onDeleteClass(node.id);
                  }}
                  sx={{ p: 0.5 }}
                  color="error"
                >
                  <Delete fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        }
        sx={{
          '& .MuiTreeItem-content': {
            padding: 0,
            '&.Mui-selected': {
              backgroundColor: 'transparent',
            },
            '&.Mui-focused': {
              backgroundColor: 'transparent',
            },
          },
          '& .MuiTreeItem-label': {
            padding: 0,
          },
        }}
      >
        {/* Attributes */}
        {showAttributes && node.attributes && node.attributes.length > 0 && (
          <Box
            sx={{
              pl: 4,
              py: 0.5,
              borderLeft: 2,
              borderColor: 'divider',
              ml: 2,
            }}
          >
            {node.attributes.map((attr) => (
              <Box
                key={attr.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  py: 0.3,
                  px: 1,
                  borderRadius: 0.5,
                  '&:hover': {
                    backgroundColor: (theme) =>
                      alpha(theme.palette.action.hover, 0.03),
                  },
                }}
              >
                <ViewColumn
                  sx={{
                    mr: 1,
                    fontSize: 16,
                    color: 'text.secondary',
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    flexGrow: 1,
                    color: 'text.secondary',
                  }}
                >
                  {attr.name}
                </Typography>

                {/* Data Type */}
                <Typography
                  variant="caption"
                  sx={{
                    mr: 0.5,
                    color: 'text.disabled',
                    fontFamily: 'monospace',
                  }}
                >
                  {attr.data_type}
                </Typography>

                {/* PK/FK Indicators */}
                {attr.is_primary_key && (
                  <KeyIcon
                    sx={{ fontSize: 14, color: 'warning.main', mr: 0.3 }}
                  />
                )}
                {attr.is_foreign_key && (
                  <LinkIcon
                    sx={{ fontSize: 14, color: 'info.main' }}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Child Nodes */}
        {hasChildren && node.children.map((child) => renderTreeNode(child))}
      </TreeItem>
    );
  };

  if (!hierarchy || !hierarchy.root_nodes || hierarchy.root_nodes.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography color="text.secondary" textAlign="center">
            No schema hierarchy available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Card Header */}
      <CardHeader
        avatar={<AccountTree color="primary" />}
        title={
          <Typography variant="h6" fontWeight={600}>
            Schema Structure
          </Typography>
        }
        subheader={
          <Stack direction="row" spacing={1} mt={0.5}>
            <Chip
              size="small"
              label={`${hierarchy.total_nodes} classes`}
              variant="outlined"
            />
            <Chip
              size="small"
              label={`Depth: ${hierarchy.max_depth}`}
              variant="outlined"
            />
          </Stack>
        }
        action={
          <IconButton onClick={() => setCardExpanded(!cardExpanded)}>
            {cardExpanded ? <ExpandMore /> : <ChevronRight />}
          </IconButton>
        }
        sx={{ pb: 1 }}
      />

      {/* Card Content */}
      <Collapse in={cardExpanded}>
        <CardContent
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            pt: 0,
            '&:last-child': { pb: 2 },
          }}
        >
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
              '& .MuiTreeItem-root': {
                '& .MuiTreeItem-content': {
                  borderRadius: 1,
                  mb: 0.5,
                },
              },
            }}
          >
            {hierarchy.root_nodes.map((rootNode) => renderTreeNode(rootNode))}
          </TreeView>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default SchemaTreeCard;