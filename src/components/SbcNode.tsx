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
  Layers3,
  Network,
  Plus,
  RadioTower,
  Route,
  Server,
  Settings2,
  Shield,
  Shuffle,
  Trash2,
  Waypoints,
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
  endpoint: Waypoints,
  service: Server,
  outbound: Network,
  "rule-set": Layers3,
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

function supportsDialDetour(type: string) {
  return !["block", "selector", "urltest", "dns"].includes(type);
}

export function getPortSpecs(kind: SbcNodeKind, type: string, direction: "input" | "output"): PortSpec[] {
  if (direction === "input") {
    if (kind === "route") return [{ key: "inbound", label: "Inbound traffic", nodeKind: "inbound", icon: RadioTower }];
    if (kind === "route-rule") {
      return [
        { key: "route", label: "Route order", nodeKind: "route", icon: Route },
        { key: "inbound", label: "Inbound matcher", nodeKind: "inbound", icon: RadioTower },
      ];
    }
    if (kind === "dns") return [{ key: "inbound-query", label: "DNS query source", nodeKind: "inbound", icon: RadioTower }];
    if (kind === "dns-rule") {
      return [
        { key: "dns", label: "DNS order", nodeKind: "dns", icon: Globe2 },
        { key: "inbound", label: "Inbound matcher", nodeKind: "inbound", icon: RadioTower },
      ];
    }
    if (kind === "rule-set") {
      return [
        { key: "route-rule", label: "Upstream Route rule set", nodeKind: "route-rule", icon: GitBranch },
        { key: "dns-rule", label: "Upstream DNS rule set", nodeKind: "dns-rule", icon: GitBranch },
      ];
    }
    if (kind === "dns-server") {
      const ports: PortSpec[] = [
        { key: "dns", label: "DNS final server", nodeKind: "dns", icon: Globe2 },
        { key: "dns-rule", label: "DNS rule", nodeKind: "dns-rule", icon: GitBranch },
      ];
      return ports;
    }
    if (kind === "endpoint") {
      if (type === "tailscale") {
        return [
          { key: "dns-server", label: "Upstream Tailscale DNS server", nodeKind: "dns-server", nodeType: "tailscale", icon: Server },
          { key: "derp-service", label: "Upstream DERP service", nodeKind: "service", nodeType: "derp", icon: Server },
        ];
      }
      return [];
    }
    if (kind === "outbound") {
      const routingInputs: PortSpec[] = [
        { key: "route", label: "Upstream Route final", nodeKind: "route", icon: Route },
        { key: "route-rule", label: "Upstream Rule outbound", nodeKind: "route-rule", icon: GitBranch },
      ];
      return [
        ...routingInputs,
        { key: "selector-group", label: "Upstream Selector candidate", nodeKind: "outbound", nodeType: "selector", icon: Shuffle },
        { key: "urltest-group", label: "Upstream URLTest candidate", nodeKind: "outbound", nodeType: "urltest", icon: Database },
        { key: "dns-detour", label: "Upstream DNS detour target", nodeKind: "dns-server", icon: Server },
        { key: "detour-target", label: "Upstream Dial detour target", nodeKind: "outbound", icon: Network },
        { key: "service-detour", label: "Upstream service detour target", nodeKind: "service", icon: Server },
        { key: "rule-set-download", label: "Upstream Rule Set download detour", nodeKind: "rule-set", icon: Layers3 },
      ];
    }
    if (kind === "service") {
      if (type === "ssm-api") {
        return [
          {
            key: "managed-inbound",
            label: "Managed Shadowsocks inbound",
            nodeKind: "inbound",
            nodeType: "shadowsocks",
            icon: RadioTower,
          },
        ];
      }
      if (type === "resolved") {
        return [
          {
            key: "dns-server",
            label: "Upstream resolved DNS server",
            nodeKind: "dns-server",
            nodeType: "resolved",
            icon: Globe2,
          },
        ];
      }
      return [];
    }
    return [];
  }

  if (kind === "inbound") {
    const ports: PortSpec[] = [
      { key: "route", label: "Route hub", nodeKind: "route", icon: Route },
      { key: "route-rule-match", label: "Route rule matcher", nodeKind: "route-rule", icon: GitBranch },
      { key: "dns-rule-match", label: "DNS rule matcher", nodeKind: "dns-rule", icon: GitBranch },
    ];
    if (type === "shadowsocks") ports.push({ key: "service", label: "SSM API service", nodeKind: "service", nodeType: "ssm-api", icon: Server });
    return ports;
  }
  if (kind === "route") {
    return [
      { key: "route-rule", label: "Route rule", nodeKind: "route-rule", icon: GitBranch },
      { key: "outbound", label: "Outbound", nodeKind: "outbound", icon: Network },
    ];
  }
  if (kind === "route-rule") {
    return [
      { key: "outbound", label: "Outbound", nodeKind: "outbound", icon: Network },
      { key: "rule-set", label: "Rule Set", nodeKind: "rule-set", icon: Layers3 },
    ];
  }
  if (kind === "dns") {
    return [
      { key: "dns-rule", label: "DNS rule", nodeKind: "dns-rule", icon: GitBranch },
      { key: "dns-server", label: "DNS server", nodeKind: "dns-server", icon: Server },
    ];
  }
  if (kind === "dns-rule") {
    return [
      { key: "dns-server", label: "DNS server", nodeKind: "dns-server", icon: Server },
      { key: "rule-set", label: "Rule Set", nodeKind: "rule-set", icon: Layers3 },
    ];
  }
  if (kind === "rule-set") return [{ key: "download-detour", label: "Download detour", nodeKind: "outbound", icon: Network }];
  if (kind === "dns-server") {
    const ports: PortSpec[] = [{ key: "outbound", label: "Detour outbound", nodeKind: "outbound", icon: Network }];
    if (type === "tailscale") ports.push({ key: "endpoint", label: "Tailscale endpoint", nodeKind: "endpoint", nodeType: "tailscale", icon: Waypoints });
    if (type === "resolved") ports.push({ key: "service", label: "systemd-resolved service", nodeKind: "service", nodeType: "resolved", icon: Server });
    return ports;
  }
  if (kind === "endpoint") return [{ key: "dial-detour", label: "Dial detour outbound", nodeKind: "outbound", icon: Network }];
  if (kind === "outbound" && (type === "selector" || type === "urltest")) {
    return [{ key: "outbound-member", label: "Downstream candidate", nodeKind: "outbound", icon: Network }];
  }
  if (kind === "outbound" && supportsDialDetour(type)) {
    return [{ key: "dial-detour", label: "Downstream dial detour", nodeKind: "outbound", icon: Network }];
  }
  if (kind === "service") {
    const ports: PortSpec[] = [];
    if (type === "derp") {
      ports.push({
        key: "verify-client-endpoint",
        label: "Verify client endpoint",
        nodeKind: "endpoint",
        nodeType: "tailscale",
        icon: Waypoints,
      });
    }
    if (type === "ccm" || type === "ocm") {
      ports.push({ key: "detour", label: "API detour outbound", nodeKind: "outbound", icon: Network });
    }
    return ports;
  }
  if (kind === "settings" && type === "ntp") {
    return [{ key: "dial-detour", label: "NTP detour outbound", nodeKind: "outbound", icon: Network }];
  }
  return [];
}

function nodeValueFromId(id: string) {
  return id.split(":").slice(1).join(":");
}

function stringRefs(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
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
    if (kind === "route-rule" && portKey === "inbound") {
      const index = routeRuleIndex(id);
      return Boolean(config.route?.rules?.[index]?.inbound);
    }
    if (kind === "dns" && portKey === "inbound-query") return (config.inbounds?.length ?? 0) > 0;
    if (kind === "dns-rule" && portKey === "dns") return true;
    if (kind === "dns-rule" && portKey === "inbound") {
      const index = routeRuleIndex(id);
      return Boolean(config.dns?.rules?.[index]?.inbound);
    }
    if (kind === "dns-server" && portKey === "dns-rule") {
      return config.dns?.rules?.some((rule) => rule.server === value) ?? false;
    }
    if (kind === "dns-server" && portKey === "dns") return config.dns?.final === value;
    if (kind === "endpoint" && portKey === "dns-server") {
      return config.dns?.servers?.some((server) => server.type === "tailscale" && server.endpoint === value) ?? false;
    }
    if (kind === "endpoint" && portKey === "derp-service") {
      return (
        config.services?.some((service) => {
          const refs = stringRefs(service.verify_client_endpoint as string | string[] | undefined);
          return service.type === "derp" && refs.includes(value);
        }) ?? false
      );
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
    if (kind === "outbound" && portKey === "dns-detour") {
      return config.dns?.servers?.some((server) => server.detour === value) ?? false;
    }
    if (kind === "outbound" && portKey === "detour-target") {
      return Boolean(
        config.outbounds?.some((outbound) => outbound.tag !== value && outbound.detour === value) ||
          config.endpoints?.some((endpoint) => endpoint.detour === value),
      );
    }
    if (kind === "outbound" && portKey === "service-detour") {
      return config.services?.some((service) => service.detour === value) ?? false;
    }
    if (kind === "outbound" && portKey === "rule-set-download") {
      return config.route?.rule_set?.some((ruleSet) => ruleSet.download_detour === value) ?? false;
    }
    if (kind === "service" && portKey === "managed-inbound") {
      const service = config.services?.find((item) => item.tag === value);
      return Boolean(service?.servers && Object.values(service.servers).length > 0);
    }
    if (kind === "rule-set" && portKey === "route-rule") {
      return config.route?.rules?.some((rule) => {
        if (Array.isArray(rule.rule_set)) return rule.rule_set.includes(value);
        return rule.rule_set === value;
      }) ?? false;
    }
    if (kind === "rule-set" && portKey === "dns-rule") {
      return config.dns?.rules?.some((rule) => {
        if (Array.isArray(rule.rule_set)) return rule.rule_set.includes(value);
        return rule.rule_set === value;
      }) ?? false;
    }
    return false;
  }

  if (kind === "inbound" && portKey === "route") return Boolean(config.route);
  if (kind === "inbound" && portKey === "route-rule-match") {
    return config.route?.rules?.some((rule) => stringRefs(rule.inbound).includes(value)) ?? false;
  }
  if (kind === "inbound" && portKey === "dns-rule-match") {
    return config.dns?.rules?.some((rule) => stringRefs(rule.inbound).includes(value)) ?? false;
  }
  if (kind === "inbound" && portKey === "service") {
    return (
      config.services?.some(
        (service) =>
          service.type === "ssm-api" &&
          service.servers &&
          Object.values(service.servers).includes(value),
      ) ?? false
    );
  }
  if (kind === "route" && portKey === "route-rule") return (config.route?.rules?.length ?? 0) > 0;
  if (kind === "route" && portKey === "outbound") return Boolean(config.route?.final);
  if (kind === "route-rule" && portKey === "outbound") {
    const index = routeRuleIndex(id);
    return Boolean(config.route?.rules?.[index]?.outbound);
  }
  if (kind === "route-rule" && portKey === "rule-set") {
    const index = routeRuleIndex(id);
    return Boolean(config.route?.rules?.[index]?.rule_set);
  }
  if (kind === "dns" && portKey === "dns-rule") return (config.dns?.rules?.length ?? 0) > 0;
  if (kind === "dns" && portKey === "dns-server") return Boolean(config.dns?.final);
  if (kind === "dns-rule" && portKey === "dns-server") {
    const index = routeRuleIndex(id);
    return Boolean(config.dns?.rules?.[index]?.server);
  }
  if (kind === "dns-rule" && portKey === "rule-set") {
    const index = routeRuleIndex(id);
    return Boolean(config.dns?.rules?.[index]?.rule_set);
  }
  if (kind === "rule-set" && portKey === "download-detour") {
    return Boolean(config.route?.rule_set?.find((ruleSet) => ruleSet.tag === value)?.download_detour);
  }
  if (kind === "dns-server" && portKey === "outbound") {
    return Boolean(config.dns?.servers?.find((server) => server.tag === value)?.detour);
  }
  if (kind === "dns-server" && portKey === "endpoint") {
    return Boolean(config.dns?.servers?.find((server) => server.tag === value)?.endpoint);
  }
  if (kind === "endpoint" && portKey === "dial-detour") {
    return Boolean(config.endpoints?.find((endpoint) => endpoint.tag === value)?.detour);
  }
  if (kind === "outbound" && (type === "selector" || type === "urltest") && portKey === "outbound-member") {
    return Boolean(config.outbounds?.find((outbound) => outbound.tag === value)?.outbounds?.length);
  }
  if (kind === "outbound" && portKey === "dial-detour") {
    return Boolean(config.outbounds?.find((outbound) => outbound.tag === value)?.detour);
  }
  if (kind === "service" && portKey === "verify-client-endpoint") {
    const service = config.services?.find((item) => item.tag === value);
    return stringRefs(service?.verify_client_endpoint as string | string[] | undefined).length > 0;
  }
  if (kind === "service" && portKey === "detour") {
    return Boolean(config.services?.find((service) => service.tag === value)?.detour);
  }
  return false;
}

export function SbcNode({ id, data, selected }: NodeProps<SbcFlowNode>) {
  const config = useProjectStore((state) => state.config);
  const setSelectedId = useProjectStore((state) => state.setSelectedId);
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
                <Handle
                  id={port.key}
                  className="sbc-handle sbc-handle--in sbc-handle--target"
                  type="target"
                  position={Position.Left}
                />
                <Handle
                  id={port.key}
                  className="sbc-handle sbc-handle--in sbc-handle--source"
                  type="source"
                  position={Position.Left}
                />
                <port.icon size={15} />
                <span className="sbc-port__label">{port.label}</span>
                <span className="sbc-port__action">{connected ? <Trash2 size={10} /> : <Plus size={11} />}</span>
              </button>
            );
          })}
        </div>

        <div className="sbc-node__ports sbc-node__ports--right" data-testid="node-right-ports">
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
                <Handle
                  id={port.key}
                  className="sbc-handle sbc-handle--out sbc-handle--target"
                  type="target"
                  position={Position.Right}
                />
                <Handle
                  id={port.key}
                  className="sbc-handle sbc-handle--out sbc-handle--source"
                  type="source"
                  position={Position.Right}
                />
                <port.icon size={15} />
                <span className="sbc-port__label">{port.label}</span>
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

        {data.compatible.length > 0 ? (
          <button
            className="sbc-node__add nodrag"
            type="button"
            aria-label={`Add from ${data.title}`}
            onClick={(event) => {
              event.stopPropagation();
              const first = data.compatible[0];
              if (first) createCompatible(id, first);
            }}
          >
            <Plus size={20} />
          </button>
        ) : null}

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
