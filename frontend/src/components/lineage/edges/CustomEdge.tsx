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
    const edgeColor = highlighted ? '#10B981' : style.stroke || '#718096';

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
            strokeOpacity: 1,
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
                background: 'rgba(255, 255, 255, 0.98)',
                padding: '6px 10px',
                borderRadius: '8px',
                border: `1.5px solid ${highlighted ? '#10B981' : '#E2E8F0'}`,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s ease',
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