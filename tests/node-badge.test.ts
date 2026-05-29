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

describe("version-gated badge (target-aware)", () => {
  it("flags a node type that needs a newer sing-box than the target", () => {
    expect(nodeBadge("outbound", "naive", "1.12")?.tone).toBe("version");
    expect(nodeBadge("outbound", "naive", "1.12")?.label).toBe("needs 1.13");
    expect(nodeBadge("service", "ccm", "1.12")?.tone).toBe("version");
    expect(nodeBadge("endpoint", "tailscale", "1.11")?.label).toBe("needs 1.12");
    // 1.14 testing-only types badge "needs 1.14" on the default 1.13 target.
    expect(nodeBadge("inbound", "cloudflared", "1.13")?.label).toBe("needs 1.14");
    expect(nodeBadge("service", "hysteria-realm", "1.13")?.tone).toBe("version");
  });

  it("does not flag the naive INBOUND (it predates 1.13 — only the outbound is new)", () => {
    expect(nodeBadge("inbound", "naive", "1.12")).toBeNull();
  });

  it("shows nothing once the target is new enough", () => {
    expect(nodeBadge("outbound", "naive", "1.13")).toBeNull();
    expect(nodeBadge("inbound", "anytls", "1.12")).toBeNull(); // anytls needs 1.12, target 1.12 → ok
    expect(nodeBadge("endpoint", "tailscale", "1.13")).toBeNull();
    expect(nodeBadge("inbound", "cloudflared", "1.14")).toBeNull();
  });

  it("skips the version check with no target, but type-based badges still apply", () => {
    expect(nodeBadge("outbound", "naive")).toBeNull();
    expect(nodeBadge("outbound", "block", "1.13")?.tone).toBe("deprecated");
    expect(nodeBadge("inbound", "tproxy", "1.13")?.tone).toBe("platform");
  });
});
