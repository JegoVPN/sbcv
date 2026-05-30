import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// C5 (G9 + V4-S4/G2): a legacy DNS-server `address` and a top-level dns.fakeip block are ERRORS on the
// testing (1.14, removed) target AND on the default stable (1.13) target — binary-verified, sing-box 1.13
// `check` rejects both by default (legacy address needs ENABLE_DEPRECATED_LEGACY_DNS_SERVERS; fakeip ERRORs
// out). They stay deprecation WARNINGS only on the legacy 1.12 target, which still accepts them.
// Source: real sing-box-stable(1.13)/1.12 binaries; testing/.../legacy.md ("Removed in sing-box 1.14.0").

function level(config: SingBoxConfig, code: string, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).find((d) => d.code === code)?.level;
}

function emissions(config: SingBoxConfig, code: string, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version).filter((d) => d.code === code);
}

const legacyAddress = {
  dns: { servers: [{ tag: "legacy", address: "tcp://1.1.1.1" }] },
} as unknown as SingBoxConfig;

const legacyFakeip = {
  dns: { fakeip: { enabled: true, inet4_range: "198.18.0.0/15" } },
} as unknown as SingBoxConfig;

describe("C5 — legacy DNS address version gate", () => {
  it("is an error on the testing (1.14) target", () => {
    expect(level(legacyAddress, "dns-server-legacy-address-deprecated", "testing")).toBe("error");
  });
  it("is an error on the default stable (1.13) target, which rejects it by default", () => {
    expect(level(legacyAddress, "dns-server-legacy-address-deprecated", "stable")).toBe("error");
  });
  it("stays a warning only on the legacy 1.12 target", () => {
    expect(level(legacyAddress, "dns-server-legacy-address-deprecated", "stable", "1.12")).toBe("warning");
  });
  it("emits exactly once and the 1.14 message says removed in 1.14.0", () => {
    const errs = emissions(legacyAddress, "dns-server-legacy-address-deprecated", "testing");
    expect(errs).toHaveLength(1);
    expect(errs[0]!.message).toMatch(/removed in sing-box 1\.14\.0/i);
  });
});

describe("C5 — top-level dns.fakeip version gate", () => {
  it("is an error on the testing (1.14) target", () => {
    expect(level(legacyFakeip, "legacy-fakeip-deprecated", "testing")).toBe("error");
  });
  it("is an error on the default stable (1.13) target, which rejects it by default", () => {
    expect(level(legacyFakeip, "legacy-fakeip-deprecated", "stable")).toBe("error");
  });
  it("stays a warning only on the legacy 1.12 target", () => {
    expect(level(legacyFakeip, "legacy-fakeip-deprecated", "stable", "1.12")).toBe("warning");
  });
  it("emits exactly once and the 1.14 message says removed in 1.14.0", () => {
    const errs = emissions(legacyFakeip, "legacy-fakeip-deprecated", "testing");
    expect(errs).toHaveLength(1);
    expect(errs[0]!.message).toMatch(/removed in sing-box 1\.14\.0/i);
  });
});
