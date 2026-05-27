import type { Env } from "./env.js";

export function preflight(req: Request, env: Env): Response {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin, env)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin!),
  });
}

export function applyCors(res: Response, env: Env, origin?: string | null): Response {
  const resolvedOrigin = origin && isAllowedOrigin(origin, env) ? origin : primaryOrigin(env);
  const headers = new Headers(res.headers);
  for (const [key, value] of Object.entries(corsHeaders(resolvedOrigin))) {
    headers.set(key, value);
  }
  return new Response(res.body, { status: res.status, headers });
}

export function isAllowedOrigin(origin: string | null | undefined, env: Env): boolean {
  if (!origin) return false;
  return allowedOrigins(env).includes(origin);
}

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGIN.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function primaryOrigin(env: Env): string {
  const [first] = allowedOrigins(env);
  return first ?? env.ALLOWED_ORIGIN;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, cf-turnstile-response",
    "access-control-max-age": "300",
    vary: "Origin",
  };
}
