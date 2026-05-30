import { describe, expect, it } from "vitest";

import { renameTag } from "../src/domain/commands";
import type { SingBoxConfig } from "../src/domain/types";

// V10-S0 (assessment M3) — renameTag must be namespace-scoped. inbound "foo" and outbound "foo" legally
// coexist (distinct reference namespaces). Renaming the outbound must NOT touch the inbound entity or
// inbound-namespace references, and vice-versa. endpoint shares the outbound reference namespace.

function sharedNameConfig(): SingBoxConfig {
  return {
    inbounds: [{ type: "mixed", tag: "foo", listen: "127.0.0.1", listen_port: 2080 }],
    outbounds: [
      { type: "direct", tag: "foo" },
      { type: "selector", tag: "sel", outbounds: ["foo"] },
    ],
    route: { final: "foo", rules: [{ inbound: ["foo"], outbound: "foo" }] },
  } as unknown as SingBoxConfig;
}

describe("V10-S0 — namespace-scoped renameTag", () => {
  it("renaming an outbound leaves a same-named inbound (and inbound refs) untouched", () => {
    const next = renameTag(sharedNameConfig(), "outbound", "foo", "bar");
    // entity: only the outbound is renamed
    expect(next.outbounds!.find((o) => o.type === "direct")!.tag).toBe("bar");
    expect(next.inbounds![0]!.tag).toBe("foo");
    // outbound-namespace references rewritten
    expect(next.route!.final).toBe("bar");
    expect((next.route!.rules![0] as Record<string, unknown>).outbound).toBe("bar");
    expect((next.outbounds!.find((o) => o.type === "selector") as Record<string, unknown>).outbounds).toEqual(["bar"]);
    // inbound-namespace reference NOT touched
    expect((next.route!.rules![0] as Record<string, unknown>).inbound).toEqual(["foo"]);
  });

  it("renaming an inbound leaves a same-named outbound (and outbound refs) untouched", () => {
    const next = renameTag(sharedNameConfig(), "inbound", "foo", "baz");
    expect(next.inbounds![0]!.tag).toBe("baz");
    expect(next.outbounds!.find((o) => o.type === "direct")!.tag).toBe("foo");
    // inbound-namespace ref rewritten, outbound-namespace refs untouched
    expect((next.route!.rules![0] as Record<string, unknown>).inbound).toEqual(["baz"]);
    expect(next.route!.final).toBe("foo");
    expect((next.route!.rules![0] as Record<string, unknown>).outbound).toBe("foo");
  });

  it("renaming an endpoint rewrites outbound-namespace refs (shared namespace)", () => {
    const config = {
      endpoints: [{ type: "wireguard", tag: "ep" }],
      route: { final: "ep" },
    } as unknown as SingBoxConfig;
    const next = renameTag(config, "endpoint", "ep", "ep2");
    expect(next.endpoints![0]!.tag).toBe("ep2");
    expect(next.route!.final).toBe("ep2");
  });

  it("refuses to rename onto a name already used in the same namespace", () => {
    const config = {
      outbounds: [{ type: "direct", tag: "a" }, { type: "block", tag: "b" }],
    } as unknown as SingBoxConfig;
    // "b" already exists in the outbound namespace → no-op
    expect(renameTag(config, "outbound", "a", "b")).toEqual(config);
  });
});
