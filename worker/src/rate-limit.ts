import type { Env } from "./env.js";

const WINDOW_MS = 60_000;
const KEY_PREFIX = "rl";

export async function allowRequest(env: Env, identifier: string): Promise<boolean> {
  const limit = Number(env.RATE_LIMIT_PER_MIN ?? 30);
  if (!Number.isFinite(limit) || limit <= 0) return true;

  const windowIndex = Math.floor(Date.now() / WINDOW_MS);
  const key = `${KEY_PREFIX}:${identifier}:${windowIndex}`;

  const current = Number((await env.CHECK_CACHE.get(key)) ?? "0");
  if (current >= limit) return false;

  await env.CHECK_CACHE.put(key, String(current + 1), { expirationTtl: 90 });
  return true;
}
