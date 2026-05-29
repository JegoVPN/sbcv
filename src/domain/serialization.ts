import { normalizeDnsRule, normalizeRouteRule } from "./commands";
import type { SingBoxConfig } from "./types";

// A legacy/pre-release config may carry a raw-string value where the model expects a `string[]` list
// (route.default_network_type / default_fallback_network_type — A16-norm; and the dial-group
// network_type / fallback_network_type on outbounds/endpoints — A16-norm-rest). Coerce the bare string
// to a single-element array at the import boundary so the model honors the array shape and the
// `kind:"list"` control / export stay correct. Non-string values pass through untouched.
function coerceStringList(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "string") record[key] = value ? [value] : [];
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
    coerceStringList(route as Record<string, unknown>, "default_network_type");
    coerceStringList(route as Record<string, unknown>, "default_fallback_network_type");
  }
  // Dial-group siblings on outbounds/endpoints carry the same legacy-string-vs-array hazard.
  for (const list of [config.outbounds, config.endpoints]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      coerceStringList(item as Record<string, unknown>, "network_type");
      coerceStringList(item as Record<string, unknown>, "fallback_network_type");
    }
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
