import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import { createConfigExport, parseConfigJson } from "../src/domain/serialization";
import type { SingBoxConfig } from "../src/domain/types";

// L4-export-noise (D7): the DOWNLOADED config trims provably-inert noise — empty strings and empty
// arrays, which sing-box treats as absent. It must NOT over-clean: empty objects, false, 0, null, and
// all non-empty values are preserved, and the cleaned config stays sing-box-equivalent (same
// diagnostics). Only createConfigExport (the download) is pruned; the editable live JSON draft is not.

function exportedConfig(config: unknown): SingBoxConfig {
  return parseConfigJson(createConfigExport(config as SingBoxConfig).contents);
}

describe("L4-export-noise — export prunes inert empty noise", () => {
  it("drops empty-string and empty-array fields", () => {
    const out = exportedConfig({
      outbounds: [{ type: "direct", tag: "d", detour: "", network_type: [], domain_strategy: "" }],
    });
    const ob = out.outbounds?.[0] as Record<string, unknown>;
    expect(ob).not.toHaveProperty("detour");
    expect(ob).not.toHaveProperty("network_type");
    expect(ob).not.toHaveProperty("domain_strategy");
    expect(ob.type).toBe("direct");
    expect(ob.tag).toBe("d");
  });

  it("preserves meaningful empties and falsy values (0, false, empty object)", () => {
    const out = exportedConfig({
      inbounds: [{ type: "mixed", tag: "in", listen: "::", listen_port: 0, sniff: false }],
      experimental: { clash_api: {} },
    });
    const inb = out.inbounds?.[0] as Record<string, unknown>;
    expect(inb.listen_port).toBe(0);
    expect(inb.sniff).toBe(false);
    expect(inb.listen).toBe("::");
    // empty object kept (clash_api:{} enables Clash with defaults)
    expect((out.experimental as Record<string, unknown>).clash_api).toEqual({});
  });

  it("prunes nested objects and array elements' objects (deep)", () => {
    const out = exportedConfig({
      outbounds: [{ type: "vless", tag: "v", server: "e.x", server_port: 443, uuid: "u", flow: "", tls: { enabled: true, server_name: "" } }],
    });
    const ob = out.outbounds?.[0] as Record<string, unknown>;
    expect(ob).not.toHaveProperty("flow");
    expect(ob.tls).toEqual({ enabled: true });
  });

  it("does NOT drop empty-string elements inside an array (only object keys)", () => {
    const out = exportedConfig({
      route: { rules: [{ domain_suffix: ["", "example.com"], outbound: "d" }], final: "d" },
      outbounds: [{ type: "direct", tag: "d" }],
    });
    const rule = out.route?.rules?.[0] as Record<string, unknown>;
    expect(rule.domain_suffix).toEqual(["", "example.com"]);
  });

  it("D7 — pruning is semantics-preserving (diagnostics unchanged after export round-trip)", () => {
    const config = {
      inbounds: [{ type: "mixed", tag: "in", listen: "127.0.0.1", listen_port: 2080, users: [] }],
      outbounds: [
        { type: "shadowsocks", tag: "ss", server: "e.x", server_port: 8388, method: "aes-128-gcm", password: "p", plugin: "" },
        { type: "direct", tag: "d", detour: "" },
      ],
      route: { rules: [{ domain_suffix: ["x"], outbound: "ss" }], final: "d", rule_set: [] },
    } as unknown as SingBoxConfig;
    const before = validateConfig(config, "stable").map((d) => d.code).sort();
    const after = validateConfig(exportedConfig(config), "stable").map((d) => d.code).sort();
    expect(after).toEqual(before);
  });

  it("does not mutate the input config", () => {
    const config = { outbounds: [{ type: "direct", tag: "d", detour: "" }] } as unknown as SingBoxConfig;
    createConfigExport(config);
    expect((config.outbounds?.[0] as Record<string, unknown>).detour).toBe("");
  });
});
