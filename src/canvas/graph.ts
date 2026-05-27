import type { Edge, Node } from "@xyflow/react";
import type { Diagnostic, EndpointConfig, EntityRef, OutboundConfig, ServiceConfig, SingBoxConfig } from "../domain/types";
import type { ProjectLayout } from "../domain/types";

export type SbcNodeKind =
  | "inbound"
  | "route"
  | "route-rule"
  | "dns"
  | "dns-server"
  | "dns-rule"
  | "endpoint"
  | "service"
  | "outbound"
  | "rule-set"
  | "settings";

export type SbcNodeData = {
  ref: EntityRef;
  kind: SbcNodeKind;
  type: string;
  title: string;
  subtitle: string;
  status: "valid" | "warning" | "error";
  compatible: string[];
};

export type SbcFlowNode = Node<SbcNodeData, "sbc">;

const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {};
const MAX_VISUAL_RULE_NODES = 24;
const MAX_VISUAL_RULE_SET_NODES = 24;
const MAX_VISUAL_CANDIDATE_EDGES = 96;
const NODE_SLOT_Y = 330;
const ROUTE_RULE_START_Y = 60;
const ROUTE_HUB_Y = 260;
const DNS_LANE_MIN_Y = 900;
const MAX_OUTBOUND_DEPTH = 2;
const SETTINGS_NODE_IDS = ["settings:log", "settings:ntp", "settings:certificate", "settings:experimental"] as const;

const COLUMNS = {
  settings: -300,
  entry: 0,
  rule: 720,
  target: 1440,
  member: 2160,
  leaf: 2880,
} as const;

type LayoutColumn = keyof typeof COLUMNS;
type SettingsNodeId = (typeof SETTINGS_NODE_IDS)[number];
type SettingsPath = SettingsNodeId extends `settings:${infer Path}` ? Path : never;

function nodePosition(layout: ProjectLayout, id: string, fallback: { x: number; y: number }) {
  return layout.positions[id] ?? DEFAULT_POSITIONS[id] ?? fallback;
}

function makeNode(
  id: string,
  data: SbcNodeData,
  layout: ProjectLayout,
  fallback: { x: number; y: number },
): SbcFlowNode {
  return {
    id,
    type: "sbc",
    position: nodePosition(layout, id, fallback),
    data,
  };
}

function createColumnAllocator() {
  const occupied = new Map<LayoutColumn, number[]>();

  function reserve(column: LayoutColumn, desiredY: number) {
    const columnYs = occupied.get(column) ?? [];
    let y = desiredY;
    while (columnYs.some((usedY) => Math.abs(usedY - y) < NODE_SLOT_Y)) {
      y += NODE_SLOT_Y;
    }
    columnYs.push(y);
    columnYs.sort((a, b) => a - b);
    occupied.set(column, columnYs);
    return y;
  }

  return { reserve };
}

function diagnosticStatus(pathPrefix: string, diagnostics: Diagnostic[]): SbcNodeData["status"] {
  const scoped = diagnostics.filter((diagnostic) =>
    diagnostic.path.startsWith(pathPrefix),
  );
  if (scoped.some((diagnostic) => diagnostic.level === "error")) return "error";
  if (scoped.some((diagnostic) => diagnostic.level === "warning")) return "warning";
  return "valid";
}

function truncateLabel(value: string) {
  return value.length > 78 ? `${value.slice(0, 76)}...` : value;
}

function listLabel(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    if (!value.length) return undefined;
    const visible = value.slice(0, 4).join(", ");
    return truncateLabel(value.length > 4 ? `${visible} +${value.length - 4}` : visible);
  }
  return value ? truncateLabel(value) : undefined;
}

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function stringRefs(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function visualizeRouteRulesCount(count: number) {
  return count <= MAX_VISUAL_RULE_NODES ? count : 1;
}

function isOutboundGroup(outbound: OutboundConfig) {
  return outbound.type === "selector" || outbound.type === "urltest";
}

function outboundDetourTag(outbound: OutboundConfig) {
  return typeof outbound.detour === "string" && outbound.detour.trim() ? outbound.detour : undefined;
}

function entityTag(tag: string | undefined, kind: string, index: number) {
  return tag && tag.trim() ? tag : `untagged-${kind}-${index + 1}`;
}

function makeEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
  animated = false,
): Edge {
  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    animated,
  };
}

export function deriveGraph(config: SingBoxConfig, layout: ProjectLayout, diagnostics: Diagnostic[]) {
  const nodes: SbcFlowNode[] = [];
  const edges: Edge[] = [];
  const columnLayout = createColumnAllocator();
  const inbounds = listItems(config.inbounds);
  const outbounds = listItems(config.outbounds);
  const routeRules = listItems(config.route?.rules);
  const dnsServers = listItems(config.dns?.servers);
  const dnsRules = listItems(config.dns?.rules);
  const endpoints = listItems(config.endpoints);
  const services = listItems(config.services);
  const ruleSets = listItems(config.route?.rule_set);
  const visualizeRuleSets = ruleSets.length <= MAX_VISUAL_RULE_SET_NODES;
  let visualCandidateEdges = 0;
  const routeTargetY = new Map<string, number>();
  const ruleSetTargetY = new Map<string, number>();
  const outboundByTag = new Map<string, OutboundConfig>();
  const outboundDepth = new Map<string, number>();
  const outboundDesiredY = new Map<string, number>();
  const outboundY = new Map<string, number>();
  const memberY = new Map<string, number>();
  const memberTags = new Set<string>();
  const endpointTargetY = new Map<string, number>();
  const endpointY = new Map<string, number>();

  SETTINGS_NODE_IDS.forEach((id, index) => {
    if (!layout.positions[id]) return;
    const path = id.slice("settings:".length) as SettingsPath;
    const entity = config[path];
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) return;
    nodes.push(
      makeNode(
        id,
        {
          ref: { kind: "settings", path },
          kind: "settings",
          type: path,
          title: path[0] ? `${path[0].toUpperCase()}${path.slice(1)}` : path,
          subtitle: "global settings",
          status: diagnosticStatus(`/${path}`, diagnostics),
          compatible: [],
        },
        layout,
        { x: COLUMNS.settings, y: ROUTE_HUB_Y + index * NODE_SLOT_Y },
      ),
    );
  });

  outbounds.forEach((outbound, index) => {
    outboundByTag.set(entityTag(outbound.tag, "outbound", index), outbound);
    if (Array.isArray(outbound.outbounds)) {
      outbound.outbounds.forEach((tag) => memberTags.add(tag));
    }
    const detour = outboundDetourTag(outbound);
    if (detour) memberTags.add(detour);
  });

  endpoints.forEach((endpoint, index) => {
    const tag = entityTag(endpoint.tag, "endpoint", index);
    if (typeof endpoint.detour === "string" && endpoint.detour) {
      memberTags.add(endpoint.detour);
    }
    if (endpoint.type === "tailscale") endpointTargetY.set(tag, DNS_LANE_MIN_Y + index * NODE_SLOT_Y);
  });

  services.forEach((service) => {
    if (typeof service.detour === "string" && service.detour) memberTags.add(service.detour);
  });

  inbounds.forEach((inbound, index) => {
    const tag = entityTag(inbound.tag, "inbound", index);
    const id = `inbound:${tag}`;
    nodes.push(
      makeNode(
        id,
        {
          ref: { kind: "inbound", tag },
          kind: "inbound",
          type: inbound.type,
          title: tag,
          subtitle: `${inbound.type} inbound`,
          status: diagnosticStatus(`/inbounds/${index}`, diagnostics),
          compatible: ["Route"],
        },
        layout,
        {
          x: COLUMNS.entry,
          y: columnLayout.reserve(
            "entry",
            ROUTE_HUB_Y + (index - Math.floor(inbounds.length / 2)) * NODE_SLOT_Y,
          ),
        },
      ),
    );
    if (config.route) {
      edges.push(makeEdge(`edge:inbound:${tag}:route`, id, "route:main", "route", "inbound", true));
    }
  });

  if (config.route) {
    const visualizeRouteRules = routeRules.length <= MAX_VISUAL_RULE_NODES;
    const routeY = columnLayout.reserve("entry", ROUTE_HUB_Y);
    nodes.push(
      makeNode(
        "route:main",
        {
          ref: { kind: "route", id: "main" },
          kind: "route",
          type: "route",
          title: "Route",
          subtitle: `${routeRules.length} ordered rules`,
          status: diagnosticStatus("/route", diagnostics),
          compatible: ["Direct", "Block", "Selector", "URLTest", "SOCKS"],
        },
        layout,
        { x: COLUMNS.entry, y: routeY },
      ),
    );

    if (visualizeRouteRules) {
      routeRules.forEach((rule, index) => {
        const id = `route-rule:${index}`;
        const y = columnLayout.reserve("rule", ROUTE_RULE_START_Y + index * NODE_SLOT_Y);
        if (rule.outbound && !routeTargetY.has(rule.outbound)) {
          routeTargetY.set(rule.outbound, y);
        }
        const inboundRefs = stringRefs(rule.inbound);
        const ruleSetRefs = stringRefs(rule.rule_set);
        ruleSetRefs.forEach((tag) => {
          if (!ruleSetTargetY.has(tag)) ruleSetTargetY.set(tag, y);
        });
        const label =
          listLabel(rule.domain_suffix) ??
          listLabel(rule.domain_keyword) ??
          listLabel(rule.domain) ??
          listLabel(rule.rule_set) ??
          rule.action ??
          "match rule";
        nodes.push(
          makeNode(
            id,
            {
              ref: { kind: "route-rule", index },
              kind: "route-rule",
              type: "route-rule",
              title: `Rule ${index + 1}`,
              subtitle: label,
              status: diagnosticStatus(`/route/rules/${index}`, diagnostics),
              compatible: ["Direct", "Block", "Selector", "URLTest", "SOCKS"],
            },
            layout,
            { x: COLUMNS.rule, y },
          ),
        );
        edges.push(makeEdge(`edge:route-rule-order:${index}`, "route:main", id, "route-rule", "route"));
        inboundRefs.forEach((tag) => {
          edges.push(makeEdge(`edge:route-rule-inbound:${index}:${tag}`, `inbound:${tag}`, id, "route-rule-match", "inbound"));
        });
        const ruleAction = typeof rule.action === "string" ? rule.action : "";
        const routeRuleOutboundAllowed = ruleAction === "" || ruleAction === "route" || ruleAction === "bypass";
        if (rule.outbound && routeRuleOutboundAllowed) {
          edges.push(makeEdge(`edge:route-rule:${index}:${rule.outbound}`, id, `outbound:${rule.outbound}`, "outbound", "route-rule"));
        }
        if (visualizeRuleSets) {
          ruleSetRefs.forEach((tag) => {
            edges.push(makeEdge(`edge:route-rule-set:${index}:${tag}`, id, `rule-set:${tag}`, "rule-set", "route-rule"));
          });
        }
      });
    }

    if (config.route.final) {
      if (!routeTargetY.has(config.route.final)) {
        routeTargetY.set(
          config.route.final,
          ROUTE_RULE_START_Y +
            Math.max(1, Math.min(routeRules.length, MAX_VISUAL_RULE_NODES)) * NODE_SLOT_Y,
        );
      }
      edges.push(makeEdge(`edge:route-final:${config.route.final}`, "route:main", `outbound:${config.route.final}`, "outbound", "route", true));
    }
  }

  function rememberOutbound(tag: string, depth: number, desiredY: number) {
    const cappedDepth = Math.min(depth, MAX_OUTBOUND_DEPTH);
    const currentDepth = outboundDepth.get(tag);
    if (currentDepth === undefined || cappedDepth > currentDepth) {
      outboundDepth.set(tag, cappedDepth);
      outboundDesiredY.set(tag, desiredY);
      return;
    }
    if (currentDepth === cappedDepth && !outboundDesiredY.has(tag)) {
      outboundDesiredY.set(tag, desiredY);
    }
  }

  function walkOutboundTree(tag: string, depth: number, desiredY: number, trail: Set<string>) {
    if (trail.has(tag)) return;
    rememberOutbound(tag, depth, desiredY);
    const outbound = outboundByTag.get(tag);
    if (!outbound || !isOutboundGroup(outbound) || !Array.isArray(outbound.outbounds)) {
      const detour = outbound ? outboundDetourTag(outbound) : undefined;
      if (detour) {
        memberY.set(detour, desiredY);
        walkOutboundTree(detour, depth + 1, desiredY, new Set([...trail, tag]));
      }
      return;
    }
    const nextTrail = new Set(trail);
    nextTrail.add(tag);
    const midpoint = (outbound.outbounds.length - 1) / 2;
    outbound.outbounds.forEach((candidateTag, candidateIndex) => {
      const candidateY = desiredY + (candidateIndex - midpoint) * NODE_SLOT_Y;
      memberY.set(candidateTag, candidateY);
      walkOutboundTree(candidateTag, depth + 1, candidateY, nextTrail);
    });
    const detour = outboundDetourTag(outbound);
    if (detour) {
      memberY.set(detour, desiredY);
      walkOutboundTree(detour, depth + 1, desiredY, nextTrail);
    }
  }

  routeTargetY.forEach((y, tag) => walkOutboundTree(tag, 0, y, new Set()));

  outbounds.forEach((outbound, index) => {
    const tag = entityTag(outbound.tag, "outbound", index);
    const depth = outboundDepth.get(tag) ?? (memberTags.has(tag) ? 1 : 0);
    const column: LayoutColumn = depth === 0 ? "target" : depth === 1 ? "member" : "leaf";
    const desiredY =
      routeTargetY.get(tag) ??
      outboundDesiredY.get(tag) ??
      memberY.get(tag) ??
      ROUTE_HUB_Y + index * NODE_SLOT_Y;
    const y = columnLayout.reserve(column, desiredY);
    outboundY.set(tag, y);
  });

  outbounds.forEach((outbound, index) => {
    const tag = entityTag(outbound.tag, "outbound", index);
    const id = `outbound:${tag}`;
    const depth = outboundDepth.get(tag) ?? (memberTags.has(tag) ? 1 : 0);
    const column: LayoutColumn = depth === 0 ? "target" : depth === 1 ? "member" : "leaf";
    nodes.push(
      makeNode(
        id,
        {
          ref: { kind: "outbound", tag },
          kind: "outbound",
          type: outbound.type,
          title: tag,
          subtitle:
            Array.isArray(outbound.outbounds) &&
            outbound.outbounds.length &&
            isOutboundGroup(outbound)
              ? `${outbound.type}: ${outbound.outbounds.join(", ")}`
              : outbound.server
                ? `${outbound.type} ${outbound.server}:${outbound.server_port ?? ""}`
                : `${outbound.type} outbound`,
          status: diagnosticStatus(`/outbounds/${index}`, diagnostics),
          compatible:
            isOutboundGroup(outbound)
              ? ["SOCKS", "Direct", "Block"]
              : [],
        },
        layout,
        { x: COLUMNS[column], y: outboundY.get(tag) ?? ROUTE_HUB_Y + index * NODE_SLOT_Y },
      ),
    );

    if (Array.isArray(outbound.outbounds)) {
      outbound.outbounds.forEach((candidateTag, candidateIndex) => {
        if (visualCandidateEdges >= MAX_VISUAL_CANDIDATE_EDGES) return;
        visualCandidateEdges += 1;
        edges.push(
          makeEdge(
            `edge:${outbound.type}:${tag}:${candidateIndex}:${candidateTag}`,
            id,
            `outbound:${candidateTag}`,
            "outbound-member",
            outbound.type === "selector" ? "selector-group" : "urltest-group",
          ),
        );
      });
    }
    const detour = outboundDetourTag(outbound);
    if (detour) {
      edges.push(makeEdge(`edge:outbound-detour:${tag}:${detour}`, id, `outbound:${detour}`, "dial-detour", "detour-target"));
    }
  });

  dnsRules.forEach((rule, index) => {
    const ruleSetRefs = stringRefs(rule.rule_set);
    ruleSetRefs.forEach((tag) => {
      if (!ruleSetTargetY.has(tag)) ruleSetTargetY.set(tag, DNS_LANE_MIN_Y + index * NODE_SLOT_Y);
    });
  });

  if (visualizeRuleSets) {
    ruleSets.forEach((ruleSet, index) => {
      const tag = entityTag(ruleSet.tag, "rule-set", index);
      nodes.push(
        makeNode(
          `rule-set:${tag}`,
          {
            ref: { kind: "rule-set", tag },
            kind: "rule-set",
            type: ruleSet.type,
            title: tag,
            subtitle:
              ruleSet.type === "remote" && typeof ruleSet.url === "string"
                ? ruleSet.url
                : ruleSet.type === "local" && typeof ruleSet.path === "string"
                  ? ruleSet.path
                  : `${ruleSet.type} rule-set`,
            status: diagnosticStatus(`/route/rule_set/${index}`, diagnostics),
            compatible: [],
          },
          layout,
          {
            x: COLUMNS.member,
            y: columnLayout.reserve(
              "member",
              ruleSetTargetY.get(tag) ?? DNS_LANE_MIN_Y + (index + 1) * NODE_SLOT_Y,
            ),
          },
        ),
      );
      if (ruleSet.type === "remote" && typeof ruleSet.download_detour === "string" && ruleSet.download_detour) {
        edges.push(
          makeEdge(
            `edge:rule-set-download:${tag}:${ruleSet.download_detour}`,
            `rule-set:${tag}`,
            `outbound:${ruleSet.download_detour}`,
            "download-detour",
            "rule-set-download",
          ),
        );
      }
    });
  }

  if (config.dns) {
    const visualizeDnsRules = dnsRules.length <= MAX_VISUAL_RULE_NODES;
    const dnsLaneY =
      ROUTE_RULE_START_Y +
      Math.max(3, visualizeRouteRulesCount(routeRules.length) + 1) *
        NODE_SLOT_Y;
    const dnsY = columnLayout.reserve("entry", Math.max(DNS_LANE_MIN_Y, dnsLaneY));
    nodes.push(
      makeNode(
        "dns:main",
        {
          ref: { kind: "dns", id: "main" },
          kind: "dns",
          type: "dns",
          title: "DNS",
          subtitle: `${dnsRules.length} ordered rules`,
          status: diagnosticStatus("/dns", diagnostics),
          compatible: ["DNS Server"],
        },
        layout,
        { x: COLUMNS.entry, y: dnsY },
      ),
    );

    dnsServers.forEach((server, index) => {
      const tag = entityTag(server.tag, "dns-server", index);
      const id = `dns-server:${tag}`;
      const y = columnLayout.reserve("target", dnsY + index * NODE_SLOT_Y);
      nodes.push(
        makeNode(
          id,
          {
            ref: { kind: "dns-server", tag },
            kind: "dns-server",
            type: server.type,
            title: tag,
            subtitle: `${server.type} dns server`,
            status: diagnosticStatus(`/dns/servers/${index}`, diagnostics),
            compatible: [],
          },
          layout,
          { x: COLUMNS.target, y },
        ),
      );
      if (server.detour) {
        edges.push(makeEdge(`edge:dns-server-detour:${tag}:${server.detour}`, id, `outbound:${server.detour}`, "outbound", "dns-detour"));
      }
      if (server.type === "tailscale" && server.endpoint) {
        endpointTargetY.set(server.endpoint, y);
        edges.push(makeEdge(`edge:dns-server-endpoint:${tag}:${server.endpoint}`, id, `endpoint:${server.endpoint}`, "endpoint", "dns-server"));
      }
    });

    if (visualizeDnsRules) {
      dnsRules.forEach((rule, index) => {
        const id = `dns-rule:${index}`;
        const y = columnLayout.reserve("rule", dnsY + index * NODE_SLOT_Y);
        nodes.push(
          makeNode(
            id,
            {
              ref: { kind: "dns-rule", index },
              kind: "dns-rule",
              type: "dns-rule",
              title: `DNS Rule ${index + 1}`,
              subtitle:
                listLabel(rule.domain_suffix) ??
                listLabel(rule.domain_keyword) ??
                listLabel(rule.domain) ??
                listLabel(rule.rule_set) ??
                rule.action ??
                "dns match",
              status: diagnosticStatus(`/dns/rules/${index}`, diagnostics),
              compatible: ["DNS Server"],
            },
            layout,
            { x: COLUMNS.rule, y },
          ),
        );
        edges.push(makeEdge(`edge:dns-rule-order:${index}`, "dns:main", id, "dns-rule", "dns"));
        stringRefs(rule.inbound).forEach((tag) => {
          edges.push(makeEdge(`edge:dns-rule-inbound:${index}:${tag}`, `inbound:${tag}`, id, "dns-rule-match", "inbound"));
        });
        const dnsAction = typeof rule.action === "string" ? rule.action : "";
        const dnsRuleServerAllowed = dnsAction === "" || dnsAction === "route" || dnsAction === "evaluate";
        if (rule.server && dnsRuleServerAllowed) {
          edges.push(makeEdge(`edge:dns-rule:${index}:${rule.server}`, id, `dns-server:${rule.server}`, "dns-server", "dns-rule"));
        }
        const ruleSetRefs = stringRefs(rule.rule_set);
        if (visualizeRuleSets) {
          ruleSetRefs.forEach((tag) => {
            edges.push(makeEdge(`edge:dns-rule-set:${index}:${tag}`, id, `rule-set:${tag}`, "rule-set", "dns-rule"));
          });
        }
      });
    }

    if (config.dns.final) {
      edges.push(makeEdge(`edge:dns-final:${config.dns.final}`, "dns:main", `dns-server:${config.dns.final}`, "dns-server", "dns"));
    }
  }

  endpoints.forEach((endpoint, index) => {
    const tag = entityTag(endpoint.tag, "endpoint", index);
    const desiredY = endpointTargetY.get(tag) ?? DNS_LANE_MIN_Y + (index + dnsServers.length + 1) * NODE_SLOT_Y;
    endpointY.set(tag, columnLayout.reserve("member", desiredY));
  });

  endpoints.forEach((endpoint, index) => {
    const tag = entityTag(endpoint.tag, "endpoint", index);
    nodes.push(
      makeNode(
        `endpoint:${tag}`,
        {
          ref: { kind: "endpoint", tag },
          kind: "endpoint",
          type: endpoint.type,
          title: tag,
          subtitle: endpointSubtitle(endpoint),
          status: diagnosticStatus(`/endpoints/${index}`, diagnostics),
          compatible: endpoint.type === "tailscale" ? ["DNS Tailscale Server"] : [],
        },
        layout,
        { x: COLUMNS.member, y: endpointY.get(tag) ?? DNS_LANE_MIN_Y + index * NODE_SLOT_Y },
      ),
    );
    if (typeof endpoint.detour === "string" && endpoint.detour) {
      edges.push(makeEdge(`edge:endpoint-detour:${tag}:${endpoint.detour}`, `endpoint:${tag}`, `outbound:${endpoint.detour}`, "dial-detour", "detour-target"));
    }
  });

  services.forEach((service, index) => {
    const tag = entityTag(service.tag, "service", index);
    const id = `service:${tag}`;
    const y = columnLayout.reserve(
      "entry",
      DNS_LANE_MIN_Y + (dnsServers.length + dnsRules.length + endpoints.length + index + 2) * NODE_SLOT_Y,
    );
    nodes.push(
      makeNode(
        id,
        {
          ref: { kind: "service", tag },
          kind: "service",
          type: service.type,
          title: tag,
          subtitle: serviceSubtitle(service),
          status: diagnosticStatus(`/services/${index}`, diagnostics),
          compatible: service.type === "ssm-api" ? ["Shadowsocks Inbound"] : service.type === "derp" ? ["Tailscale Endpoint"] : [],
        },
        layout,
        { x: COLUMNS.entry, y },
      ),
    );

    if (service.detour) {
      edges.push(makeEdge(`edge:service-detour:${tag}:${service.detour}`, id, `outbound:${service.detour}`, "detour", "service-detour"));
    }

    const verifyEndpoints = stringRefs(service.verify_client_endpoint as string | string[] | undefined);
    verifyEndpoints.forEach((endpointTag) => {
      endpointTargetY.set(endpointTag, y);
      edges.push(makeEdge(`edge:service-verify-endpoint:${tag}:${endpointTag}`, id, `endpoint:${endpointTag}`, "verify-client-endpoint", "derp-service"));
    });

    if (service.servers && typeof service.servers === "object" && !Array.isArray(service.servers)) {
      Object.entries(service.servers).forEach(([path, inboundTag]) => {
        edges.push(makeEdge(`edge:service-ssm-inbound:${tag}:${path}:${inboundTag}`, `inbound:${inboundTag}`, id, "service", "managed-inbound"));
      });
    }
  });

  centerColumnsVertically(nodes, layout);

  return { nodes, edges };
}

function centerColumnsVertically(nodes: SbcFlowNode[], layout: ProjectLayout) {
  const algorithmicByX = new Map<number, SbcFlowNode[]>();
  for (const node of nodes) {
    if (layout.positions[node.id]) continue;
    const list = algorithmicByX.get(node.position.x) ?? [];
    list.push(node);
    algorithmicByX.set(node.position.x, list);
  }
  if (algorithmicByX.size <= 1) return;

  let anchorMid: number | undefined;
  let anchorNodeCount = 0;
  let anchorExtent = 0;
  for (const columnNodes of algorithmicByX.values()) {
    if (columnNodes.length === 0) continue;
    const ys = columnNodes.map((node) => node.position.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const extent = maxY - minY;
    const beatsByCount = columnNodes.length > anchorNodeCount;
    const beatsByExtent =
      columnNodes.length === anchorNodeCount && extent > anchorExtent;
    if (anchorMid === undefined || beatsByCount || beatsByExtent) {
      anchorNodeCount = columnNodes.length;
      anchorExtent = extent;
      anchorMid = (minY + maxY) / 2;
    }
  }
  if (anchorMid === undefined) return;

  for (const columnNodes of algorithmicByX.values()) {
    if (columnNodes.length === 0) continue;
    const ys = columnNodes.map((node) => node.position.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const mid = (minY + maxY) / 2;
    const shift = anchorMid - mid;
    if (Math.abs(shift) < 1) continue;
    for (const node of columnNodes) {
      node.position = { x: node.position.x, y: node.position.y + shift };
    }
  }
}

function endpointSubtitle(endpoint: EndpointConfig) {
  if (endpoint.type === "wireguard") {
    const address = Array.isArray(endpoint.address) ? endpoint.address.join(", ") : "";
    return address ? `wireguard ${address}` : "wireguard endpoint";
  }
  if (endpoint.type === "tailscale") {
    return typeof endpoint.hostname === "string" && endpoint.hostname
      ? `tailscale ${endpoint.hostname}`
      : "tailscale endpoint";
  }
  return `${endpoint.type} endpoint`;
}

function serviceSubtitle(service: ServiceConfig) {
  if (service.type === "ssm-api") {
    const count = service.servers && typeof service.servers === "object" ? Object.keys(service.servers).length : 0;
    return `ssm-api ${count} managed servers`;
  }
  if (service.type === "derp") return "tailscale derp service";
  if (service.type === "resolved") return "systemd-resolved service";
  if (service.type === "ccm") return "Claude Code multiplexer";
  if (service.type === "ocm") return "OpenAI Codex multiplexer";
  if (service.type === "hysteria-realm") return "hysteria2 realm service";
  return `${service.type} service`;
}
