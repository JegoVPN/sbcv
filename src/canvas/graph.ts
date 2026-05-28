import type { Edge, Node } from "@xyflow/react";
import {
  edgeIsDisconnectable,
  formatEdgeId,
  generatedEntityTag,
  parseNodeId,
  portEndpointsForNode,
  type PortDirection,
  type PortNodeKind,
} from "../domain/portRelationRegistry";
import { supportsDnsServerDialFields } from "../domain/sharedFieldRegistry";
import type { Diagnostic, EndpointConfig, EntityRef, OutboundConfig, ServiceConfig, SingBoxConfig, TaggedConfig, TaggedResourceConfig } from "../domain/types";
import type { ProjectLayout } from "../domain/types";

export type SbcNodeKind = PortNodeKind;

export type SbcNodeData = {
  ref: EntityRef;
  kind: SbcNodeKind;
  type: string;
  title: string;
  subtitle: string;
  status: "valid" | "warning" | "error";
  compatible: string[];
  connectedPorts?: Partial<Record<PortDirection, string[]>>;
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
    deletable: data.kind !== "notice",
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
  const scoped = diagnostics.filter((diagnostic) => diagnostic.path === pathPrefix || diagnostic.path.startsWith(`${pathPrefix}/`));
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
  return Math.min(count, MAX_VISUAL_RULE_NODES);
}

function isOutboundGroup(outbound: OutboundConfig) {
  return outbound.type === "selector" || outbound.type === "urltest";
}

function outboundDetourTag(outbound: OutboundConfig) {
  return typeof outbound.detour === "string" && outbound.detour.trim() ? outbound.detour : undefined;
}

function entityTag(tag: string | undefined, kind: string, index: number) {
  return tag && tag.trim() ? tag : generatedEntityTag(kind as Parameters<typeof generatedEntityTag>[0], index);
}

function rememberMinY(targets: Map<string, number>, tag: string, y: number) {
  const current = targets.get(tag);
  if (current === undefined || y < current) targets.set(tag, y);
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
    type: "sbc",
    source,
    target,
    sourceHandle,
    targetHandle,
    animated,
    deletable: edgeIsDisconnectable(id),
  };
}

function nodeValueFromId(id: string) {
  return parseNodeId(id)?.value ?? "";
}

function ruleIndexFromId(id: string) {
  const index = Number(nodeValueFromId(id));
  return Number.isInteger(index) ? index : -1;
}

function isPortConnected(
  config: SingBoxConfig,
  id: string,
  kind: SbcNodeKind,
  type: string,
  direction: PortDirection,
  portKey: string,
) {
  const value = nodeValueFromId(id);

  if (direction === "input") {
    if (kind === "route" && portKey === "inbound") return (config.inbounds?.length ?? 0) > 0;
    if (kind === "route-rule" && portKey === "route") return true;
    if (kind === "route-rule" && portKey === "inbound") {
      const index = ruleIndexFromId(id);
      return Boolean(config.route?.rules?.[index]?.inbound);
    }
    if (kind === "dns-rule" && portKey === "dns") return true;
    if (kind === "dns-rule" && portKey === "inbound") {
      const index = ruleIndexFromId(id);
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
    // These five outbound-target ports are also exposed on endpoint nodes (A7b extraNodeKinds), so an
    // endpoint wired as a route/selector/dns target reflects its connected state too.
    if ((kind === "outbound" || kind === "endpoint") && portKey === "route") return config.route?.final === value;
    if ((kind === "outbound" || kind === "endpoint") && portKey === "route-rule") {
      return config.route?.rules?.some((rule) => rule.outbound === value) ?? false;
    }
    if ((kind === "outbound" || kind === "endpoint") && portKey === "selector-group") {
      return config.outbounds?.some((outbound) => outbound.type === "selector" && outbound.outbounds?.includes(value)) ?? false;
    }
    if ((kind === "outbound" || kind === "endpoint") && portKey === "urltest-group") {
      return config.outbounds?.some((outbound) => outbound.type === "urltest" && outbound.outbounds?.includes(value)) ?? false;
    }
    if ((kind === "outbound" || kind === "endpoint") && portKey === "dns-detour") {
      return config.dns?.servers?.some((server) => server.detour === value) ?? false;
    }
    if (kind === "outbound" && portKey === "detour-target") {
      return Boolean(
        config.outbounds?.some((outbound) => outbound.tag !== value && outbound.detour === value) ||
          config.endpoints?.some((endpoint) => endpoint.detour === value) ||
          config.ntp?.detour === value,
      );
    }
    if (kind === "outbound" && portKey === "clash-download-detour") {
      const clashApi = config.experimental?.clash_api as Record<string, unknown> | undefined;
      return clashApi?.external_ui_download_detour === value;
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
    if (kind === "service" && portKey === "dns-server") {
      return config.dns?.servers?.some((server) => server.type === "resolved" && server.service === value) ?? false;
    }
    if (kind === "endpoint" && portKey === "certificate-provider") {
      return config.certificate_providers?.some((provider) => provider.type === "tailscale" && provider.endpoint === value) ?? false;
    }
    if (kind === "rule-set" && portKey === "route-rule") {
      return (
        config.route?.rules?.some((rule) => {
          if (Array.isArray(rule.rule_set)) return rule.rule_set.includes(value);
          return rule.rule_set === value;
        }) ?? false
      );
    }
    if (kind === "rule-set" && portKey === "dns-rule") {
      return (
        config.dns?.rules?.some((rule) => {
          if (Array.isArray(rule.rule_set)) return rule.rule_set.includes(value);
          return rule.rule_set === value;
        }) ?? false
      );
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
    const index = ruleIndexFromId(id);
    return Boolean(config.route?.rules?.[index]?.outbound);
  }
  if (kind === "route-rule" && portKey === "rule-set") {
    const index = ruleIndexFromId(id);
    return Boolean(config.route?.rules?.[index]?.rule_set);
  }
  if (kind === "dns" && portKey === "dns-rule") return (config.dns?.rules?.length ?? 0) > 0;
  if (kind === "dns" && portKey === "dns-server") return Boolean(config.dns?.final);
  if (kind === "dns-rule" && portKey === "dns-server") {
    const index = ruleIndexFromId(id);
    return Boolean(config.dns?.rules?.[index]?.server);
  }
  if (kind === "dns-rule" && portKey === "rule-set") {
    const index = ruleIndexFromId(id);
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
  if (kind === "dns-server" && portKey === "service") {
    return Boolean(config.dns?.servers?.find((server) => server.tag === value)?.service);
  }
  if (kind === "endpoint" && portKey === "dial-detour") {
    return Boolean(config.endpoints?.find((endpoint) => endpoint.tag === value)?.detour);
  }
  if (kind === "certificate-provider" && portKey === "endpoint") {
    return Boolean(config.certificate_providers?.find((provider) => provider.tag === value)?.endpoint);
  }
  if (kind === "settings" && type === "ntp" && portKey === "dial-detour") {
    return Boolean(config.ntp?.detour);
  }
  if (kind === "settings" && type === "experimental" && portKey === "clash-download-detour") {
    const clashApi = config.experimental?.clash_api as Record<string, unknown> | undefined;
    return Boolean(clashApi?.external_ui_download_detour);
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

function annotateConnectedPorts(config: SingBoxConfig, nodes: SbcFlowNode[]) {
  for (const node of nodes) {
    const input = portEndpointsForNode(node.data.kind, node.data.type, "input")
      .filter((port) => isPortConnected(config, node.id, node.data.kind, node.data.type, "input", port.portKey))
      .map((port) => port.portKey)
      .sort();
    const output = portEndpointsForNode(node.data.kind, node.data.type, "output")
      .filter((port) => isPortConnected(config, node.id, node.data.kind, node.data.type, "output", port.portKey))
      .map((port) => port.portKey)
      .sort();

    if (input.length || output.length) {
      node.data.connectedPorts = { input, output };
    }
  }
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
  const certificateProviders = listItems(config.certificate_providers);
  const httpClients = listItems(config.http_clients);
  const endpointTagSet = new Set(endpoints.map((endpoint) => endpoint.tag));
  // An endpoint shares the outbound tag namespace, so a route/selector/dns-detour edge to such a tag must
  // target the `endpoint:<tag>` node rather than a phantom `outbound:<tag>`.
  const outboundTargetNodeId = (tag: string) => (endpointTagSet.has(tag) ? `endpoint:${tag}` : `outbound:${tag}`);
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
    if (isOutboundGroup(outbound) && Array.isArray(outbound.outbounds)) {
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
      edges.push(makeEdge(formatEdgeId("inbound", tag, "route"), id, "route:main", "route", "inbound", true));
    }
  });

  if (config.route) {
    const visibleRouteRules = routeRules.slice(0, MAX_VISUAL_RULE_NODES);
    const hiddenRouteRules = routeRules.length - visibleRouteRules.length;
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

    if (visibleRouteRules.length > 0) {
      visibleRouteRules.forEach((rule, index) => {
        const id = `route-rule:${index}`;
        const y = columnLayout.reserve("rule", ROUTE_RULE_START_Y + index * NODE_SLOT_Y);
        if (rule.outbound && !routeTargetY.has(rule.outbound)) {
          routeTargetY.set(rule.outbound, y);
        }
        const inboundRefs = stringRefs(rule.inbound);
        const ruleSetRefs = stringRefs(rule.rule_set);
        ruleSetRefs.forEach((tag) => rememberMinY(ruleSetTargetY, tag, y));
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
        edges.push(makeEdge(formatEdgeId("route-rule-order", index), "route:main", id, "route-rule", "route"));
        inboundRefs.forEach((tag) => {
          edges.push(makeEdge(formatEdgeId("route-rule-inbound", index, tag), `inbound:${tag}`, id, "route-rule-match", "inbound"));
        });
        const ruleAction = typeof rule.action === "string" ? rule.action : "";
        const routeRuleOutboundAllowed = ruleAction === "" || ruleAction === "route" || ruleAction === "bypass";
        if (rule.outbound && routeRuleOutboundAllowed) {
          edges.push(makeEdge(formatEdgeId("route-rule", index, rule.outbound), id, outboundTargetNodeId(rule.outbound), "outbound", "route-rule"));
        }
        if (visualizeRuleSets) {
          ruleSetRefs.forEach((tag) => {
            edges.push(makeEdge(formatEdgeId("route-rule-set", index, tag), id, `rule-set:${tag}`, "rule-set", "route-rule"));
          });
        }
      });
    }
    if (hiddenRouteRules > 0) {
      nodes.push(
        makeNode(
          "notice:route-rules-overflow",
          {
            ref: { kind: "route", id: "main" },
            kind: "notice",
            type: "route-rules",
            title: `+${hiddenRouteRules} route rules not visualized`,
            subtitle: `${routeRules.length} ordered route rules stay in the Rules table`,
            status: diagnosticStatus("/route/rules", diagnostics),
            compatible: [],
          },
          layout,
          { x: COLUMNS.rule, y: columnLayout.reserve("rule", ROUTE_RULE_START_Y) },
        ),
      );
    }

    if (config.route.final) {
      if (!routeTargetY.has(config.route.final)) {
        routeTargetY.set(
          config.route.final,
          ROUTE_RULE_START_Y +
            Math.max(1, Math.min(routeRules.length, MAX_VISUAL_RULE_NODES)) * NODE_SLOT_Y,
        );
      }
      edges.push(makeEdge(formatEdgeId("route-final", config.route.final), "route:main", outboundTargetNodeId(config.route.final), "outbound", "route", true));
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
              ? [
                  "Direct",
                  "Block",
                  "SOCKS",
                  "HTTP",
                  "Shadowsocks",
                  "VMess",
                  "Trojan",
                  "Naive",
                  "Hysteria",
                  "Hysteria2",
                  "ShadowTLS",
                  "VLESS",
                  "TUIC",
                  "AnyTLS",
                  "Tor",
                  "SSH",
                  "Selector",
                  "URLTest",
                ]
              : [],
        },
        layout,
        { x: COLUMNS[column], y: outboundY.get(tag) ?? ROUTE_HUB_Y + index * NODE_SLOT_Y },
      ),
    );

    if (isOutboundGroup(outbound) && Array.isArray(outbound.outbounds)) {
      outbound.outbounds.forEach((candidateTag, candidateIndex) => {
        if (visualCandidateEdges >= MAX_VISUAL_CANDIDATE_EDGES) return;
        visualCandidateEdges += 1;
        edges.push(
          makeEdge(
            formatEdgeId(outbound.type, tag, candidateIndex, candidateTag),
            id,
            outboundTargetNodeId(candidateTag),
            "outbound-member",
            outbound.type === "selector" ? "selector-group" : "urltest-group",
          ),
        );
      });
    }
    const detour = outboundDetourTag(outbound);
    if (detour) {
      edges.push(makeEdge(formatEdgeId("outbound-detour", tag, detour), id, `outbound:${detour}`, "dial-detour", "detour-target"));
    }
  });

  if (config.dns) {
    const visibleDnsRules = dnsRules.slice(0, MAX_VISUAL_RULE_NODES);
    const hiddenDnsRules = dnsRules.length - visibleDnsRules.length;
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
      if (server.detour && supportsDnsServerDialFields(server.type)) {
        edges.push(makeEdge(formatEdgeId("dns-server-detour", tag, server.detour), id, outboundTargetNodeId(server.detour), "outbound", "dns-detour"));
      }
      if (server.type === "tailscale" && server.endpoint) {
        endpointTargetY.set(server.endpoint, y);
        edges.push(makeEdge(formatEdgeId("dns-server-endpoint", tag, server.endpoint), id, `endpoint:${server.endpoint}`, "endpoint", "dns-server"));
      }
      if (server.type === "resolved" && typeof (server as Record<string, unknown>).service === "string") {
        const serviceTag = (server as Record<string, unknown>).service as string;
        if (serviceTag) {
          edges.push(
            makeEdge(
              formatEdgeId("dns-server-service", tag, serviceTag),
              id,
              `service:${serviceTag}`,
              "service",
              "dns-server",
            ),
          );
        }
      }
    });

    if (visibleDnsRules.length > 0) {
      visibleDnsRules.forEach((rule, index) => {
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
        edges.push(makeEdge(formatEdgeId("dns-rule-order", index), "dns:main", id, "dns-rule", "dns"));
        stringRefs(rule.inbound).forEach((tag) => {
          edges.push(makeEdge(formatEdgeId("dns-rule-inbound", index, tag), `inbound:${tag}`, id, "dns-rule-match", "inbound"));
        });
        const dnsAction = typeof rule.action === "string" ? rule.action : "";
        const dnsRuleServerAllowed = dnsAction === "" || dnsAction === "route" || dnsAction === "evaluate";
        if (rule.server && dnsRuleServerAllowed) {
          edges.push(makeEdge(formatEdgeId("dns-rule", index, rule.server), id, `dns-server:${rule.server}`, "dns-server", "dns-rule"));
        }
        const ruleSetRefs = stringRefs(rule.rule_set);
        ruleSetRefs.forEach((tag) => rememberMinY(ruleSetTargetY, tag, y));
        if (visualizeRuleSets) {
          ruleSetRefs.forEach((tag) => {
            edges.push(makeEdge(formatEdgeId("dns-rule-set", index, tag), id, `rule-set:${tag}`, "rule-set", "dns-rule"));
          });
        }
      });
    }
    if (hiddenDnsRules > 0) {
      nodes.push(
        makeNode(
          "notice:dns-rules-overflow",
          {
            ref: { kind: "dns", id: "main" },
            kind: "notice",
            type: "dns-rules",
            title: `+${hiddenDnsRules} DNS rules not visualized`,
            subtitle: `${dnsRules.length} ordered DNS rules stay in the DNS rules table`,
            status: diagnosticStatus("/dns/rules", diagnostics),
            compatible: [],
          },
          layout,
          { x: COLUMNS.rule, y: columnLayout.reserve("rule", dnsY) },
        ),
      );
    }

    if (config.dns.final) {
      edges.push(makeEdge(formatEdgeId("dns-final", config.dns.final), "dns:main", `dns-server:${config.dns.final}`, "dns-server", "dns"));
    }
  }

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
            formatEdgeId("rule-set-download", tag, ruleSet.download_detour),
            `rule-set:${tag}`,
            `outbound:${ruleSet.download_detour}`,
            "download-detour",
            "rule-set-download",
          ),
        );
      }
    });
  }

  certificateProviders.forEach((provider, index) => {
    const tag = entityTag(provider.tag, "certificate-provider", index);
    const desiredY = DNS_LANE_MIN_Y + (dnsServers.length + dnsRules.length + index + 1) * NODE_SLOT_Y;
    const y = columnLayout.reserve("target", desiredY);
    nodes.push(
      makeNode(
        `certificate-provider:${tag}`,
        {
          ref: { kind: "certificate-provider", tag },
          kind: "certificate-provider",
          type: provider.type,
          title: tag,
          subtitle: certificateProviderSubtitle(provider),
          status: diagnosticStatus(`/certificate_providers/${index}`, diagnostics),
          compatible: [],
        },
        layout,
        { x: COLUMNS.target, y },
      ),
    );

    if (provider.type === "tailscale" && typeof provider.endpoint === "string" && provider.endpoint) {
      endpointTargetY.set(provider.endpoint, y);
      edges.push(
        makeEdge(
          formatEdgeId("certificate-provider-endpoint", tag, provider.endpoint),
          `certificate-provider:${tag}`,
          `endpoint:${provider.endpoint}`,
          "endpoint",
          "certificate-provider",
        ),
      );
    }
  });

  httpClients.forEach((client, index) => {
    const tag = entityTag(client.tag, "http-client", index);
    const desiredY = DNS_LANE_MIN_Y + (dnsServers.length + dnsRules.length + certificateProviders.length + index + 2) * NODE_SLOT_Y;
    nodes.push(
      makeNode(
        `http-client:${tag}`,
        {
          ref: { kind: "http-client", tag },
          kind: "http-client",
          type: "http-client",
          title: tag,
          subtitle: httpClientSubtitle(client),
          status: diagnosticStatus(`/http_clients/${index}`, diagnostics),
          compatible: [],
        },
        layout,
        { x: COLUMNS.target, y: columnLayout.reserve("target", desiredY) },
      ),
    );
  });

  endpoints.forEach((endpoint, index) => {
    const tag = entityTag(endpoint.tag, "endpoint", index);
    const desiredY = endpointTargetY.get(tag) ?? DNS_LANE_MIN_Y + (index + dnsServers.length + certificateProviders.length + 1) * NODE_SLOT_Y;
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
      edges.push(makeEdge(formatEdgeId("endpoint-detour", tag, endpoint.detour), `endpoint:${tag}`, `outbound:${endpoint.detour}`, "dial-detour", "detour-target"));
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
          compatible: [],
        },
        layout,
        { x: COLUMNS.entry, y },
      ),
    );

    if (service.detour) {
      const relationId = service.type === "ocm" ? "service-detour-ocm" : "service-detour-ccm";
      edges.push(makeEdge(formatEdgeId(relationId, tag, service.detour), id, `outbound:${service.detour}`, "detour", "service-detour"));
    }

    const verifyEndpoints = stringRefs(service.verify_client_endpoint as string | string[] | undefined);
    verifyEndpoints.forEach((endpointTag) => {
      endpointTargetY.set(endpointTag, y);
      edges.push(makeEdge(formatEdgeId("service-verify-endpoint", tag, endpointTag), id, `endpoint:${endpointTag}`, "verify-client-endpoint", "derp-service"));
    });

    if (service.servers && typeof service.servers === "object" && !Array.isArray(service.servers)) {
      Object.entries(service.servers).forEach(([path, inboundTag]) => {
        edges.push(makeEdge(formatEdgeId("service-ssm-inbound", tag, path, inboundTag), `inbound:${inboundTag}`, id, "service", "managed-inbound"));
      });
    }
  });

  const ntp = config.ntp as Record<string, unknown> | undefined;
  if (ntp && typeof ntp.detour === "string" && ntp.detour) {
    const ntpNodeId = "settings:ntp";
    const ntpNodeExists = nodes.some((node) => node.id === ntpNodeId);
    if (ntpNodeExists) {
      edges.push(
        makeEdge(
          formatEdgeId("settings-ntp-detour", ntp.detour),
          ntpNodeId,
          `outbound:${ntp.detour}`,
          "dial-detour",
          "detour-target",
        ),
      );
    }
  }

  const clashApi = config.experimental?.clash_api as Record<string, unknown> | undefined;
  if (clashApi && typeof clashApi.external_ui_download_detour === "string" && clashApi.external_ui_download_detour) {
    const experimentalNodeId = "settings:experimental";
    const experimentalNodeExists = nodes.some((node) => node.id === experimentalNodeId);
    if (experimentalNodeExists) {
      edges.push(
        makeEdge(
          formatEdgeId("clash-api-download-detour", clashApi.external_ui_download_detour),
          experimentalNodeId,
          `outbound:${clashApi.external_ui_download_detour}`,
          "clash-download-detour",
          "clash-download-detour",
        ),
      );
    }
  }

  centerColumnsVertically(nodes, layout);

  annotateConnectedPorts(config, nodes);
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

function certificateProviderSubtitle(provider: TaggedConfig) {
  if (provider.type === "tailscale") {
    return typeof provider.endpoint === "string" && provider.endpoint
      ? `tailscale endpoint ${provider.endpoint}`
      : "tailscale certificate provider";
  }
  if (provider.type === "acme") return "ACME certificate provider";
  if (provider.type === "cloudflare-origin-ca") return "Cloudflare Origin CA provider";
  return `${provider.type} certificate provider`;
}

function httpClientSubtitle(client: TaggedResourceConfig) {
  const engine = typeof client.engine === "string" && client.engine ? client.engine : "default";
  return `${engine} HTTP client`;
}
