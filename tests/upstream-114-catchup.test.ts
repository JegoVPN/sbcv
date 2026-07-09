import { describe, expect, it } from "vitest";

import { nodeBadge } from "../src/canvas/nodeLabels";
import { createInbound, createOutbound, createService } from "../src/domain/commands";
import { validateConfig } from "../src/domain/diagnostics";
import { typeMinVersion } from "../src/domain/minVersions";
import { isTestingOnlyType } from "../src/domain/schemaRegistry";
import type { SingBoxChannel, SingBoxConfig } from "../src/domain/types";

// Upstream catch-up to sing-box 1.14.0-alpha.40: snell in/out (alpha.38), bridge outbound (alpha.40),
// api service (alpha.30/32), usbip-server + usbip-client services (alpha.32). Every binary-behavior
// claim below was verified against the real 1.14.0-alpha.40 binary (see fixtures/testing/
// upstream-114-catchup.json for the check-clean shapes; stable 1.13.14 rejects the same file).

function codes(config: SingBoxConfig, channel: SingBoxChannel, version: string, level?: "error" | "warning") {
  return validateConfig(config, channel, version)
    .filter((d) => (level ? d.level === level : true))
    .map((d) => d.code);
}

describe("1.14 catch-up — type min-versions are table-driven (C7-A extension)", () => {
  it("exposes 1.14 for all six new types", () => {
    expect(typeMinVersion("inbound", "snell")).toBe("1.14");
    expect(typeMinVersion("outbound", "snell")).toBe("1.14");
    expect(typeMinVersion("outbound", "bridge")).toBe("1.14");
    expect(typeMinVersion("service", "api")).toBe("1.14");
    expect(typeMinVersion("service", "usbip-server")).toBe("1.14");
    expect(typeMinVersion("service", "usbip-client")).toBe("1.14");
  });

  it("marks the six new types testing-only, without touching existing types", () => {
    expect(isTestingOnlyType("inbound", "snell")).toBe(true);
    expect(isTestingOnlyType("outbound", "snell")).toBe(true);
    expect(isTestingOnlyType("outbound", "bridge")).toBe(true);
    expect(isTestingOnlyType("service", "api")).toBe(true);
    expect(isTestingOnlyType("service", "usbip-server")).toBe(true);
    expect(isTestingOnlyType("service", "usbip-client")).toBe(true);
    // Pre-existing gates keep working through the same helper…
    expect(isTestingOnlyType("inbound", "cloudflared")).toBe(true);
    expect(isTestingOnlyType("service", "hysteria-realm")).toBe(true);
    // …and channel-unrestricted types stay creatable everywhere.
    expect(isTestingOnlyType("outbound", "naive")).toBe(false);
    expect(isTestingOnlyType("inbound", "anytls")).toBe(false);
  });

  it("badge and diagnostic read the same min for snell", () => {
    expect(nodeBadge("inbound", "snell", "1.13")?.label).toBe("needs 1.14");
    expect(nodeBadge("outbound", "bridge", "1.13")?.label).toBe("needs 1.14");
    expect(nodeBadge("inbound", "snell", "1.14")).toBeNull();
    // bridge on 1.14 falls back to its privileged platform badge (not a version badge).
    expect(nodeBadge("outbound", "bridge", "1.14")?.tone).toBe("platform");
  });
});

describe("1.14 catch-up — version gates error on stable targets, clean on testing", () => {
  const config = {
    inbounds: [{ type: "snell", tag: "s-in", listen: "127.0.0.1", listen_port: 2080, version: 5, psk: "fixture-psk" }],
    outbounds: [
      { type: "snell", tag: "s-out", server: "127.0.0.1", server_port: 2080, version: 4, psk: "fixture-psk" },
      { type: "bridge", tag: "b-out" },
    ],
    services: [
      { type: "api", tag: "api", listen: "127.0.0.1", listen_port: 9091 },
      { type: "usbip-server", tag: "us", listen: "127.0.0.1", listen_port: 3240, devices: [{ bus_id: "1-2" }] },
      { type: "usbip-client", tag: "uc", server: "127.0.0.1", server_port: 3240 },
    ],
  } as unknown as SingBoxConfig;

  it("errors with per-type codes on 1.13 stable", () => {
    const errors = codes(config, "stable", "1.13", "error");
    expect(errors).toContain("inbound-snell-version");
    expect(errors).toContain("outbound-snell-version");
    expect(errors).toContain("outbound-bridge-version");
    expect(errors).toContain("service-api-version");
    expect(errors).toContain("service-usbip-server-version");
    expect(errors).toContain("service-usbip-client-version");
  });

  it("is clean of version gates on 1.14 testing", () => {
    const errors = codes(config, "testing", "1.14", "error");
    for (const code of errors) expect(code).not.toMatch(/-version$/);
  });
});

describe("1.14 catch-up — snell required fields + v6 psk length (inbound: check-FATAL; outbound: can never authenticate)", () => {
  it("missing psk / version → missing-required-field", () => {
    const noPsk = { inbounds: [{ type: "snell", tag: "s", listen: "127.0.0.1", listen_port: 2080, version: 5 }] } as unknown as SingBoxConfig;
    const noVersion = { outbounds: [{ type: "snell", tag: "s", server: "x", server_port: 1, psk: "fixture-psk" }] } as unknown as SingBoxConfig;
    expect(codes(noPsk, "testing", "1.14", "error")).toContain("missing-required-field");
    expect(codes(noVersion, "testing", "1.14", "error")).toContain("missing-required-field");
  });

  it("v6 with a sub-12-byte psk errors on both sides; v5/v4 accept it", () => {
    const shortV6In = { inbounds: [{ type: "snell", tag: "s", listen: "127.0.0.1", listen_port: 2080, version: 6, psk: "short" }] } as unknown as SingBoxConfig;
    const shortV6Out = { outbounds: [{ type: "snell", tag: "s", server: "x", server_port: 1, version: 6, psk: "short" }] } as unknown as SingBoxConfig;
    const shortV5In = { inbounds: [{ type: "snell", tag: "s", listen: "127.0.0.1", listen_port: 2080, version: 5, psk: "short" }] } as unknown as SingBoxConfig;
    expect(codes(shortV6In, "testing", "1.14", "error")).toContain("inbound-snell-v6-psk-length");
    expect(codes(shortV6Out, "testing", "1.14", "error")).toContain("outbound-snell-v6-psk-length");
    expect(codes(shortV5In, "testing", "1.14", "error")).not.toContain("inbound-snell-v6-psk-length");
  });

  it("v6 with a 12+ byte psk is clean", () => {
    const okV6 = { inbounds: [{ type: "snell", tag: "s", listen: "127.0.0.1", listen_port: 2080, version: 6, psk: "fixture-psk-12plus" }] } as unknown as SingBoxConfig;
    expect(codes(okV6, "testing", "1.14", "error")).not.toContain("inbound-snell-v6-psk-length");
  });
});

describe("1.14 catch-up — usbip-server devices requirement (binary: check-time FATAL)", () => {
  it("errors with the default provider and no devices", () => {
    const bare = { services: [{ type: "usbip-server", tag: "u", listen: "127.0.0.1", listen_port: 3240 }] } as unknown as SingBoxConfig;
    expect(codes(bare, "testing", "1.14", "error")).toContain("usbip-server-devices-required");
  });
  it("errors when every match is empty — zero-valued fields count as unset (binary-verified)", () => {
    // The exact state the inspector's "Add device match" button creates before any field is filled.
    for (const devices of [[{}], [{ bus_id: "" }], [{ vendor_id: 0 }], [{ serial: "" }, {}]]) {
      const config = { services: [{ type: "usbip-server", tag: "u", listen: "127.0.0.1", listen_port: 3240, devices }] } as unknown as SingBoxConfig;
      expect(codes(config, "testing", "1.14", "error"), JSON.stringify(devices)).toContain("usbip-server-devices-required");
    }
  });
  it("is silent with an effective match, or with the dynamic provider", () => {
    const byBusId = { services: [{ type: "usbip-server", tag: "u", listen: "127.0.0.1", listen_port: 3240, devices: [{ bus_id: "1-2" }] }] } as unknown as SingBoxConfig;
    const byVendor = { services: [{ type: "usbip-server", tag: "u", listen: "127.0.0.1", listen_port: 3240, devices: [{ vendor_id: 1133 }] }] } as unknown as SingBoxConfig;
    const dynamic = { services: [{ type: "usbip-server", tag: "u", listen: "127.0.0.1", listen_port: 3240, provider: "dynamic" }] } as unknown as SingBoxConfig;
    expect(codes(byBusId, "testing", "1.14", "error")).not.toContain("usbip-server-devices-required");
    expect(codes(byVendor, "testing", "1.14", "error")).not.toContain("usbip-server-devices-required");
    expect(codes(dynamic, "testing", "1.14", "error")).not.toContain("usbip-server-devices-required");
  });
});

describe("1.14 catch-up — implicit HTTP client deprecation (dashboard + rule-set suppression)", () => {
  const CODE = "api-dashboard-implicit-http-client-deprecated";

  it("warns when an enabled dashboard has no explicit/default/first client", () => {
    const bare = { services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: true }] } as unknown as SingBoxConfig;
    expect(codes(bare, "testing", "1.14", "warning")).toContain(CODE);
  });

  it("string shorthand counts as enabled", () => {
    const stringForm = { services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: "./dash" }] } as unknown as SingBoxConfig;
    expect(codes(stringForm, "testing", "1.14", "warning")).toContain(CODE);
  });

  it("suppressed by dashboard.http_client, route.default_http_client, or any http_clients entry", () => {
    const explicit = { services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: { enabled: true, http_client: "dl" } }] } as unknown as SingBoxConfig;
    const viaRoute = { route: { default_http_client: "dl" }, services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: true }] } as unknown as SingBoxConfig;
    const viaList = { http_clients: [{ tag: "dl" }], services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: true }] } as unknown as SingBoxConfig;
    expect(codes(explicit, "testing", "1.14", "warning")).not.toContain(CODE);
    expect(codes(viaRoute, "testing", "1.14", "warning")).not.toContain(CODE);
    expect(codes(viaList, "testing", "1.14", "warning")).not.toContain(CODE);
  });

  it("an EMPTY http_client string does not suppress (doc: 'When empty, the default HTTP client is used')", () => {
    const emptyDash = { services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: { enabled: true, http_client: "" } }] } as unknown as SingBoxConfig;
    expect(codes(emptyDash, "testing", "1.14", "warning")).toContain(CODE);
    const RS = "rule-set-implicit-http-client-deprecated";
    const emptyRuleSet = { route: { rule_set: [{ type: "remote", tag: "r", format: "source", url: "https://example.com/r.json", http_client: "" }] } } as unknown as SingBoxConfig;
    expect(codes(emptyRuleSet, "testing", "1.14", "warning")).toContain(RS);
  });

  it("silent when the dashboard is absent or disabled", () => {
    const none = { services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091 }] } as unknown as SingBoxConfig;
    const off = { services: [{ type: "api", tag: "a", listen: "127.0.0.1", listen_port: 9091, dashboard: false }] } as unknown as SingBoxConfig;
    expect(codes(none, "testing", "1.14", "warning")).not.toContain(CODE);
    expect(codes(off, "testing", "1.14", "warning")).not.toContain(CODE);
  });

  it("rule-set implicit warning is now suppressed by a top-level http_clients entry (alpha.40 doc)", () => {
    const RS = "rule-set-implicit-http-client-deprecated";
    const bare = { route: { rule_set: [{ type: "remote", tag: "r", format: "source", url: "https://example.com/r.json" }] } } as unknown as SingBoxConfig;
    const withClients = { http_clients: [{ tag: "dl" }], route: { rule_set: [{ type: "remote", tag: "r", format: "source", url: "https://example.com/r.json" }] } } as unknown as SingBoxConfig;
    expect(codes(bare, "testing", "1.14", "warning")).toContain(RS);
    expect(codes(withClients, "testing", "1.14", "warning")).not.toContain(RS);
  });
});

describe("1.14 catch-up — hysteria2 realm port_mapping requires IPv4 (alpha.41, binary-verified FATAL)", () => {
  const CODE = "hysteria2-realm-port-mapping-requires-ipv4";
  const mk = (realm: Record<string, unknown>, side: "inbounds" | "outbounds") =>
    ({
      [side]: [
        side === "outbounds"
          ? { type: "hysteria2", tag: "h", password: "p", tls: { enabled: true, server_name: "e" }, realm }
          : { type: "hysteria2", tag: "h", listen: "127.0.0.1", listen_port: 443, users: [{ password: "p" }], tls: { enabled: true, server_name: "e" }, realm },
      ],
    }) as unknown as SingBoxConfig;

  it("errors on ip_version 6 + enabled port_mapping, both sides", () => {
    const realm = { server_url: "https://r.example.com", token: "t", realm_id: "r", ip_version: 6, port_mapping: { enabled: true } };
    expect(codes(mk(realm, "outbounds"), "testing", "1.14", "error")).toContain(CODE);
    expect(codes(mk(realm, "inbounds"), "testing", "1.14", "error")).toContain(CODE);
  });

  it("silent on ip_version 4 + port_mapping, and on port_mapping without ip_version", () => {
    const v4 = { server_url: "https://r.example.com", token: "t", realm_id: "r", ip_version: 4, port_mapping: { enabled: true } };
    const noVersion = { server_url: "https://r.example.com", token: "t", realm_id: "r", port_mapping: { enabled: true } };
    const disabled = { server_url: "https://r.example.com", token: "t", realm_id: "r", ip_version: 6, port_mapping: { enabled: false } };
    for (const realm of [v4, noVersion, disabled]) {
      expect(codes(mk(realm, "outbounds"), "testing", "1.14", "error")).not.toContain(CODE);
    }
  });
});

describe("1.14 catch-up — factory goldens (S3 delegation guard extension)", () => {
  it("inbound snell (v5 + scaffold psk)", () => {
    expect(createInbound("snell", "x")).toEqual({ type: "snell", tag: "x", listen: "127.0.0.1", listen_port: 2080, version: 5, psk: "change-me" });
  });
  it("outbound snell (v4 = v5 wire, tolerates the short scaffold psk)", () => {
    expect(createOutbound("snell", "x")).toEqual({ type: "snell", tag: "x", server: "127.0.0.1", server_port: 1080, version: 4, psk: "change-me" });
  });
  it("outbound bridge (interface only)", () => {
    expect(createOutbound("bridge", "x")).toEqual({ type: "bridge", tag: "x", interface: "" });
  });
  it("service api (9091 avoids the ssm-api scaffold's 9090)", () => {
    expect(createService("api", "x")).toEqual({ type: "api", tag: "x", listen: "127.0.0.1", listen_port: 9091, secret: "" });
  });
  it("service usbip-server (upstream default port 3240)", () => {
    expect(createService("usbip-server", "x")).toEqual({ type: "usbip-server", tag: "x", listen: "127.0.0.1", listen_port: 3240, devices: [] });
  });
  it("service usbip-client", () => {
    expect(createService("usbip-client", "x")).toEqual({ type: "usbip-client", tag: "x", server: "", server_port: 3240, devices: [] });
  });
});
