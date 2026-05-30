import { namespaceForKind } from "./indexes";
import type { DnsServerConfig, EndpointConfig, OutboundConfig, SingBoxConfig, TaggedConfig, TaggedResourceConfig } from "./types";

export type ReferenceKind =
  | "inbound"
  | "outbound"
  | "dns-server"
  | "endpoint"
  | "service"
  | "rule-set"
  | "http-client"
  | "certificate-provider";

export type ReferenceRegistryEntry = {
  kind: ReferenceKind;
  paths: string[];
  replace: (config: SingBoxConfig, oldTag: string, newTag: string) => void;
  remove: (config: SingBoxConfig, tag: string) => void;
};

type MutableRecord = Record<string, unknown>;

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" && value ? [value] : [];
}

export function replaceTagRefValue<T extends string | string[] | undefined>(value: T, oldTag: string, newTag: string): T {
  if (Array.isArray(value)) return value.map((tag) => (tag === oldTag ? newTag : tag)) as T;
  return (value === oldTag ? newTag : value) as T;
}

export function removeTagRefValue(value: string | string[] | undefined, tag: string): string | string[] | undefined {
  if (Array.isArray(value)) {
    const next = value.filter((item) => item !== tag);
    if (next.length === 0) return undefined;
    return next.length === 1 ? next[0] : next;
  }
  return value === tag ? undefined : value;
}

function replaceStringArray(value: unknown, oldTag: string, newTag: string): string[] | undefined {
  const refs = stringList(value);
  return refs.length ? refs.map((item) => (item === oldTag ? newTag : item)) : undefined;
}

function removeStringArray(value: unknown, tag: string): string[] | undefined {
  if (Array.isArray(value)) return stringList(value).filter((item) => item !== tag);
  const refs = stringList(value).filter((item) => item !== tag);
  return refs.length ? refs : undefined;
}

function replaceStringField(record: MutableRecord | undefined, field: string, oldTag: string, newTag: string) {
  if (record?.[field] === oldTag) record[field] = newTag;
}

function removeStringField(record: MutableRecord | undefined, field: string, tag: string) {
  if (record?.[field] === tag) record[field] = undefined;
}

function replaceResolverRef(value: unknown, oldTag: string, newTag: string): unknown {
  if (value === oldTag) return newTag;
  if (!isRecord(value)) return value;
  const next = { ...value };
  replaceStringField(next, "server", oldTag, newTag);
  return next;
}

function removeResolverRef(value: unknown, tag: string): unknown {
  if (value === tag) return undefined;
  if (!isRecord(value)) return value;
  return value.server === tag ? undefined : value;
}

function replaceHttpClientOutboundDetour(value: unknown, oldTag: string, newTag: string): unknown {
  if (!isRecord(value)) return value;
  const next = { ...value };
  replaceStringField(next, "detour", oldTag, newTag);
  return next;
}

function removeHttpClientOutboundDetour(value: unknown, tag: string): unknown {
  if (!isRecord(value)) return value;
  const next = { ...value };
  removeStringField(next, "detour", tag);
  return next;
}

function replaceHttpClientRef(value: unknown, oldTag: string, newTag: string): unknown {
  return value === oldTag ? newTag : value;
}

function removeHttpClientRef(value: unknown, tag: string): unknown {
  return value === tag ? undefined : value;
}

function tlsRecords(config: SingBoxConfig): MutableRecord[] {
  const result: MutableRecord[] = [];
  const pushTls = (item: MutableRecord) => {
    if (isRecord(item.tls)) result.push(item.tls);
  };
  (config.inbounds ?? []).forEach((item) => pushTls(item as MutableRecord));
  (config.outbounds ?? []).forEach((item) => pushTls(item as MutableRecord));
  (config.dns?.servers ?? []).forEach((item) => pushTls(item as MutableRecord));
  (config.services ?? []).forEach((item) => pushTls(item as MutableRecord));
  (config.http_clients ?? []).forEach((item) => pushTls(item as MutableRecord));
  return result;
}

// V10 / G5 (S6): collapse the twin replace/remove walkers (one near-identical pair per reference kind —
// the assessment's "two near-duplicate hand-written walkers per kind") into ONE traversal per kind,
// parameterized by a `RefOp`. The traversal stays explicit (no JSON-pointer engine) so no exotic shape
// can be silently missed; only the per-shape transform differs between rename and delete. `replaceOp`
// rewrites old→new; `removeOp` drops the tag. The registry's `replace`/`remove` thunks are thin wrappers,
// so the public API and every caller/test are unchanged.
type RefOp = {
  /** A bare string ref: rename → new tag, delete → undefined. Applied only when the field is a string. */
  scalar: (value: string) => string | undefined;
  /** A string | string[] ref (rule.inbound / rule_set / verify_client_endpoint). */
  list: (value: string | string[] | undefined) => string | string[] | undefined;
  /** A string[] ref (outbounds / stats arrays / route_*_address_set). */
  stringArray: (value: unknown) => string[] | undefined;
  /** A domain_resolver ref: bare string OR `{ server: tag }`. */
  resolver: (value: unknown) => unknown;
  /** An inline http_client ref carrying its own outbound detour: `{ detour: tag }`. */
  httpClientDetour: (value: unknown) => unknown;
  /** A plain http_client tag ref. */
  httpClientRef: (value: unknown) => unknown;
  /** A service.servers map (path → tag): rename rewrites values, delete drops matching entries. */
  serversMap: (servers: Record<string, string>) => Record<string, string>;
};

const replaceOp = (oldTag: string, newTag: string): RefOp => ({
  scalar: (value) => (value === oldTag ? newTag : value),
  list: (value) => replaceTagRefValue(value, oldTag, newTag),
  stringArray: (value) => replaceStringArray(value, oldTag, newTag),
  resolver: (value) => replaceResolverRef(value, oldTag, newTag),
  httpClientDetour: (value) => replaceHttpClientOutboundDetour(value, oldTag, newTag),
  httpClientRef: (value) => replaceHttpClientRef(value, oldTag, newTag),
  serversMap: (servers) =>
    Object.fromEntries(Object.entries(servers).map(([path, tag]) => [path, tag === oldTag ? newTag : tag])),
});

const removeOp = (tag: string): RefOp => ({
  scalar: (value) => (value === tag ? undefined : value),
  list: (value) => removeTagRefValue(value, tag),
  stringArray: (value) => removeStringArray(value, tag),
  resolver: (value) => removeResolverRef(value, tag),
  httpClientDetour: (value) => removeHttpClientOutboundDetour(value, tag),
  httpClientRef: (value) => removeHttpClientRef(value, tag),
  serversMap: (servers) => Object.fromEntries(Object.entries(servers).filter(([, ref]) => ref !== tag)),
});

// Apply `op.scalar` to a string field, writing back only on a real change (preserves the original
// replaceStringField/removeStringField semantics: only string fields are touched, undefined stays absent).
function applyScalarField(record: MutableRecord | undefined, field: string, op: RefOp) {
  if (!record) return;
  const cur = record[field];
  if (typeof cur !== "string") return;
  const next = op.scalar(cur);
  if (next !== cur) record[field] = next;
}

function applyResolverField(record: MutableRecord | undefined, field: string, op: RefOp) {
  if (!record || record[field] === undefined) return;
  record[field] = op.resolver(record[field]);
}

function visitInboundRefs(config: SingBoxConfig, op: RefOp) {
  config.route?.rules?.forEach((rule) => {
    rule.inbound = op.list(rule.inbound);
  });
  config.dns?.rules?.forEach((rule) => {
    rule.inbound = op.list(rule.inbound);
  });
  config.inbounds?.forEach((inbound) => applyScalarField(inbound as MutableRecord, "detour", op));
  config.services?.forEach((service) => {
    if (!service.servers || typeof service.servers !== "object" || Array.isArray(service.servers)) return;
    service.servers = op.serversMap(service.servers);
  });
  const stats = (config.experimental as MutableRecord | undefined)?.v2ray_api;
  const statRefs = isRecord(stats) && isRecord(stats.stats) ? stats.stats : null;
  if (statRefs) statRefs.inbounds = op.stringArray(statRefs.inbounds);
}

function visitOutboundRefs(config: SingBoxConfig, op: RefOp) {
  applyScalarField(config.route as MutableRecord | undefined, "final", op);
  config.route?.rules?.forEach((rule) => applyScalarField(rule as MutableRecord, "outbound", op));
  config.outbounds?.forEach((outbound) => {
    outbound.outbounds = op.stringArray(outbound.outbounds);
    applyScalarField(outbound as MutableRecord, "default", op);
    applyScalarField(outbound as MutableRecord, "detour", op);
  });
  config.dns?.servers?.forEach((server) => applyScalarField(server as MutableRecord, "detour", op));
  config.endpoints?.forEach((endpoint) => applyScalarField(endpoint as MutableRecord, "detour", op));
  config.services?.forEach((service) => {
    const obj = service as MutableRecord;
    applyScalarField(obj, "detour", op);
    if (Array.isArray(obj.mesh_with)) obj.mesh_with.forEach((peer) => { if (isRecord(peer)) applyScalarField(peer, "detour", op); });
    if (Array.isArray(obj.verify_client_url)) obj.verify_client_url.forEach((entry) => { if (isRecord(entry)) applyScalarField(entry, "detour", op); });
  });
  config.inbounds?.forEach((inbound) => {
    const obj = inbound as MutableRecord;
    if (isRecord(obj.handshake)) applyScalarField(obj.handshake, "detour", op);
    if (isRecord(obj.handshake_for_server_name)) {
      Object.values(obj.handshake_for_server_name).forEach((entry) => { if (isRecord(entry)) applyScalarField(entry, "detour", op); });
    }
    if (isRecord(obj.control_dialer)) applyScalarField(obj.control_dialer, "detour", op);
    if (isRecord(obj.tunnel_dialer)) applyScalarField(obj.tunnel_dialer, "detour", op);
  });
  config.route?.rule_set?.forEach((ruleSet) => applyScalarField(ruleSet as MutableRecord, "download_detour", op));
  applyScalarField(config.ntp as MutableRecord | undefined, "detour", op);
  const clashApi = (config.experimental as MutableRecord | undefined)?.clash_api;
  if (isRecord(clashApi)) applyScalarField(clashApi, "external_ui_download_detour", op);
  const stats = (config.experimental as MutableRecord | undefined)?.v2ray_api;
  const statRefs = isRecord(stats) && isRecord(stats.stats) ? stats.stats : null;
  if (statRefs) statRefs.outbounds = op.stringArray(statRefs.outbounds);
  visitInlineHttpClientOutboundRefs(config, op);
}

function visitInlineHttpClientOutboundRefs(config: SingBoxConfig, op: RefOp) {
  if (config.route) config.route.default_http_client = op.httpClientDetour(config.route.default_http_client);
  config.route?.rule_set?.forEach((ruleSet) => {
    (ruleSet as MutableRecord).http_client = op.httpClientDetour((ruleSet as MutableRecord).http_client);
  });
  config.certificate_providers?.forEach((provider) => {
    (provider as MutableRecord).http_client = op.httpClientDetour((provider as MutableRecord).http_client);
  });
  config.http_clients?.forEach((client) => {
    applyScalarField(client as MutableRecord, "detour", op);
  });
}

function visitDnsServerRefs(config: SingBoxConfig, op: RefOp) {
  applyScalarField(config.dns as MutableRecord | undefined, "final", op);
  config.dns?.rules?.forEach((rule) => applyScalarField(rule as MutableRecord, "server", op));
  config.route?.rules?.forEach((rule) => applyScalarField(rule as MutableRecord, "server", op));
  // W4 (m1): legacy DNS server `address_resolver` is a dns-server tag (resolves the server's own domain
  // address; dns/server/legacy.md). Track it in the rename/delete cascade so renaming the referenced
  // resolver rewrites it and deleting it scrubs the dangling ref (it was previously untracked → silent break).
  config.dns?.servers?.forEach((server) => applyScalarField(server as MutableRecord, "address_resolver", op));
  applyResolverField(config.route as MutableRecord | undefined, "default_domain_resolver", op);
  const dialOwners: Array<OutboundConfig | DnsServerConfig | EndpointConfig | TaggedConfig | TaggedResourceConfig | Record<string, unknown>> = [
    ...(config.outbounds ?? []),
    ...(config.dns?.servers ?? []),
    ...(config.endpoints ?? []),
    ...(config.route?.rule_set ?? []),
    ...(config.http_clients ?? []),
  ];
  dialOwners.forEach((owner) => applyResolverField(owner as MutableRecord, "domain_resolver", op));
  applyResolverField(config.ntp as MutableRecord | undefined, "domain_resolver", op);
}

function visitEndpointRefs(config: SingBoxConfig, op: RefOp) {
  config.dns?.servers?.forEach((server) => applyScalarField(server as MutableRecord, "endpoint", op));
  config.services?.forEach((service) => {
    service.verify_client_endpoint = op.list(service.verify_client_endpoint as string | string[] | undefined);
  });
  config.certificate_providers?.forEach((provider) => applyScalarField(provider as MutableRecord, "endpoint", op));
}

function visitServiceRefs(config: SingBoxConfig, op: RefOp) {
  config.dns?.servers?.forEach((server) => applyScalarField(server as MutableRecord, "service", op));
}

function visitRuleSetRefs(config: SingBoxConfig, op: RefOp) {
  config.route?.rules?.forEach((rule) => {
    rule.rule_set = op.list(rule.rule_set);
  });
  config.dns?.rules?.forEach((rule) => {
    rule.rule_set = op.list(rule.rule_set);
  });
  config.inbounds?.forEach((inbound) => {
    const obj = inbound as MutableRecord;
    if (obj.type !== "tun") return;
    if (obj.route_address_set !== undefined) obj.route_address_set = op.stringArray(obj.route_address_set);
    if (obj.route_exclude_address_set !== undefined) obj.route_exclude_address_set = op.stringArray(obj.route_exclude_address_set);
  });
}

function visitHttpClientRefs(config: SingBoxConfig, op: RefOp) {
  if (config.route) config.route.default_http_client = op.httpClientRef(config.route.default_http_client);
  config.route?.rule_set?.forEach((ruleSet) => {
    (ruleSet as MutableRecord).http_client = op.httpClientRef((ruleSet as MutableRecord).http_client);
  });
  config.certificate_providers?.forEach((provider) => {
    (provider as MutableRecord).http_client = op.httpClientRef((provider as MutableRecord).http_client);
  });
}

function visitCertificateProviderRefs(config: SingBoxConfig, op: RefOp) {
  tlsRecords(config).forEach((tls) => applyScalarField(tls, "certificate_provider", op));
}

// Each entry pairs the declarative pointer catalog (`paths`, the single source the canvas
// canonicalPath parity test binds against) with ONE traversal, exposed as rename/delete thunks.
type ReferenceVisitor = (config: SingBoxConfig, op: RefOp) => void;

function entry(kind: ReferenceKind, paths: string[], visit: ReferenceVisitor): ReferenceRegistryEntry {
  return {
    kind,
    paths,
    replace: (config, oldTag, newTag) => visit(config, replaceOp(oldTag, newTag)),
    remove: (config, tag) => visit(config, removeOp(tag)),
  };
}

export const referenceRegistry: ReferenceRegistryEntry[] = [
  entry(
    "inbound",
    ["/route/rules/*/inbound", "/dns/rules/*/inbound", "/inbounds/*/detour", "/services/*/servers", "/experimental/v2ray_api/stats/inbounds"],
    visitInboundRefs,
  ),
  entry(
    "outbound",
    ["/route/final", "/route/rules/*/outbound", "/outbounds/*/outbounds", "/outbounds/*/default", "/outbounds/*/detour", "/dns/servers/*/detour", "/endpoints/*/detour", "/services/*/detour", "/services/*/mesh_with/*/detour", "/services/*/verify_client_url/*/detour", "/inbounds/*/handshake/detour", "/inbounds/*/handshake_for_server_name/*/detour", "/inbounds/*/control_dialer/detour", "/inbounds/*/tunnel_dialer/detour", "/route/rule_set/*/download_detour", "/ntp/detour", "/experimental/clash_api/external_ui_download_detour", "/experimental/v2ray_api/stats/outbounds"],
    visitOutboundRefs,
  ),
  entry(
    "dns-server",
    ["/dns/final", "/dns/rules/*/server", "/route/rules/*/server", "/route/default_domain_resolver", "*/domain_resolver", "/dns/servers/*/address_resolver"],
    visitDnsServerRefs,
  ),
  entry(
    "endpoint",
    ["/dns/servers/*/endpoint", "/services/*/verify_client_endpoint", "/certificate_providers/*/endpoint"],
    visitEndpointRefs,
  ),
  entry("service", ["/dns/servers/*/service"], visitServiceRefs),
  entry(
    "rule-set",
    ["/route/rules/*/rule_set", "/dns/rules/*/rule_set", "/inbounds/*/route_address_set", "/inbounds/*/route_exclude_address_set"],
    visitRuleSetRefs,
  ),
  entry(
    "http-client",
    ["/route/default_http_client", "/route/rule_set/*/http_client", "/certificate_providers/*/http_client"],
    visitHttpClientRefs,
  ),
  entry("certificate-provider", ["*/tls/certificate_provider"], visitCertificateProviderRefs),
];

export function replaceRegisteredTagReferences(config: SingBoxConfig, oldTag: string, newTag: string) {
  referenceRegistry.forEach((entry) => entry.replace(config, oldTag, newTag));
}

/**
 * V10-S0 (M3): rewrite tag references only within a single reference NAMESPACE. A namespace-blind rename
 * corrupts a legitimately same-named entity in another namespace (inbound "foo" + outbound "foo" coexist
 * — renaming one must not rewrite the other's refs). endpoint shares the outbound namespace, so renaming
 * an endpoint rewrites the outbound-namespace refs (detour/final/…) too.
 */
export function replaceNamespacedTagReferences(
  config: SingBoxConfig,
  namespace: string,
  oldTag: string,
  newTag: string,
) {
  referenceRegistry.forEach((entry) => {
    if (namespaceForKind(entry.kind) === namespace) entry.replace(config, oldTag, newTag);
  });
}

export function removeRegisteredTagReferences(config: SingBoxConfig, kind: ReferenceKind, tag: string) {
  referenceRegistry.find((entry) => entry.kind === kind)?.remove(config, tag);
}
