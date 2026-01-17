// frontend/src/components/lineage/nodes/AttributeNode.tsx

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Box, Card, CardContent, Typography, Chip, Stack } from '@mui/material';
import { Circle, Key, Link as LinkIcon } from '@mui/icons-material';

interface AttributeNodeData {
  label: string;
  name: string;
  data_type: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
  highlighted: boolean;
  selected: boolean;
  class_name?: string;
  sample_value?: any;
}

export const AttributeNode = memo<NodeProps<AttributeNodeData>>(({ data, id }) => {
  const getIcon = () => {
    if (data.is_primary_key) return <Key sx={{ fontSize: 16 }} />;
    if (data.is_foreign_key) return <LinkIcon sx={{ fontSize: 16 }} />;
    return <Circle sx={{ fontSize: 12 }} />;
  };

  const getColor = () => {
    if (data.is_primary_key) return 'warning.main';
    if (data.is_foreign_key) return 'secondary.main';
    return 'info.main';
  };

  return (
    <>
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{
          background: data.highlighted ? '#ffc107' : '#4fc3f7',
          width: 8,
          height: 8,
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{
          background: data.highlighted ? '#ffc107' : '#4fc3f7',
          width: 8,
          height: 8,
        }}
      />

      <Card
        sx={{
          minWidth: 200,
          maxWidth: 300,
          border: 2,
          borderColor: data.highlighted
            ? 'warning.main'
            : data.selected
            ? 'info.main'
            : 'divider',
          boxShadow: data.highlighted || data.selected ? 3 : 1,
          bgcolor: 'background.paper',
          transition: 'all 0.2s',
          '&:hover': {
            boxShadow: 2,
          },
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ color: getColor() }}>{getIcon()}</Box>
            <Typography variant="body2" fontWeight={600}>
              {data.label}
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={data.data_type}
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
            {data.class_name && (
              <Chip
                size="small"
                label={data.class_name}
                variant="outlined"
                color="primary"
                sx={{ fontSize: '0.7rem' }}
              />
            )}
          </Stack>

          {data.sample_value !== undefined && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                mt: 1,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              Sample: {String(data.sample_value)}
            </Typography>
          )}
        </CardContent>
      </Card>
    </>
  );
});

AttributeNode.displayName = 'AttributeNode';