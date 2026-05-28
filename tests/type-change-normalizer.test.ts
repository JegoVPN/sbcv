import { describe, expect, it } from "vitest";
import { changeEntityType } from "../src/domain/commands";
import type { SingBoxConfig } from "../src/domain/types";

// A4a (type-change-normalizer): changing an entity's type must drop a dial `detour` when the new type
// cannot dial, so the config never carries a detour sing-box would reject (C0-9 outbound, C0-8 dns-server
// detour). The C0-3 rule-action field normalizers, C0-8 dependency creation, the W7 confirm dialog, and
// the W13 kv-blank-row fixes are deferred to A4b/A4c (devlog 2026-05-28).

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}

function outboundDetour(config: SingBoxConfig, tag: string): unknown {
  return (config.outbounds?.find((item) => item.tag === tag) as Record<string, unknown> | undefined)?.detour;
}

function dnsServerDetour(config: SingBoxConfig, tag: string): unknown {
  return (config.dns?.servers?.find((item) => item.tag === tag) as Record<string, unknown> | undefined)?.detour;
}

describe("A4a type-change detour scrub", () => {
  it("drops an outbound dial detour when switching to a non-dialable type", () => {
    for (const nextType of ["block", "dns", "selector", "urltest"]) {
      const config = asConfig({
        outbounds: [
          { type: "socks", tag: "o", server: "1.2.3.4", server_port: 1080, detour: "up" },
          { type: "direct", tag: "up" },
        ],
      });
      const next = changeEntityType(config, { kind: "outbound", tag: "o" }, nextType);
      expect(outboundDetour(next, "o"), `outbound -> ${nextType}`).toBeUndefined();
    }
  });

  it("keeps an outbound dial detour when switching to another dialable type", () => {
    const config = asConfig({
      outbounds: [
        { type: "socks", tag: "o", server: "1.2.3.4", server_port: 1080, detour: "up" },
        { type: "direct", tag: "up" },
      ],
    });
    const next = changeEntityType(config, { kind: "outbound", tag: "o" }, "http");
    expect(outboundDetour(next, "o")).toBe("up");
  });

  it("drops a dns-server dial detour when switching to a non-dialable type", () => {
    for (const nextType of ["hosts", "fakeip", "tailscale", "resolved"]) {
      const config = asConfig({
        dns: { servers: [{ type: "tls", tag: "d", server: "1.1.1.1", detour: "up" }] },
        outbounds: [{ type: "direct", tag: "up" }],
      });
      const next = changeEntityType(config, { kind: "dns-server", tag: "d" }, nextType);
      expect(dnsServerDetour(next, "d"), `dns-server -> ${nextType}`).toBeUndefined();
    }
  });

  it("keeps a dns-server dial detour when switching to another dialable type", () => {
    const config = asConfig({
      dns: { servers: [{ type: "tls", tag: "d", server: "1.1.1.1", detour: "up" }] },
      outbounds: [{ type: "direct", tag: "up" }],
    });
    const next = changeEntityType(config, { kind: "dns-server", tag: "d" }, "https");
    expect(dnsServerDetour(next, "d")).toBe("up");
  });
});
