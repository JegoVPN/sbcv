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
  const next = { ...value };
  removeStringField(next, "server", tag);
  return Object.values(next).some((item) => item !== undefined) ? next : undefined;
}

function replaceResolverField(record: MutableRecord | undefined, field: string, oldTag: string, newTag: string) {
  if (!record || record[field] === undefined) return;
  record[field] = replaceResolverRef(record[field], oldTag, newTag);
}

function removeResolverField(record: MutableRecord | undefined, field: string, tag: string) {
  if (!record || record[field] === undefined) return;
  record[field] = removeResolverRef(record[field], tag);
}

function replaceHttpClientOutboundDetour(value: unknown, oldTag: string, newTag: string): unknown {
  if (!isRecord(value)) return value;
  const next = { ...value };
  replaceStringField(next, "detour", oldTag, newTag);
  replaceResolverField(next, "domain_resolver", oldTag, newTag);
  return next;
}

function removeHttpClientOutboundDetour(value: unknown, tag: string): unknown {
  if (!isRecord(value)) return value;
  const next = { ...value };
  removeStringField(next, "detour", tag);
  removeResolverField(next, "domain_resolver", tag);
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

function replaceInboundRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  config.route?.rules?.forEach((rule) => {
    rule.inbound = replaceTagRefValue(rule.inbound, oldTag, newTag);
  });
  config.dns?.rules?.forEach((rule) => {
    rule.inbound = replaceTagRefValue(rule.inbound, oldTag, newTag);
  });
  config.services?.forEach((service) => {
    if (!service.servers || typeof service.servers !== "object" || Array.isArray(service.servers)) return;
    service.servers = Object.fromEntries(
      Object.entries(service.servers).map(([path, tag]) => [path, tag === oldTag ? newTag : tag]),
    );
  });
  const stats = (config.experimental as MutableRecord | undefined)?.v2ray_api;
  const statRefs = isRecord(stats) && isRecord(stats.stats) ? stats.stats : null;
  if (statRefs) statRefs.inbounds = replaceStringArray(statRefs.inbounds, oldTag, newTag);
}

function removeInboundRefs(config: SingBoxConfig, tag: string) {
  config.route?.rules?.forEach((rule) => {
    rule.inbound = removeTagRefValue(rule.inbound, tag);
  });
  config.dns?.rules?.forEach((rule) => {
    rule.inbound = removeTagRefValue(rule.inbound, tag);
  });
  config.services?.forEach((service) => {
    if (!service.servers || typeof service.servers !== "object" || Array.isArray(service.servers)) return;
    service.servers = Object.fromEntries(Object.entries(service.servers).filter(([, ref]) => ref !== tag));
  });
  const stats = (config.experimental as MutableRecord | undefined)?.v2ray_api;
  const statRefs = isRecord(stats) && isRecord(stats.stats) ? stats.stats : null;
  if (statRefs) statRefs.inbounds = removeStringArray(statRefs.inbounds, tag);
}

function replaceOutboundRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  if (config.route?.final === oldTag) config.route.final = newTag;
  config.route?.rules?.forEach((rule) => replaceStringField(rule as MutableRecord, "outbound", oldTag, newTag));
  config.outbounds?.forEach((outbound) => {
    outbound.outbounds = replaceStringArray(outbound.outbounds, oldTag, newTag);
    replaceStringField(outbound as MutableRecord, "default", oldTag, newTag);
    replaceStringField(outbound as MutableRecord, "detour", oldTag, newTag);
  });
  config.dns?.servers?.forEach((server) => replaceStringField(server as MutableRecord, "detour", oldTag, newTag));
  config.endpoints?.forEach((endpoint) => replaceStringField(endpoint as MutableRecord, "detour", oldTag, newTag));
  config.services?.forEach((service) => replaceStringField(service as MutableRecord, "detour", oldTag, newTag));
  config.route?.rule_set?.forEach((ruleSet) => replaceStringField(ruleSet as MutableRecord, "download_detour", oldTag, newTag));
  replaceStringField(config.ntp as MutableRecord | undefined, "detour", oldTag, newTag);
  const clashApi = (config.experimental as MutableRecord | undefined)?.clash_api;
  if (isRecord(clashApi)) replaceStringField(clashApi, "external_ui_download_detour", oldTag, newTag);
  const stats = (config.experimental as MutableRecord | undefined)?.v2ray_api;
  const statRefs = isRecord(stats) && isRecord(stats.stats) ? stats.stats : null;
  if (statRefs) statRefs.outbounds = replaceStringArray(statRefs.outbounds, oldTag, newTag);
  replaceInlineHttpClientOutboundRefs(config, oldTag, newTag);
}

function removeOutboundRefs(config: SingBoxConfig, tag: string) {
  if (config.route?.final === tag) config.route.final = undefined;
  config.route?.rules?.forEach((rule) => removeStringField(rule as MutableRecord, "outbound", tag));
  config.outbounds?.forEach((outbound) => {
    outbound.outbounds = removeStringArray(outbound.outbounds, tag);
    removeStringField(outbound as MutableRecord, "default", tag);
    removeStringField(outbound as MutableRecord, "detour", tag);
  });
  config.dns?.servers?.forEach((server) => removeStringField(server as MutableRecord, "detour", tag));
  config.endpoints?.forEach((endpoint) => removeStringField(endpoint as MutableRecord, "detour", tag));
  config.services?.forEach((service) => removeStringField(service as MutableRecord, "detour", tag));
  config.route?.rule_set?.forEach((ruleSet) => removeStringField(ruleSet as MutableRecord, "download_detour", tag));
  removeStringField(config.ntp as MutableRecord | undefined, "detour", tag);
  const clashApi = (config.experimental as MutableRecord | undefined)?.clash_api;
  if (isRecord(clashApi)) removeStringField(clashApi, "external_ui_download_detour", tag);
  const stats = (config.experimental as MutableRecord | undefined)?.v2ray_api;
  const statRefs = isRecord(stats) && isRecord(stats.stats) ? stats.stats : null;
  if (statRefs) statRefs.outbounds = removeStringArray(statRefs.outbounds, tag);
  removeInlineHttpClientOutboundRefs(config, tag);
}

function replaceInlineHttpClientOutboundRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  if (config.route) config.route.default_http_client = replaceHttpClientOutboundDetour(config.route.default_http_client, oldTag, newTag);
  config.route?.rule_set?.forEach((ruleSet) => {
    (ruleSet as MutableRecord).http_client = replaceHttpClientOutboundDetour((ruleSet as MutableRecord).http_client, oldTag, newTag);
  });
  config.certificate_providers?.forEach((provider) => {
    (provider as MutableRecord).http_client = replaceHttpClientOutboundDetour((provider as MutableRecord).http_client, oldTag, newTag);
  });
  config.http_clients?.forEach((client) => {
    replaceStringField(client as MutableRecord, "detour", oldTag, newTag);
    replaceResolverField(client as MutableRecord, "domain_resolver", oldTag, newTag);
  });
}

function removeInlineHttpClientOutboundRefs(config: SingBoxConfig, tag: string) {
  if (config.route) config.route.default_http_client = removeHttpClientOutboundDetour(config.route.default_http_client, tag);
  config.route?.rule_set?.forEach((ruleSet) => {
    (ruleSet as MutableRecord).http_client = removeHttpClientOutboundDetour((ruleSet as MutableRecord).http_client, tag);
  });
  config.certificate_providers?.forEach((provider) => {
    (provider as MutableRecord).http_client = removeHttpClientOutboundDetour((provider as MutableRecord).http_client, tag);
  });
  config.http_clients?.forEach((client) => {
    removeStringField(client as MutableRecord, "detour", tag);
    removeResolverField(client as MutableRecord, "domain_resolver", tag);
  });
}

function replaceDnsServerRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  if (config.dns?.final === oldTag) config.dns.final = newTag;
  config.dns?.rules?.forEach((rule) => replaceStringField(rule as MutableRecord, "server", oldTag, newTag));
  replaceResolverField(config.route as MutableRecord | undefined, "default_domain_resolver", oldTag, newTag);
  const dialOwners: Array<OutboundConfig | DnsServerConfig | EndpointConfig | TaggedConfig | TaggedResourceConfig | Record<string, unknown>> = [
    ...(config.outbounds ?? []),
    ...(config.dns?.servers ?? []),
    ...(config.endpoints ?? []),
    ...(config.route?.rule_set ?? []),
    ...(config.http_clients ?? []),
  ];
  dialOwners.forEach((owner) => replaceResolverField(owner as MutableRecord, "domain_resolver", oldTag, newTag));
  replaceResolverField(config.ntp as MutableRecord | undefined, "domain_resolver", oldTag, newTag);
}

function removeDnsServerRefs(config: SingBoxConfig, tag: string) {
  if (config.dns?.final === tag) config.dns.final = undefined;
  config.dns?.rules?.forEach((rule) => removeStringField(rule as MutableRecord, "server", tag));
  removeResolverField(config.route as MutableRecord | undefined, "default_domain_resolver", tag);
  const dialOwners: Array<OutboundConfig | DnsServerConfig | EndpointConfig | TaggedConfig | TaggedResourceConfig | Record<string, unknown>> = [
    ...(config.outbounds ?? []),
    ...(config.dns?.servers ?? []),
    ...(config.endpoints ?? []),
    ...(config.route?.rule_set ?? []),
    ...(config.http_clients ?? []),
  ];
  dialOwners.forEach((owner) => removeResolverField(owner as MutableRecord, "domain_resolver", tag));
  removeResolverField(config.ntp as MutableRecord | undefined, "domain_resolver", tag);
}

function replaceEndpointRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  config.dns?.servers?.forEach((server) => replaceStringField(server as MutableRecord, "endpoint", oldTag, newTag));
  config.services?.forEach((service) => {
    service.verify_client_endpoint = replaceTagRefValue(service.verify_client_endpoint as string | string[] | undefined, oldTag, newTag);
  });
  config.certificate_providers?.forEach((provider) => replaceStringField(provider as MutableRecord, "endpoint", oldTag, newTag));
}

function removeEndpointRefs(config: SingBoxConfig, tag: string) {
  config.dns?.servers?.forEach((server) => removeStringField(server as MutableRecord, "endpoint", tag));
  config.services?.forEach((service) => {
    service.verify_client_endpoint = removeTagRefValue(service.verify_client_endpoint as string | string[] | undefined, tag);
  });
  config.certificate_providers?.forEach((provider) => removeStringField(provider as MutableRecord, "endpoint", tag));
}

function replaceServiceRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  config.dns?.servers?.forEach((server) => replaceStringField(server as MutableRecord, "service", oldTag, newTag));
}

function removeServiceRefs(config: SingBoxConfig, tag: string) {
  config.dns?.servers?.forEach((server) => removeStringField(server as MutableRecord, "service", tag));
}

function replaceRuleSetRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  config.route?.rules?.forEach((rule) => {
    rule.rule_set = replaceTagRefValue(rule.rule_set, oldTag, newTag);
  });
  config.dns?.rules?.forEach((rule) => {
    rule.rule_set = replaceTagRefValue(rule.rule_set, oldTag, newTag);
  });
}

function removeRuleSetRefs(config: SingBoxConfig, tag: string) {
  config.route?.rules?.forEach((rule) => {
    rule.rule_set = removeTagRefValue(rule.rule_set, tag);
  });
  config.dns?.rules?.forEach((rule) => {
    rule.rule_set = removeTagRefValue(rule.rule_set, tag);
  });
}

function replaceHttpClientRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  if (config.route) config.route.default_http_client = replaceHttpClientRef(config.route.default_http_client, oldTag, newTag);
  config.route?.rule_set?.forEach((ruleSet) => {
    (ruleSet as MutableRecord).http_client = replaceHttpClientRef((ruleSet as MutableRecord).http_client, oldTag, newTag);
  });
  config.certificate_providers?.forEach((provider) => {
    (provider as MutableRecord).http_client = replaceHttpClientRef((provider as MutableRecord).http_client, oldTag, newTag);
  });
  config.services?.forEach((service) => {
    (service as MutableRecord).http_client = replaceHttpClientRef((service as MutableRecord).http_client, oldTag, newTag);
  });
}

function removeHttpClientRefs(config: SingBoxConfig, tag: string) {
  if (config.route) config.route.default_http_client = removeHttpClientRef(config.route.default_http_client, tag);
  config.route?.rule_set?.forEach((ruleSet) => {
    (ruleSet as MutableRecord).http_client = removeHttpClientRef((ruleSet as MutableRecord).http_client, tag);
  });
  config.certificate_providers?.forEach((provider) => {
    (provider as MutableRecord).http_client = removeHttpClientRef((provider as MutableRecord).http_client, tag);
  });
  config.services?.forEach((service) => {
    (service as MutableRecord).http_client = removeHttpClientRef((service as MutableRecord).http_client, tag);
  });
}

function replaceCertificateProviderRefs(config: SingBoxConfig, oldTag: string, newTag: string) {
  tlsRecords(config).forEach((tls) => replaceStringField(tls, "certificate_provider", oldTag, newTag));
}

function removeCertificateProviderRefs(config: SingBoxConfig, tag: string) {
  tlsRecords(config).forEach((tls) => removeStringField(tls, "certificate_provider", tag));
}

export const referenceRegistry: ReferenceRegistryEntry[] = [
  {
    kind: "inbound",
    paths: ["/route/rules/*/inbound", "/dns/rules/*/inbound", "/services/*/servers", "/experimental/v2ray_api/stats/inbounds"],
    replace: replaceInboundRefs,
    remove: removeInboundRefs,
  },
  {
    kind: "outbound",
    paths: ["/route/final", "/route/rules/*/outbound", "/outbounds/*/outbounds", "/outbounds/*/default", "/outbounds/*/detour", "/dns/servers/*/detour", "/endpoints/*/detour", "/services/*/detour", "/route/rule_set/*/download_detour", "/ntp/detour", "/experimental/clash_api/external_ui_download_detour", "/experimental/v2ray_api/stats/outbounds"],
    replace: replaceOutboundRefs,
    remove: removeOutboundRefs,
  },
  {
    kind: "dns-server",
    paths: ["/dns/final", "/dns/rules/*/server", "/route/default_domain_resolver", "*/domain_resolver"],
    replace: replaceDnsServerRefs,
    remove: removeDnsServerRefs,
  },
  {
    kind: "endpoint",
    paths: ["/dns/servers/*/endpoint", "/services/*/verify_client_endpoint", "/certificate_providers/*/endpoint"],
    replace: replaceEndpointRefs,
    remove: removeEndpointRefs,
  },
  {
    kind: "service",
    paths: ["/dns/servers/*/service"],
    replace: replaceServiceRefs,
    remove: removeServiceRefs,
  },
  {
    kind: "rule-set",
    paths: ["/route/rules/*/rule_set", "/dns/rules/*/rule_set"],
    replace: replaceRuleSetRefs,
    remove: removeRuleSetRefs,
  },
  {
    kind: "http-client",
    paths: ["/route/default_http_client", "/route/rule_set/*/http_client", "/certificate_providers/*/http_client", "/services/*/http_client"],
    replace: replaceHttpClientRefs,
    remove: removeHttpClientRefs,
  },
  {
    kind: "certificate-provider",
    paths: ["*/tls/certificate_provider"],
    replace: replaceCertificateProviderRefs,
    remove: removeCertificateProviderRefs,
  },
];

export function replaceRegisteredTagReferences(config: SingBoxConfig, oldTag: string, newTag: string) {
  referenceRegistry.forEach((entry) => entry.replace(config, oldTag, newTag));
}

export function removeRegisteredTagReferences(config: SingBoxConfig, kind: ReferenceKind, tag: string) {
  referenceRegistry.find((entry) => entry.kind === kind)?.remove(config, tag);
}
