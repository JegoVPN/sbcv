import type {
  DnsServerConfig,
  EndpointConfig,
  InboundConfig,
  OutboundConfig,
  ServiceConfig,
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
  item: TaggedConfig | TaggedResourceConfig | InboundConfig | OutboundConfig | DnsServerConfig | ServiceConfig,
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

// References resolve per-field/per-namespace, so the same tag in different collections never collides
// at runtime. Endpoints share the OUTBOUND namespace (endpoint/index.md: "a protocol with inbound and
// outbound behavior"); every other kind references in its own namespace. (C9)
export function namespaceForKind(kind: TaggedEntityKind): string {
  return kind === "endpoint" ? "outbound" : kind;
}

export function buildNamespacedTagIndex(config: SingBoxConfig): Map<string, TaggedEntityRef[]> {
  const index = new Map<string, TaggedEntityRef[]>();
  for (const entity of getTaggedEntities(config)) {
    const key = `${namespaceForKind(entity.kind)} ${entity.tag}`;
    const existing = index.get(key) ?? [];
    existing.push(entity);
    index.set(key, existing);
  }
  return index;
}

export function getOutboundTags(config: SingBoxConfig): Set<string> {
  const tags = new Set(listItems(config.outbounds).map((item) => item.tag));
  // An endpoint is "a protocol with inbound and outbound behavior" (endpoint/index.md), so its tag shares
  // the outbound namespace and is a valid route/selector/detour target. Both WireGuard and Tailscale
  // endpoints can be "used as an outbound" (migration.md), so all endpoint tags are included.
  listItems<EndpointConfig>(config.endpoints).forEach((endpoint) => tags.add(endpoint.tag));
  return tags;
}

export function getInboundTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.inbounds).map((item) => item.tag));
}

export function getDnsServerTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.dns?.servers).map((item) => item.tag));
}

export function getEndpointTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems<EndpointConfig>(config.endpoints).map((item) => item.tag));
}

export function getRuleSetTags(config: SingBoxConfig): Set<string> {
  return new Set(listItems(config.route?.rule_set).map((item) => item.tag));
}

export function getHttpClientTags(config: SingBoxConfig): Set<string> {
  return new Set(
    listItems(config.http_clients)
      .map((item) => item.tag)
      .filter((tag): tag is string => Boolean(tag)),
  );
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

function tagIsBlank(tag: unknown): boolean {
  return typeof tag !== "string" || tag.trim() === "";
}

/**
 * V3 import dedup: repair tags on an imported config IN PLACE (the caller passes a fresh parse).
 * Namespace-aware (matches the duplicate-tag diagnostic): within each reference namespace the first
 * use of a tag wins and every later collision gets a `-N` suffix. Blank tags are only assigned for the
 * kinds sing-box *requires* a tag (rule_set / http_clients) — tagless inbounds/outbounds/etc. are valid
 * and left untouched. Renaming a duplicate never breaks a reference: refs already resolved to the first
 * holder, and the newly-suffixed entity was previously unreachable-as-distinct. Returns the repair tally.
 */
export function dedupeTags(config: SingBoxConfig): { renamed: number; assigned: number } {
  const used = new Map<string, Set<string>>();
  const isUsed = (ns: string, tag: string) => used.get(ns)?.has(tag) ?? false;
  const markUsed = (ns: string, tag: string) => {
    const set = used.get(ns) ?? new Set<string>();
    set.add(tag);
    used.set(ns, set);
  };
  const uniqueIn = (ns: string, base: string) => {
    if (!isUsed(ns, base)) return base;
    let counter = 2;
    while (isUsed(ns, `${base}-${counter}`)) counter += 1;
    return `${base}-${counter}`;
  };

  const collections: Array<{ items: unknown[]; kind: TaggedEntityKind; base: string; required: boolean }> = [
    { items: listItems(config.inbounds), kind: "inbound", base: "inbound", required: false },
    { items: listItems(config.outbounds), kind: "outbound", base: "outbound", required: false },
    { items: listItems(config.dns?.servers), kind: "dns-server", base: "dns", required: false },
    { items: listItems(config.endpoints), kind: "endpoint", base: "endpoint", required: false },
    { items: listItems(config.services), kind: "service", base: "service", required: false },
    { items: listItems(config.certificate_providers), kind: "certificate-provider", base: "cert", required: false },
    { items: listItems(config.http_clients), kind: "http-client", base: "http-client", required: true },
    { items: listItems(config.route?.rule_set), kind: "rule-set", base: "rule-set", required: true },
  ];

  let renamed = 0;
  let assigned = 0;
  for (const { items, kind, base, required } of collections) {
    const ns = namespaceForKind(kind);
    for (const raw of items) {
      const item = raw as { tag?: unknown };
      if (tagIsBlank(item.tag)) {
        if (required) {
          const tag = uniqueIn(ns, base);
          item.tag = tag;
          markUsed(ns, tag);
          assigned += 1;
        }
        continue;
      }
      const tag = item.tag as string;
      if (isUsed(ns, tag)) {
        const next = uniqueIn(ns, tag);
        item.tag = next;
        markUsed(ns, next);
        renamed += 1;
      } else {
        markUsed(ns, tag);
      }
    }
  }
  return { renamed, assigned };
}
