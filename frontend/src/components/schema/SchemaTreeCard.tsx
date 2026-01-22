// frontend/src/components/schema/SchemaTreeCard.tsx
// ✅ FULLY FIXED: Proper name display with robust fallbacks

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
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
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
import type { HierarchyTree, HierarchyNode } from '../../types/lineage';

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
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [cardExpanded, setCardExpanded] = useState(true);

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

  // ✅ Render individual tree node with robust name handling
  const renderTreeNode = (node: HierarchyNode): React.ReactNode => {
    const isRoot = node.level === 0;
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedNodeId === node.id;
    const instanceCount = node.instance_count ?? 0;
    
    // ✅ CRITICAL FIX: Robust name resolution with multiple fallbacks
    let displayName: string;
    if (node.display_name && String(node.display_name).trim()) {
      displayName = String(node.display_name).trim();
    } else if (node.name && String(node.name).trim()) {
      displayName = String(node.name).trim();
    } else {
      // Last resort fallback
      displayName = `Class_${node.id.substring(0, 8)}`;
      console.warn(`⚠️ Node ${node.id} has no name, using fallback: ${displayName}`);
    }

    return (
      <TreeItem
        key={node.id}
        itemId={node.id}
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
              <AccountTree fontSize="small" color="primary" sx={{ mr: 1 }} />
            ) : (
              <TableChart fontSize="small" color="secondary" sx={{ mr: 1 }} />
            )}

            {/* ✅ Display name with guaranteed value */}
            <Typography variant="body2" fontWeight={isRoot ? 600 : 500}>
              {displayName}
            </Typography>

            {/* Level indicator */}
            {node.level > 0 && (
              <Chip
                label={`L${node.level}`}
                size="small"
                sx={{
                  ml: 1,
                  height: 20,
                  fontSize: '0.7rem',
                  backgroundColor: (theme) =>
                    alpha(theme.palette.secondary.main, 0.1),
                }}
              />
            )}

            {/* Attribute count */}
            {showAttributes && node.attributes && node.attributes.length > 0 && (
              <Chip
                icon={<ViewColumn sx={{ fontSize: 14 }} />}
                label={node.attributes.length}
                size="small"
                variant="outlined"
                sx={{ ml: 1, height: 20 }}
              />
            )}

            {/* Instance count */}
            {instanceCount > 0 && (
              <Chip
                label={`${instanceCount} instances`}
                size="small"
                color="success"
                sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
              />
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* Action buttons */}
            {editable && (
              <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
                {onAddSubclass && (
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
                )}
                {onEditClass && (
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
                )}
                {onDeleteClass && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClass(node.id);
                    }}
                    sx={{ padding: 0.5 }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Stack>
            )}
          </Box>
        }
      >
        {/* Render attributes as nested items if showAttributes is true */}
        {showAttributes && node.attributes && node.attributes.length > 0 && (
          <>
            {node.attributes.map((attr) => (
              <TreeItem
                key={`${node.id}-attr-${attr.id}`}
                itemId={`${node.id}-attr-${attr.id}`}
                label={
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      py: 0.25,
                      px: 0.5,
                    }}
                  >
                    <ViewColumn
                      fontSize="small"
                      sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }}
                    />
                    <Typography variant="caption" fontFamily="monospace">
                      {attr.name}
                    </Typography>
                    <Chip
                      label={attr.data_type}
                      size="small"
                      sx={{
                        ml: 1,
                        height: 16,
                        fontSize: '0.65rem',
                        '& .MuiChip-label': { px: 0.75 },
                      }}
                    />
                    {attr.is_primary_key && (
                      <KeyIcon
                        sx={{ ml: 0.5, fontSize: 14, color: 'warning.main' }}
                      />
                    )}
                    {attr.is_foreign_key && (
                      <LinkIcon
                        sx={{ ml: 0.5, fontSize: 14, color: 'info.main' }}
                      />
                    )}
                  </Box>
                }
              />
            ))}
          </>
        )}

        {/* Render child nodes recursively */}
        {hasChildren && node.children.map((child) => renderTreeNode(child))}
      </TreeItem>
    );
  };

  if (!hierarchy || !hierarchy.root_nodes || hierarchy.root_nodes.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Schema Hierarchy"
          action={
            <IconButton onClick={() => setCardExpanded(!cardExpanded)}>
              {cardExpanded ? <ExpandMore /> : <ChevronRight />}
            </IconButton>
          }
        />
        <Collapse in={cardExpanded}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                py: 4,
              }}
            >
              <AccountTree sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No hierarchy available
              </Typography>
            </Box>
          </CardContent>
        </Collapse>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Schema Hierarchy"
        subheader={`${hierarchy.total_nodes} classes, max depth: ${hierarchy.max_depth}`}
        action={
          <IconButton onClick={() => setCardExpanded(!cardExpanded)}>
            {cardExpanded ? <ExpandMore /> : <ChevronRight />}
          </IconButton>
        }
      />
      <Collapse in={cardExpanded}>
        <CardContent>
          <SimpleTreeView
            expandedItems={expandedItems}
            onExpandedItemsChange={handleExpandedItemsChange}
            selectedItems={selectedNodeId}
            onSelectedItemsChange={handleSelectedItemsChange}
            slots={{
              collapseIcon: ExpandMore,
              expandIcon: ChevronRight,
            }}
            sx={{
              flexGrow: 1,
              maxWidth: '100%',
              overflowY: 'auto',
            }}
          >
            {hierarchy.root_nodes.map((node) => renderTreeNode(node))}
          </SimpleTreeView>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default SchemaTreeCard;