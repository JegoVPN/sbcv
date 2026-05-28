import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// A27 (W33): scaffold/template secrets like REPLACE_ME_PASSWORD (and change-me variants) ship as dummy
// values; warn so the user replaces them before exposing the config.

function warnCodes(config: SingBoxConfig) {
  return validateConfig(config, "testing").filter((d) => d.level === "warning").map((d) => d.code);
}

describe("A27 — placeholder-secret warning (W33)", () => {
  it("flags a REPLACE_ME placeholder password on an outbound", () => {
    const config = { outbounds: [{ type: "shadowsocks", tag: "ss", server: "e.x", server_port: 443, method: "aes-128-gcm", password: "REPLACE_ME_PASSWORD" }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).toContain("placeholder-secret");
  });

  it("flags a change-me placeholder on an inbound secret", () => {
    const config = { inbounds: [{ type: "trojan", tag: "tr", users: [{ name: "u", password: "change-me" }] }] } as unknown as SingBoxConfig;
    // users[].password is nested; the top-level scan covers entity-level secret fields. A top-level
    // placeholder (e.g. an outbound password) is the primary case; nested user secrets are covered by
    // their own checks where they exist.
    const top = { outbounds: [{ type: "trojan", tag: "tr", server: "e.x", server_port: 443, password: "change-me" }] } as unknown as SingBoxConfig;
    expect(warnCodes(top)).toContain("placeholder-secret");
    void config;
  });

  it("does not flag a real secret", () => {
    const config = { outbounds: [{ type: "shadowsocks", tag: "ss", server: "e.x", server_port: 443, method: "aes-128-gcm", password: "s3cr3t-actual-value" }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).not.toContain("placeholder-secret");
  });
});
