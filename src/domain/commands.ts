import { buildNamespacedTagIndex, getUniqueTag, namespaceForKind } from "./indexes";
import { preferredDnsServerTag, preferredEndpointTag, preferredInboundTag, preferredServiceTag } from "./protocols";
import {
  removeRegisteredTagReferences,
  replaceNamespacedTagReferences,
  type ReferenceKind,
} from "./referenceRegistry";
import { adapterDisconnect } from "./portReferenceAdapter";
import { parseEdgeId, relationIsDisconnectable } from "./portRelationRegistry";
import { schemaRow } from "./schemaRegistry";
import { supportsDnsServerDialFields, supportsOutboundDialFields } from "./sharedFieldRegistry";
import { cloneConfig, STABLE_MINIMAL_CONFIG, STABLE_TUN_SPLIT_CONFIG } from "./templates";
import type {
  DnsRule,
  DnsServerConfig,
  EndpointConfig,
  EntityRef,
  InboundConfig,
  OutboundConfig,
  RouteRule,
  ServiceConfig,
  SingBoxConfig,
  TaggedConfig,
} from "./types";

export function createMinimalConfig(): SingBoxConfig {
  return cloneConfig(STABLE_MINIMAL_CONFIG);
}

export function createStableTunSplitConfig(): SingBoxConfig {
  return cloneConfig(STABLE_TUN_SPLIT_CONFIG);
}

export function ensureSettings(config: SingBoxConfig, path: keyof SingBoxConfig): SingBoxConfig {
  const next = cloneConfig(config);
  const current = next[path];
  if (!current || typeof current !== "object" || Array.isArray(current)) {
    next[path] = {};
  }
  if (path === "log") {
    next.log = {
      level: "info",
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  if (path === "ntp") {
    next.ntp = {
      enabled: false,
      server: "time.apple.com",
      server_port: 123,
      interval: "30m",
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  if (path === "certificate") {
    next.certificate = {
      store: "system",
      certificate: [],
      certificate_path: [],
      certificate_directory_path: [],
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  if (path === "experimental") {
    next.experimental = {
      cache_file: {
        enabled: false,
        path: "",
        cache_id: "",
        store_fakeip: false,
      },
      clash_api: {
        external_controller: "",
        secret: "",
        default_mode: "",
        access_control_allow_origin: [],
        access_control_allow_private_network: false,
      },
      ...(typeof current === "object" && current && !Array.isArray(current) ? current : {}),
    };
  }
  return next;
}

function ensureArray<T>(array: T[] | undefined): T[] {
  return array ? [...array] : [];
}

export function ensureRoute(config: SingBoxConfig): SingBoxConfig {
  const next = cloneConfig(config);
  next.route = next.route ?? { rules: [], final: undefined };
  next.route.rules = ensureArray(next.route.rules);
  return next;
}

export function addInbound(config: SingBoxConfig, type = "tun", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? preferredInboundTag(type));
  next.inbounds = [...(next.inbounds ?? []), createInbound(type, tag)];
  return next;
}

export function createInbound(type: string, tag: string): InboundConfig {
  return (schemaRow("inbound", type)?.factory(tag) ?? { type, tag }) as InboundConfig;
}

export function addOutbound(config: SingBoxConfig, type: string, preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? type);
  const outbound = createOutbound(type, tag);
  next.outbounds = [...(next.outbounds ?? []), outbound];
  return next;
}

export function createOutbound(type: string, tag: string): OutboundConfig {
  return (schemaRow("outbound", type)?.factory(tag) ?? { type, tag }) as OutboundConfig;
}

export function addDnsServer(config: SingBoxConfig, type = "local", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const tag = getUniqueTag(next, preferredTag ?? preferredDnsServerTag(type));
  let server = createDnsServer(type, tag);
  if (type === "tailscale") {
    let endpointTag = next.endpoints?.find((endpoint) => endpoint.type === "tailscale" && typeof endpoint.tag === "string" && endpoint.tag)?.tag;
    if (!endpointTag) {
      endpointTag = getUniqueTag(next, preferredEndpointTag("tailscale"));
      next.endpoints = [...(next.endpoints ?? []), createEndpoint("tailscale", endpointTag)];
    }
    server = { ...server, endpoint: endpointTag };
  }
  if (type === "resolved") {
    let serviceTag = next.services?.find((service) => service.type === "resolved" && typeof service.tag === "string" && service.tag)?.tag;
    if (!serviceTag) {
      serviceTag = getUniqueTag(next, preferredServiceTag("resolved"));
      next.services = [...(next.services ?? []), createService("resolved", serviceTag)];
    }
    server = { ...server, service: serviceTag };
  }
  next.dns.servers = [...(next.dns.servers ?? []), server];
  next.dns.final = next.dns.final ?? tag;
  return next;
}

export function addEndpoint(config: SingBoxConfig, type = "wireguard", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? preferredEndpointTag(type));
  next.endpoints = [...(next.endpoints ?? []), createEndpoint(type, tag)];
  return next;
}

export function addService(config: SingBoxConfig, type = "resolved", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  let service = createService(type, getUniqueTag(next, preferredTag ?? preferredServiceTag(type)));

  if (type === "ssm-api") {
    let inboundTag = next.inbounds?.find((inbound) => inbound.type === "shadowsocks" && inbound.managed)?.tag;
    if (!inboundTag) {
      inboundTag = getUniqueTag(next, "ss-managed-in");
      next.inbounds = [
        ...(next.inbounds ?? []),
        {
          ...createInbound("shadowsocks", inboundTag),
          method: "2022-blake3-aes-128-gcm",
          password: "Q7WI7Eid7AOHSdFDw3bkdA==",
          managed: true,
        },
      ];
    }
    service = { ...service, servers: { "/": inboundTag } };
  }

  next.services = [...(next.services ?? []), service];
  return next;
}

export function createService(type: string, tag: string): ServiceConfig {
  return (schemaRow("service", type)?.factory(tag) ?? { type, tag }) as ServiceConfig;
}

export function createEndpoint(type: string, tag: string): EndpointConfig {
  return (schemaRow("endpoint", type)?.factory(tag) ?? { type, tag }) as EndpointConfig;
}

export function createDnsServer(type: string, tag: string): DnsServerConfig {
  return (schemaRow("dns-server", type)?.factory(tag) ?? { type, tag }) as DnsServerConfig;
}

export function addRuleSet(config: SingBoxConfig, type = "remote", preferredTag?: string): SingBoxConfig {
  const next = ensureRoute(config);
  const tag = getUniqueTag(next, preferredTag ?? `${type}-rules`);
  next.route!.rule_set = [...(next.route!.rule_set ?? []), createRuleSet(type, tag)];
  return next;
}

export function addHttpClient(config: SingBoxConfig, preferredTag?: string): SingBoxConfig {
  const next: SingBoxConfig = { ...config };
  const tag = getUniqueTag(next, preferredTag ?? "http-client");
  // A top-level http_clients[] entry is a tag + the shared HTTP-client object (engine/tls/dial…).
  next.http_clients = [...(next.http_clients ?? []), { tag }];
  return next;
}

export function preferredCertificateProviderTag(type: string): string {
  if (type === "tailscale") return "ts-cert";
  if (type === "cloudflare-origin-ca") return "cf-cert";
  return "acme-cert";
}

// certificate_providers[] is sing-box 1.14+. acme + cloudflare-origin-ca require `domain` (string[]);
// tailscale reuses a Tailscale endpoint via `endpoint`. Never emit the non-schema type
// "certificate-provider" (the bare palette item defaults to acme). (C2 / shared/certificate-provider/*)
export function createCertificateProvider(type: string, tag: string): TaggedConfig {
  if (type === "tailscale") return { type: "tailscale", tag, endpoint: "" };
  return { type, tag, domain: [] };
}

export function addCertificateProvider(config: SingBoxConfig, type = "acme", preferredTag?: string): SingBoxConfig {
  const next = cloneConfig(config);
  const tag = getUniqueTag(next, preferredTag ?? preferredCertificateProviderTag(type));
  next.certificate_providers = [...(next.certificate_providers ?? []), createCertificateProvider(type, tag)];
  return next;
}

export function createRuleSet(type: string, tag: string): TaggedConfig {
  const row = schemaRow("rule-set", type);
  if (!row) {
    throw new Error(`Unsupported rule-set type: ${type}`);
  }
  return row.factory(tag) as TaggedConfig;
}

export function routeRuleAllowsOutbound(rule: Pick<RouteRule, "action"> | undefined): boolean {
  const action = typeof rule?.action === "string" ? rule.action : "";
  return action === "" || action === "route" || action === "bypass";
}

// Route-rule `server` (a DNS-server tag) is valid ONLY for the `resolve` action — it picks the DNS server
// used to resolve the destination domain (route/rule_action.md "resolve" block). Single source of truth for
// the resolve-server canvas edge gate (V7-S3) and the normalizer scrub.
export function routeRuleAllowsServer(rule: Pick<RouteRule, "action"> | undefined): boolean {
  return (typeof rule?.action === "string" ? rule.action : "") === "resolve";
}

// Return a copy of `rule` without the named keys (only those actually present), or `rule` unchanged
// when there is nothing to drop — so the no-op fast path keeps its identity.
function dropRuleKeys<T extends object>(rule: T, keys: string[]): T {
  const present = keys.filter((key) => key in (rule as Record<string, unknown>));
  if (!present.length) return rule;
  const copy = { ...rule } as Record<string, unknown>;
  for (const key of present) delete copy[key];
  return copy as T;
}

export function normalizeRouteRule(rule: RouteRule): RouteRule {
  const action = typeof rule.action === "string" ? rule.action : "";
  const drop = routeRuleAllowsOutbound(rule) ? [] : ["outbound"];
  // `method`/`no_drop` are reject-only (sing-box route rule_action); scrub on any other action.
  if (action !== "reject") drop.push("method", "no_drop");
  // `server` is resolve-only — scrub it on any other action (mirrors the dns-rule server scrub).
  if (!routeRuleAllowsServer(rule)) drop.push("server");
  return dropRuleKeys(rule, drop);
}

export function dnsRuleAllowsServer(rule: Pick<DnsRule, "action"> | undefined): boolean {
  const action = typeof rule?.action === "string" ? rule.action : "";
  return action === "" || action === "route" || action === "evaluate";
}

export function normalizeDnsRule(rule: DnsRule): DnsRule {
  const action = typeof rule.action === "string" ? rule.action : "";
  const drop = dnsRuleAllowsServer(rule) ? [] : ["server"];
  // `method`/`no_drop` are reject-only; `rcode`/`answer`/`ns`/`extra` are predefined-only
  // (sing-box dns rule_action). Scrub each when the action is anything else.
  if (action !== "reject") drop.push("method", "no_drop");
  if (action !== "predefined") drop.push("rcode", "answer", "ns", "extra");
  return dropRuleKeys(rule, drop);
}

export function addRouteRule(config: SingBoxConfig, rule?: RouteRule): SingBoxConfig {
  const next = ensureRoute(config);
  next.route!.rules = [
    ...(next.route!.rules ?? []),
    normalizeRouteRule(rule ?? { domain_suffix: ["example"], outbound: next.route?.final }),
  ];
  return next;
}

export function addDnsRule(config: SingBoxConfig, rule?: DnsRule): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  next.dns.rules = [
    ...(next.dns.rules ?? []),
    normalizeDnsRule(rule ?? { domain_suffix: ["example"], server: next.dns.final }),
  ];
  return next;
}

export function updateRouteRule(
  config: SingBoxConfig,
  index: number,
  patch: Partial<RouteRule>,
): SingBoxConfig {
  const next = ensureRoute(config);
  const rules = [...(next.route!.rules ?? [])];
  const current = rules[index];
  if (!current) return next;
  rules[index] = normalizeRouteRule({ ...current, ...patch });
  next.route!.rules = rules;
  return next;
}

export function updateDnsRule(
  config: SingBoxConfig,
  index: number,
  patch: Partial<DnsRule>,
): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const rules = [...(next.dns.rules ?? [])];
  const current = rules[index];
  if (!current) return next;
  rules[index] = normalizeDnsRule({ ...current, ...patch });
  next.dns.rules = rules;
  return next;
}

export function moveRouteRule(config: SingBoxConfig, index: number, direction: -1 | 1): SingBoxConfig {
  const next = ensureRoute(config);
  const rules = [...(next.route!.rules ?? [])];
  const target = index + direction;
  if (target < 0 || target >= rules.length) return next;
  const current = rules[index];
  const other = rules[target];
  if (!current || !other) return next;
  rules[index] = other;
  rules[target] = current;
  next.route!.rules = rules;
  return next;
}

export function moveDnsRule(config: SingBoxConfig, index: number, direction: -1 | 1): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  const rules = [...(next.dns.rules ?? [])];
  const target = index + direction;
  if (target < 0 || target >= rules.length) return next;
  const current = rules[index];
  const other = rules[target];
  if (!current || !other) return next;
  rules[index] = other;
  rules[target] = current;
  next.dns.rules = rules;
  return next;
}

export function deleteRouteRule(config: SingBoxConfig, index: number): SingBoxConfig {
  const next = ensureRoute(config);
  next.route!.rules = (next.route!.rules ?? []).filter((_, ruleIndex) => ruleIndex !== index);
  return next;
}

export function deleteDnsRule(config: SingBoxConfig, index: number): SingBoxConfig {
  const next = cloneConfig(config);
  if (next.dns?.rules) {
    next.dns.rules = next.dns.rules.filter((_, ruleIndex) => ruleIndex !== index);
  }
  return next;
}

export function setRouteFinal(config: SingBoxConfig, tag: string): SingBoxConfig {
  const next = ensureRoute(config);
  next.route!.final = tag;
  return next;
}

export function setDnsFinal(config: SingBoxConfig, tag: string): SingBoxConfig {
  const next = cloneConfig(config);
  next.dns = next.dns ?? {};
  next.dns.final = tag;
  return next;
}

export function connectSelectorCandidate(
  config: SingBoxConfig,
  selectorTag: string,
  outboundTag: string,
): SingBoxConfig {
  const outbounds = config.outbounds ?? [];
  const parent = outbounds.find((outbound) => outbound.tag === selectorTag);
  // A selector/urltest member may be an outbound or an endpoint (endpoints share the outbound namespace).
  const child =
    outbounds.find((outbound) => outbound.tag === outboundTag) ??
    (config.endpoints ?? []).find((endpoint) => endpoint.tag === outboundTag);
  if (!parent || !child || parent.tag === child.tag) return config;
  if (parent.type !== "selector" && parent.type !== "urltest") return config;
  const current = parent.outbounds ?? [];
  if (current.includes(outboundTag)) return config;
  const next = cloneConfig(config);
  next.outbounds = (next.outbounds ?? []).map((outbound) => {
    if (outbound.tag !== selectorTag) return outbound;
    return { ...outbound, outbounds: [...current, outboundTag] };
  });
  return next;
}

export function updateEntityField(
  config: SingBoxConfig,
  ref: EntityRef,
  field: string,
  value: unknown,
): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "outbound") {
    next.outbounds = (next.outbounds ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "dns-server") {
    next.dns = next.dns ?? {};
    next.dns.servers = (next.dns.servers ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "endpoint") {
    next.endpoints = (next.endpoints ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "service") {
    next.services = (next.services ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "rule-set") {
    next.route = next.route ?? {};
    next.route.rule_set = (next.route.rule_set ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "certificate-provider") {
    next.certificate_providers = (next.certificate_providers ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "http-client") {
    next.http_clients = (next.http_clients ?? []).map((item) =>
      item.tag === ref.tag ? { ...item, [field]: value } : item,
    );
  }
  if (ref.kind === "route") {
    next.route = { ...(next.route ?? {}), [field]: value };
  }
  if (ref.kind === "dns") {
    next.dns = { ...(next.dns ?? {}), [field]: value };
  }
  if (ref.kind === "settings") {
    const current = next[ref.path];
    const objectValue =
      current && typeof current === "object" && !Array.isArray(current) ? current : {};
    next[ref.path] = { ...objectValue, [field]: value };
  }
  return next;
}

export function changeEntityType(
  config: SingBoxConfig,
  ref: Extract<EntityRef, { kind: "inbound" | "outbound" | "dns-server" | "endpoint" | "service" | "rule-set" }>,
  nextType: string,
): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).map((item) =>
      item.tag === ref.tag ? { ...createInbound(nextType, ref.tag), tag: ref.tag } : item,
    );
  }
  if (ref.kind === "outbound") {
    next.outbounds = (next.outbounds ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createOutbound(nextType, ref.tag);
      // Preserve the dial detour only when the new outbound type actually dials (drops it for
      // block/dns/selector/urltest, which sing-box rejects with a detour) — C0-9.
      const detour = supportsOutboundDialFields(nextType) ? item.detour : undefined;
      return detour ? { ...replacement, detour } : replacement;
    });
  }
  if (ref.kind === "dns-server") {
    next.dns = next.dns ?? {};
    next.dns.servers = (next.dns.servers ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createDnsServer(nextType, ref.tag);
      // Preserve the dial detour only for dialable DNS server types (drops it for
      // hosts/fakeip/tailscale/resolved, which have no Dial Fields) — C0-8 detour scrub.
      const detour = supportsDnsServerDialFields(nextType) ? item.detour : undefined;
      const endpoint = item.endpoint;
      return {
        ...replacement,
        ...(detour ? { detour } : {}),
        ...(nextType === "tailscale" && endpoint ? { endpoint } : {}),
      };
    });
  }
  if (ref.kind === "endpoint") {
    next.endpoints = (next.endpoints ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createEndpoint(nextType, ref.tag);
      const detour = item.detour;
      return detour ? { ...replacement, detour } : replacement;
    });
    if (nextType !== "tailscale") removeRegisteredTagReferences(next, "endpoint", ref.tag);
  }
  if (ref.kind === "service") {
    next.services = (next.services ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createService(nextType, ref.tag);
      const listen = item.listen;
      const listenPort = item.listen_port;
      return {
        ...replacement,
        ...(listen ? { listen } : {}),
        ...(typeof listenPort === "number" ? { listen_port: listenPort } : {}),
      };
    });
    if (nextType !== "resolved") removeRegisteredTagReferences(next, "service", ref.tag);
  }
  if (ref.kind === "rule-set") {
    next.route = next.route ?? {};
    next.route.rule_set = (next.route.rule_set ?? []).map((item) => {
      if (item.tag !== ref.tag) return item;
      const replacement = createRuleSet(nextType, ref.tag);
      const downloadDetour = item.download_detour;
      return nextType === "remote" && downloadDetour ? { ...replacement, download_detour: downloadDetour } : replacement;
    });
  }
  return next;
}

export function removeTagRef(value: string | string[] | undefined, tag: string) {
  if (Array.isArray(value)) return value.filter((item) => item !== tag);
  return value === tag ? undefined : value;
}

// Rename the tag on ONLY the collection that holds entities of `kind` (each kind has its own array).
function renameEntityInCollection(config: SingBoxConfig, kind: ReferenceKind, oldTag: string, newTag: string) {
  const rename = <T extends { tag?: string }>(items: T[] | undefined) =>
    items?.map((item) => (item.tag === oldTag ? { ...item, tag: newTag } : item));
  switch (kind) {
    case "inbound":
      config.inbounds = rename(config.inbounds);
      break;
    case "outbound":
      config.outbounds = rename(config.outbounds);
      break;
    case "dns-server":
      if (config.dns) config.dns = { ...config.dns, servers: rename(config.dns.servers) };
      break;
    case "endpoint":
      config.endpoints = rename(config.endpoints);
      break;
    case "service":
      config.services = rename(config.services);
      break;
    case "rule-set":
      if (config.route) config.route = { ...config.route, rule_set: rename(config.route.rule_set) };
      break;
    case "certificate-provider":
      config.certificate_providers = rename(config.certificate_providers);
      break;
    case "http-client":
      config.http_clients = rename(config.http_clients);
      break;
  }
}

/**
 * Rename a taggable entity's tag, NAMESPACE-SCOPED (V10-S0 / assessment M3). A bare-string rename across
 * all collections corrupts a legitimately same-named entity in a different reference namespace (inbound
 * "foo" + outbound "foo" coexist). We rename only `kind`'s own collection, guard uniqueness within the
 * namespace, and rewrite references only within that namespace (endpoint shares the outbound namespace).
 */
export function renameTag(
  config: SingBoxConfig,
  kind: ReferenceKind,
  oldTag: string,
  newTag: string,
): SingBoxConfig {
  if (!newTag.trim() || oldTag === newTag) return config;
  const namespace = namespaceForKind(kind);
  // Conflict guard scoped to the same namespace (cross-namespace same-name is legal).
  if (buildNamespacedTagIndex(config).get(`${namespace} ${newTag}`)?.length) return config;
  const next = cloneConfig(config);
  renameEntityInCollection(next, kind, oldTag, newTag);
  replaceNamespacedTagReferences(next, namespace, oldTag, newTag);
  return next;
}

function referenceKindForEntity(ref: EntityRef): ReferenceKind | null {
  if (
    ref.kind === "inbound" ||
    ref.kind === "outbound" ||
    ref.kind === "dns-server" ||
    ref.kind === "endpoint" ||
    ref.kind === "service" ||
    ref.kind === "rule-set" ||
    ref.kind === "http-client" ||
    ref.kind === "certificate-provider"
  ) {
    return ref.kind;
  }
  return null;
}

export function deleteEntity(config: SingBoxConfig, ref: EntityRef): SingBoxConfig {
  const next = cloneConfig(config);
  if (ref.kind === "inbound") {
    next.inbounds = (next.inbounds ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "outbound") {
    next.outbounds = (next.outbounds ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "dns-server") {
    if (next.dns?.servers) {
      next.dns.servers = next.dns.servers.filter((item) => item.tag !== ref.tag);
    }
  }
  if (ref.kind === "endpoint") {
    next.endpoints = (next.endpoints ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "service") {
    next.services = (next.services ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "rule-set") {
    if (next.route?.rule_set) {
      next.route.rule_set = next.route.rule_set.filter((item) => item.tag !== ref.tag);
    }
  }
  if (ref.kind === "certificate-provider") {
    next.certificate_providers = (next.certificate_providers ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "http-client") {
    next.http_clients = (next.http_clients ?? []).filter((item) => item.tag !== ref.tag);
  }
  if (ref.kind === "route-rule") return deleteRouteRule(config, ref.index);
  if (ref.kind === "dns-rule") return deleteDnsRule(config, ref.index);
  if (ref.kind === "settings") {
    delete next[ref.path];
  }
  const referenceKind = referenceKindForEntity(ref);
  if (referenceKind && "tag" in ref) removeRegisteredTagReferences(next, referenceKind, ref.tag);
  // An endpoint shares the outbound tag namespace (it can be "used as an outbound"), so also scrub its
  // outbound-target refs (route.final, route rule outbound, selector/urltest members, detours).
  if (ref.kind === "endpoint") removeRegisteredTagReferences(next, "outbound", ref.tag);
  return next;
}

export function disconnectEdge(config: SingBoxConfig, edgeId: string): SingBoxConfig {
  const parsed = parseEdgeId(edgeId);
  if (!parsed || !relationIsDisconnectable(parsed.relationId)) return config;
  const next = cloneConfig(config);
  const relation = parsed.relationId;
  const parts = parsed.parts;
  adapterDisconnect(next, relation, parts);
  return next;
}
