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
import type { SingBoxConfig } from "../domain/types";
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

export type PortSpec = {
  key: string;
  label: string;
  nodeKind: SbcNodeKind;
  nodeType?: string;
  icon: LucideIcon;
};

export function getNodeIcon(kind: SbcNodeKind, type: string): LucideIcon {
  return kind === "outbound" ? outboundIcon(type) : iconMap[kind];
}

export function getPortSpecs(kind: SbcNodeKind, type: string, direction: "input" | "output"): PortSpec[] {
  if (direction === "input") {
    if (kind === "route") return [{ key: "inbound", label: "Inbound traffic", nodeKind: "inbound", icon: RadioTower }];
    if (kind === "route-rule") return [{ key: "route", label: "Route order", nodeKind: "route", icon: Route }];
    if (kind === "dns") return [{ key: "inbound-query", label: "DNS query source", nodeKind: "inbound", icon: RadioTower }];
    if (kind === "dns-rule") return [{ key: "dns", label: "DNS resolver", nodeKind: "dns", icon: Globe2 }];
    if (kind === "dns-server") {
      return [{ key: "dns-rule", label: "DNS rule", nodeKind: "dns-rule", icon: GitBranch }];
    }
    if (kind === "outbound") {
      const routingInputs: PortSpec[] = [
        { key: "route", label: "Route target", nodeKind: "route", icon: Route },
        { key: "route-rule", label: "Route rule target", nodeKind: "route-rule", icon: GitBranch },
      ];
      if (type === "selector" || type === "urltest") return routingInputs;
      return [
        ...routingInputs,
        { key: "selector-group", label: "Selector member", nodeKind: "outbound", nodeType: "selector", icon: Shuffle },
        { key: "urltest-group", label: "URLTest member", nodeKind: "outbound", nodeType: "urltest", icon: Database },
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

function nodeValueFromId(id: string) {
  return id.split(":").slice(1).join(":");
}

function routeRuleIndex(id: string) {
  const index = Number(nodeValueFromId(id));
  return Number.isInteger(index) ? index : -1;
}

function isPortConnected(
  config: SingBoxConfig,
  id: string,
  kind: SbcNodeKind,
  type: string,
  direction: "input" | "output",
  portKey: string,
) {
  const value = nodeValueFromId(id);

  if (direction === "input") {
    if (kind === "route" && portKey === "inbound") return (config.inbounds?.length ?? 0) > 0;
    if (kind === "route-rule" && portKey === "route") return true;
    if (kind === "dns" && portKey === "inbound-query") return (config.inbounds?.length ?? 0) > 0;
    if (kind === "dns-rule" && portKey === "dns") return true;
    if (kind === "dns-server" && portKey === "dns-rule") {
      return config.dns?.rules?.some((rule) => rule.server === value) ?? false;
    }
    if (kind === "outbound" && portKey === "route") return config.route?.final === value;
    if (kind === "outbound" && portKey === "route-rule") {
      return config.route?.rules?.some((rule) => rule.outbound === value) ?? false;
    }
    if (kind === "outbound" && portKey === "selector-group") {
      return config.outbounds?.some((outbound) => outbound.type === "selector" && outbound.outbounds?.includes(value)) ?? false;
    }
    if (kind === "outbound" && portKey === "urltest-group") {
      return config.outbounds?.some((outbound) => outbound.type === "urltest" && outbound.outbounds?.includes(value)) ?? false;
    }
    return false;
  }

  if (kind === "inbound" && portKey === "route") return Boolean(config.route);
  if (kind === "route" && portKey === "route-rule") return (config.route?.rules?.length ?? 0) > 0;
  if (kind === "route" && portKey === "outbound") return Boolean(config.route?.final);
  if (kind === "route-rule" && portKey === "outbound") {
    const index = routeRuleIndex(id);
    return Boolean(config.route?.rules?.[index]?.outbound);
  }
  if (kind === "dns" && portKey === "dns-rule") return (config.dns?.rules?.length ?? 0) > 0;
  if (kind === "dns" && portKey === "dns-server") return Boolean(config.dns?.final);
  if (kind === "dns-rule" && portKey === "dns-server") {
    const index = routeRuleIndex(id);
    return Boolean(config.dns?.rules?.[index]?.server);
  }
  if (kind === "dns-server" && portKey === "outbound") {
    return Boolean(config.dns?.servers?.find((server) => server.tag === value)?.detour);
  }
  if (kind === "outbound" && (type === "selector" || type === "urltest") && portKey === "outbound-member") {
    return Boolean(config.outbounds?.find((outbound) => outbound.tag === value)?.outbounds?.length);
  }
  return false;
}

export function SbcNode({ id, data, selected }: NodeProps<SbcFlowNode>) {
  const config = useProjectStore((state) => state.config);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
  const setPanelTab = useProjectStore((state) => state.setPanelTab);
  const createCompatible = useProjectStore((state) => state.createCompatible);
  const togglePortConnection = useProjectStore((state) => state.togglePortConnection);
  const deleteEntity = useProjectStore((state) => state.deleteEntity);
  const Icon = getNodeIcon(data.kind, data.type);
  const inputPorts = getPortSpecs(data.kind, data.type, "input");
  const outputPorts = getPortSpecs(data.kind, data.type, "output");

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
          {inputPorts.map((port) => {
            const connected = isPortConnected(config, id, data.kind, data.type, "input", port.key);
            return (
              <button
                className={`sbc-port sbc-port--input ${connected ? "is-connected" : ""}`}
                key={port.key}
                title={port.label}
                type="button"
                aria-label={`${connected ? "Remove" : "Add"} ${port.label} for ${data.title}`}
                data-port-type={port.key}
                data-port-node-kind={port.nodeKind}
                data-port-node-type={port.nodeType}
                data-connected={connected ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePortConnection(id, "input", port);
                }}
              >
                <port.icon size={15} />
                <span className="sbc-port__action">{connected ? <Trash2 size={10} /> : <Plus size={11} />}</span>
              </button>
            );
          })}
        </div>

        <div className="sbc-node__ports sbc-node__ports--right" data-testid="node-right-ports">
          <Handle className="sbc-handle sbc-handle--out" type="source" position={Position.Right} />
          {outputPorts.map((port) => {
            const connected = isPortConnected(config, id, data.kind, data.type, "output", port.key);
            return (
              <button
                className={`sbc-port sbc-port--output ${connected ? "is-connected" : ""}`}
                key={port.key}
                title={port.label}
                type="button"
                aria-label={`${connected ? "Remove" : "Add"} ${port.label} from ${data.title}`}
                data-port-type={port.key}
                data-port-node-kind={port.nodeKind}
                data-port-node-type={port.nodeType}
                data-connected={connected ? "true" : "false"}
                onClick={(event) => {
                  event.stopPropagation();
                  togglePortConnection(id, "output", port);
                }}
              >
                <port.icon size={15} />
                <span className="sbc-port__action">{connected ? <Trash2 size={10} /> : <Plus size={11} />}</span>
              </button>
            );
          })}
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
