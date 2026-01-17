// frontend/src/components/lineage/edges/CustomEdge.tsx

import React, { memo } from 'react';
import {
  EdgeProps,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from 'reactflow';

interface CustomEdgeData {
  label?: string;
  type?: string;
  highlighted?: boolean;
  transformation?: string;
  cardinality?: string;
}

export const CustomEdge = memo<EdgeProps<CustomEdgeData>>(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    data,
    markerEnd,
  }) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const highlighted = data?.highlighted || false;
    const edgeColor = highlighted ? '#ffc107' : style.stroke || '#64b5f6';

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={{
            ...style,
            stroke: edgeColor,
            strokeWidth: highlighted ? 3 : (style.strokeWidth as number) || 2,
          }}
        />
        
        {data?.label && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                fontSize: 11,
                fontWeight: 500,
                pointerEvents: 'all',
                background: 'white',
                padding: '4px 8px',
                borderRadius: 4,
                border: `1px solid ${highlighted ? '#ffc107' : '#e0e0e0'}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
              className="nodrag nopan"
            >
              {data.label}
              {data.cardinality && (
                <span style={{ marginLeft: 4, color: '#666', fontSize: 10 }}>
                  ({data.cardinality})
                </span>
              )}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

CustomEdge.displayName = 'CustomEdge';