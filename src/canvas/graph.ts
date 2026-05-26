import type { Edge, Node } from "@xyflow/react";
import type { Diagnostic, EntityRef, OutboundConfig, SingBoxConfig } from "../domain/types";
import type { ProjectLayout } from "../domain/types";

export type SbcNodeKind =
  | "inbound"
  | "route"
  | "route-rule"
  | "dns"
  | "dns-server"
  | "dns-rule"
  | "outbound"
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

const DEFAULT_POSITIONS: Record<string, { x: number; y: number }> = {
  "route:main": { x: 420, y: 260 },
  "dns:main": { x: 420, y: 620 },
};
const MAX_VISUAL_RULE_NODES = 24;
const MAX_VISUAL_CANDIDATE_EDGES = 96;
const NODE_SLOT_Y = 330;
const ROUTE_RULE_START_Y = 60;
const ROUTE_HUB_Y = 260;
const DNS_LANE_MIN_Y = 900;
const MAX_OUTBOUND_DEPTH = 2;
const SETTINGS_NODE_IDS = ["settings:log", "settings:ntp", "settings:certificate", "settings:experimental"] as const;

const COLUMNS = {
  settings: -300,
  inbound: 0,
  hub: 720,
  rule: 1440,
  target: 2160,
  member: 2880,
  leaf: 3600,
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

function listLabel(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function visualizeRouteRulesCount(count: number) {
  return count <= MAX_VISUAL_RULE_NODES ? count : 1;
}

function isOutboundGroup(outbound: OutboundConfig) {
  return outbound.type === "selector" || outbound.type === "urltest";
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
  let visualCandidateEdges = 0;
  const routeTargetY = new Map<string, number>();
  const outboundByTag = new Map<string, OutboundConfig>();
  const outboundDepth = new Map<string, number>();
  const outboundDesiredY = new Map<string, number>();
  const outboundY = new Map<string, number>();
  const memberY = new Map<string, number>();
  const memberTags = new Set<string>();

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
          x: COLUMNS.inbound,
          y: columnLayout.reserve(
            "inbound",
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
    const routeY = columnLayout.reserve("hub", ROUTE_HUB_Y);
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
        { x: COLUMNS.hub, y: routeY },
      ),
    );

    if (visualizeRouteRules) {
      routeRules.forEach((rule, index) => {
        const id = `route-rule:${index}`;
        const y = columnLayout.reserve("rule", ROUTE_RULE_START_Y + index * NODE_SLOT_Y);
        if (rule.outbound && !routeTargetY.has(rule.outbound)) {
          routeTargetY.set(rule.outbound, y);
        }
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
        if (rule.outbound) {
          edges.push(makeEdge(`edge:route-rule:${index}:${rule.outbound}`, id, `outbound:${rule.outbound}`, "outbound", "route-rule"));
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
  });

  if (config.dns) {
    const visualizeDnsRules = dnsRules.length <= MAX_VISUAL_RULE_NODES;
    const dnsLaneY =
      ROUTE_RULE_START_Y +
      Math.max(3, visualizeRouteRulesCount(routeRules.length) + 1) *
        NODE_SLOT_Y;
    const dnsY = columnLayout.reserve("hub", Math.max(DNS_LANE_MIN_Y, dnsLaneY));
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
        { x: COLUMNS.hub, y: dnsY },
      ),
    );

    dnsServers.forEach((server, index) => {
      const tag = entityTag(server.tag, "dns-server", index);
      const id = `dns-server:${tag}`;
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
          { x: COLUMNS.target, y: columnLayout.reserve("target", dnsY + index * NODE_SLOT_Y) },
        ),
      );
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
        if (rule.server) {
          edges.push(makeEdge(`edge:dns-rule:${index}:${rule.server}`, id, `dns-server:${rule.server}`, "dns-server", "dns-rule"));
        }
      });
    }

    if (config.dns.final) {
      edges.push(makeEdge(`edge:dns-final:${config.dns.final}`, "dns:main", `dns-server:${config.dns.final}`, "dns-server", "dns"));
    }
  }

  return { nodes, edges };
}
