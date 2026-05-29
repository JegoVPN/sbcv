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

  it("flags platform-locked inbounds (tproxy / redirect / tun)", () => {
    expect(nodeBadge("inbound", "tproxy")?.tone).toBe("platform");
    expect(nodeBadge("inbound", "redirect")?.tone).toBe("platform");
    expect(nodeBadge("inbound", "tun")?.tone).toBe("platform");
  });

  it("returns null for ordinary, unconstrained nodes", () => {
    expect(nodeBadge("outbound", "shadowsocks")).toBeNull();
    expect(nodeBadge("inbound", "mixed")).toBeNull();
    expect(nodeBadge("dns-server", "tls")).toBeNull();
    expect(nodeBadge("route", "route")).toBeNull();
  });
});
