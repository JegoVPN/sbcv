import { normalizeDnsRule, normalizeRouteRule } from "./commands";
import type { SbcProject, SingBoxConfig } from "./types";

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
  // "config.json" for a bare sing-box config; "project.sbcv.json" for the C16 project wrapper.
  fileName: string;
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
  // DF1 — `tun.address` is string | string[]; the Address control reads/writes the array form, so a
  // string-form value rendered blank and the first edit overwrote the original string with an array of the
  // typed text (silent data loss). Coerce to the array shape at import — string ↔ single-element array is
  // sing-box-equivalent (both stable + testing binaries `check` exit 0 on either form).
  if (Array.isArray(config.inbounds)) {
    for (const item of config.inbounds) {
      if (!item || typeof item !== "object") continue;
      if ((item as Record<string, unknown>).type !== "tun") continue;
      coerceStringList(item as Record<string, unknown>, "address");
    }
  }
  return config;
}

export function stringifyConfig(config: SingBoxConfig): string {
  return JSON.stringify(config, null, 2);
}

// Recursively drop provably-inert export noise from a COPY of the config: object keys whose value is
// an empty string or an empty array — sing-box treats both as absent, so removing them keeps the config
// equivalent while making the downloaded file cleaner. Conservative (D7 — don't over-clean): keeps
// empty objects, `false`, `0`, `null`, and never drops array *elements* (only object keys). Does not
// mutate the input. Applied only to the download (createConfigExport), not the live editable JSON draft.
function pruneExportNoise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(pruneExportNoise);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (raw === "") continue;
      if (Array.isArray(raw) && raw.length === 0) continue;
      out[key] = pruneExportNoise(raw);
    }
    return out;
  }
  return value;
}

export function createConfigExport(config: SingBoxConfig): ConfigExport {
  return {
    fileName: "config.json",
    mimeType: "application/json",
    contents: stringifyConfig(pruneExportNoise(config) as SingBoxConfig),
  };
}

export function parseConfigJson(json: string): SingBoxConfig {
  return normalizeConfig(JSON.parse(json));
}

// ── Project (sbcv) wrapper ──────────────────────────────────────────────────────────────────────
// A versioned app-local wrapper carrying config + canvas layout + authoring channel/version. It is
// NOT a sing-box config and must never be fed to `sing-box check`; the `kind` discriminator keeps it
// strictly distinct from a bare config (Open rejects a bare config; plain Import rejects this). (C16)
export const SBC_PROJECT_KIND = "sbcv-project" as const;
export const SBC_PROJECT_SCHEMA_VERSION = 1;

export function createProjectExport(project: SbcProject): ConfigExport {
  const payload: SbcProject = {
    kind: SBC_PROJECT_KIND,
    schemaVersion: SBC_PROJECT_SCHEMA_VERSION,
    appVersion: project.appVersion,
    singBoxChannel: project.singBoxChannel,
    singBoxVersion: project.singBoxVersion,
    config: project.config,
    layout: project.layout,
  };
  return {
    fileName: "project.sbcv.json",
    mimeType: "application/json",
    contents: `${JSON.stringify(payload, null, 2)}\n`,
  };
}

export function parseProjectJson(json: string): SbcProject {
  const parsed = JSON.parse(json) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.kind !== SBC_PROJECT_KIND) {
    throw new Error('Not an sbcv project file (expected kind: "sbcv-project"). Use plain Import for a sing-box config.');
  }
  if (typeof parsed.schemaVersion !== "number") {
    throw new Error("sbcv project is missing a numeric schemaVersion.");
  }
  const layout = parsed.layout as { positions?: unknown } | undefined;
  if (!layout || typeof layout !== "object" || Array.isArray(layout) || typeof layout.positions !== "object" || layout.positions === null || Array.isArray(layout.positions)) {
    throw new Error("sbcv project layout.positions is malformed.");
  }
  return {
    kind: SBC_PROJECT_KIND,
    schemaVersion: parsed.schemaVersion,
    appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : "",
    singBoxChannel: parsed.singBoxChannel === "testing" ? "testing" : "stable",
    singBoxVersion: typeof parsed.singBoxVersion === "string" ? parsed.singBoxVersion : "",
    config: normalizeConfig(parsed.config),
    layout: { positions: layout.positions as Record<string, { x: number; y: number }> },
  };
}
