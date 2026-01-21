// frontend/src/components/lineage/nodes/ClassNodeWithTreeView.tsx
// ✅ FIXED: Proper tree view with collapsible hierarchy

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
import {
  ExpandMore,
  ChevronRight,
  Class as ClassIcon,
  AccountTree,
} from '@mui/icons-material';

import { HierarchyNode, Attribute } from '../../../types/lineage';

interface ClassNodeData {
  label: string;
  name: string;
  type: string;
  attributes?: Attribute[];
  instance_count?: number;
  collapsed?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  level?: number;
  hierarchy?: HierarchyNode;
  onAttributeClick?: (attributeId: string) => void;
}

// ============================================
// TREE NODE COMPONENT
// ============================================

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
  onAttributeClick?: (attributeId: string) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level, onAttributeClick }) => {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <Box sx={{ ml: level * 2 }}>
      {/* Node Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          py: 0.5,
          px: 1,
          borderRadius: 1,
          backgroundColor: level === 0 ? 'rgba(33, 150, 243, 0.1)' : 'rgba(0, 0, 0, 0.02)',
          '&:hover': {
            backgroundColor: level === 0 ? 'rgba(33, 150, 243, 0.15)' : 'rgba(0, 0, 0, 0.05)',
          },
          mb: 0.5,
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ p: 0, mr: 0.5, width: 20, height: 20 }}
          >
            {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
          </IconButton>
        ) : (
          <Box sx={{ width: 20, mr: 0.5 }} />
        )}
        
        <AccountTree sx={{ fontSize: 16, mr: 0.5, color: 'primary.main' }} />
        
        <Typography
          variant="body2"
          sx={{
            fontWeight: level === 0 ? 600 : 400,
            fontSize: level === 0 ? '0.875rem' : '0.8125rem',
            flex: 1,
          }}
        >
          {node.display_name || node.name}
        </Typography>
        
        {node.instance_count !== undefined && node.instance_count > 0 && (
          <Chip
            label={node.instance_count}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              backgroundColor: 'primary.main',
              color: 'white',
            }}
          />
        )}
      </Box>
      
      {/* Attributes */}
      {node.attributes && node.attributes.length > 0 && (
        <Box sx={{ ml: 2.5, mb: 0.5 }}>
          {node.attributes.slice(0, 3).map((attr) => (
            <Box
              key={attr.id || attr.name}
              sx={{
                display: 'flex',
                alignItems: 'center',
                py: 0.25,
                px: 0.5,
                fontSize: '0.75rem',
                color: 'text.secondary',
                cursor: onAttributeClick ? 'pointer' : 'default',
                '&:hover': onAttributeClick ? {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  borderRadius: 0.5,
                } : {},
              }}
              onClick={() => onAttributeClick && attr.id && onAttributeClick(attr.id)}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: attr.is_primary_key ? 'warning.main' : 'grey.400',
                  mr: 0.5,
                }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                {attr.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ fontSize: '0.65rem', ml: 0.5, color: 'grey.500' }}
              >
                ({attr.data_type})
              </Typography>
            </Box>
          ))}
          {node.attributes.length > 3 && (
            <Typography
              variant="caption"
              sx={{ pl: 0.5, fontSize: '0.7rem', color: 'grey.500' }}
            >
              +{node.attributes.length - 3} more
            </Typography>
          )}
        </Box>
      )}
      
      {/* Children */}
      {hasChildren && (
        <Collapse in={expanded}>
          <Box sx={{ mt: 0.5 }}>
            {node.children.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                level={level + 1}
                onAttributeClick={onAttributeClick}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

// ============================================
// MAIN CLASS NODE COMPONENT
// ============================================

const ClassNodeWithTreeView = memo<NodeProps<ClassNodeData>>(({ data }) => {
  const {
    label,
    attributes = [],
    instance_count = 0,
    highlighted = false,
    selected = false,
    level = 0,
    hierarchy,
    onAttributeClick,
  } = data;

  // If this node has a hierarchy (children), show tree view
  const hasHierarchy = hierarchy && hierarchy.children && hierarchy.children.length > 0;

  return (
    <Box
      sx={{
        minWidth: hasHierarchy ? 300 : 200,
        maxWidth: hasHierarchy ? 500 : 300,
        backgroundColor: 'white',
        border: highlighted
          ? '2px solid #ffc107'
          : selected
          ? '2px solid #1976d2'
          : '1px solid #e0e0e0',
        borderRadius: 2,
        boxShadow: highlighted
          ? '0 4px 12px rgba(255, 193, 7, 0.3)'
          : selected
          ? '0 4px 12px rgba(25, 118, 210, 0.3)'
          : '0 2px 8px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        },
      }}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 12,
          height: 12,
          backgroundColor: highlighted ? '#ffc107' : '#1976d2',
          border: '2px solid white',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 12,
          height: 12,
          backgroundColor: highlighted ? '#ffc107' : '#1976d2',
          border: '2px solid white',
        }}
      />

      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          backgroundColor: highlighted
            ? 'rgba(255, 193, 7, 0.1)'
            : selected
            ? 'rgba(25, 118, 210, 0.1)'
            : 'rgba(33, 150, 243, 0.08)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <ClassIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              flex: 1,
              color: 'text.primary',
            }}
          >
            {label}
          </Typography>
          {instance_count > 0 && (
            <Chip
              label={`${instance_count} instances`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                backgroundColor: 'primary.main',
                color: 'white',
              }}
            />
          )}
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ p: 1.5 }}>
        {hasHierarchy ? (
          /* Tree View for Hierarchical Nodes */
          <Box>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                mb: 1,
                display: 'block',
              }}
            >
              Class Hierarchy
            </Typography>
            <TreeNode
              node={hierarchy!}
              level={0}
              onAttributeClick={onAttributeClick}
            />
          </Box>
        ) : (
          /* Simple Attribute List for Non-Hierarchical Nodes */
          <>
            {attributes.length > 0 && (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: 'text.secondary',
                    mb: 0.5,
                    display: 'block',
                  }}
                >
                  Attributes ({attributes.length})
                </Typography>
                <Stack spacing={0.5}>
                  {attributes.slice(0, 5).map((attr) => (
                    <Box
                      key={attr.id || attr.name}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        py: 0.5,
                        px: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.02)',
                        borderRadius: 1,
                        cursor: onAttributeClick ? 'pointer' : 'default',
                        '&:hover': onAttributeClick
                          ? {
                              backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            }
                          : {},
                      }}
                      onClick={() =>
                        onAttributeClick && attr.id && onAttributeClick(attr.id)
                      }
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: attr.is_primary_key
                            ? 'warning.main'
                            : 'grey.400',
                          mr: 1,
                        }}
                      />
                      <Typography variant="body2" sx={{ flex: 1, fontSize: '0.8rem' }}>
                        {attr.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                      >
                        {attr.data_type}
                      </Typography>
                    </Box>
                  ))}
                  {attributes.length > 5 && (
                    <Typography
                      variant="caption"
                      sx={{ pl: 1, color: 'text.secondary', fontSize: '0.75rem' }}
                    >
                      +{attributes.length - 5} more attributes
                    </Typography>
                  )}
                </Stack>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
});

ClassNodeWithTreeView.displayName = 'ClassNodeWithTreeView';

export default ClassNodeWithTreeView;