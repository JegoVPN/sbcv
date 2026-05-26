import type { SingBoxConfig } from "./types";

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child !== undefined) {
        output[key] = stripUndefined(child);
      }
    }
    return output;
  }
  return value;
}

export function normalizeConfig(input: unknown): SingBoxConfig {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("sing-box config must be a JSON object.");
  }
  return structuredClone(input) as SingBoxConfig;
}

export function stringifyConfig(config: SingBoxConfig): string {
  return JSON.stringify(stripUndefined(config), null, 2);
}

export function parseConfigJson(json: string): SingBoxConfig {
  return normalizeConfig(JSON.parse(json));
}
