import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// C10 (4.2 server_ports): a hysteria/hysteria2 outbound using port hopping via a non-empty
// `server_ports` array (no scalar `server_port`) no longer raises the blocking
// outbound-invalid-server-port error, while neither-supplied still errors.
// Source: stable/.../outbound/hysteria2.md ("Ignored if server_ports is set"), hysteria.md.

function portErrors(config: SingBoxConfig, channel: SingBoxChannel) {
  return validateConfig(config, channel)
    .filter((d) => d.level === "error" && d.code === "outbound-invalid-server-port")
    .length;
}

const out = (extra: Record<string, unknown>) =>
  ({ outbounds: [{ type: "hysteria2", tag: "h", server: "x", password: "p", up_mbps: 1, down_mbps: 1, tls: { enabled: true, server_name: "e" }, ...extra }] }) as unknown as SingBoxConfig;

describe("C10 — hysteria server_ports port-hopping exemption", () => {
  it("hysteria2 with non-empty server_ports and no server_port → no port error (both channels)", () => {
    expect(portErrors(out({ server_ports: ["2080:3000"] }), "stable")).toBe(0);
    expect(portErrors(out({ server_ports: ["2080:3000"] }), "testing")).toBe(0);
  });

  it("hysteria (v1) with non-empty server_ports and no server_port → no port error", () => {
    const cfg = { outbounds: [{ type: "hysteria", tag: "h", server: "x", up_mbps: 1, down_mbps: 1, auth_str: "a", tls: { enabled: true, server_name: "e" }, server_ports: ["2080:3000"] }] } as unknown as SingBoxConfig;
    expect(portErrors(cfg, "stable")).toBe(0);
  });

  it("server_ports + an out-of-range server_port → still errors", () => {
    expect(portErrors(out({ server_ports: ["2080:3000"], server_port: 70000 }), "stable")).toBeGreaterThan(0);
  });

  it("neither server_port nor server_ports → still errors", () => {
    expect(portErrors(out({}), "stable")).toBeGreaterThan(0);
  });

  it("empty server_ports [] is not an exemption → still errors", () => {
    expect(portErrors(out({ server_ports: [] }), "stable")).toBeGreaterThan(0);
  });

  it("a non-hysteria proxy (socks) with no port still errors", () => {
    const socks = { outbounds: [{ type: "socks", tag: "s", server: "x" }] } as unknown as SingBoxConfig;
    expect(portErrors(socks, "stable")).toBeGreaterThan(0);
  });

  it("a valid scalar server_port still passes", () => {
    expect(portErrors(out({ server_port: 443 }), "stable")).toBe(0);
  });
});
