import { isAllowedOrigin } from "./cors.js";
import type { Env } from "./env.js";
import { cacheKey } from "./hash.js";
import { forwardToContainer } from "./forward.js";
import { allowRequest } from "./rate-limit.js";
import { isValidTarget } from "./targets.js";
import { verifyTurnstile } from "./turnstile.js";

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function handleCheck(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get("origin");
  if (origin && !isAllowedOrigin(origin, env)) {
    return jsonError("Origin not allowed", 403);
  }

  const maxBody = Number(env.MAX_BODY_BYTES ?? 524288);
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > maxBody) {
    return jsonError("Body too large", 413);
  }

  let body: { target?: unknown; config?: unknown; turnstileToken?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return jsonError("Body must be JSON", 400);
  }

  if (!body || typeof body !== "object" || !isValidTarget(body.target)) {
    return jsonError("Invalid or missing target", 400);
  }
  if (!body.config || typeof body.config !== "object") {
    return jsonError("Config must be an object", 400);
  }

  const clientIp = req.headers.get("cf-connecting-ip");
  const turnstileToken =
    (typeof body.turnstileToken === "string" ? body.turnstileToken : null) ??
    req.headers.get("cf-turnstile-response");

  if (env.TURNSTILE_SECRET_KEY) {
    const ok = await verifyTurnstile(turnstileToken, env, clientIp);
    if (!ok) return jsonError("Turnstile verification failed", 401);
  }

  if (clientIp) {
    const allowed = await allowRequest(env, clientIp);
    if (!allowed) return jsonError("Rate limit exceeded", 429);
  }

  const key = await cacheKey({
    target: body.target,
    config: body.config,
    validatorVersion: env.VALIDATOR_VERSION ?? "v1",
  });

  const cached = await env.CHECK_CACHE.get(key);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: { "content-type": "application/json", "x-cache": "HIT" },
    });
  }

  let upstream: Response;
  try {
    upstream = await forwardToContainer({ target: body.target, config: body.config }, env);
  } catch {
    return jsonError("Validation service temporarily unavailable", 502);
  }

  if (upstream.status === 401) {
    return jsonError("Internal auth failed", 502);
  }

  const text = await upstream.text();

  try {
    const parsed = JSON.parse(text) as { status?: string };
    const ttl = parsed.status === "invalid" ? 300 : 86_400;
    await env.CHECK_CACHE.put(key, text, { expirationTtl: ttl });
  } catch {
    // upstream is not JSON; do not cache
  }

  return new Response(text, {
    status: upstream.status,
    headers: { "content-type": "application/json", "x-cache": "MISS" },
  });
}
