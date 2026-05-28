import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { memo, useCallback, useState, type MouseEvent } from "react";
import { useProjectStore } from "../state/useProjectStore";

export const CanvasEdge = memo(function CanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  selected,
  animated,
  deletable,
}: EdgeProps) {
  const disconnectEdge = useProjectStore((state) => state.disconnectEdge);
  const [hovered, setHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const canRemove = deletable !== false;
  const removeVisible = hovered || selected;
  const handleRemove = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    disconnectEdge(id);
  }, [disconnectEdge, id]);

  return (
    <>
      <g
        className="sbc-edge"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={style}
          interactionWidth={24}
          className={animated ? "sbc-edge__path sbc-edge__path--animated" : "sbc-edge__path"}
        />
      </g>
      {canRemove ? (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="sbc-edge-remove nodrag nopan nowheel"
            data-visible={removeVisible ? "true" : "false"}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            title="Remove connection"
            aria-label={`Remove connection ${id}`}
            onClick={handleRemove}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <X size={15} strokeWidth={2.6} />
          </button>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
});
