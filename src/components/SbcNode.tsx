import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
  Ban,
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  GitBranch,
  Globe2,
  Network,
  RadioTower,
  Route,
  Server,
  Shield,
  Shuffle,
  Trash2,
} from "lucide-react";
import type { SbcFlowNode } from "../canvas/graph";
import { useProjectStore } from "../state/useProjectStore";

const iconMap = {
  inbound: RadioTower,
  route: Route,
  "route-rule": GitBranch,
  dns: Globe2,
  "dns-server": Server,
  "dns-rule": GitBranch,
  outbound: Network,
  settings: Braces,
};

function outboundIcon(type: string) {
  if (type === "direct") return CheckCircle2;
  if (type === "block") return Ban;
  if (type === "selector") return Shuffle;
  if (type === "urltest") return Database;
  return Shield;
}

export function SbcNode({ id, data, selected }: NodeProps<SbcFlowNode>) {
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const createCompatible = useProjectStore((state) => state.createCompatible);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const Icon = data.kind === "outbound" ? outboundIcon(data.type) : iconMap[data.kind];

  return (
    <div
      className={`sbc-node sbc-node--${data.status} ${selected ? "is-selected" : ""}`}
      onClick={() => setSelectedId(id)}
      data-testid={`node-${id}`}
    >
      <Handle className="sbc-handle sbc-handle--in" type="target" position={Position.Left} />
      <div className="sbc-node__header">
        <div className="sbc-node__icon">
          <Icon size={18} strokeWidth={2.2} />
        </div>
        <div>
          <div className="sbc-node__eyebrow">{data.kind}</div>
          <div className="sbc-node__title">{data.title}</div>
        </div>
        <div className="sbc-node__status">
          {data.status === "error" ? <CircleAlert size={15} /> : <CheckCircle2 size={15} />}
        </div>
      </div>
      <div className="sbc-node__type">{data.type}</div>
      <div className="sbc-node__subtitle">{data.subtitle}</div>
      <div className="sbc-node__actions nodrag">
        {data.compatible.map((kind) => (
          <button
            key={kind}
            className="node-chip"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              createCompatible(id, kind);
            }}
          >
            + {kind}
          </button>
        ))}
        <button
          className="node-icon-button"
          type="button"
          aria-label={`Delete ${data.title}`}
          onClick={(event) => {
            event.stopPropagation();
            deleteEntity(data.ref);
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <Handle className="sbc-handle sbc-handle--out" type="source" position={Position.Right} />
    </div>
  );
}
