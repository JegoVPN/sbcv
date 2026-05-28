import { normalizeDnsRule, normalizeRouteRule } from "./commands";
import type { RouteConfig, SingBoxConfig } from "./types";

// A16 declares route.default_network_type / default_fallback_network_type as `string[]`. A legacy
// pre-release config may carry the raw-string form; coerce it to a single-element array at the import
// boundary so the model honors the type (and the list control / export stay correct). (A16-norm)
function coerceRouteNetworkList(route: RouteConfig, key: "default_network_type" | "default_fallback_network_type") {
  const value: unknown = route[key];
  if (typeof value === "string") route[key] = value ? [value] : [];
}

export type ConfigExport = {
  fileName: "config.json";
  mimeType: "application/json";
  contents: string;
};

function assertObjectField(input: Record<string, unknown>, path: string) {
  const value = input[path];
  if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) {
    throw new Error(`sing-box config field "${path}" must be an object.`);
  }
}

function assertArrayField(input: Record<string, unknown>, path: string) {
  const value = input[path];
  if (value !== undefined && !Array.isArray(value)) {
    throw new Error(`sing-box config field "${path}" must be an array.`);
  }
}

function assertNestedArrayField(input: Record<string, unknown>, objectPath: string, field: string) {
  const owner = input[objectPath];
  if (owner === undefined) return;
  if (!owner || typeof owner !== "object" || Array.isArray(owner)) {
    throw new Error(`sing-box config field "${objectPath}" must be an object.`);
  }
  const value = (owner as Record<string, unknown>)[field];
  if (value !== undefined && !Array.isArray(value)) {
    throw new Error(`sing-box config field "${objectPath}.${field}" must be an array.`);
  }
}

export function normalizeConfig(input: unknown): SingBoxConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("sing-box config must be a JSON object.");
  }
  const root = input as Record<string, unknown>;
  assertArrayField(root, "inbounds");
  assertArrayField(root, "outbounds");
  assertArrayField(root, "endpoints");
  assertArrayField(root, "services");
  assertArrayField(root, "certificate_providers");
  assertArrayField(root, "http_clients");
  assertObjectField(root, "route");
  assertObjectField(root, "dns");
  assertNestedArrayField(root, "route", "rules");
  assertNestedArrayField(root, "route", "rule_set");
  assertNestedArrayField(root, "dns", "servers");
  assertNestedArrayField(root, "dns", "rules");
  const config = structuredClone(input) as SingBoxConfig;
  // Run the rule normalizers on import too (not just in the add/update commands), so a stale `server`
  // on a non-route/evaluate dns-rule or a stale `outbound` on a non-route route-rule is scrubbed at
  // the boundary rather than surviving invisibly on every editor surface and re-exporting. (A10d)
  const dns = config.dns;
  if (dns?.rules) dns.rules = dns.rules.map(normalizeDnsRule);
  const route = config.route;
  if (route?.rules) route.rules = route.rules.map(normalizeRouteRule);
  if (route) {
    coerceRouteNetworkList(route, "default_network_type");
    coerceRouteNetworkList(route, "default_fallback_network_type");
  }
  return config;
}

export function stringifyConfig(config: SingBoxConfig): string {
  return JSON.stringify(config, null, 2);
}

export function createConfigExport(config: SingBoxConfig): ConfigExport {
  return {
    fileName: "config.json",
    mimeType: "application/json",
    contents: stringifyConfig(config),
  };
}

export function parseConfigJson(json: string): SingBoxConfig {
  return normalizeConfig(JSON.parse(json));
}
