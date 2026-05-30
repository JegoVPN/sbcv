import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxConfig } from "../src/domain/types";

// V4-S1 — testing-only sections that sing-box-stable REJECTS at decode are error-level on a stable
// target (verified against the real binary: "unknown field http_clients" / "unknown field
// certificate_providers" / "unknown inbound type: cloudflared"), so they feed the V2 export hard gate
// — aligning with naive / ccm-ocm / hysteria-realm. On the testing target they are valid (no error).

function codes(config: SingBoxConfig, channel: "stable" | "testing") {
  return new Set(validateConfig(config, channel).filter((d) => d.level === "error").map((d) => d.code));
}

describe("V4-S1 — testing-only sections are errors on stable", () => {
  it("cloudflared inbound errors on stable, ok on testing", () => {
    const config = { inbounds: [{ type: "cloudflared", tag: "cf", token: "x" }] } as unknown as SingBoxConfig;
    expect(codes(config, "stable").has("inbound-cloudflared-testing-only")).toBe(true);
    expect(codes(config, "testing").has("inbound-cloudflared-testing-only")).toBe(false);
  });

  it("top-level certificate_providers errors on stable, ok on testing", () => {
    const config = {
      certificate_providers: [{ type: "dnsimple", tag: "cp", api_access_token: "x" }],
    } as unknown as SingBoxConfig;
    expect(codes(config, "stable").has("stable-version-gated-certificate-providers")).toBe(true);
    expect(codes(config, "testing").has("stable-version-gated-certificate-providers")).toBe(false);
  });

  it("http_clients errors on stable, ok on testing", () => {
    const config = { http_clients: [{ tag: "hc" }] } as unknown as SingBoxConfig;
    expect(codes(config, "stable").has("stable-version-gated-http-clients")).toBe(true);
    expect(codes(config, "testing").has("stable-version-gated-http-clients")).toBe(false);
  });
});

describe("V4-S3 — removed-type outbounds are errors (sing-box rejects by default)", () => {
  it("legacy dns / wireguard outbounds error on every target; block stays a warning", () => {
    const dnsOut = { outbounds: [{ type: "dns", tag: "d" }] } as unknown as SingBoxConfig;
    const wgOut = { outbounds: [{ type: "wireguard", tag: "w" }] } as unknown as SingBoxConfig;
    const blockOut = { outbounds: [{ type: "block", tag: "b" }] } as unknown as SingBoxConfig;
    for (const channel of ["stable", "testing"] as const) {
      expect(codes(dnsOut, channel).has("outbound-dns-legacy-deprecated")).toBe(true);
      expect(codes(wgOut, channel).has("outbound-wireguard-legacy-deprecated")).toBe(true);
      // block is accepted by sing-box (1.12 + 1.13) — must NOT be an export-blocking error.
      expect(validateConfig(blockOut, channel).find((d) => d.code === "outbound-block-deprecated")?.level).toBe("warning");
    }
  });
});

// W8 — field-level 1.14-only gates that sing-box-1.13 FATAL-rejects ("unknown field …") must be
// error-level on a stable target (binary-verified), not the bypassable warning they used to be — they
// feed the V2 export hard gate, matching the V4-S1 testing-only-section policy.
describe("W8 — 1.14-only field gates are errors on stable (M2 + M3)", () => {
  const cases: Array<[string, SingBoxConfig, string]> = [
    ["ssh.cipher", { outbounds: [{ type: "ssh", tag: "s", server: "1.2.3.4", server_port: 22, user: "r", cipher: ["aes128-ctr"] }] } as unknown as SingBoxConfig, "ssh-cipher-testing-only"],
    ["ssh.mac", { outbounds: [{ type: "ssh", tag: "s", server: "1.2.3.4", server_port: 22, user: "r", mac: ["hmac-sha2-256"] }] } as unknown as SingBoxConfig, "ssh-mac-testing-only"],
    ["ssh.kex_algorithm", { outbounds: [{ type: "ssh", tag: "s", server: "1.2.3.4", server_port: 22, user: "r", kex_algorithm: ["curve25519-sha256"] }] } as unknown as SingBoxConfig, "ssh-kex-algorithm-testing-only"],
    ["hysteria2.realm", { outbounds: [{ type: "hysteria2", tag: "h", server: "1.2.3.4", server_port: 443, password: "p", tls: { enabled: true, server_name: "x" }, realm: "r" }] } as unknown as SingBoxConfig, "hysteria2-realm-testing-only"],
    ["hysteria2.bbr_profile", { outbounds: [{ type: "hysteria2", tag: "h", server: "1.2.3.4", server_port: 443, password: "p", tls: { enabled: true, server_name: "x" }, bbr_profile: "default" }] } as unknown as SingBoxConfig, "hysteria2-bbr-profile-testing-only"],
    ["tun.dns_mode", { inbounds: [{ type: "tun", tag: "t", address: ["172.19.0.1/30"], dns_mode: "normal" }], outbounds: [{ type: "direct", tag: "d" }] } as unknown as SingBoxConfig, "tun-dns-mode-testing-only"],
    ["tun.dns_address", { inbounds: [{ type: "tun", tag: "t", address: ["172.19.0.1/30"], dns_address: "1.1.1.1" }], outbounds: [{ type: "direct", tag: "d" }] } as unknown as SingBoxConfig, "tun-dns-address-testing-only"],
  ];
  for (const [label, config, code] of cases) {
    it(`${label} errors on stable, ok on testing`, () => {
      expect(codes(config, "stable").has(code)).toBe(true);
      expect(codes(config, "testing").has(code)).toBe(false);
    });
  }

  // M2: the shared QUIC tuning block (initial_packet_size / disable_path_mtu_discovery / idle_timeout /
  // keep_alive_period) is 1.14+; previously ungated entirely. Each is binary-rejected by 1.13 on
  // hysteria / hysteria2 / tuic.
  for (const field of ["initial_packet_size", "disable_path_mtu_discovery", "idle_timeout", "keep_alive_period"]) {
    it(`tuic.${field} (QUIC block) errors on stable, ok on testing`, () => {
      const config = { outbounds: [{ type: "tuic", tag: "t", server: "1.2.3.4", server_port: 443, uuid: "c9919dd8-63fb-46c0-b654-3596f82fe6b6", password: "p", tls: { enabled: true, server_name: "x" }, [field]: field === "disable_path_mtu_discovery" ? true : field === "initial_packet_size" ? 1400 : "30s" }] } as unknown as SingBoxConfig;
      expect(codes(config, "stable").has("quic-shared-field-testing-only")).toBe(true);
      expect(codes(config, "testing").has("quic-shared-field-testing-only")).toBe(false);
    });
  }

  it("does NOT flag a generic idle_timeout on a non-QUIC type (service) — scoped to hysteria/hysteria2/tuic", () => {
    const svc = { services: [{ type: "resolved", tag: "r", idle_timeout: "30s" }] } as unknown as SingBoxConfig;
    expect(codes(svc, "stable").has("quic-shared-field-testing-only")).toBe(false);
  });
});
