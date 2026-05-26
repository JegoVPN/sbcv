import type {
  DnsServerConfig,
  InboundConfig,
  OutboundConfig,
  SingBoxConfig,
  TaggedConfig,
  TaggedResourceConfig,
} from "./types";

export type TaggedEntityKind =
  | "inbound"
  | "outbound"
  | "dns-server"
  | "endpoint"
  | "service"
  | "certificate-provider"
  | "http-client"
  | "rule-set";

export type TaggedEntityRef = {
  kind: TaggedEntityKind;
  tag: string;
  type: string;
  path: string;
};

function pushTagged(
  result: TaggedEntityRef[],
  kind: TaggedEntityKind,
  item: TaggedConfig | TaggedResourceConfig | InboundConfig | OutboundConfig | DnsServerConfig,
  path: string,
) {
  if (item.tag) {
    result.push({ kind, tag: item.tag, type: typeof item.type === "string" ? item.type : kind, path });
  }
}

function listItems<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function getTaggedEntities(config: SingBoxConfig): TaggedEntityRef[] {
  const result: TaggedEntityRef[] = [];
  listItems(config.inbounds).forEach((item, index) =>
    pushTagged(result, "inbound", item, `/inbounds/${index}`),
  );
  listItems(config.outbounds).forEach((item, index) =>
    pushTagged(result, "outbound", item, `/outbounds/${index}`),
  );
  listItems(config.dns?.servers).forEach((item, index) =>
    pushTagged(result, "dns-server", item, `/dns/servers/${index}`),
  );
  listItems(config.endpoints).forEach((item, index) =>
    pushTagged(result, "endpoint", item, `/endpoints/${index}`),
  );
  listItems(config.services).forEach((item, index) =>
    pushTagged(result, "service", item, `/services/${index}`),
  );
  listItems(config.certificate_providers).forEach((item, index) =>
    pushTagged(result, "certificate-provider", item, `/certificate_providers/${index}`),
  );
  listItems(config.http_clients).forEach((item, index) =>
    pushTagged(result, "http-client", item, `/http_clients/${index}`),
  );
  listItems(config.route?.rule_set).forEach((item, index) =>
    pushTagged(result, "rule-set", item, `/route/rule_set/${index}`),
  );
  return result;
}

export function buildTagIndex(config: SingBoxConfig): Map<string, TaggedEntityRef[]> {
  const index = new Map<string, TaggedEntityRef[]>();
  for (const entity of getTaggedEntities(config)) {
    const existing = index.get(entity.tag) ?? [];
    existing.push(entity);
    index.set(entity.tag, existing);
  }
  return index;
}

export function getOutboundTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.outbounds).map((item) => item.tag));
}

export function getInboundTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.inbounds).map((item) => item.tag));
}

export function getDnsServerTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.dns?.servers).map((item) => item.tag));
}

export function getRuleSetTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.route?.rule_set).map((item) => item.tag));
}

export function getUniqueTag(config: SingBoxConfig, base: string): string {
  const tags = buildTagIndex(config);
  if (!tags.has(base)) return base;
  let counter = 2;
  while (tags.has(`${base}-${counter}`)) {
    counter += 1;
  }
  return `${base}-${counter}`;
}
