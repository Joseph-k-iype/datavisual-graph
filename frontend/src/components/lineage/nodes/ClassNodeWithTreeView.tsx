// frontend/src/components/lineage/nodes/ClassNodeWithTreeView.tsx
// ✅ STANDALONE: Each node independent, fully connectable, nice visual design

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
  Circle,
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
  isStandaloneNode?: boolean;
  parentId?: string;
  onAttributeClick?: (attributeId: string) => void;
}

// ============================================
// MAIN CLASS NODE COMPONENT
// ============================================

const ClassNodeWithTreeView = memo<NodeProps<ClassNodeData>>(({ data }) => {
  const {
    label,
    name,
    type,
    attributes = [],
    instance_count = 0,
    highlighted = false,
    selected = false,
    level = 0,
    hierarchy,
    isStandaloneNode = false,
    onAttributeClick,
  } = data;

  const [expanded, setExpanded] = useState(true);
  
  const isSubclass = type === 'subclass' || level > 0;
  const hasChildren = hierarchy && hierarchy.children && hierarchy.children.length > 0;
  
  return (
    <Box
      sx={{
        minWidth: isSubclass ? 220 : 280,
        maxWidth: isSubclass ? 320 : 380,
        backgroundColor: 'white',
        border: highlighted
          ? '2px solid #ffc107'
          : selected
          ? '2px solid #1976d2'
          : isSubclass
          ? '2px solid #9c27b0'
          : '2px solid #2196f3',
        borderRadius: 2,
        boxShadow: highlighted
          ? '0 4px 12px rgba(255, 193, 7, 0.3)'
          : selected
          ? '0 4px 12px rgba(25, 118, 210, 0.3)'
          : isSubclass
          ? '0 3px 10px rgba(156, 39, 176, 0.25)'
          : '0 2px 8px rgba(33, 150, 243, 0.2)',
        transition: 'all 0.2s ease',
        '&:hover': {
          boxShadow: isSubclass 
            ? '0 4px 16px rgba(156, 39, 176, 0.35)' 
            : '0 4px 16px rgba(33, 150, 243, 0.3)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* ✅ CRITICAL: Edge handles for ALL nodes */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          left: -8,
          top: '50%',
          width: 14,
          height: 14,
          background: isSubclass ? '#9c27b0' : '#1976d2',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          right: -8,
          top: '50%',
          width: 14,
          height: 14,
          background: isSubclass ? '#9c27b0' : '#1976d2',
          border: '2px solid white',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      />
      
      {/* Header */}
      <Box
        sx={{
          p: 1.5,
          pb: 1,
          cursor: 'pointer',
          background: isSubclass 
            ? 'linear-gradient(135deg, rgba(156, 39, 176, 0.12) 0%, rgba(156, 39, 176, 0.05) 100%)' 
            : 'linear-gradient(135deg, #2196f3 0%, #1976d2 100%)',
          color: isSubclass ? 'text.primary' : 'white',
          borderRadius: '8px 8px 0 0',
          borderBottom: isSubclass ? '2px solid rgba(156, 39, 176, 0.2)' : 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          {isSubclass ? (
            <AccountTree sx={{ fontSize: 20, color: 'secondary.main' }} />
          ) : (
            <ClassIcon sx={{ fontSize: 20 }} />
          )}
          
          <Typography 
            variant="subtitle2" 
            sx={{ 
              fontWeight: 600, 
              flex: 1, 
              fontSize: isSubclass ? '0.875rem' : '0.95rem',
            }}
          >
            {name || label}
          </Typography>
          
          {isSubclass && (
            <Chip
              label={`Level ${level}`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: 'secondary.main',
                color: 'white',
              }}
            />
          )}
          
          {hasChildren && (
            <Chip
              label={`${hierarchy!.children.length} child${hierarchy!.children.length > 1 ? 'ren' : ''}`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.65rem',
                backgroundColor: isSubclass ? 'rgba(156, 39, 176, 0.3)' : 'rgba(255, 255, 255, 0.25)',
                color: isSubclass ? 'secondary.dark' : 'white',
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
                backgroundColor: isSubclass 
                  ? 'rgba(76, 175, 80, 0.2)' 
                  : 'rgba(255, 255, 255, 0.25)',
                color: isSubclass ? 'success.dark' : 'white',
                fontWeight: 600,
              }}
            />
          )}
          
          <IconButton
            size="small"
            sx={{ 
              p: 0, 
              color: isSubclass ? 'text.primary' : 'white',
            }}
          >
            {expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
          </IconButton>
        </Stack>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 1.5, pt: 1 }}>
          {/* ✅ CRITICAL: Show ONLY this class's attributes (no inheritance) */}
          {attributes && attributes.length > 0 ? (
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
                {isSubclass ? 'Own Attributes' : 'Attributes'} ({attributes.length})
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
                      cursor: onAttributeClick && attr.id ? 'pointer' : 'default',
                      borderRadius: 0.75,
                      transition: 'all 0.15s',
                      '&:hover': onAttributeClick ? {
                        backgroundColor: isSubclass 
                          ? 'rgba(156, 39, 176, 0.08)' 
                          : 'rgba(33, 150, 243, 0.08)',
                        transform: 'translateX(2px)',
                      } : {},
                    }}
                    onClick={() => onAttributeClick && attr.id && onAttributeClick(attr.id)}
                  >
                    <Circle
                      sx={{
                        fontSize: 7,
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
          ) : (
            <Box 
              sx={{ 
                p: 2, 
                textAlign: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.02)',
                borderRadius: 1,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No attributes defined
              </Typography>
            </Box>
          )}
          
          {/* Visual indicator if this node has children (but don't render them nested) */}
          {hasChildren && (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Box
                sx={{
                  p: 1,
                  borderRadius: 1,
                  backgroundColor: isSubclass 
                    ? 'rgba(156, 39, 176, 0.05)' 
                    : 'rgba(33, 150, 243, 0.05)',
                  border: '1px dashed',
                  borderColor: isSubclass ? 'secondary.light' : 'primary.light',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1}>
                  <AccountTree 
                    sx={{ 
                      fontSize: 16, 
                      color: isSubclass ? 'secondary.main' : 'primary.main',
                    }} 
                  />
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontSize: '0.7rem',
                      color: 'text.secondary',
                      fontWeight: 500,
                    }}
                  >
                    Has {hierarchy!.children.length} subclass{hierarchy!.children.length > 1 ? 'es' : ''}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Chip
                    label="Hierarchy"
                    size="small"
                    variant="outlined"
                    sx={{
                      height: 18,
                      fontSize: '0.6rem',
                      borderColor: isSubclass ? 'secondary.light' : 'primary.light',
                      color: isSubclass ? 'secondary.main' : 'primary.main',
                    }}
                  />
                </Stack>
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