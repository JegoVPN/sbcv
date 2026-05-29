import { describe, expect, it } from "vitest";
import { nodeBadge } from "../src/canvas/nodeLabels";

// A titlebar badge for orthogonal status the valid/warning/error glyph can't express: whole-type
// deprecations and platform-locked node types (grounded in the upstream config docs).
describe("node semantic badge", () => {
  it("flags whole-type-deprecated outbounds (block / dns / wireguard)", () => {
    for (const type of ["block", "dns", "wireguard"]) {
      const badge = nodeBadge("outbound", type);
      expect(badge?.tone, type).toBe("deprecated");
      expect(badge?.label, type).toBe("deprecated");
    }
  });

  it("flags the hard platform-locked inbounds (tproxy / redirect)", () => {
    expect(nodeBadge("inbound", "tproxy")?.tone).toBe("platform");
    expect(nodeBadge("inbound", "redirect")?.tone).toBe("platform");
  });

  it("returns null for ordinary or broadly-supported nodes", () => {
    expect(nodeBadge("outbound", "shadowsocks")).toBeNull();
    expect(nodeBadge("inbound", "mixed")).toBeNull();
    // tun is intentionally not badged — it's also the primary inbound on the mobile apps.
    expect(nodeBadge("inbound", "tun")).toBeNull();
    expect(nodeBadge("dns-server", "tls")).toBeNull();
    expect(nodeBadge("route", "route")).toBeNull();
  });
});
