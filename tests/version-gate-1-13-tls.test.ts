import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// C7-B (G11): the 1.13-added TLS fields (kernel_tx / kernel_rx / curve_preferences /
// client_authentication) warn "needs sing-box 1.13" on a 1.12 target; 1.13/1.14 are clean. Default-off
// shapes produce nothing. client_authentication is server-only (inbound). Source: shared/tls.md.

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}

const inbound = (tls: Record<string, unknown>) =>
  ({ inbounds: [{ type: "trojan", tag: "i", listen: "127.0.0.1", listen_port: 443, users: [{ name: "u", password: "p" }], tls: { enabled: true, server_name: "e", ...tls } }] }) as unknown as SingBoxConfig;
const outbound = (tls: Record<string, unknown>) =>
  ({ outbounds: [{ type: "trojan", tag: "o", server: "x", server_port: 443, password: "p", tls: { enabled: true, server_name: "e", ...tls } }] }) as unknown as SingBoxConfig;

describe("C7-B — 1.13 TLS field gates", () => {
  it("kernel_tx=true warns on 1.12, clean on 1.13/1.14", () => {
    expect(codes(outbound({ kernel_tx: true }), "stable", "1.12")).toContain("tls-kernel-tx-1-13-only");
    expect(codes(outbound({ kernel_tx: true }), "stable", "1.13")).not.toContain("tls-kernel-tx-1-13-only");
    expect(codes(outbound({ kernel_tx: true }), "testing", "1.14")).not.toContain("tls-kernel-tx-1-13-only");
  });

  it("kernel_rx=true + curve_preferences warn on 1.12 (both inbound and outbound)", () => {
    expect(codes(inbound({ kernel_rx: true }), "stable", "1.12")).toContain("tls-kernel-rx-1-13-only");
    expect(codes(outbound({ curve_preferences: ["X25519"] }), "stable", "1.12")).toContain("tls-curve-preferences-1-13-only");
    expect(codes(inbound({ curve_preferences: ["P256"] }), "stable", "1.12")).toContain("tls-curve-preferences-1-13-only");
  });

  it("client_authentication is server-only: warns on inbound, never on outbound", () => {
    expect(codes(inbound({ client_authentication: "require-any" }), "stable", "1.12")).toContain("tls-client-authentication-1-13-only");
    expect(codes(outbound({ client_authentication: "require-any" }), "stable", "1.12")).not.toContain("tls-client-authentication-1-13-only");
  });

  it("default-off shapes produce nothing on 1.12", () => {
    const c = codes(inbound({ kernel_tx: false, kernel_rx: false, curve_preferences: [], client_authentication: "no" }), "stable", "1.12");
    expect(c).not.toContain("tls-kernel-tx-1-13-only");
    expect(c).not.toContain("tls-kernel-rx-1-13-only");
    expect(c).not.toContain("tls-curve-preferences-1-13-only");
    expect(c).not.toContain("tls-client-authentication-1-13-only");
  });

  it("the gates are export-blocking errors (V4-S3 / M4: sing-box-1.12 rejects unknown tls fields)", () => {
    const diag = validateConfig(outbound({ kernel_tx: true }), "stable", "1.12").find((d) => d.code === "tls-kernel-tx-1-13-only");
    expect(diag?.level).toBe("error");
  });
});
