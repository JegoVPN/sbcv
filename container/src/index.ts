import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { runCheck } from "./runner.js";
import { isValidTarget, SUPPORTED_TARGETS } from "./targets.js";

const app = new Hono();

const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? "";
const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 524288);

function authorizeInternal(headers: Headers): Response | null {
  // The container is reached only via the worker's Durable Object stub
  // (http://container.internal/...). It has no public route, so the
  // x-internal-token check here is defense-in-depth. When INTERNAL_TOKEN
  // is unset (e.g. Cloudflare Containers does not currently propagate
  // worker secrets into the container env), skip the check rather than
  // hard-fail; the worker's edge-side controls (Turnstile, CORS, rate
  // limit) still gate every request.
  if (!INTERNAL_TOKEN) return null;
  const got = headers.get("x-internal-token");
  if (got !== INTERNAL_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}

app.get("/healthz", (c) =>
  c.json({
    ok: true,
    targets: SUPPORTED_TARGETS,
  }),
);

app.post("/check", async (c) => {
  const blocked = authorizeInternal(c.req.raw.headers);
  if (blocked) return blocked;

  const contentLength = Number(c.req.header("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return c.json({ status: "invalid", errors: ["Request body too large"] }, 413);
  }

  let body: { target?: unknown; config?: unknown };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ status: "invalid", errors: ["Body must be JSON"] }, 400);
  }

  if (!body || typeof body !== "object" || !isValidTarget(body.target)) {
    return c.json({ status: "invalid", errors: ["Invalid or missing target"] }, 400);
  }
  if (!body.config || typeof body.config !== "object") {
    return c.json({ status: "invalid", errors: ["Config must be an object"] }, 400);
  }

  try {
    const result = await runCheck({ target: body.target, config: body.config });
    return c.json(result, 200);
  } catch {
    return c.json(
      { status: "invalid", errors: ["Internal validator error"] },
      500,
    );
  }
});

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
console.log(`sbc-validator listening on :${port}`);
