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
  it("is only a warning (not error) on 1.13/1.12 which still accept the legacy form", () => {
    expect(errorCodes(legacy("8.8.8.8"), "stable", "1.13").has("dns-server-legacy-address-deprecated")).toBe(false);
  });
});

describe("V4-S4 — G3 testing-only fields error on stable", () => {
  it("dns.optimistic / dns.timeout", () => {
    const codes = errorCodes({ dns: { optimistic: true, timeout: "5s" } } as unknown as SingBoxConfig, "stable");
    expect(codes.has("dns-optimistic-testing-only")).toBe(true);
    expect(codes.has("dns-timeout-testing-only")).toBe(true);
  });
  it("route.default_http_client / find_neighbor / rule_set.http_client", () => {
    const codes = errorCodes(
      {
        route: {
          default_http_client: "hc",
          find_neighbor: true,
          rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://x/y.srs", http_client: "hc" }],
        },
        http_clients: [{ tag: "hc" }],
      } as unknown as SingBoxConfig,
      "stable",
    );
    expect(codes.has("route-default-http-client-testing-only")).toBe(true);
    expect(codes.has("route-find-neighbor-testing-only")).toBe(true);
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
