import { readFileSync, readdirSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import { knownFieldsFor } from "../src/domain/knownFieldsRegistry";
import type { SingBoxConfig } from "../src/domain/types";

// W9 (serialization → strong) — the unknown-field linter closes the one validity hole re-run#4 named:
// the heuristic linter did not catch unknown/typo'd field names that sing-box's strict decoder
// FATAL-rejects. Allowlist sourced from upstream docs (both channels) ∪ shared groups ∪ a binary-verified
// supplement; errors feed the V2 export hard gate. The make-or-break property is ZERO false positives on
// binary-valid configs.

function unknownFieldCodes(config: SingBoxConfig, channel: "stable" | "testing" = "stable") {
  return validateConfig(config, channel)
    .filter((d) => d.code === "unknown-field")
    .map((d) => d.path);
}

describe("W9 — unknown-field linter flags strict-decoder rejections", () => {
  it("errors a typo'd top-level field (binary: 'unknown field')", () => {
    const config = { outbounds: [{ type: "direct", tag: "d", totally_bogus_field: "x" }] } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(config)).toEqual(["/outbounds/0/totally_bogus_field"]);
    expect(validateConfig(config, "stable").find((d) => d.code === "unknown-field")?.level).toBe("error");
  });

  it("errors Clash.Meta selector extensions sing-box does not have (filter / providers / use_all_providers)", () => {
    const config = { outbounds: [{ type: "selector", tag: "s", outbounds: ["d"], filter: [], providers: [], use_all_providers: true }] } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(config).sort()).toEqual(["/outbounds/0/filter", "/outbounds/0/providers", "/outbounds/0/use_all_providers"].sort());
  });

  it("errors Xray fields on a mislabeled outbound (streamSettings / mux / settings)", () => {
    const config = { outbounds: [{ type: "vmess", tag: "v", server: "1.2.3.4", server_port: 443, uuid: "c9919dd8-63fb-46c0-b654-3596f82fe6b6", streamSettings: {}, mux: {} }] } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(config).sort()).toEqual(["/outbounds/0/mux", "/outbounds/0/streamSettings"].sort());
  });

  it("does NOT flag valid fields the docs omit but the binary accepts (supplement: tuic.zero_rtt_handshake, fakeip ranges, hysteria mbps)", () => {
    const config = {
      inbounds: [{ type: "hysteria", tag: "h", listen: "::", listen_port: 443, up_mbps: 100, down_mbps: 100, tls: { enabled: true } }],
      outbounds: [{ type: "tuic", tag: "t", server: "1.2.3.4", server_port: 443, uuid: "c9919dd8-63fb-46c0-b654-3596f82fe6b6", password: "p", zero_rtt_handshake: false, tls: { enabled: true, server_name: "x" } }],
      dns: { servers: [{ type: "fakeip", tag: "f", inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" }] },
    } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(config)).toEqual([]);
  });

  it("does NOT flag a wireguard endpoint listen_port (doc-list omits it; binary accepts it) — review FP #1", () => {
    const config = { endpoints: [{ type: "wireguard", tag: "w", address: ["10.0.0.2/32"], private_key: "k", listen_port: 51820, peers: [] }] } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(config, "stable")).toEqual([]);
    expect(unknownFieldCodes(config, "testing")).toEqual([]);
  });

  it("does NOT flag hysteria-realm http2 tuning fields (the http2 shared group must be wired) — review FP #2", () => {
    const config = { services: [{ type: "hysteria-realm", tag: "hr", listen: "::", listen_port: 443, idle_timeout: "30s", keep_alive_period: "10s", stream_receive_window: 1, connection_receive_window: 1, max_concurrent_streams: 1 }] } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(config, "testing")).toEqual([]);
  });

  it("skips entities with no upstream doc / no string type (no false positive, legacy form handled elsewhere)", () => {
    expect(knownFieldsFor("dns-server", undefined)).toBeNull();
    const typeless = { dns: { servers: [{ tag: "legacy", address: "1.1.1.1", address_resolver: "x", strategy: "prefer_ipv4" }] } } as unknown as SingBoxConfig;
    expect(unknownFieldCodes(typeless)).toEqual([]);
  });

  it("ZERO false positives across the binary-valid bundled fixtures (fixtures/stable + fixtures/testing)", () => {
    for (const [dir, channel] of [["fixtures/stable", "stable"], ["fixtures/testing", "testing"]] as const) {
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
        const config = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as SingBoxConfig;
        expect(unknownFieldCodes(config, channel), `${dir}/${file} must have no unknown-field FP`).toEqual([]);
      }
    }
  });
});
