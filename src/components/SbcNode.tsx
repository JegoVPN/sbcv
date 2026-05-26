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
  Plus,
  RadioTower,
  Route,
  Server,
  Settings2,
  Shield,
  Shuffle,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { SbcFlowNode, SbcNodeKind } from "../canvas/graph";
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

type PortSpec = {
  key: string;
  label: string;
  nodeKind: SbcNodeKind;
  icon: LucideIcon;
};

function portSpecs(kind: SbcNodeKind, type: string, direction: "input" | "output"): PortSpec[] {
  if (direction === "input") {
    if (kind === "route") return [{ key: "inbound", label: "Inbound traffic", nodeKind: "inbound", icon: RadioTower }];
    if (kind === "route-rule") return [{ key: "route", label: "Route order", nodeKind: "route", icon: Route }];
    if (kind === "dns") return [{ key: "inbound-query", label: "DNS query source", nodeKind: "inbound", icon: RadioTower }];
    if (kind === "dns-rule") return [{ key: "dns", label: "DNS resolver", nodeKind: "dns", icon: Globe2 }];
    if (kind === "dns-server") {
      return [{ key: "dns-rule", label: "DNS rule", nodeKind: "dns-rule", icon: GitBranch }];
    }
    if (kind === "outbound") {
      return [
        { key: "route", label: "Route target", nodeKind: "route", icon: Route },
        { key: "route-rule", label: "Route rule target", nodeKind: "route-rule", icon: GitBranch },
        { key: "outbound-group", label: "Selector member", nodeKind: "outbound", icon: Shuffle },
      ];
    }
    return [];
  }

  if (kind === "inbound") return [{ key: "route", label: "Route", nodeKind: "route", icon: Route }];
  if (kind === "route") {
    return [
      { key: "route-rule", label: "Route rule", nodeKind: "route-rule", icon: GitBranch },
      { key: "outbound", label: "Outbound", nodeKind: "outbound", icon: Network },
    ];
  }
  if (kind === "route-rule") return [{ key: "outbound", label: "Outbound", nodeKind: "outbound", icon: Network }];
  if (kind === "dns") {
    return [
      { key: "dns-rule", label: "DNS rule", nodeKind: "dns-rule", icon: GitBranch },
      { key: "dns-server", label: "DNS server", nodeKind: "dns-server", icon: Server },
    ];
  }
  if (kind === "dns-rule") return [{ key: "dns-server", label: "DNS server", nodeKind: "dns-server", icon: Server }];
  if (kind === "dns-server") return [{ key: "outbound", label: "Detour outbound", nodeKind: "outbound", icon: Network }];
  if (kind === "outbound" && (type === "selector" || type === "urltest")) {
    return [{ key: "outbound-member", label: "Outbound member", nodeKind: "outbound", icon: Network }];
  }
  return [];
}

export function SbcNode({ id, data, selected }: NodeProps<SbcFlowNode>) {
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const setPanelTab = useProjectStore((state) => state.setPanelTab);
  const createCompatible = useProjectStore((state) => state.createCompatible);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const Icon = data.kind === "outbound" ? outboundIcon(data.type) : iconMap[data.kind];
  const inputPorts = portSpecs(data.kind, data.type, "input");
  const outputPorts = portSpecs(data.kind, data.type, "output");

  return (
    <div
      className={`sbc-node-shell ${selected ? "is-selected" : ""}`}
      onClick={() => setSelectedId(id)}
      data-testid={`node-${id}`}
    >
      <div className="sbc-node-titlebar" data-testid="node-titlebar">
        <span className="sbc-node-titlebar__icon">
          <Icon size={18} strokeWidth={2.2} />
        </span>
        <span>{`${data.kind} / ${data.type}`}</span>
      </div>
      <div className={`sbc-node sbc-node--${data.status} ${selected ? "is-selected" : ""}`} data-testid="node-card">
        {selected ? (
          <>
            <span className="sbc-node__corner sbc-node__corner--tl" data-testid="node-selection-corner" />
            <span className="sbc-node__corner sbc-node__corner--tr" data-testid="node-selection-corner" />
            <span className="sbc-node__corner sbc-node__corner--br" data-testid="node-selection-corner" />
            <span className="sbc-node__corner sbc-node__corner--bl" data-testid="node-selection-corner" />
          </>
        ) : null}

        <div className="sbc-node__ports sbc-node__ports--left" data-testid="node-left-ports">
          <Handle className="sbc-handle sbc-handle--in" type="target" position={Position.Left} />
          {inputPorts.map((port) => (
            <span
              className="sbc-port sbc-port--input"
              key={port.key}
              title={port.label}
              data-port-type={port.key}
              data-port-node-kind={port.nodeKind}
            >
              <port.icon size={15} />
            </span>
          ))}
        </div>

        <div className="sbc-node__ports sbc-node__ports--right" data-testid="node-right-ports">
          <Handle className="sbc-handle sbc-handle--out" type="source" position={Position.Right} />
          {outputPorts.map((port) => (
            <span
              className="sbc-port sbc-port--output"
              key={port.key}
              title={port.label}
              data-port-type={port.key}
              data-port-node-kind={port.nodeKind}
            >
              <port.icon size={15} />
            </span>
          ))}
        </div>

        <div className="sbc-node__summary">
          <div className="sbc-node__status">
            {data.status === "error" ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          </div>
          <div className="sbc-node__title">{data.title}</div>
          <div className="sbc-node__subtitle">{data.subtitle}</div>
        </div>

        <button
          className="sbc-node__add nodrag"
          type="button"
          aria-label={`Add from ${data.title}`}
          onClick={(event) => {
            event.stopPropagation();
            if (data.compatible[0]) createCompatible(id, data.compatible[0]);
          }}
        >
          <Plus size={20} />
        </button>

        <div className="sbc-node__toolbar nodrag" data-testid="node-bottom-toolbar">
          <span className="sbc-node-pill sbc-node-pill--type">
            <Icon size={16} />
            {data.type}
          </span>
          <span className={`sbc-node-pill sbc-node-pill--${data.status}`}>
            {data.status === "error" ? <CircleAlert size={14} /> : <CheckCircle2 size={14} />}
            {data.status}
          </span>
          <button
            className="node-icon-button"
            type="button"
            aria-label={`Open inspector for ${data.title}`}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(id);
              setPanelTab(
                data.kind === "dns" || data.kind === "dns-rule"
                  ? "dns"
                  : data.kind === "route" || data.kind === "route-rule"
                    ? "rules"
                    : "json",
              );
            }}
          >
            <Settings2 size={15} />
          </button>
          <button
            className="sbc-node-primary"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(id);
            }}
          >
            <CheckCircle2 size={15} />
            {data.compatible.length || 1}
          </button>
        </div>

        <div className="sbc-node__actions nodrag" data-testid="node-hover-actions">
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
            className="node-icon-button node-icon-button--danger"
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
      </div>
    </div>
  );
}
