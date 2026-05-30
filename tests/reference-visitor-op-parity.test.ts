import { describe, expect, it } from "vitest";

import {
  removeRegisteredTagReferences,
  replaceRegisteredTagReferences,
} from "../src/domain/referenceRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// V10 / S6 — the rename and delete cascades now share ONE traversal per reference kind, parameterized by
// a RefOp. This guards that collapse against op-divergence on the trickiest non-scalar shapes:
// resolver-object ({server: tag}), service.servers map (path→tag), http_client inline detour ({detour}),
// and the experimental stats string-arrays. Each shape is exercised by BOTH replace and remove.

function fixture(): SingBoxConfig {
  return JSON.parse(
    JSON.stringify({
      outbounds: [
        { type: "direct", tag: "out-a" },
        { type: "selector", tag: "sel", outbounds: ["out-a", "out-b"], default: "out-a" },
        // domain_resolver as a structured object → resolver-object shape pointing at a dns-server
        { type: "direct", tag: "out-res", domain_resolver: { server: "dns-a" } },
      ],
      dns: { servers: [{ type: "udp", tag: "dns-a", server: "1.1.1.1" }] },
      services: [
        // service.servers map (path → inbound tag)
        { type: "resolved", tag: "svc", servers: { "/a": "in-a", "/b": "in-a" } },
      ],
      inbounds: [{ type: "mixed", tag: "in-a" }],
      route: {
        // inline http_client object carrying its own outbound detour
        default_http_client: { detour: "out-a" },
        rules: [{ outbound: "out-a" }],
      },
      experimental: { v2ray_api: { stats: { outbounds: ["out-a", "out-b"], inbounds: ["in-a"] } } },
    }),
  );
}

describe("S6 — reference visitor op parity across non-scalar shapes", () => {
  it("rename rewrites resolver-object / servers-map / http_client-detour / stats-array", () => {
    const config = fixture();
    replaceRegisteredTagReferences(config, "out-a", "OUT");
    replaceRegisteredTagReferences(config, "dns-a", "DNS");
    replaceRegisteredTagReferences(config, "in-a", "IN");

    const sel = config.outbounds!.find((o) => o.tag === "sel") as Record<string, unknown>;
    expect(sel.outbounds).toEqual(["OUT", "out-b"]);
    expect(sel.default).toBe("OUT");
    const res = config.outbounds!.find((o) => o.tag === "out-res") as Record<string, unknown>;
    expect(res.domain_resolver).toEqual({ server: "DNS" });
    expect((config.services![0] as Record<string, unknown>).servers).toEqual({ "/a": "IN", "/b": "IN" });
    expect(config.route!.default_http_client).toEqual({ detour: "OUT" });
    const stats = (config.experimental as Record<string, any>).v2ray_api.stats;
    expect(stats.outbounds).toEqual(["OUT", "out-b"]);
    expect(stats.inbounds).toEqual(["IN"]);
  });

  it("delete drops the same references through the same traversal", () => {
    const config = fixture();
    removeRegisteredTagReferences(config, "outbound", "out-a");
    removeRegisteredTagReferences(config, "dns-server", "dns-a");
    removeRegisteredTagReferences(config, "inbound", "in-a");

    const sel = config.outbounds!.find((o) => o.tag === "sel") as Record<string, unknown>;
    expect(sel.outbounds).toEqual(["out-b"]);
    expect(sel.default).toBeUndefined();
    const res = config.outbounds!.find((o) => o.tag === "out-res") as Record<string, unknown>;
    expect(res.domain_resolver).toBeUndefined();
    // both map entries pointed at the deleted inbound → map empties out
    expect((config.services![0] as Record<string, unknown>).servers).toEqual({});
    // inline http_client object survives but its detour is scrubbed
    expect(config.route!.default_http_client).toEqual({ detour: undefined });
    const stats = (config.experimental as Record<string, any>).v2ray_api.stats;
    expect(stats.outbounds).toEqual(["out-b"]);
    expect(stats.inbounds).toEqual([]);
  });
});
