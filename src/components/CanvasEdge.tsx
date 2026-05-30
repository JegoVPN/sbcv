import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { memo, useCallback, useState, type MouseEvent } from "react";
import { parseEdgeId, relationForId } from "../domain/portRelationRegistry";
import { useProjectStore } from "../state/useProjectStore";

// V8-S1: the human name of the relation an edge represents, derived from its id (formatEdgeId encodes the
// relationId). Two edges between the same node pair (e.g. an outbound that is BOTH a route-rule target and a
// selector member) are otherwise visually identical; this names each on hover. Falls back to "" for the
// readonly/decorative order edges (no registry relation), which then get no tooltip.
export function relationLabelForEdge(edgeId: string): string {
  const relationId = parseEdgeId(edgeId)?.relationId;
  return (relationId && relationForId(relationId)?.source.label) || "";
}

export const CanvasEdge = memo(function CanvasEdge({
  id,
  source,
  target,
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
  data,
}: EdgeProps) {
  const disconnectEdge = useProjectStore((state) => state.disconnectEdge);
  const selectedId = useProjectStore((state) => state.selectedId);
  // A selected node lights its first-degree edges (the ones it is an endpoint of) in the card's
  // selection blue, so its immediate up/downstream chain stands out from the rest of the green graph.
  const highlighted = selectedId != null && (source === selectedId || target === selectedId);
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
  const relationLabel = relationLabelForEdge(id);
  // V8-S2: an edge to/from an unresolved tag (graph.ts flags it + synthesizes a "missing reference" node).
  const dangling = (data as { dangling?: boolean } | undefined)?.dangling === true;
  const tooltip = dangling ? `${relationLabel || "Reference"} → missing target` : relationLabel;
  const handleRemove = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    disconnectEdge(id);
  }, [disconnectEdge, id]);

  return (
    <>
      <g
        className="sbc-edge"
        data-relation={relationLabel || undefined}
        data-dangling={dangling ? "true" : undefined}
        aria-label={tooltip || undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Native hover tooltip naming the relation (and flagging a dangling target). */}
        {tooltip ? <title>{tooltip}</title> : null}
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={markerEnd}
          style={style}
          interactionWidth={24}
          className={`${animated ? "sbc-edge__path sbc-edge__path--animated" : "sbc-edge__path"}${highlighted ? " sbc-edge__path--highlighted" : ""}${dangling ? " sbc-edge__path--dangling" : ""}`}
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
