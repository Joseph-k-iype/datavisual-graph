// frontend/src/components/lineage/nodes/ClassNode.tsx - FIXED

import React, { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Stack,
  Typography,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  TableChart,
  ExpandMore,
  ExpandLess,
  Circle,
} from '@mui/icons-material';

interface AttributeInfo {
  id: string;
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
}

interface ClassNodeData {
  label: string;
  name: string;
  type: string;
  attributes?: AttributeInfo[];
  instance_count?: number;
  collapsed: boolean;
  highlighted: boolean;
  selected: boolean;
  has_upstream: boolean;
  has_downstream: boolean;
  level: number;
  color?: string;
  onAttributeClick?: (attributeId: string) => void;
}

export const ClassNode = memo<NodeProps<ClassNodeData>>(({ data }) => {
  const [expanded, setExpanded] = React.useState(!data.collapsed);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(prev => !prev);
  }, []);

  const handleAttributeClick = useCallback((e: React.MouseEvent, attrId: string) => {
    e.stopPropagation();
    if (data.onAttributeClick) {
      data.onAttributeClick(attrId);
    }
  }, [data]);

  const getAttributeColor = (attr: AttributeInfo): "warning" | "secondary" | "default" => {
    if (attr.is_primary_key) return 'warning';
    if (attr.is_foreign_key) return 'secondary';
    return 'default';
  };

  const getAttributeIcon = (attr: AttributeInfo): string => {
    if (attr.is_primary_key) return '🔑';
    if (attr.is_foreign_key) return '🔗';
    return '📊';
  };

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
          minWidth: 280,
          maxWidth: 400,
          border: 2,
          borderColor: data.highlighted
            ? 'warning.main'
            : data.selected
            ? 'primary.main'
            : 'divider',
          boxShadow: data.highlighted || data.selected ? 4 : 1,
          bgcolor: 'background.paper',
          transition: 'all 0.2s',
          '&:hover': {
            boxShadow: 3,
          },
        }}
      >
        <CardHeader
          avatar={
            <TableChart
              sx={{
                color: data.color || 'primary.main',
                fontSize: 28,
              }}
            />
          }
          title={
            <Typography variant="subtitle1" fontWeight={600}>
              {data.label}
            </Typography>
          }
          subheader={
            <Stack direction="row" spacing={1} mt={0.5}>
              {data.instance_count !== undefined && (
                <Chip
                  size="small"
                  label={`${data.instance_count} instances`}
                  variant="outlined"
                  color="primary"
                />
              )}
              <Chip
                size="small"
                label={`Level ${data.level}`}
                variant="outlined"
              />
            </Stack>
          }
          action={
            data.attributes && data.attributes.length > 0 ? (
              <IconButton size="small" onClick={handleToggle}>
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            ) : null
          }
          sx={{ pb: 1 }}
        />

        {data.attributes && data.attributes.length > 0 && (
          <Collapse in={expanded} timeout="auto">
            <CardContent sx={{ pt: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
              >
                Attributes ({data.attributes.length})
              </Typography>
              <Stack spacing={0.5}>
                {data.attributes.map((attr) => (
                  <Chip
                    key={attr.id}
                    size="small"
                    variant="outlined"
                    color={getAttributeColor(attr)}
                    icon={
                      <Circle
                        sx={{
                          fontSize: 12,
                          ml: 1,
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{getAttributeIcon(attr)}</span>
                        <span>{attr.name}</span>
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ color: 'text.secondary', ml: 0.5 }}
                        >
                          ({attr.data_type})
                        </Typography>
                      </Box>
                    }
                    onClick={(e) => handleAttributeClick(e, attr.id)}
                    sx={{
                      justifyContent: 'flex-start',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Collapse>
        )}

        {/* Indicators */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            px: 2,
            pb: 1,
            pt: 0.5,
          }}
        >
          {data.has_upstream && (
            <Typography variant="caption" color="success.main">
              ← Upstream
            </Typography>
          )}
          {data.has_downstream && (
            <Typography variant="caption" color="error.main">
              Downstream →
            </Typography>
          )}
        </Box>
      </Card>
    </>
  );
});

ClassNode.displayName = 'ClassNode';