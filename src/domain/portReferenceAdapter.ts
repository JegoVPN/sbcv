import {
  connectSelectorCandidate,
  dnsRuleAllowsServer,
  removeTagRef,
  routeRuleAllowsOutbound,
  setDnsFinal,
  setRouteFinal,
  updateDnsRule,
  updateEntityField,
  updateRouteRule,
} from "./commands";
import { AGGREGATE_RELATION_IDS, type PortRelation, relationForId } from "./portRelationRegistry";
import { supportsDnsServerDialFields, supportsOutboundDialFields } from "./sharedFieldRegistry";
import type { SingBoxConfig } from "./types";

type PortNode = { kind: string; value: string };

// C13 — one registry-driven adapter behind the three hand-written port switches (isPortConnected /
// connectDirectedPortReference / disconnectEdge). A writable PortRelation's `canonicalPath` (+ a derived
// reference shape + a per-id gate) is the single source of truth for where a reference lives; this module
// interprets it so adding a simple writable relation is a registry entry with no switch edits. Bespoke
// shapes (selector/urltest member arrays, the ssm-api servers path-map, the string|object domain_resolver)
// route through explicit, labelled handlers keyed by relation id. Pure projection over the canonical config
// — no schema/behaviour change; the symmetry + completeness suites are the behaviour lock.

type MutableRecord = Record<string, unknown>;
type RefShape = "scalar" | "tag-array";

// Index-bound collections key their `*` on a numeric rule index (route/dns rules carry no tag); every other
// `*` collection keys on `.tag`.
const INDEX_BOUND_ARRAYS = new Set(["route/rules", "dns/rules"]);

// Tag-array references (string | string[]) use add/removeTagRef; everything else is a scalar tag string. The
// aggregates are the multi-edge tag-arrays — minus service-ssm-inbound, which is a path→tag map (bespoke).
function refShapeFor(relationId: string): RefShape {
  return AGGREGATE_RELATION_IDS.has(relationId) && relationId !== "service-ssm-inbound" ? "tag-array" : "scalar";
}

// Relations whose reference does not fit the generic canonicalPath/scalar|tag-array model and are handled
// by explicit clauses below (and, for connect/read, in the call sites until those slices land).
const BESPOKE_DISCONNECT = new Set([
  "selector",
  "urltest",
  "service-ssm-inbound",
  "dial-domain-resolver",
  "endpoint-domain-resolver",
  "dns-server-domain-resolver",
]);

function isRecord(value: unknown): value is MutableRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Walk a slash-path (no `*`) into a live nested object on the (already-cloned) config, returning the parent
// of the final segment so the caller can mutate the leaf. Returns undefined if any hop is absent.
function resolveContainer(root: MutableRecord, segments: string[]): MutableRecord | undefined {
  let cursor: MutableRecord = root;
  for (const segment of segments) {
    const next = cursor[segment];
    if (!isRecord(next)) return undefined;
    cursor = next;
  }
  return cursor;
}

// The dns-server domain_resolver / outbound|endpoint domain_resolver shape: a bare string tag OR an object
// whose `server` is the tag. Disconnect drops the whole reference (an object without `server` is invalid).
function clearDomainResolver(owner: MutableRecord | undefined, resolverTag: string) {
  if (!owner) return;
  const resolver = owner.domain_resolver;
  if (typeof resolver === "string" && resolver === resolverTag) owner.domain_resolver = undefined;
  else if (isRecord(resolver) && resolver.server === resolverTag) owner.domain_resolver = undefined;
}

const DOMAIN_RESOLVER_COLLECTION: Record<string, "outbounds" | "endpoints"> = {
  "dial-domain-resolver": "outbounds",
  "endpoint-domain-resolver": "endpoints",
};

/**
 * Clear the reference an edge represents on a cloned config. `relationId` + `parts` come from the parsed
 * edge id; `next` is a mutable clone the caller owns. Mirrors the legacy per-relation disconnect clauses.
 */
export function adapterDisconnect(next: SingBoxConfig, relationId: string, parts: string[]): void {
  if (BESPOKE_DISCONNECT.has(relationId)) {
    disconnectBespoke(next, relationId, parts);
    return;
  }
  const relation = relationForId(relationId);
  const canonicalPath = relation?.canonicalPath;
  if (!canonicalPath) return;

  const segments = canonicalPath.split("/").filter(Boolean);
  const starIndex = segments.indexOf("*");
  const leafField = segments[segments.length - 1];
  if (!leafField) return;
  const shape = refShapeFor(relationId);
  const root = next as unknown as MutableRecord;

  let leafParent: MutableRecord | undefined;
  let ref: string | undefined;

  if (starIndex === -1) {
    // Singleton scalar: /route/final, /dns/final, /ntp/detour, /route/default_http_client,
    // /experimental/clash_api/external_ui_download_detour.
    leafParent = resolveContainer(root, segments.slice(0, -1));
    ref = parts[0];
  } else {
    const arrayPath = segments.slice(0, starIndex);
    const arrayKey = arrayPath[arrayPath.length - 1];
    if (!arrayKey) return;
    const arrayContainer = resolveContainer(root, arrayPath.slice(0, -1));
    const array = arrayContainer?.[arrayKey];
    if (!Array.isArray(array)) return;
    const selector = parts[0];
    const item = INDEX_BOUND_ARRAYS.has(arrayPath.join("/"))
      ? (Number.isInteger(Number(selector)) ? array[Number(selector)] : undefined)
      : array.find((entry) => isRecord(entry) && entry.tag === selector);
    if (!isRecord(item)) return;
    // Descend any segments between `*` and the leaf (none today, but keeps the walker general).
    leafParent = resolveContainer(item, segments.slice(starIndex + 1, -1));
    ref = parts[1];
  }

  if (!leafParent || ref === undefined) return;
  if (shape === "tag-array") {
    leafParent[leafField] = removeTagRef(leafParent[leafField] as string | string[] | undefined, ref);
  } else if (leafParent[leafField] === ref) {
    leafParent[leafField] = undefined;
  }
}

// addTagRef matching the store's normalizing semantics (single remaining ref collapses to a scalar) —
// connect must preserve this exactly (commands' removeTagRef keeps arrays, used only by disconnect).
function addTagRef(value: string | string[] | undefined, tag: string): string | string[] {
  const refs = Array.isArray(value) ? value : value ? [value] : [];
  if (refs.includes(tag)) return value ?? tag;
  return refs.length ? [...refs, tag] : tag;
}

// Map a canonicalPath to the kind of the node that OWNS the reference (where the value is written). The
// other endpoint of the edge supplies the referenced value.
function ownerKindForPath(canonicalPath: string): string | undefined {
  // Order matters: specific array collections before the broad hub paths (/dns/servers before /dns/final,
  // /route/rule_set + /route/rules before /route/final).
  if (canonicalPath.startsWith("/route/rules/")) return "route-rule";
  if (canonicalPath.startsWith("/route/rule_set/")) return "rule-set";
  if (canonicalPath.startsWith("/route/")) return "route"; // /route/final, /route/default_http_client
  if (canonicalPath.startsWith("/dns/rules/")) return "dns-rule";
  if (canonicalPath.startsWith("/dns/servers/")) return "dns-server";
  if (canonicalPath.startsWith("/dns/")) return "dns"; // /dns/final
  if (canonicalPath.startsWith("/outbounds/")) return "outbound";
  if (canonicalPath.startsWith("/endpoints/")) return "endpoint";
  if (canonicalPath.startsWith("/services/")) return "service";
  if (canonicalPath.startsWith("/certificate_providers/")) return "certificate-provider";
  if (canonicalPath.startsWith("/http_clients/")) return "http-client";
  if (canonicalPath.startsWith("/ntp/") || canonicalPath.startsWith("/experimental/")) return "settings";
  return undefined;
}

// Per-relation connect gates NOT already enforced by relationForHandles' node-kind/type matching: the
// action-based rule gates, and the dial-group gates (relationForHandles' dns-server-detour exclude omits
// `legacy`, which supportsDnsServerDialFields correctly rejects — so these are load-bearing, not redundant).
const CONNECT_GATES: Record<string, (config: SingBoxConfig, ownerValue: string) => boolean> = {
  "route-rule": (config, ownerValue) => routeRuleAllowsOutbound(config.route?.rules?.[Number(ownerValue)]),
  "dns-rule": (config, ownerValue) => dnsRuleAllowsServer(config.dns?.rules?.[Number(ownerValue)]),
  "outbound-detour": (config, ownerValue) =>
    supportsOutboundDialFields(config.outbounds?.find((item) => item.tag === ownerValue)?.type),
  "dns-server-detour": (config, ownerValue) =>
    supportsDnsServerDialFields(config.dns?.servers?.find((item) => item.tag === ownerValue)?.type),
  "dns-server-service": (config, ownerValue) =>
    config.dns?.servers?.find((item) => item.tag === ownerValue)?.type === "resolved",
};

const BESPOKE_CONNECT = new Set([
  "selector",
  "urltest",
  "service-ssm-inbound",
  "dial-domain-resolver",
  "endpoint-domain-resolver",
  "dns-server-domain-resolver",
  "clash-api-download-detour",
]);

/**
 * Write the reference an edge would create, returning a new config or null if the connection is not
 * permitted. The writableRelation is resolved by the caller (relationForHandles); this performs the
 * canonical write. Mirrors the legacy connectDirectedPortReference clauses.
 */
export function adapterConnect(
  config: SingBoxConfig,
  relation: PortRelation,
  output: PortNode,
  input: PortNode,
): SingBoxConfig | null {
  const relationId = relation.id;
  if (BESPOKE_CONNECT.has(relationId)) return connectBespoke(config, relationId, output, input);

  const canonicalPath = relation.canonicalPath;
  if (!canonicalPath) return null;
  const ownerKind = ownerKindForPath(canonicalPath);
  if (!ownerKind) return null;
  const owner = output.kind === ownerKind ? output : input;
  const ref = owner === output ? input.value : output.value;

  const gate = CONNECT_GATES[relationId];
  if (gate && !gate(config, owner.value)) return null;

  const segments = canonicalPath.split("/").filter(Boolean);
  const leafField = segments[segments.length - 1];
  if (!leafField) return null;
  const shape = refShapeFor(relationId);

  if (ownerKind === "route-rule" || ownerKind === "dns-rule") {
    const index = Number(owner.value);
    if (!Number.isInteger(index)) return null;
    const rule = ownerKind === "route-rule" ? config.route?.rules?.[index] : config.dns?.rules?.[index];
    const value = shape === "tag-array" ? addTagRef((rule as Record<string, unknown> | undefined)?.[leafField] as string | string[] | undefined, ref) : ref;
    return ownerKind === "route-rule"
      ? updateRouteRule(config, index, { [leafField]: value })
      : updateDnsRule(config, index, { [leafField]: value });
  }

  if (ownerKind === "route" && leafField === "final") return setRouteFinal(config, ref);
  if (ownerKind === "dns" && leafField === "final") return setDnsFinal(config, ref);
  if (ownerKind === "route") return updateEntityField(config, { kind: "route", id: "main" } as never, leafField, ref);
  if (ownerKind === "settings") {
    const path = canonicalPath.startsWith("/ntp/") ? "ntp" : "experimental";
    return updateEntityField(config, { kind: "settings", path } as never, leafField, ref);
  }

  // Tag-bound entity collections (outbound / endpoint / dns-server / service / certificate-provider /
  // rule-set / http-client).
  if (shape === "tag-array") {
    const owners = collectionFor(config, ownerKind);
    const current = (owners?.find((item) => (item as Record<string, unknown>).tag === owner.value) as Record<string, unknown> | undefined)?.[leafField];
    return updateEntityField(config, { kind: ownerKind, tag: owner.value } as never, leafField, addTagRef(current as string | string[] | undefined, ref));
  }
  return updateEntityField(config, { kind: ownerKind, tag: owner.value } as never, leafField, ref);
}

function collectionFor(config: SingBoxConfig, kind: string): unknown[] | undefined {
  switch (kind) {
    case "outbound":
      return config.outbounds;
    case "endpoint":
      return config.endpoints;
    case "dns-server":
      return config.dns?.servers;
    case "service":
      return config.services;
    case "certificate-provider":
      return config.certificate_providers;
    case "rule-set":
      return config.route?.rule_set;
    case "http-client":
      return config.http_clients;
    default:
      return undefined;
  }
}

function connectBespoke(config: SingBoxConfig, relationId: string, output: PortNode, input: PortNode): SingBoxConfig | null {
  if (relationId === "selector" || relationId === "urltest") {
    return connectSelectorCandidate(config, output.value, input.value);
  }
  if (relationId === "service-ssm-inbound") {
    // output = inbound (shadowsocks), input = ssm-api service; servers is a path→inbound-tag map.
    const service = config.services?.find((item) => item.tag === input.value);
    const inbound = config.inbounds?.find((item) => item.tag === output.value);
    if (service?.type !== "ssm-api" || inbound?.type !== "shadowsocks") return null;
    const currentServers = isRecord(service.servers) ? service.servers : {};
    const alreadyMapped = Object.values(currentServers).includes(output.value);
    const servers = alreadyMapped
      ? currentServers
      : { ...currentServers, [uniqueServerPath(currentServers, output.value)]: output.value };
    const withService = updateEntityField(config, { kind: "service", tag: input.value } as never, "servers", servers);
    return updateEntityField(withService, { kind: "inbound", tag: output.value } as never, "managed", true);
  }
  if (relationId === "clash-api-download-detour") {
    const clashApi = isRecord(config.experimental?.clash_api) ? (config.experimental!.clash_api as MutableRecord) : {};
    return updateEntityField(config, { kind: "settings", path: "experimental" } as never, "clash_api", {
      ...clashApi,
      external_ui_download_detour: input.value,
    });
  }
  // domain_resolver: output = the dial-bearing entity, input = the dns-server. Preserve an existing object
  // form's siblings (strategy, …); otherwise write the bare tag.
  const ownerKind = output.kind;
  const owners = collectionForDomainResolver(config, ownerKind);
  const current = (owners?.find((item) => (item as Record<string, unknown>).tag === output.value) as MutableRecord | undefined)?.domain_resolver;
  const nextValue = isRecord(current) ? { ...current, server: input.value } : input.value;
  return updateEntityField(config, { kind: ownerKind, tag: output.value } as never, "domain_resolver", nextValue);
}

function collectionForDomainResolver(config: SingBoxConfig, kind: string): unknown[] | undefined {
  if (kind === "outbound") return config.outbounds;
  if (kind === "endpoint") return config.endpoints;
  if (kind === "dns-server") return config.dns?.servers;
  return undefined;
}

function uniqueServerPath(servers: Record<string, unknown>, tag: string): string {
  if (!("/" in servers)) return "/";
  let candidate = `/${tag}`;
  let suffix = 2;
  while (candidate in servers) {
    candidate = `/${tag}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function disconnectBespoke(next: SingBoxConfig, relationId: string, parts: string[]): void {
  if (relationId === "selector" || relationId === "urltest") {
    const parent = parts[0];
    const child = parts[2] ?? parts[1];
    next.outbounds = next.outbounds?.map((outbound) =>
      outbound.tag === parent && outbound.type === relationId
        ? { ...outbound, outbounds: outbound.outbounds?.filter((tag) => tag !== child) }
        : outbound,
    );
    return;
  }
  if (relationId === "service-ssm-inbound") {
    const [serviceTag, path, inboundTag] = parts;
    if (!path || !inboundTag) return;
    next.services = next.services?.map((service) => {
      if (service.tag !== serviceTag || !isRecord(service.servers)) return service;
      if (service.servers[path] !== inboundTag) return service;
      const servers = { ...service.servers };
      delete servers[path];
      return { ...service, servers };
    });
    return;
  }
  // domain_resolver: string | object `.server`.
  const [ownerTag, resolverTag] = parts;
  if (resolverTag === undefined) return;
  if (relationId === "dns-server-domain-resolver") {
    clearDomainResolver(next.dns?.servers?.find((server) => server.tag === ownerTag) as MutableRecord | undefined, resolverTag);
    return;
  }
  const collection = DOMAIN_RESOLVER_COLLECTION[relationId];
  if (!collection) return;
  const owners = next[collection] as MutableRecord[] | undefined;
  clearDomainResolver(owners?.find((owner) => owner.tag === ownerTag), resolverTag);
}
