export interface CacheKeyParts {
  target: string;
  config: unknown;
  validatorVersion: string;
}

export async function cacheKey(parts: CacheKeyParts): Promise<string> {
  const normalized = JSON.stringify({
    target: parts.target,
    config: normalize(parts.config),
    v: parts.validatorVersion,
  });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = normalize(obj[key]);
    }
    return sorted;
  }
  return value;
}
