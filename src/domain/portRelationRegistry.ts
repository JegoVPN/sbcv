export const PORT_NODE_KINDS = [
  "inbound",
  "route",
  "route-rule",
  "dns",
  "dns-server",
  "dns-rule",
  "endpoint",
  "service",
  "outbound",
  "rule-set",
  "certificate-provider",
  "http-client",
  "settings",
] as const;

export type PortNodeKind = (typeof PORT_NODE_KINDS)[number];
export type PortDirection = "input" | "output";
export type PortRelationMode = "writable" | "readonly" | "decorative" | "order-only";
export type PortIconId =
  | "ban"
  | "database"
  | "git-branch"
  | "globe"
  | "layers"
  | "network"
  | "radio"
  | "route"
  | "server"
  | "settings"
  | "shield"
  | "shuffle"
  | "waypoints";

export type PortEndpoint = {
  direction: PortDirection;
  nodeKind: PortNodeKind;
  nodeType?: string;
  nodeTypeExcludes?: string[];
  portKey: string;
  label: string;
  icon: PortIconId;
};

export type PortRelation = {
  id: string;
  mode: PortRelationMode;
  source: PortEndpoint;
  target: PortEndpoint;
  canonicalPath?: string;
  stableGate?: "stable" | "testing";
  createTarget?: string[];
  disconnectable?: boolean;
};

export type ParsedNodeId = {
  kind: PortNodeKind;
  value: string;
};

export type ParsedEdgeId = {
  relationId: string;
  parts: string[];
};

function endpoint(
  direction: PortDirection,
  nodeKind: PortNodeKind,
  portKey: string,
  label: string,
  icon: PortIconId,
  nodeType?: string,
  nodeTypeExcludes?: string[],
): PortEndpoint {
  return { direction, nodeKind, nodeType, nodeTypeExcludes, portKey, label, icon };
}

function relation(
  id: string,
  mode: PortRelationMode,
  source: PortEndpoint,
  target: PortEndpoint,
  canonicalPath?: string,
  createTarget?: string[],
  disconnectable?: boolean,
): PortRelation {
  return { id, mode, source, target, canonicalPath, createTarget, disconnectable };
}

export const portRelations: PortRelation[] = [
  relation("inbound", "decorative", endpoint("output", "inbound", "route", "Route hub", "route"), endpoint("input", "route", "inbound", "Inbound traffic", "radio")),
  relation("route-rule-order", "readonly", endpoint("output", "route", "route-rule", "Route rule", "git-branch"), endpoint("input", "route-rule", "route", "Route order", "route")),
  relation("route-final", "writable", endpoint("output", "route", "outbound", "Outbound", "network"), endpoint("input", "outbound", "route", "Upstream Route final", "route"), "/route/final", ["outbound"]),
  relation("route-rule-inbound", "writable", endpoint("output", "inbound", "route-rule-match", "Route rule matcher", "git-branch"), endpoint("input", "route-rule", "inbound", "Inbound matcher", "radio"), "/route/rules/*/inbound"),
  relation("route-rule", "writable", endpoint("output", "route-rule", "outbound", "Outbound", "network"), endpoint("input", "outbound", "route-rule", "Upstream Rule outbound", "git-branch"), "/route/rules/*/outbound", ["outbound"]),
  relation("route-rule-set", "writable", endpoint("output", "route-rule", "rule-set", "Rule Set", "layers"), endpoint("input", "rule-set", "route-rule", "Upstream Route rule set", "git-branch"), "/route/rules/*/rule_set", ["rule-set"]),
  relation("dns-rule-order", "readonly", endpoint("output", "dns", "dns-rule", "DNS rule", "git-branch"), endpoint("input", "dns-rule", "dns", "DNS order", "globe")),
  relation("dns-final", "writable", endpoint("output", "dns", "dns-server", "DNS server", "server"), endpoint("input", "dns-server", "dns", "DNS final server", "globe"), "/dns/final", ["dns-server"]),
  relation("dns-rule-inbound", "writable", endpoint("output", "inbound", "dns-rule-match", "DNS rule matcher", "git-branch"), endpoint("input", "dns-rule", "inbound", "Inbound matcher", "radio"), "/dns/rules/*/inbound"),
  relation("dns-rule", "writable", endpoint("output", "dns-rule", "dns-server", "DNS server", "server"), endpoint("input", "dns-server", "dns-rule", "DNS rule", "git-branch"), "/dns/rules/*/server", ["dns-server"]),
  relation("dns-rule-set", "writable", endpoint("output", "dns-rule", "rule-set", "Rule Set", "layers"), endpoint("input", "rule-set", "dns-rule", "Upstream DNS rule set", "git-branch"), "/dns/rules/*/rule_set", ["rule-set"]),
  relation("selector", "writable", endpoint("output", "outbound", "outbound-member", "Downstream candidate", "network", "selector"), endpoint("input", "outbound", "selector-group", "Upstream Selector candidate", "shuffle"), "/outbounds/*/outbounds", ["outbound"]),
  relation("urltest", "writable", endpoint("output", "outbound", "outbound-member", "Downstream candidate", "network", "urltest"), endpoint("input", "outbound", "urltest-group", "Upstream URLTest candidate", "database"), "/outbounds/*/outbounds", ["outbound"]),
  relation("dns-server-detour", "writable", endpoint("output", "dns-server", "outbound", "Detour outbound", "network", undefined, ["hosts", "fakeip", "tailscale", "resolved"]), endpoint("input", "outbound", "dns-detour", "Upstream DNS detour target", "server"), "/dns/servers/*/detour", ["outbound"]),
  relation("outbound-detour", "writable", endpoint("output", "outbound", "dial-detour", "Downstream dial detour", "network", undefined, ["block", "selector", "urltest", "dns"]), endpoint("input", "outbound", "detour-target", "Upstream Dial detour target", "network"), "/outbounds/*/detour", ["outbound"]),
  relation("dns-server-endpoint", "writable", endpoint("output", "dns-server", "endpoint", "Tailscale endpoint", "waypoints", "tailscale"), endpoint("input", "endpoint", "dns-server", "Upstream Tailscale DNS server", "server", "tailscale"), "/dns/servers/*/endpoint", ["endpoint"]),
  relation("endpoint-detour", "writable", endpoint("output", "endpoint", "dial-detour", "Dial detour outbound", "network"), endpoint("input", "outbound", "detour-target", "Upstream Dial detour target", "network"), "/endpoints/*/detour", ["outbound"]),
  relation("service-detour-ccm", "writable", endpoint("output", "service", "detour", "API detour outbound", "network", "ccm"), endpoint("input", "outbound", "service-detour", "Upstream service detour target", "server"), "/services/*/detour", ["outbound"]),
  relation("service-detour-ocm", "writable", endpoint("output", "service", "detour", "API detour outbound", "network", "ocm"), endpoint("input", "outbound", "service-detour", "Upstream service detour target", "server"), "/services/*/detour", ["outbound"]),
  relation("rule-set-download", "writable", endpoint("output", "rule-set", "download-detour", "Download detour", "network", "remote"), endpoint("input", "outbound", "rule-set-download", "Upstream Rule Set download detour", "layers"), "/route/rule_set/*/download_detour", ["outbound"]),
  relation("clash-api-download-detour", "writable", endpoint("output", "settings", "clash-download-detour", "Clash UI download detour", "network", "experimental"), endpoint("input", "outbound", "clash-download-detour", "Upstream Clash UI download detour target", "settings"), "/experimental/clash_api/external_ui_download_detour", ["outbound"]),
  relation("service-verify-endpoint", "writable", endpoint("output", "service", "verify-client-endpoint", "Verify client endpoint", "waypoints", "derp"), endpoint("input", "endpoint", "derp-service", "Upstream DERP service", "server", "tailscale"), "/services/*/verify_client_endpoint", ["endpoint"]),
  relation("service-ssm-inbound", "writable", endpoint("output", "inbound", "service", "SSM API service", "server", "shadowsocks"), endpoint("input", "service", "managed-inbound", "Managed Shadowsocks inbound", "radio", "ssm-api"), "/services/*/servers", ["inbound"]),
  relation("dns-server-service", "writable", endpoint("output", "dns-server", "service", "systemd-resolved service", "settings", "resolved"), endpoint("input", "service", "dns-server", "Upstream resolved DNS server", "globe", "resolved"), "/dns/servers/*/service"),
  relation("certificate-provider-endpoint", "writable", endpoint("output", "certificate-provider", "endpoint", "Tailscale endpoint", "waypoints", "tailscale"), endpoint("input", "endpoint", "certificate-provider", "Upstream certificate provider endpoint", "shield", "tailscale"), "/certificate_providers/*/endpoint", ["endpoint"]),
  relation("settings-ntp-detour", "writable", endpoint("output", "settings", "dial-detour", "NTP detour outbound", "network", "ntp"), endpoint("input", "outbound", "detour-target", "Upstream Dial detour target", "network"), "/ntp/detour", ["outbound"]),
];

export function isPortNodeKind(value: string): value is PortNodeKind {
  return (PORT_NODE_KINDS as readonly string[]).includes(value);
}

export function parseNodeId(id: string): ParsedNodeId | null {
  const separator = id.indexOf(":");
  if (separator < 0) return null;
  const kind = id.slice(0, separator);
  if (!isPortNodeKind(kind)) return null;
  return { kind, value: id.slice(separator + 1) };
}

export function formatNodeId(kind: PortNodeKind, value: string | number) {
  return `${kind}:${value}`;
}

export function encodeEdgePart(value: string | number) {
  return encodeURIComponent(String(value));
}

export function decodeEdgePart(value: string) {
  return decodeURIComponent(value);
}

export function formatEdgeId(relationId: string, ...parts: Array<string | number>) {
  if (relationId.includes(":")) throw new Error(`Relation id cannot contain ":": ${relationId}`);
  return ["edge", relationId, ...parts.map(encodeEdgePart)].join(":");
}

export function parseEdgeId(edgeId: string): ParsedEdgeId | null {
  const [prefix, relationId, ...parts] = edgeId.split(":");
  if (prefix !== "edge" || !relationId) return null;
  try {
    return { relationId, parts: parts.map(decodeEdgePart) };
  } catch {
    return null;
  }
}

export function endpointMatchesNode(endpoint: PortEndpoint, nodeKind: PortNodeKind, nodeType?: string) {
  if (endpoint.nodeKind !== nodeKind) return false;
  if (nodeType && endpoint.nodeTypeExcludes?.includes(nodeType)) return false;
  return !endpoint.nodeType || endpoint.nodeType === nodeType;
}

export function relationForHandles(
  sourceKind: PortNodeKind,
  sourceType: string | undefined,
  sourceHandle: string | null | undefined,
  targetKind: PortNodeKind,
  targetType: string | undefined,
  targetHandle: string | null | undefined,
  modes: PortRelationMode[] = ["writable"],
) {
  if (!sourceHandle || !targetHandle) return undefined;
  return portRelations.find((entry) =>
    modes.includes(entry.mode) &&
    endpointMatchesNode(entry.source, sourceKind, sourceType) &&
    endpointMatchesNode(entry.target, targetKind, targetType) &&
    entry.source.portKey === sourceHandle &&
    entry.target.portKey === targetHandle,
  );
}

export function relationForId(relationId: string) {
  return portRelations.find((entry) => entry.id === relationId);
}

export function relationIsDisconnectable(relationId: string) {
  const entry = relationForId(relationId);
  return entry ? entry.disconnectable ?? entry.mode === "writable" : false;
}

export function edgeIsDisconnectable(edgeId: string) {
  const parsed = parseEdgeId(edgeId);
  return parsed ? relationIsDisconnectable(parsed.relationId) : false;
}

export function portEndpointsForNode(kind: PortNodeKind, type: string, direction: PortDirection) {
  const endpoints = portRelations.flatMap((entry) => [entry.source, entry.target]);
  const seen = new Set<string>();
  return endpoints.filter((endpoint) => {
    if (endpoint.direction !== direction || !endpointMatchesNode(endpoint, kind, type)) return false;
    if (seen.has(endpoint.portKey)) return false;
    seen.add(endpoint.portKey);
    return true;
  });
}
