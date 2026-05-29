import { describe, expect, it } from "vitest";

import { summarizeDiagnostics, validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// C6 (G10): a naive outbound emits a blocking ERROR on sing-box 1.12 (naive is Since 1.13.0), mirroring
// the ccm/ocm gate, so a 1.12 config that the 1.12 binary rejects is no longer reported exportable.
// Source: stable/.../outbound/naive.md ("Since sing-box 1.13.0"); oldstable has no naive.

const naive = {
  outbounds: [{ type: "naive", tag: "n", server: "x", server_port: 443, username: "u", password: "p", tls: { enabled: true, server_name: "e" } }],
} as unknown as SingBoxConfig;

function errorCodes(config: SingBoxConfig, channel: SingBoxChannel, version?: string) {
  return validateConfig(config, channel, version)
    .filter((d) => d.level === "error")
    .map((d) => d.code);
}

describe("C6 — naive outbound 1.13 version gate", () => {
  it("errors on the 1.12 target", () => {
    expect(errorCodes(naive, "stable", "1.12")).toContain("outbound-naive-version");
  });
  it("is clean on 1.13 (stable) and 1.14 (testing)", () => {
    expect(errorCodes(naive, "stable", "1.13")).not.toContain("outbound-naive-version");
    expect(errorCodes(naive, "testing", "1.14")).not.toContain("outbound-naive-version");
  });
  it("targets /outbounds/0/type at error level on 1.12", () => {
    const diag = validateConfig(naive, "stable", "1.12").find((d) => d.code === "outbound-naive-version");
    expect(diag?.level).toBe("error");
    expect(diag?.path).toBe("/outbounds/0/type");
  });
  it("flips summarizeDiagnostics to error on 1.12", () => {
    expect(summarizeDiagnostics(validateConfig(naive, "stable", "1.12"))).toBe("error");
  });
  it("does not flag non-naive outbounds", () => {
    const socks = { outbounds: [{ type: "socks", tag: "s", server: "x", server_port: 1080 }] } as unknown as SingBoxConfig;
    expect(errorCodes(socks, "stable", "1.12")).not.toContain("outbound-naive-version");
  });
});
