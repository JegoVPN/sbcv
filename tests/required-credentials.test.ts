import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// W1 (M3): credential fields a proxy type requires (binary-verified: shadowsocks method+password,
// tuic-out uuid) are declared in the registry (SchemaRow.requiredFields) and validated as hard semantic
// errors — a config missing one passes a shape-only lint but the real binary rejects it. Bites imported /
// cleared entities (GUI factories always seed them).

const errs = (config: SingBoxConfig) =>
  validateConfig(config, "stable").filter((d) => d.level === "error" && d.code === "missing-required-field");

describe("W1 — required-credential validation", () => {
  it("errors a shadowsocks outbound missing password (and method)", () => {
    const noPw = errs({ outbounds: [{ type: "shadowsocks", tag: "s", server: "1.1.1.1", server_port: 8388, method: "aes-128-gcm" }] } as unknown as SingBoxConfig);
    expect(noPw.some((d) => d.path.endsWith("/password"))).toBe(true);
    const noMethod = errs({ outbounds: [{ type: "shadowsocks", tag: "s", server: "1.1.1.1", server_port: 8388, password: "x" }] } as unknown as SingBoxConfig);
    expect(noMethod.some((d) => d.path.endsWith("/method"))).toBe(true);
  });

  it("errors a shadowsocks INBOUND missing method/password", () => {
    const out = errs({ inbounds: [{ type: "shadowsocks", tag: "in", listen: "::", listen_port: 8388 }] } as unknown as SingBoxConfig);
    expect(out.some((d) => d.path.endsWith("/method"))).toBe(true);
    expect(out.some((d) => d.path.endsWith("/password"))).toBe(true);
  });

  it("errors a tuic outbound missing uuid", () => {
    const out = errs({ outbounds: [{ type: "tuic", tag: "u", server: "1.1.1.1", server_port: 443, tls: { enabled: true } }] } as unknown as SingBoxConfig);
    expect(out.some((d) => d.path.endsWith("/uuid"))).toBe(true);
  });

  it("is a hard (semantic) error that blocks export", () => {
    const diags = validateConfig(
      { outbounds: [{ type: "shadowsocks", tag: "s", server: "1.1.1.1", server_port: 8388, method: "aes-128-gcm" }] } as unknown as SingBoxConfig,
      "stable",
    );
    const missing = diags.find((d) => d.code === "missing-required-field");
    expect(missing?.source).toBe("semantic");
  });

  it("passes a complete shadowsocks / tuic config (no false positives)", () => {
    const ok = errs({
      outbounds: [
        { type: "shadowsocks", tag: "s", server: "1.1.1.1", server_port: 8388, method: "aes-128-gcm", password: "p" },
        { type: "tuic", tag: "u", server: "1.1.1.1", server_port: 443, uuid: "2dd61d93-75d8-4da4-ac0e-6aece7eac365", tls: { enabled: true } },
      ],
    } as unknown as SingBoxConfig);
    expect(ok).toEqual([]);
  });

  it("does not double-flag cloudflared token (kept its bespoke check)", () => {
    const diags = validateConfig(
      { inbounds: [{ type: "cloudflared", tag: "cf" }] } as unknown as SingBoxConfig,
      "testing",
    );
    expect(diags.filter((d) => d.code === "missing-required-field" && d.path.includes("cloudflared"))).toEqual([]);
    // the bespoke cloudflared token error still fires
    expect(diags.some((d) => d.code === "inbound-cloudflared-token-missing")).toBe(true);
  });
});
