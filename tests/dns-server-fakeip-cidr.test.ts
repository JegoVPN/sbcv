import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A20 (dns-server / W28): the fakeip DNS server wrote inet4_range/inet6_range as raw strings and
// diagnostics only checked presence, never shape — a malformed CIDR (or an IPv6 in the v4 field) was
// accepted and exported, and sing-box rejects it at start with no in-UI signal.

function errorCodes(config: SingBoxConfig) {
  return validateConfig(config, "testing").filter((d) => d.level === "error").map((d) => d.code);
}
function fakeip(ranges: Record<string, unknown>): SingBoxConfig {
  return { dns: { servers: [{ type: "fakeip", tag: "fk", ...ranges }] } } as unknown as SingBoxConfig;
}

describe("A20-dns — fakeip CIDR-shape validation", () => {
  it("accepts valid IPv4/IPv6 CIDR ranges", () => {
    expect(errorCodes(fakeip({ inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" })))
      .not.toContain("dns-server-fakeip-range-invalid");
  });

  it("flags a malformed IPv4 range", () => {
    expect(errorCodes(fakeip({ inet4_range: "198.18.0/40" }))).toContain("dns-server-fakeip-range-invalid");
  });

  it("flags an IPv6 value in the IPv4 range field (and vice versa)", () => {
    expect(errorCodes(fakeip({ inet4_range: "fc00::/18" }))).toContain("dns-server-fakeip-range-invalid");
    expect(errorCodes(fakeip({ inet6_range: "198.18.0.0/15" }))).toContain("dns-server-fakeip-range-invalid");
  });

  it("flags an out-of-range prefix or octet", () => {
    expect(errorCodes(fakeip({ inet4_range: "198.18.0.0/33" }))).toContain("dns-server-fakeip-range-invalid");
    expect(errorCodes(fakeip({ inet4_range: "300.18.0.0/15" }))).toContain("dns-server-fakeip-range-invalid");
    expect(errorCodes(fakeip({ inet6_range: "fc00::/200" }))).toContain("dns-server-fakeip-range-invalid");
  });

  it("does not double-report when the range is simply missing (that is range-missing, not invalid)", () => {
    const codes = errorCodes(fakeip({}));
    expect(codes).toContain("dns-server-fakeip-range-missing");
    expect(codes).not.toContain("dns-server-fakeip-range-invalid");
  });
});
