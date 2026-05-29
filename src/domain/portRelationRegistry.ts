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
  "notice",
] as const;

export type PortNodeKind = (typeof PORT_NODE_KINDS)[number];
export type PortDirection = "input" | "output";
export type PortRelationMode = "writable" | "readonly" | "decorative" | "order-only";
export type PortIconId =
  | "ban"
  | "cog"
  | "corner-down-right"
  | "crosshair"
  | "database"
  | "download-cloud"
  | "filter"
  | "flag"
  | "flag-triangle-right"
  | "git-branch"
  | "globe"
  | "layers"
  | "list-checks"
  | "list-ordered"
  | "milestone"
  | "network"
  | "radio"
  | "route"
  | "server"
  | "settings"
  | "shield"
  | "shield-check"
  | "shuffle"
  | "spline"
  | "target"
  | "waypoints";

export type PortEndpoint = {
  direction: PortDirection;
  nodeKind: PortNodeKind;
  nodeType?: string;
  nodeTypeExcludes?: string[];
  extraNodeKinds?: PortNodeKind[];
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
  extraNodeKinds?: PortNodeKind[],
): PortEndpoint {
  return { direction, nodeKind, nodeType, nodeTypeExcludes, extraNodeKinds, portKey, label, icon };
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
  relation("route-rule-order", "readonly", endpoint("output", "route", "route-rule", "Route rule", "list-ordered"), endpoint("input", "route-rule", "route", "Route order", "route")),
  relation("route-final", "writable", endpoint("output", "route", "outbound", "Outbound", "flag-triangle-right"), endpoint("input", "outbound", "route", "Upstream Route final", "route", undefined, undefined, ["endpoint"]), "/route/final", ["outbound"]),
  relation("route-rule-inbound", "writable", endpoint("output", "inbound", "route-rule-match", "Route rule matcher", "filter"), endpoint("input", "route-rule", "inbound", "Inbound matcher", "radio"), "/route/rules/*/inbound", ["route-rule"]),
  relation("route-rule", "writable", endpoint("output", "route-rule", "outbound", "Outbound", "target"), endpoint("input", "outbound", "route-rule", "Upstream Rule outbound", "git-branch", undefined, undefined, ["endpoint"]), "/route/rules/*/outbound", ["outbound"]),
  relation("route-rule-set", "writable", endpoint("output", "route-rule", "rule-set", "Rule Set", "layers"), endpoint("input", "rule-set", "route-rule", "Upstream Route rule set", "git-branch"), "/route/rules/*/rule_set", ["rule-set"]),
  relation("dns-rule-order", "readonly", endpoint("output", "dns", "dns-rule", "DNS rule", "list-ordered"), endpoint("input", "dns-rule", "dns", "DNS order", "globe")),
  relation("dns-final", "writable", endpoint("output", "dns", "dns-server", "DNS server", "flag"), endpoint("input", "dns-server", "dns", "DNS final server", "globe"), "/dns/final", ["dns-server"]),
  relation("dns-rule-inbound", "writable", endpoint("output", "inbound", "dns-rule-match", "DNS rule matcher", "filter"), endpoint("input", "dns-rule", "inbound", "Inbound matcher", "radio"), "/dns/rules/*/inbound", ["dns-rule"]),
  relation("dns-rule", "writable", endpoint("output", "dns-rule", "dns-server", "DNS server", "crosshair"), endpoint("input", "dns-server", "dns-rule", "DNS rule", "git-branch"), "/dns/rules/*/server", ["dns-server"]),
  relation("dns-rule-set", "writable", endpoint("output", "dns-rule", "rule-set", "Rule Set", "layers"), endpoint("input", "rule-set", "dns-rule", "Upstream DNS rule set", "git-branch"), "/dns/rules/*/rule_set", ["rule-set"]),
  relation("selector", "writable", endpoint("output", "outbound", "outbound-member", "Downstream candidate", "list-checks", "selector"), endpoint("input", "outbound", "selector-group", "Upstream Selector candidate", "shuffle", undefined, undefined, ["endpoint"]), "/outbounds/*/outbounds", ["outbound"]),
  relation("urltest", "writable", endpoint("output", "outbound", "outbound-member", "Downstream candidate", "list-checks", "urltest"), endpoint("input", "outbound", "urltest-group", "Upstream URLTest candidate", "database", undefined, undefined, ["endpoint"]), "/outbounds/*/outbounds", ["outbound"]),
  relation("dns-server-detour", "writable", endpoint("output", "dns-server", "outbound", "Detour outbound", "milestone", undefined, ["hosts", "fakeip", "tailscale", "resolved"]), endpoint("input", "outbound", "dns-detour", "Upstream DNS detour target", "server", undefined, undefined, ["endpoint"]), "/dns/servers/*/detour", ["outbound"]),
  relation("outbound-detour", "writable", endpoint("output", "outbound", "dial-detour", "Downstream dial detour", "spline", undefined, ["block", "selector", "urltest", "dns"]), endpoint("input", "outbound", "detour-target", "Upstream Dial detour target", "network", undefined, ["block", "dns"], ["endpoint"]), "/outbounds/*/detour", ["outbound"]),
  relation("dns-server-endpoint", "writable", endpoint("output", "dns-server", "endpoint", "Tailscale endpoint", "waypoints", "tailscale"), endpoint("input", "endpoint", "dns-server", "Upstream Tailscale DNS server", "server", "tailscale"), "/dns/servers/*/endpoint", ["endpoint"]),
  relation("endpoint-detour", "writable", endpoint("output", "endpoint", "dial-detour", "Dial detour outbound", "spline"), endpoint("input", "outbound", "detour-target", "Upstream Dial detour target", "network", undefined, ["block", "dns"], ["endpoint"]), "/endpoints/*/detour", ["outbound"]),
  relation("service-detour-ccm", "writable", endpoint("output", "service", "detour", "API detour outbound", "corner-down-right", "ccm"), endpoint("input", "outbound", "service-detour", "Upstream service detour target", "server", undefined, undefined, ["endpoint"]), "/services/*/detour", ["outbound"]),
  relation("service-detour-ocm", "writable", endpoint("output", "service", "detour", "API detour outbound", "corner-down-right", "ocm"), endpoint("input", "outbound", "service-detour", "Upstream service detour target", "server", undefined, undefined, ["endpoint"]), "/services/*/detour", ["outbound"]),
  relation("rule-set-download", "writable", endpoint("output", "rule-set", "download-detour", "Download detour", "download-cloud", "remote"), endpoint("input", "outbound", "rule-set-download", "Upstream Rule Set download detour", "layers", undefined, undefined, ["endpoint"]), "/route/rule_set/*/download_detour", ["outbound"]),
  relation("clash-api-download-detour", "writable", endpoint("output", "settings", "clash-download-detour", "Clash UI download detour", "download-cloud", "experimental"), endpoint("input", "outbound", "clash-download-detour", "Upstream Clash UI download detour target", "settings", undefined, undefined, ["endpoint"]), "/experimental/clash_api/external_ui_download_detour", ["outbound"]),
  relation("service-verify-endpoint", "writable", endpoint("output", "service", "verify-client-endpoint", "Verify client endpoint", "shield-check", "derp"), endpoint("input", "endpoint", "derp-service", "Upstream DERP service", "server", "tailscale"), "/services/*/verify_client_endpoint", ["endpoint"]),
  relation("service-ssm-inbound", "writable", endpoint("output", "inbound", "service", "SSM API service", "cog", "shadowsocks"), endpoint("input", "service", "managed-inbound", "Managed Shadowsocks inbound", "radio", "ssm-api"), "/services/*/servers", ["inbound", "service"]),
  relation("dns-server-service", "writable", endpoint("output", "dns-server", "service", "systemd-resolved service", "settings", "resolved"), endpoint("input", "service", "dns-server", "Upstream resolved DNS server", "globe", "resolved"), "/dns/servers/*/service", ["service"]),
  relation("certificate-provider-endpoint", "writable", endpoint("output", "certificate-provider", "endpoint", "Tailscale endpoint", "waypoints", "tailscale"), endpoint("input", "endpoint", "certificate-provider", "Upstream certificate provider endpoint", "shield", "tailscale"), "/certificate_providers/*/endpoint", ["endpoint"]),
  relation("settings-ntp-detour", "writable", endpoint("output", "settings", "dial-detour", "NTP detour outbound", "spline", "ntp"), endpoint("input", "outbound", "detour-target", "Upstream Dial detour target", "network", undefined, ["block", "dns"], ["endpoint"]), "/ntp/detour", ["outbound"]),
  // dial.md domain_resolver: a dial-bearing entity (outbound / endpoint / dns-server) resolves its own
  // server name via a DNS server (string tag, or object form `{server: tag, …}`; added 1.12.0, required
  // for domain-named servers since 1.14.0). One relation per source kind — mirroring the detour family —
  // so the source type-gate (dial-group membership) is precise per kind (the "tailscale" type means dial
  // on an endpoint but not on a dns-server, so a single shared nodeTypeExcludes can't serve all three).
  // All three share the `domain-resolver` output handle → `domain-resolver-target` input on a dns-server.
  // The Inspector select stays the editor; this just adds the canvas port + connect/disconnect. (C11b)
  relation("dial-domain-resolver", "writable", endpoint("output", "outbound", "domain-resolver", "Domain resolver", "globe", undefined, ["block", "selector", "urltest", "dns"]), endpoint("input", "dns-server", "domain-resolver-target", "Upstream domain resolver", "globe"), "/outbounds/*/domain_resolver", ["dns-server"]),
  relation("endpoint-domain-resolver", "writable", endpoint("output", "endpoint", "domain-resolver", "Domain resolver", "globe"), endpoint("input", "dns-server", "domain-resolver-target", "Upstream domain resolver", "globe"), "/endpoints/*/domain_resolver", ["dns-server"]),
  relation("dns-server-domain-resolver", "writable", endpoint("output", "dns-server", "domain-resolver", "Domain resolver", "globe", undefined, ["legacy", "hosts", "fakeip", "tailscale", "resolved"]), endpoint("input", "dns-server", "domain-resolver-target", "Upstream domain resolver", "globe"), "/dns/servers/*/domain_resolver", ["dns-server"]),
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

export function generatedEntityTag(
  kind: Exclude<PortNodeKind, "route" | "route-rule" | "dns" | "dns-rule" | "settings" | "notice">,
  index: number,
) {
  return `untagged-${kind}-${index + 1}`;
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
  if (endpoint.nodeKind !== nodeKind && !endpoint.extraNodeKinds?.includes(nodeKind)) return false;
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

// One-to-many writable relations: a single port handle fans out to several reference edges (array-valued
// canonical paths). The per-port disconnect control is ambiguous for these (it can only target the first
// edge), so it is suppressed; disconnect a specific reference via the per-edge remove (rendered edges) or
// the Inspector's list editor (complete list, immune to the canvas edge cap). See C1-7/8/23 (A8-multiedge).
export const AGGREGATE_RELATION_IDS: ReadonlySet<string> = new Set([
  "selector",
  "urltest",
  "route-rule-inbound",
  "route-rule-set",
  "dns-rule-inbound",
  "dns-rule-set",
  "service-verify-endpoint",
  "service-ssm-inbound",
]);

export function relationIsAggregate(relationId: string) {
  return AGGREGATE_RELATION_IDS.has(relationId);
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
