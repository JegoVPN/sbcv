import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// C9 (4.2 dup-tag): a tag reused across distinct reference namespaces (e.g. an inbound and an outbound
// both "proxy") no longer raises duplicate-tag; only genuine same-namespace collisions are flagged.
// Endpoints share the OUTBOUND namespace (endpoint/index.md). Source: inbound/outbound/endpoint/index.md.

function dupPaths(config: SingBoxConfig) {
  return validateConfig(config, "stable")
    .filter((d) => d.code === "duplicate-tag")
    .map((d) => d.path)
    .sort();
}

describe("C9 — namespaced duplicate-tag", () => {
  it("does not flag a tag reused across namespaces (inbound + outbound 'dup')", () => {
    const config = { inbounds: [{ type: "tun", tag: "dup" }], outbounds: [{ type: "direct", tag: "dup" }] } as unknown as SingBoxConfig;
    expect(dupPaths(config)).toEqual([]);
  });

  it("does not flag inbound + outbound + dns-server all 'proxy'", () => {
    const config = {
      inbounds: [{ type: "tun", tag: "proxy" }],
      outbounds: [{ type: "direct", tag: "proxy" }],
      dns: { servers: [{ type: "local", tag: "proxy" }] },
    } as unknown as SingBoxConfig;
    expect(dupPaths(config)).toEqual([]);
  });

  it("still flags a true same-namespace duplicate (two outbounds 'x')", () => {
    const config = { outbounds: [{ type: "direct", tag: "x" }, { type: "block", tag: "x" }] } as unknown as SingBoxConfig;
    expect(dupPaths(config)).toEqual(["/outbounds/0/tag", "/outbounds/1/tag"]);
  });

  it("flags an outbound + wireguard endpoint collision (shared outbound namespace)", () => {
    const config = {
      outbounds: [{ type: "direct", tag: "wg" }],
      endpoints: [{ type: "wireguard", tag: "wg" }],
    } as unknown as SingBoxConfig;
    expect(dupPaths(config)).toEqual(["/endpoints/0/tag", "/outbounds/0/tag"]);
  });

  it("cross-namespace reuse contributes no error-level duplicate-tag (export not soft-gated by it)", () => {
    const config = { inbounds: [{ type: "tun", tag: "dup" }], outbounds: [{ type: "direct", tag: "dup" }] } as unknown as SingBoxConfig;
    const dupErrors = validateConfig(config, "stable").filter((d) => d.code === "duplicate-tag" && d.level === "error");
    expect(dupErrors).toHaveLength(0);
  });
});
