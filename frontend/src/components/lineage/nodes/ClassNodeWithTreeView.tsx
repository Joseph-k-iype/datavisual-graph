// frontend/src/components/lineage/nodes/ClassNodeWithTreeView.tsx
// ✅ FIXED: Shows subclasses INSIDE parent node using SimpleTreeView

import React, { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Box,
  Typography,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Divider,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
  ExpandMore,
  ChevronRight,
  Class as ClassIcon,
  AccountTree,
  Circle,
  ViewColumn,
  Key as KeyIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

import { HierarchyNode, Attribute } from '../../../types/lineage';

interface ClassNodeData {
  label: string;
  name: string;
  display_name?: string;
  type: string;
  attributes?: Attribute[];
  instance_count?: number;
  collapsed?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  level?: number;
  hierarchy?: HierarchyNode;  // Full hierarchy including children
  onAttributeClick?: (attributeId: string) => void;
}

// ============================================
// MAIN CLASS NODE COMPONENT
// ============================================

const ClassNodeWithTreeView = memo<NodeProps<ClassNodeData>>(({ data }) => {
  const {
    name,
    display_name,
    attributes = [],
    instance_count = 0,
    highlighted = false,
    selected = false,
    hierarchy,
  } = data;

  const [expanded, setExpanded] = useState(true);
  const [treeExpanded, setTreeExpanded] = useState<string[]>([]);

  const displayName = display_name || name || 'Unknown';
  const hasChildren = hierarchy && hierarchy.children && hierarchy.children.length > 0;

  // ✅ Collect all subclass IDs for handles
  const collectSubclassIds = (node: HierarchyNode): string[] => {
    const ids: string[] = [node.id];
    if (node.children) {
      node.children.forEach(child => {
        ids.push(...collectSubclassIds(child));
      });
    }
    return ids;
  };

  const allSubclassIds = hierarchy?.children
    ? hierarchy.children.flatMap(child => collectSubclassIds(child))
    : [];

  // ✅ Render subclass tree recursively with SimpleTreeView
  const renderSubclassTree = (node: HierarchyNode): React.ReactNode => {
    const nodeDisplayName = node.display_name || node.name || 'Unknown';
    const hasSubChildren = node.children && node.children.length > 0;

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
              gap: 0.75,
            }}
          >
            <AccountTree sx={{ fontSize: 14, color: 'secondary.main' }} />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            >
              {nodeDisplayName}
            </Typography>
            <Chip
              label={`L${node.level}`}
              size="small"
              color="secondary"
              sx={{
                height: 16,
                fontSize: '0.6rem',
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
            {node.attributes && node.attributes.length > 0 && (
              <Chip
                label={`${node.attributes.length}`}
                size="small"
                variant="outlined"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  '& .MuiChip-label': { px: 0.5 },
                }}
              />
            )}
          </Box>
        }
      >
        {/* Show attributes for this subclass */}
        {node.attributes && node.attributes.map((attr, idx) => (
          <TreeItem
            key={`${node.id}-attr-${attr.id || idx}`}
            itemId={`${node.id}-attr-${attr.id || idx}`}
            label={
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  py: 0.25,
                }}
              >
                <ViewColumn sx={{ fontSize: 11, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                  }}
                >
                  {attr.name}
                </Typography>
                <Chip
                  label={attr.data_type}
                  size="small"
                  sx={{
                    height: 14,
                    fontSize: '0.6rem',
                    '& .MuiChip-label': { px: 0.5 },
                  }}
                />
                {attr.is_primary_key && (
                  <KeyIcon sx={{ fontSize: 10, color: 'warning.main' }} />
                )}
                {attr.is_foreign_key && (
                  <LinkIcon sx={{ fontSize: 10, color: 'info.main' }} />
                )}
              </Box>
            }
          />
        ))}
        
        {/* Render child subclasses recursively */}
        {hasSubChildren && node.children.map(child => renderSubclassTree(child))}
      </TreeItem>
    );
  };
  
  return (
    <Box
      sx={{
        minWidth: 300,
        maxWidth: 420,
        backgroundColor: 'white',
        border: highlighted
          ? '2px solid #10B981'
          : selected
          ? '2px solid #DB0011'
          : '1px solid #E2E8F0',
        borderRadius: '16px',
        boxShadow: highlighted
          ? '0 8px 24px rgba(16, 185, 129, 0.25)'
          : selected
          ? '0 6px 20px rgba(219, 0, 17, 0.2)'
          : '0 4px 12px rgba(0, 0, 0, 0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
          transform: 'translateY(-2px)',
          borderColor: '#DB0011',
        },
      }}
    >
      {/* Edge handles for root node */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          left: -6,
          top: '50%',
          width: 12,
          height: 12,
          background: '#DB0011',
          border: '2px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 6px rgba(219, 0, 17, 0.3)',
          transition: 'all 0.2s ease',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          right: -6,
          top: '50%',
          width: 12,
          height: 12,
          background: '#DB0011',
          border: '2px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 6px rgba(219, 0, 17, 0.3)',
          transition: 'all 0.2s ease',
        }}
      />

      {/* ✅ Additional handles for subclasses (subtle and rounded) */}
      {allSubclassIds.map((subclassId, index) => (
        <React.Fragment key={`handles-${subclassId}`}>
          <Handle
            type="target"
            id={subclassId}
            position={Position.Left}
            style={{
              left: -4,
              top: `${30 + (index * 10)}%`,
              width: 8,
              height: 8,
              background: '#718096',
              border: '1.5px solid white',
              borderRadius: '50%',
              opacity: 0.6,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease',
            }}
          />
          <Handle
            type="source"
            id={subclassId}
            position={Position.Right}
            style={{
              right: -4,
              top: `${30 + (index * 10)}%`,
              width: 8,
              height: 8,
              background: '#718096',
              border: '1.5px solid white',
              borderRadius: '50%',
              opacity: 0.6,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
              transition: 'all 0.2s ease',
            }}
          />
        </React.Fragment>
      ))}
      
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          pb: 1,
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #DB0011 0%, #FF1A2E 100%)',
          color: 'white',
          borderRadius: '16px 16px 0 0',
          transition: 'all 0.2s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, #B30009 0%, #DB0011 100%)',
          },
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <ClassIcon sx={{ fontSize: 20 }} />
          
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600, 
              flex: 1,
              fontSize: '0.95rem',
            }}
          >
            {displayName}
          </Typography>
          
          {hasChildren && (
            <Chip
              label={`${hierarchy!.children.length} subclass${hierarchy!.children.length !== 1 ? 'es' : ''}`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#DB0011',
                borderRadius: '6px',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            />
          )}

          {instance_count > 0 && (
            <Chip
              label={instance_count}
              size="small"
              icon={<Circle sx={{ fontSize: 8 }} />}
              sx={{
                height: 20,
                fontSize: '0.7rem',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                color: '#DB0011',
                borderRadius: '6px',
                fontWeight: 600,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            />
          )}
          
          <IconButton
            size="small"
            sx={{ p: 0, color: 'white' }}
          >
            {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 1.5, pt: 1 }}>
          {/* Root class attributes */}
          {attributes && attributes.length > 0 && (
            <Box mb={hasChildren ? 1.5 : 0}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  fontSize: '0.65rem',
                  letterSpacing: 0.5,
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Root Attributes ({attributes.length})
              </Typography>
              <Box sx={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.02)', 
                borderRadius: 1, 
                p: 0.75,
              }}>
                {attributes.slice(0, 8).map((attr, index) => (
                  <Box
                    key={attr.id || `${attr.name}-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      py: 0.5,
                      px: 0.75,
                      borderRadius: 0.75,
                    }}
                  >
                    <Circle
                      sx={{
                        fontSize: 6,
                        mr: 1,
                        color: attr.is_primary_key ? 'warning.main' : 
                               attr.is_foreign_key ? 'info.main' :
                               'grey.400',
                      }}
                    />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: '0.75rem', 
                        flex: 1,
                        fontWeight: attr.is_primary_key ? 600 : 400,
                        fontFamily: 'monospace',
                      }}
                    >
                      {attr.name}
                    </Typography>
                    <Chip
                      label={attr.data_type}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.65rem',
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                    {attr.is_primary_key && (
                      <KeyIcon sx={{ ml: 0.5, fontSize: 12, color: 'warning.main' }} />
                    )}
                    {attr.is_foreign_key && (
                      <LinkIcon sx={{ ml: 0.5, fontSize: 12, color: 'info.main' }} />
                    )}
                  </Box>
                ))}
                {attributes.length > 8 && (
                  <Typography
                    variant="caption"
                    sx={{ 
                      fontSize: '0.7rem', 
                      color: 'text.secondary', 
                      pl: 2.5, 
                      display: 'block', 
                      mt: 0.5,
                      fontStyle: 'italic',
                    }}
                  >
                    +{attributes.length - 8} more attributes
                  </Typography>
                )}
              </Box>
            </Box>
          )}
          
          {/* ✅ CRITICAL: Subclass hierarchy tree INSIDE the node */}
          {hasChildren && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    fontSize: '0.65rem',
                    letterSpacing: 0.5,
                    display: 'block',
                    mb: 0.75,
                  }}
                >
                  Subclass Hierarchy ({hierarchy!.children.length})
                </Typography>
                <Box
                  sx={{
                    border: '1px dashed',
                    borderColor: 'secondary.light',
                    borderRadius: 1,
                    p: 1,
                    backgroundColor: 'rgba(156, 39, 176, 0.03)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                >
                  <SimpleTreeView
                    expandedItems={treeExpanded}
                    onExpandedItemsChange={(_e, items) => setTreeExpanded(items)}
                    slots={{
                      expandIcon: ChevronRight,
                      collapseIcon: ExpandMore,
                    }}
                  >
                    {hierarchy!.children.map(child => renderSubclassTree(child))}
                  </SimpleTreeView>
                </Box>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Box>
  );
});

ClassNodeWithTreeView.displayName = 'ClassNodeWithTreeView';

export default ClassNodeWithTreeView;