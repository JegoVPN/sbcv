import type { SingBoxConfig } from "./types";

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
  return structuredClone(input) as SingBoxConfig;
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
