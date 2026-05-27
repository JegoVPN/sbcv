import { describe, expect, it } from "vitest";
import { nodeIdForDiagnosticPath } from "../src/domain/diagnosticTargets";
import type { SingBoxConfig } from "../src/domain/types";

const config: SingBoxConfig = {
  experimental: { cache_file: { enabled: true } },
  log: { level: "debug" },
  ntp: { server: "time.cloudflare.com" },
  certificate: {},
  inbounds: [
    { type: "tun", tag: "tun-in" },
    { type: "mixed", tag: "mixed-in" },
    { type: "socks", tag: "" },
  ],
  outbounds: [
    { type: "selector", tag: "Manual" },
    { type: "urltest", tag: "Auto" },
    { type: "direct", tag: "direct" },
  ],
  endpoints: [{ type: "wireguard", tag: "wg" }],
  services: [{ type: "ccm", tag: "ccm" }],
  certificate_providers: [
    { type: "tailscale", tag: "ts-cert" },
    { type: "acme", tag: "" },
  ],
  http_clients: [
    { tag: "client" },
    { tag: "" },
  ],
  route: {
    final: "direct",
    rules: [{ outbound: "Manual" }, { outbound: "direct" }],
    rule_set: [{ type: "remote", tag: "geosite", format: "binary", url: "x" }],
  },
  dns: {
    final: "remote",
    servers: [
      { type: "https", tag: "remote", server: "1.1.1.1" },
      { type: "https", tag: "local", server: "8.8.8.8" },
    ],
    rules: [{ server: "remote" }],
  },
};

describe("nodeIdForDiagnosticPath", () => {
  it("maps settings paths", () => {
    expect(nodeIdForDiagnosticPath("/experimental/cache_file/store_rdrc", config)).toBe(
      "settings:experimental",
    );
    expect(nodeIdForDiagnosticPath("/log", config)).toBe("settings:log");
    expect(nodeIdForDiagnosticPath("/ntp/server", config)).toBe("settings:ntp");
    expect(nodeIdForDiagnosticPath("/certificate/store", config)).toBe("settings:certificate");
  });

  it("maps route hub and route rule indexes", () => {
    expect(nodeIdForDiagnosticPath("/route", config)).toBe("route:main");
    expect(nodeIdForDiagnosticPath("/route/final", config)).toBe("route:main");
    expect(nodeIdForDiagnosticPath("/route/rules/0/outbound", config)).toBe("route-rule:0");
    expect(nodeIdForDiagnosticPath("/route/rules/1", config)).toBe("route-rule:1");
    expect(nodeIdForDiagnosticPath("/route/rules/99", config)).toBe("route:main");
  });

  it("maps route rule sets by index → tag", () => {
    expect(nodeIdForDiagnosticPath("/route/rule_set/0/url", config)).toBe("rule-set:geosite");
    expect(nodeIdForDiagnosticPath("/route/rule_set/9", config)).toBe("route:main");
  });

  it("maps dns hub and dns rule/server indexes", () => {
    expect(nodeIdForDiagnosticPath("/dns", config)).toBe("dns:main");
    expect(nodeIdForDiagnosticPath("/dns/final", config)).toBe("dns:main");
    expect(nodeIdForDiagnosticPath("/dns/rules/0/server", config)).toBe("dns-rule:0");
    expect(nodeIdForDiagnosticPath("/dns/servers/0/address", config)).toBe("dns-server:remote");
    expect(nodeIdForDiagnosticPath("/dns/servers/1", config)).toBe("dns-server:local");
  });

  it("maps tagged collection paths by index → tag", () => {
    expect(nodeIdForDiagnosticPath("/outbounds/0/default", config)).toBe("outbound:Manual");
    expect(nodeIdForDiagnosticPath("/outbounds/1/url", config)).toBe("outbound:Auto");
    expect(nodeIdForDiagnosticPath("/inbounds/0/auto_route", config)).toBe("inbound:tun-in");
    expect(nodeIdForDiagnosticPath("/endpoints/0/detour", config)).toBe("endpoint:wg");
    expect(nodeIdForDiagnosticPath("/services/0/users", config)).toBe("service:ccm");
    expect(nodeIdForDiagnosticPath("/certificate_providers/0/endpoint", config)).toBe("certificate-provider:ts-cert");
    expect(nodeIdForDiagnosticPath("/http_clients/0/detour", config)).toBe("http-client:client");
  });

  it("falls back to deterministic untagged ids when entity has no tag", () => {
    expect(nodeIdForDiagnosticPath("/inbounds/2/listen_port", config)).toBe(
      "inbound:untagged-inbound-3",
    );
    expect(nodeIdForDiagnosticPath("/certificate_providers/1/http_client", config)).toBe(
      "certificate-provider:untagged-certificate-provider-2",
    );
    expect(nodeIdForDiagnosticPath("/http_clients/1/tls", config)).toBe(
      "http-client:untagged-http-client-2",
    );
  });

  it("returns null for unmatched or empty paths", () => {
    expect(nodeIdForDiagnosticPath("", config)).toBeNull();
    expect(nodeIdForDiagnosticPath("/unknown/path", config)).toBeNull();
    expect(nodeIdForDiagnosticPath("/outbounds", config)).toBeNull();
    expect(nodeIdForDiagnosticPath("/outbounds/99", config)).toBeNull();
  });
});
