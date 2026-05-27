import { applyCors, preflight } from "./cors.js";
import type { Env } from "./env.js";
import { handleCheck } from "./handle-check.js";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return preflight(req, env);

    const url = new URL(req.url);

    if (url.pathname === "/healthz") {
      return applyCors(new Response("ok", { status: 200 }), env, req.headers.get("origin"));
    }

    if (url.pathname === "/check" && req.method === "POST") {
      const res = await handleCheck(req, env);
      return applyCors(res, env, req.headers.get("origin"));
    }

    return applyCors(new Response("Not Found", { status: 404 }), env, req.headers.get("origin"));
  },
};
