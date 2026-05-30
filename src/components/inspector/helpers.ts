import type { EntityRef, SingBoxConfig } from "../../domain/types";

// C14 — pure, dependency-light Inspector helpers shared by the field-definition machinery and the
// per-family components. Extracted from the monolith so both can import them without a cycle.

export type InspectorEntity = Record<string, unknown>;
export type UpdateField = (ref: EntityRef, field: string, value: unknown) => void;

export function toList(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : "";
}

export function fromList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// Seeds a new kv-repeater row with a unique, non-empty key so a blank {"":""} entry can never be
// committed to (and exported from) canonical config (W13 / C0-6). Mirrors the ccm/ocm addHeader pattern.
export function withUniqueBlankKey<T extends Record<string, unknown>>(map: T, base: string): T {
  let candidate = base;
  let suffix = 2;
  while (Object.prototype.hasOwnProperty.call(map, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return { ...map, [candidate]: "" } as T;
}

export function labelForField(field: string) {
  return field
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function editableScalarFields(entity: InspectorEntity, handledFields: ReadonlySet<string>) {
  return Object.entries(entity).filter(([field, value]) => {
    if (handledFields.has(field)) return false;
    const valueType = typeof value;
    return valueType === "string" || valueType === "number" || valueType === "boolean";
  });
}

export function editableNonScalarFields(entity: InspectorEntity, handledFields: ReadonlySet<string>) {
  return Object.entries(entity).filter(([field, value]) => {
    if (handledFields.has(field)) return false;
    if (value === null || value === undefined) return false;
    const valueType = typeof value;
    if (valueType === "string" || valueType === "number" || valueType === "boolean") return false;
    return Array.isArray(value) || valueType === "object";
  });
}

export function objectField(value: unknown): InspectorEntity {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as InspectorEntity) : {};
}

export function outboundTags(config: SingBoxConfig, excludeTag?: string) {
  // Endpoints share the outbound tag namespace (A7a/A7b: a WireGuard/Tailscale endpoint is a valid
  // route/selector/detour target), so they belong in every outbound-target picker, including the
  // selector/urltest candidate checklist (otherwise endpoint members read as stale and cannot be removed).
  return [
    ...(config.outbounds ?? []).map((outbound) => outbound.tag),
    ...(config.endpoints ?? []).map((endpoint) => endpoint.tag),
  ].filter((tag): tag is string => Boolean(tag && tag !== excludeTag));
}

export function endpointTags(config: SingBoxConfig, type?: string) {
  return (config.endpoints ?? [])
    .filter((endpoint) => !type || endpoint.type === type)
    .map((endpoint) => endpoint.tag)
    .filter((tag): tag is string => Boolean(tag));
}

export function inboundTags(config: SingBoxConfig, type?: string) {
  return (config.inbounds ?? [])
    .filter((inbound) => !type || inbound.type === type)
    .map((inbound) => inbound.tag)
    .filter((tag): tag is string => Boolean(tag));
}

// The cross-entity references that point at a given endpoint tag (tailscale dns-server `endpoint`, derp
// service `verify_client_endpoint`, certificate-provider `endpoint`). Surfaced read-only in the endpoint
// inspector so a user can see what depends on it before editing. (C14: moved out of the Inspector shell so
// both the shell — which computes it — and the endpoint inspector — which needs its type — can share it.)
export function endpointReferences(config: SingBoxConfig, tag: string) {
  return {
    tailscaleDnsServers: config.dns?.servers?.filter((server) => server.type === "tailscale" && server.endpoint === tag).map((server) => server.tag) ?? [],
    derpServices:
      config.services
        ?.filter((service) => {
          const refs = service.verify_client_endpoint;
          return Array.isArray(refs) ? refs.includes(tag) : refs === tag;
        })
        .map((service) => service.tag ?? service.type) ?? [],
    certificateProviders: config.certificate_providers?.filter((provider) => provider.endpoint === tag).map((provider) => provider.tag) ?? [],
  };
}

export type EndpointReferences = ReturnType<typeof endpointReferences>;
