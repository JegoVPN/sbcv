import { describe, expect, it } from "vitest";
import { removeRegisteredTagReferences, replaceRegisteredTagReferences } from "../src/domain/referenceRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// A0 / W1 guardrail (Pass-2 T11; Codex C1-2/4/11/16/17/20/21).
// The canonical reference registry (src/domain/referenceRegistry.ts) is missing five upstream-real tag
// references, re-verified against HEAD in docs/ui-reviews-pass2/_RELATIONSHIPS.md (rows 5/23/28/29/30).
// Renaming/deleting the referenced entity leaves a dangling tag. Each `it.fails` asserts the post-fix
// contract (the dangling ref is scrubbed): it reports green while the bug reproduces and flips red when
// A6 (reference-and-detour-guards) completes the registry — convert `it.fails` -> `it` at that point.

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}

describe("referenceRegistry completeness (W1 -> A6)", () => {
  it("sanity: a covered reference (dns.rules[].server) is scrubbed on delete today", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "dns1" }], rules: [{ server: "dns1" }] },
    });
    removeRegisteredTagReferences(config, "dns-server", "dns1");
    expect(config.dns?.rules?.[0]?.server).toBeUndefined();
  });

  it.fails("scrubs route-rule resolve.server when its dns-server is deleted (row 5)", () => {
    const config = asConfig({
      route: { rules: [{ action: "resolve", server: "dns1" }] },
      dns: { servers: [{ type: "local", tag: "dns1" }] },
    });
    removeRegisteredTagReferences(config, "dns-server", "dns1");
    expect((config.route?.rules?.[0] as Record<string, unknown>).server).toBeUndefined();
  });

  it.fails("scrubs inbound listen detour when its target inbound is deleted (row 28)", () => {
    const config = asConfig({
      inbounds: [
        { type: "socks", tag: "A" },
        { type: "socks", tag: "B", detour: "A" },
      ],
    });
    removeRegisteredTagReferences(config, "inbound", "A");
    expect((config.inbounds?.[1] as Record<string, unknown>).detour).toBeUndefined();
  });

  it.fails("scrubs tun route_address_set when its rule-set is deleted (row 30)", () => {
    const config = asConfig({
      inbounds: [{ type: "tun", tag: "tun-in", route_address_set: ["rs1"] }],
      route: { rule_set: [{ type: "remote", tag: "rs1", url: "https://example.com/x.srs", format: "binary" }] },
    });
    removeRegisteredTagReferences(config, "rule-set", "rs1");
    const set = (config.inbounds?.[0] as Record<string, unknown>).route_address_set as string[] | undefined;
    expect(set ?? []).not.toContain("rs1");
  });

  it.fails("scrubs shadowtls handshake.detour when its outbound is deleted (row 29)", () => {
    const config = asConfig({
      inbounds: [{ type: "shadowtls", tag: "st", handshake: { server: "h", server_port: 443, detour: "out1" } }],
      outbounds: [{ type: "direct", tag: "out1" }],
    });
    removeRegisteredTagReferences(config, "outbound", "out1");
    const handshake = (config.inbounds?.[0] as Record<string, unknown>).handshake as Record<string, unknown>;
    expect(handshake.detour).toBeUndefined();
  });

  it.fails("scrubs derp mesh_with[].detour when its outbound is deleted (row 23)", () => {
    const config = asConfig({
      services: [{ type: "derp", tag: "derp", mesh_with: [{ server: "m", detour: "out1" }] }],
      outbounds: [{ type: "direct", tag: "out1" }],
    });
    removeRegisteredTagReferences(config, "outbound", "out1");
    const mesh = (config.services?.[0] as Record<string, unknown>).mesh_with as Array<Record<string, unknown>>;
    expect(mesh[0]?.detour).toBeUndefined();
  });
});

// Rename uses the separate replaceRegisteredTagReferences path, so a delete-only A6 fix could still leave
// rename broken. These mirror the delete cases for the same five missing references.
describe("referenceRegistry completeness on rename (W1 -> A6)", () => {
  it("sanity: a covered reference (dns.rules[].server) is rewritten on rename today", () => {
    const config = asConfig({
      dns: { servers: [{ type: "local", tag: "dns1" }], rules: [{ server: "dns1" }] },
    });
    replaceRegisteredTagReferences(config, "dns1", "dns2");
    expect(config.dns?.rules?.[0]?.server).toBe("dns2");
  });

  it.fails("rewrites route-rule resolve.server when its dns-server is renamed (row 5)", () => {
    const config = asConfig({
      route: { rules: [{ action: "resolve", server: "dns1" }] },
      dns: { servers: [{ type: "local", tag: "dns1" }] },
    });
    replaceRegisteredTagReferences(config, "dns1", "dns2");
    expect((config.route?.rules?.[0] as Record<string, unknown>).server).toBe("dns2");
  });

  it.fails("rewrites inbound listen detour when its target inbound is renamed (row 28)", () => {
    const config = asConfig({
      inbounds: [
        { type: "socks", tag: "A" },
        { type: "socks", tag: "B", detour: "A" },
      ],
    });
    replaceRegisteredTagReferences(config, "A", "A2");
    expect((config.inbounds?.[1] as Record<string, unknown>).detour).toBe("A2");
  });

  it.fails("rewrites tun route_address_set when its rule-set is renamed (row 30)", () => {
    const config = asConfig({
      inbounds: [{ type: "tun", tag: "tun-in", route_address_set: ["rs1"] }],
      route: { rule_set: [{ type: "remote", tag: "rs1", url: "https://example.com/x.srs", format: "binary" }] },
    });
    replaceRegisteredTagReferences(config, "rs1", "rs2");
    const set = (config.inbounds?.[0] as Record<string, unknown>).route_address_set as string[] | undefined;
    expect(set ?? []).toContain("rs2");
  });

  it.fails("rewrites shadowtls handshake.detour when its outbound is renamed (row 29)", () => {
    const config = asConfig({
      inbounds: [{ type: "shadowtls", tag: "st", handshake: { server: "h", server_port: 443, detour: "out1" } }],
      outbounds: [{ type: "direct", tag: "out1" }],
    });
    replaceRegisteredTagReferences(config, "out1", "out2");
    const handshake = (config.inbounds?.[0] as Record<string, unknown>).handshake as Record<string, unknown>;
    expect(handshake.detour).toBe("out2");
  });

  it.fails("rewrites derp mesh_with[].detour when its outbound is renamed (row 23)", () => {
    const config = asConfig({
      services: [{ type: "derp", tag: "derp", mesh_with: [{ server: "m", detour: "out1" }] }],
      outbounds: [{ type: "direct", tag: "out1" }],
    });
    replaceRegisteredTagReferences(config, "out1", "out2");
    const mesh = (config.services?.[0] as Record<string, unknown>).mesh_with as Array<Record<string, unknown>>;
    expect(mesh[0]?.detour).toBe("out2");
  });
});
