import { describe, expect, it } from "vitest";
import { deleteEntity, renameTag } from "../src/domain/commands";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A7a guardrail (endpoint-outbound-half, domain). An endpoint is "a protocol with inbound and outbound
// behavior" (endpoint/index.md), so its tag shares sing-box's outbound namespace and is a valid
// route.final / route-rule outbound / selector|urltest member. Rename must cascade and delete must scrub
// those refs, and diagnostics must treat an endpoint as a valid outbound target. Both WireGuard AND
// Tailscale endpoints can be "used as an outbound" (migration.md:221-223) — the pass-2 audit's claim that
// Tailscale is "not a route target" (endpoint-tailscale) is an upstream-contradicted over-restriction.
// (Audit: endpoint-wireguard P0-2 / _SUMMARY T14.)

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}

function configWithWireguardAsOutboundTarget(): SingBoxConfig {
  return asConfig({
    inbounds: [{ type: "socks", tag: "in" }],
    outbounds: [
      { type: "direct", tag: "backup" },
      { type: "selector", tag: "auto", outbounds: ["wg", "backup"], default: "wg" },
    ],
    endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [] }],
    route: { final: "wg", rules: [{ inbound: ["in"], outbound: "wg" }] },
  });
}

describe("endpoint outbound-half — WireGuard endpoint in the outbound namespace (A7a)", () => {
  it("rename cascades a WireGuard endpoint tag through route/selector refs", () => {
    const renamed = renameTag(configWithWireguardAsOutboundTarget(), "wg", "wg2");
    expect(renamed.endpoints?.[0]?.tag).toBe("wg2");
    expect(renamed.route?.final).toBe("wg2");
    expect(renamed.route?.rules?.[0]?.outbound).toBe("wg2");
    expect(renamed.outbounds?.find((o) => o.tag === "auto")?.outbounds).toEqual(["wg2", "backup"]);
    expect(renamed.outbounds?.find((o) => o.tag === "auto")?.default).toBe("wg2");
  });

  it("delete scrubs every outbound-target ref to a WireGuard endpoint", () => {
    const deleted = deleteEntity(configWithWireguardAsOutboundTarget(), { kind: "endpoint", tag: "wg" });
    expect(deleted.endpoints ?? []).toHaveLength(0);
    expect(deleted.route?.final).toBeUndefined();
    expect(deleted.route?.rules?.[0]?.outbound).toBeUndefined();
    expect(deleted.outbounds?.find((o) => o.tag === "auto")?.outbounds).toEqual(["backup"]);
    expect(deleted.outbounds?.find((o) => o.tag === "auto")?.default).toBeUndefined();
  });

  it("diagnostics accept a WireGuard endpoint as a valid outbound target", () => {
    const codes = validateConfig(configWithWireguardAsOutboundTarget(), "testing").map((d) => d.code);
    expect(codes).not.toContain("missing-route-final");
    expect(codes).not.toContain("missing-rule-outbound");
    expect(codes).not.toContain("missing-outbound-candidate");
  });

  it("diagnostics accept a Tailscale endpoint used as a route outbound (used as an outbound, migration.md)", () => {
    const config = asConfig({
      endpoints: [{ type: "tailscale", tag: "ts-ep" }],
      route: { final: "ts-ep" },
    });
    const codes = validateConfig(config, "testing").map((d) => d.code);
    expect(codes).not.toContain("missing-route-final");
  });
});
