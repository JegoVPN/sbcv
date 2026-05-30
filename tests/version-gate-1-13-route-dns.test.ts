import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// C7-C (G11): 1.13-added route-rule + local-DNS features warn "needs 1.13" on a 1.12 target; 1.13/1.14
// clean; default-off silent. Source: route/rule_action.md (bypass Since 1.13.0), route/rule.md
// (interface_address trio Since 1.13.0), dns/server/local.md (prefer_go Since 1.13.0).

function codes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).map((d) => d.code);
}

describe("C7-C — 1.13 route/DNS field gates", () => {
  it("route-rule action 'bypass' warns on 1.12, clean on 1.13/1.14", () => {
    const cfg = { route: { rules: [{ action: "bypass", outbound: "" }] } } as unknown as SingBoxConfig;
    expect(codes(cfg, "stable", "1.12")).toContain("route-rule-bypass-1-13-only");
    expect(codes(cfg, "stable", "1.13")).not.toContain("route-rule-bypass-1-13-only");
    expect(codes(cfg, "testing", "1.14")).not.toContain("route-rule-bypass-1-13-only");
  });

  it("route-rule interface_address trio warns on 1.12", () => {
    const cfg = { route: { rules: [{ interface_address: { en0: ["1.2.3.4/32"] } }] } } as unknown as SingBoxConfig;
    expect(codes(cfg, "stable", "1.12")).toContain("route-rule-interface-address-1-13-only");
    expect(codes(cfg, "stable", "1.13")).not.toContain("route-rule-interface-address-1-13-only");
  });

  it("local DNS server prefer_go warns on 1.12, clean on 1.13", () => {
    const cfg = { dns: { servers: [{ type: "local", tag: "l", prefer_go: true }] } } as unknown as SingBoxConfig;
    expect(codes(cfg, "stable", "1.12")).toContain("dns-local-prefer-go-1-13-only");
    expect(codes(cfg, "stable", "1.13")).not.toContain("dns-local-prefer-go-1-13-only");
  });

  it("default-off shapes produce nothing on 1.12", () => {
    const cfg = {
      route: { rules: [{ action: "route", outbound: "d" }] },
      dns: { servers: [{ type: "local", tag: "l" }] },
      outbounds: [{ type: "direct", tag: "d" }],
    } as unknown as SingBoxConfig;
    const c = codes(cfg, "stable", "1.12");
    expect(c).not.toContain("route-rule-bypass-1-13-only");
    expect(c).not.toContain("route-rule-interface-address-1-13-only");
    expect(c).not.toContain("dns-local-prefer-go-1-13-only");
  });

  it("the gates are export-blocking errors (V4-S3 / M4: sing-box-1.12 rejects the 1.13 action/fields)", () => {
    const cfg = { route: { rules: [{ action: "bypass" }] } } as unknown as SingBoxConfig;
    expect(validateConfig(cfg, "stable", "1.12").find((d) => d.code === "route-rule-bypass-1-13-only")?.level).toBe("error");
  });
});
