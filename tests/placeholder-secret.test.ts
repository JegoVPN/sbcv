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

  it("flags a change-me placeholder on a top-level inbound secret", () => {
    const config = { inbounds: [{ type: "trojan", tag: "tr", server: "e.x", server_port: 443, password: "change-me" }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).toContain("placeholder-secret");
  });

  // A27-rest: the scan now descends into per-user secret arrays (users[].password / uuid …), which are
  // where most inbound protocols (trojan/vmess/vless/hysteria2/tuic) actually carry their credentials.
  it("flags a change-me placeholder on a nested inbound user password", () => {
    const config = { inbounds: [{ type: "trojan", tag: "tr", users: [{ name: "u", password: "change-me" }] }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).toContain("placeholder-secret");
  });

  it("flags a REPLACE_ME placeholder uuid on a nested vless user", () => {
    const config = { inbounds: [{ type: "vless", tag: "v", users: [{ name: "u", uuid: "REPLACE_ME_UUID" }] }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).toContain("placeholder-secret");
  });

  it("flags a change-me hysteria auth_str (the scaffold default ships this)", () => {
    const config = { inbounds: [{ type: "hysteria", tag: "h", users: [{ name: "u", auth_str: "change-me" }] }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).toContain("placeholder-secret");
  });

  it("does not crash or flag on a malformed users shape", () => {
    const stringUsers = { inbounds: [{ type: "trojan", tag: "tr", users: "nope" }] } as unknown as SingBoxConfig;
    const nullUser = { inbounds: [{ type: "trojan", tag: "tr", users: [null] }] } as unknown as SingBoxConfig;
    expect(warnCodes(stringUsers)).not.toContain("placeholder-secret");
    expect(warnCodes(nullUser)).not.toContain("placeholder-secret");
  });

  it("reports the nested user path so the user can locate it", () => {
    const config = { inbounds: [{ type: "trojan", tag: "tr", users: [{ name: "alice", password: "change-me" }] }] } as unknown as SingBoxConfig;
    const found = validateConfig(config, "testing").find((d) => d.code === "placeholder-secret");
    expect(found?.path).toBe("/inbounds/0/users/0/password");
  });

  it("does not flag a real top-level secret", () => {
    const config = { outbounds: [{ type: "shadowsocks", tag: "ss", server: "e.x", server_port: 443, method: "aes-128-gcm", password: "s3cr3t-actual-value" }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).not.toContain("placeholder-secret");
  });

  it("does not flag a real nested user secret", () => {
    const config = { inbounds: [{ type: "vless", tag: "v", users: [{ name: "u", uuid: "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" }] }] } as unknown as SingBoxConfig;
    expect(warnCodes(config)).not.toContain("placeholder-secret");
  });
});
