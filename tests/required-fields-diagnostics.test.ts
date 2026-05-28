import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/domain/diagnostics";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// A2a (required-fields-diagnostics): domain diagnostics so an invalid config is flagged before export.
// Covers C0-19 (rule-set local format inference), C0-5 (empty group is an error), C0-12 (WireGuard
// endpoint required fields), C0-10 (DERP mesh peer server/port). The required-marker UI + pre-export gate
// is A2b; credential/listen presence (C0-16) and dns-rule route/evaluate server (C0-1) are deferred for
// per-finding upstream/fixture verification (see devlog 2026-05-28).

function asConfig(value: unknown): SingBoxConfig {
  return value as SingBoxConfig;
}

function errorCodes(config: SingBoxConfig, channel: SingBoxChannel = "testing"): string[] {
  return validateConfig(config, channel)
    .filter((d) => d.level === "error")
    .map((d) => d.code);
}

describe("A2a required-field diagnostics", () => {
  describe("rule-set local format inference (C0-19)", () => {
    it("flags a local rule-set with no format and a non-inferable path", () => {
      const config = asConfig({ route: { rule_set: [{ type: "local", tag: "rs", path: "./rules" }] } });
      expect(errorCodes(config)).toContain("rule-set-local-format-missing");
    });

    it("infers the format from a .srs or .json file path", () => {
      // Local path is a filesystem path (not a URL), so the extension is read literally.
      for (const path of ["./rules.srs", "/etc/sing-box/x.json"]) {
        const config = asConfig({ route: { rule_set: [{ type: "local", tag: "rs", path }] } });
        expect(errorCodes(config)).not.toContain("rule-set-local-format-missing");
      }
    });

    it("accepts a local rule-set with an explicit format", () => {
      const config = asConfig({ route: { rule_set: [{ type: "local", tag: "rs", path: "./rules", format: "source" }] } });
      expect(errorCodes(config)).not.toContain("rule-set-local-format-missing");
    });
  });

  describe("empty selector/urltest group is an error (C0-5)", () => {
    it("reports group-outbound-empty at error level", () => {
      const config = asConfig({ outbounds: [{ type: "selector", tag: "g", outbounds: [] }] });
      const matches = validateConfig(config, "testing").filter((d) => d.code === "group-outbound-empty");
      expect(matches).toHaveLength(1);
      expect(matches[0]?.level).toBe("error");
    });
  });

  describe("WireGuard endpoint required fields (C0-12)", () => {
    it("flags a wireguard endpoint missing address/private_key/peers", () => {
      const config = asConfig({ endpoints: [{ type: "wireguard", tag: "wg" }] });
      const codes = errorCodes(config);
      expect(codes).toContain("endpoint-wireguard-address-missing");
      expect(codes).toContain("endpoint-wireguard-private-key-missing");
      expect(codes).toContain("endpoint-wireguard-peers-missing");
    });

    it("flags a peer missing public_key/allowed_ips", () => {
      const config = asConfig({
        endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [{}] }],
      });
      const codes = errorCodes(config);
      expect(codes).toContain("endpoint-wireguard-peer-public-key-missing");
      expect(codes).toContain("endpoint-wireguard-peer-allowed-ips-missing");
    });

    it("accepts a complete wireguard endpoint", () => {
      const config = asConfig({
        endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [{ public_key: "p", allowed_ips: ["0.0.0.0/0"] }] }],
      });
      expect(errorCodes(config).filter((code) => code.startsWith("endpoint-wireguard"))).toEqual([]);
    });
  });

  describe("DERP mesh peer server/port (C0-10)", () => {
    it("flags a mesh peer missing server/server_port", () => {
      const config = asConfig({
        services: [{ type: "derp", tag: "d", config_path: "/srv/derp.json", tls: { enabled: true }, mesh_with: [{}] }],
      });
      const codes = errorCodes(config);
      expect(codes).toContain("derp-mesh-server-missing");
      expect(codes).toContain("derp-mesh-server-port-missing");
    });

    it("accepts a mesh peer with server + server_port", () => {
      const config = asConfig({
        services: [{ type: "derp", tag: "d", config_path: "/srv/derp.json", tls: { enabled: true }, mesh_with: [{ server: "1.2.3.4", server_port: 443 }] }],
      });
      expect(errorCodes(config).filter((code) => code.startsWith("derp-mesh"))).toEqual([]);
    });
  });
});
