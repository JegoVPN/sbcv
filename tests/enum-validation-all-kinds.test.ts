import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// W2 (re-run#3 M2): enum/type scalar validation previously fired only for inbound/outbound rows; the
// dns-server / rule-set rows had no SchemaFieldMeta `fields[]`, so a wrong-typed/invalid-enum scalar on
// those kinds passed the lint but the binary rejects it. High-value fields[] added (binary-verified):
// dns-server remote types server_port:number, legacy strategy enum, rule-set format enum.

const errs = (config: SingBoxConfig) =>
  validateConfig(config, "stable").filter((d) => d.level === "error");

describe("W2 — enum/type validation for dns-server + rule-set", () => {
  it("errors a string server_port on a tls dns-server (binary rejects: cannot unmarshal string)", () => {
    const out = errs({ dns: { servers: [{ type: "tls", tag: "d", server: "1.1.1.1", server_port: "853" }] } } as unknown as SingBoxConfig);
    expect(out.some((d) => d.code === "type-invalid" && d.path.endsWith("/server_port"))).toBe(true);
    // a numeric server_port is clean
    expect(errs({ dns: { servers: [{ type: "tls", tag: "d", server: "1.1.1.1", server_port: 853 }] } } as unknown as SingBoxConfig)
      .some((d) => d.path.endsWith("/server_port"))).toBe(false);
  });

  it("errors an invalid rule-set format and accepts source/binary", () => {
    const bad = errs({ route: { rule_set: [{ type: "local", tag: "r", format: "bogus", path: "./r.json" }] } } as unknown as SingBoxConfig);
    expect(bad.some((d) => d.code === "enum-invalid" && d.path.endsWith("/format"))).toBe(true);
    for (const format of ["source", "binary"]) {
      expect(errs({ route: { rule_set: [{ type: "remote", tag: "r", format, url: "https://x/y.srs" }] } } as unknown as SingBoxConfig)
        .some((d) => d.path.endsWith("/format"))).toBe(false);
    }
  });

  it("errors an invalid legacy DNS strategy (1.12 target)", () => {
    const bad = validateConfig(
      { dns: { servers: [{ tag: "d", address: "8.8.8.8", strategy: "bogus" }] } } as unknown as SingBoxConfig,
      "stable",
      "1.12",
    ).filter((d) => d.level === "error");
    expect(bad.some((d) => d.code === "enum-invalid" && d.path.endsWith("/strategy"))).toBe(true);
  });
});
