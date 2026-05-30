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
