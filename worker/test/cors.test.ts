import { describe, expect, it } from "vitest";

import { applyCors, isAllowedOrigin, preflight } from "../src/cors.js";

const env = {
  ALLOWED_ORIGIN: "https://sbcv.app",
} as unknown as Parameters<typeof preflight>[1];

describe("isAllowedOrigin", () => {
  it("returns true for the allowed origin", () => {
    expect(isAllowedOrigin("https://sbcv.app", env)).toBe(true);
  });
  it("returns false for any other origin", () => {
    expect(isAllowedOrigin("https://evil.example", env)).toBe(false);
    expect(isAllowedOrigin(null, env)).toBe(false);
    expect(isAllowedOrigin(undefined, env)).toBe(false);
  });
});

describe("preflight", () => {
  it("returns 403 when origin is missing", () => {
    const req = new Request("https://api.sbcv.app/check", { method: "OPTIONS" });
    expect(preflight(req, env).status).toBe(403);
  });

  it("returns 403 when origin is not allowed", () => {
    const req = new Request("https://api.sbcv.app/check", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example" },
    });
    expect(preflight(req, env).status).toBe(403);
  });

  it("returns 204 with CORS headers for allowed origin", () => {
    const req = new Request("https://api.sbcv.app/check", {
      method: "OPTIONS",
      headers: { origin: "https://sbcv.app" },
    });
    const res = preflight(req, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://sbcv.app");
    expect(res.headers.get("access-control-allow-methods")).toContain("POST");
  });
});

describe("applyCors", () => {
  it("falls back to ALLOWED_ORIGIN when caller origin missing", () => {
    const res = applyCors(new Response("ok"), env, null);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://sbcv.app");
  });
});
