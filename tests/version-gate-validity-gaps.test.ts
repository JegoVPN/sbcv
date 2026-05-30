import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// V4-S4 — validity-linter gaps from re-assessment #2, each verified against the real sing-box binary:
// G2 any legacy `address` DNS server (bare IP / local / fakeip / scheme://) is removed in 1.14;
// G3 dns.optimistic/timeout, route.default_http_client/find_neighbor, rule_set.http_client are 1.14-only;
// G4 dns-rule respond/evaluate are 1.14-only. All hard-block export on the incompatible target.

function errorCodes(config: SingBoxConfig, channel: "stable" | "testing", version?: string) {
  return new Set(
    validateConfig(config, channel, version).filter((d) => d.level === "error").map((d) => d.code),
  );
}

describe("V4-S4 — G2 legacy DNS address form", () => {
  const legacy = (address: string): SingBoxConfig =>
    ({ dns: { servers: [{ tag: "d", address }] } }) as unknown as SingBoxConfig;

  it("errors a bare-IP / local / fakeip legacy address on a 1.14 target (was missed by the scheme:// regex)", () => {
    for (const addr of ["8.8.8.8", "local", "fakeip", "tls://1.1.1.1"]) {
      expect(errorCodes(legacy(addr), "testing", "1.14").has("dns-server-legacy-address-deprecated")).toBe(true);
    }
  });
  it("also errors on 1.13, which rejects the legacy form by default (FATAL without ENABLE_DEPRECATED_LEGACY_DNS_SERVERS)", () => {
    // Binary-verified (PR #223 review): sing-box-stable(1.13) FATALs on a bare-IP legacy DNS server by
    // default; only 1.12 still accepts it. The default stable target IS 1.13, so this must hard-block.
    expect(errorCodes(legacy("8.8.8.8"), "stable", "1.13").has("dns-server-legacy-address-deprecated")).toBe(true);
  });
  it("is only a warning (not error) on the legacy 1.12 target, which still accepts the form", () => {
    const diags = validateConfig(legacy("8.8.8.8"), "stable", "1.12").filter(
      (d) => d.code === "dns-server-legacy-address-deprecated",
    );
    expect(diags).toHaveLength(1);
    expect(diags[0]?.level).toBe("warning");
  });
});

describe("V4-S4 — G3 testing-only fields error on stable", () => {
  it("dns.optimistic / dns.timeout", () => {
    const codes = errorCodes({ dns: { optimistic: true, timeout: "5s" } } as unknown as SingBoxConfig, "stable");
    expect(codes.has("dns-optimistic-testing-only")).toBe(true);
    expect(codes.has("dns-timeout-testing-only")).toBe(true);
  });
  it("route.default_http_client / find_neighbor / dhcp_lease_files / rule_set.http_client", () => {
    const codes = errorCodes(
      {
        route: {
          default_http_client: "hc",
          find_neighbor: true,
          dhcp_lease_files: ["/var/lib/misc/dnsmasq.leases"],
          rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://x/y.srs", http_client: "hc" }],
        },
        http_clients: [{ tag: "hc" }],
      } as unknown as SingBoxConfig,
      "stable",
    );
    expect(codes.has("route-default-http-client-testing-only")).toBe(true);
    expect(codes.has("route-find-neighbor-testing-only")).toBe(true);
    expect(codes.has("route-dhcp-lease-files-testing-only")).toBe(true);
    expect(codes.has("rule-set-http-client-testing-only")).toBe(true);
  });
});

describe("V4-S4 — G4 dns-rule respond/evaluate are 1.14-only", () => {
  it("errors action respond / evaluate on a pre-1.14 target", () => {
    for (const action of ["respond", "evaluate"]) {
      const codes = errorCodes({ dns: { rules: [{ action }] } } as unknown as SingBoxConfig, "stable", "1.13");
      expect(codes.has("dns-rule-action-1-14-only")).toBe(true);
    }
  });
  it("does not flag them on a 1.14 target", () => {
    const codes = errorCodes({ dns: { rules: [{ action: "evaluate" }] } } as unknown as SingBoxConfig, "testing", "1.14");
    expect(codes.has("dns-rule-action-1-14-only")).toBe(false);
  });
});
