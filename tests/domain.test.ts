import { describe, expect, it } from "vitest";
import {
  addDnsServer,
  addRuleSet,
  changeEntityType,
  connectSelectorCandidate,
  createDnsServer,
  createEndpoint,
  createInbound,
  createOutbound,
  createStableTunSplitConfig,
  deleteEntity,
  disconnectEdge,
  ensureSettings,
  moveRouteRule,
  renameTag,
  createRuleSet,
  updateDnsRule,
  updateEntityField,
  updateRouteRule,
} from "../src/domain/commands";
import { deriveGraph } from "../src/canvas/graph";
import { nodeIdForDiagnosticPath } from "../src/domain/diagnosticTargets";
import { validateConfig } from "../src/domain/diagnostics";
import { referenceRegistry, type ReferenceKind } from "../src/domain/referenceRegistry";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { createTemplatePreset, TEMPLATE_PRESETS, TEMPLATE_PRESET_IDS } from "../src/domain/templates";
import type { SingBoxConfig } from "../src/domain/types";

type ReferenceCoverageCase = {
  kind: ReferenceKind;
  tag: string;
  nextTag: string;
  paths: string[];
  staleDiagnosticCodes: string[];
  /**
   * Codes that fire as a WARNING (not error) when this kind's ref dangles. The binary `check`+`run`
   * BOTH accept these dangling refs (the rule just never matches / lazily resolves), so the long-chain
   * audit (A1–A5) downgraded them error→warning — coverage is still bound here, just at warning level.
   */
  staleWarningCodes?: string[];
  assertRenamed: (config: SingBoxConfig) => void;
  assertDeleted: (config: SingBoxConfig) => void;
};

function createReferenceCoverageConfig(): SingBoxConfig {
  return {
    inbounds: [
      { type: "tun", tag: "tun-in", route_address_set: ["rs"], tls: { certificate_provider: "cert" } },
      { type: "shadowsocks", tag: "managed-ss", managed: true },
      { type: "socks", tag: "socks-in", detour: "tun-in" },
      {
        type: "shadowtls",
        tag: "stls-in",
        handshake: { server: "h", server_port: 443, detour: "proxy" },
        handshake_for_server_name: { "example.com": { server: "e", server_port: 443, detour: "proxy" } },
      },
      { type: "cloudflared", tag: "cf-in", token: "cf-token", control_dialer: { detour: "proxy" }, tunnel_dialer: { detour: "proxy" } },
    ],
    outbounds: [
      { type: "direct", tag: "proxy", tls: { certificate_provider: "cert" } },
      { type: "direct", tag: "backup" },
      { type: "selector", tag: "auto", outbounds: ["proxy", "backup"], default: "proxy" },
      { type: "trojan", tag: "dialer", server: "example.com", server_port: 443, password: "x", detour: "proxy", domain_resolver: "local-dns" },
    ],
    dns: {
      final: "local-dns",
      servers: [
        { type: "local", tag: "local-dns", detour: "proxy", domain_resolver: { server: "bootstrap-dns" }, tls: { certificate_provider: "cert" } },
        { type: "local", tag: "bootstrap-dns" },
        { type: "tailscale", tag: "ts-dns", endpoint: "ts-ep", detour: "proxy", domain_resolver: { server: "local-dns", strategy: "ipv4_only" } },
        { type: "resolved", tag: "resolved-dns", service: "resolved-svc" },
      ],
      rules: [{ inbound: ["tun-in"], server: "local-dns", rule_set: ["rs"] }],
    },
    endpoints: [
      { type: "wireguard", tag: "wg-ep", detour: "proxy", domain_resolver: { server: "local-dns", strategy: "ipv4_only" } },
      { type: "tailscale", tag: "ts-ep" },
    ],
    services: [
      { type: "ssm-api", tag: "ssm", servers: { "/": "tun-in", "/managed": "managed-ss" }, detour: "proxy" },
      {
        type: "derp",
        tag: "derp",
        detour: "proxy",
        mesh_with: [{ server: "m", server_port: 443, detour: "proxy" }],
        verify_client_url: [{ url: "https://verify.example", detour: "proxy" }],
        verify_client_endpoint: ["ts-ep"],
        tls: { certificate_provider: "cert" },
      },
      { type: "resolved", tag: "resolved-svc" },
    ],
    route: {
      final: "proxy",
      default_domain_resolver: { server: "local-dns", strategy: "ipv4_only" },
      default_http_client: "client",
      rules: [{ inbound: ["tun-in"], outbound: "proxy", rule_set: ["rs"] }, { action: "resolve", server: "local-dns" }],
      rule_set: [
        {
          type: "remote",
          tag: "rs",
          format: "binary",
          url: "https://example.com/rules.srs",
          download_detour: "proxy",
          http_client: "client",
          domain_resolver: { server: "local-dns", strategy: "ipv4_only" },
        },
      ],
    },
    http_clients: [{ tag: "client", detour: "proxy", domain_resolver: "local-dns", tls: { certificate_provider: "cert" } }],
    certificate_providers: [{ type: "tailscale", tag: "cert", endpoint: "ts-ep", http_client: "client" }],
    ntp: { enabled: true, server: "time.example.com", server_port: 123, detour: "proxy", domain_resolver: { server: "local-dns", strategy: "ipv4_only" } },
    experimental: {
      clash_api: { external_ui_download_detour: "proxy" },
      v2ray_api: { stats: { enabled: true, inbounds: ["tun-in"], outbounds: ["proxy"] } },
    },
  };
}

// W7: produce a DANGLING config by removing the referenced entity (no rename/delete cascade), so every
// reference to `tag` is left pointing at a now-absent entity — the state the diagnostics layer must flag.
function danglingByRemoving(kind: ReferenceKind, tag: string): SingBoxConfig {
  const config = createReferenceCoverageConfig();
  const drop = <T extends { tag?: unknown }>(items?: T[]) => items?.filter((item) => item?.tag !== tag);
  if (kind === "inbound") config.inbounds = drop(config.inbounds);
  else if (kind === "outbound") config.outbounds = drop(config.outbounds);
  else if (kind === "dns-server" && config.dns) config.dns.servers = drop(config.dns.servers);
  else if (kind === "endpoint") config.endpoints = drop(config.endpoints);
  else if (kind === "service") config.services = drop(config.services);
  else if (kind === "rule-set" && config.route) config.route.rule_set = drop(config.route.rule_set);
  else if (kind === "http-client") config.http_clients = drop(config.http_clients);
  else if (kind === "certificate-provider") config.certificate_providers = drop(config.certificate_providers);
  return config;
}

const referenceCoverageCases: ReferenceCoverageCase[] = [
  {
    kind: "inbound",
    tag: "tun-in",
    nextTag: "tun-renamed",
    paths: ["/route/rules/*/inbound", "/dns/rules/*/inbound", "/inbounds/*/detour", "/services/*/servers", "/experimental/v2ray_api/stats/inbounds"],
    staleDiagnosticCodes: [
      "missing-dns-rule-inbound",
      "missing-ssm-api-inbound",
      "v2ray-stats-inbound-missing",
    ],
    // A2: a dangling route-rule `inbound` matcher is check+run clean — the rule just never matches — so it
    // warns instead of erroring. Coverage stays bound, at warning level.
    staleWarningCodes: ["missing-route-rule-inbound"],
    assertRenamed: (config) => {
      expect(config.route?.rules?.[0]?.inbound).toEqual(["tun-renamed"]);
      expect(config.dns?.rules?.[0]?.inbound).toEqual(["tun-renamed"]);
      expect(config.services?.find((item) => item.tag === "ssm")?.servers).toMatchObject({ "/": "tun-renamed" });
      expect((config.experimental?.v2ray_api as Record<string, unknown>)?.stats).toMatchObject({ inbounds: ["tun-renamed"] });
      expect((config.inbounds?.find((item) => item.tag === "socks-in") as Record<string, unknown> | undefined)?.detour).toBe("tun-renamed");
    },
    assertDeleted: (config) => {
      expect(config.route?.rules?.[0]?.inbound).toBeUndefined();
      expect(config.dns?.rules?.[0]?.inbound).toBeUndefined();
      expect(config.services?.find((item) => item.tag === "ssm")?.servers).toEqual({ "/managed": "managed-ss" });
      expect((config.experimental?.v2ray_api as Record<string, unknown>)?.stats).toMatchObject({ inbounds: [] });
      expect((config.inbounds?.find((item) => item.tag === "socks-in") as Record<string, unknown> | undefined)?.detour).toBeUndefined();
    },
  },
  {
    kind: "outbound",
    tag: "proxy",
    nextTag: "proxy-renamed",
    paths: [
      "/route/final",
      "/route/rules/*/outbound",
      "/outbounds/*/outbounds",
      "/outbounds/*/default",
      "/outbounds/*/detour",
      "/dns/servers/*/detour",
      "/endpoints/*/detour",
      "/services/*/detour",
      "/services/*/mesh_with/*/detour",
      "/services/*/verify_client_url/*/detour",
      "/inbounds/*/handshake/detour",
      "/inbounds/*/handshake_for_server_name/*/detour",
      "/inbounds/*/control_dialer/detour",
      "/inbounds/*/tunnel_dialer/detour",
      "/route/rule_set/*/download_detour",
      "/ntp/detour",
      "/experimental/clash_api/external_ui_download_detour",
      "/experimental/v2ray_api/stats/outbounds",
    ],
    staleDiagnosticCodes: [
      "missing-route-final",
      "missing-outbound-candidate",
      "missing-dns-server-detour",
      "missing-endpoint-detour",
      "missing-service-detour",
      "ntp-detour-missing",
      "rule-set-download-detour-missing",
      "v2ray-stats-outbound-missing",
    ],
    // A1: dangling route-rule `outbound` (matcher + action form) is check+run clean (rule never matches).
    // A4: dangling clash_api `external_ui_download_detour` is check+run clean and the doc says "Default
    // outbound will be used if empty" — the detour is only lazily resolved when downloading external UI.
    // Both warn instead of erroring; coverage stays bound, at warning level.
    staleWarningCodes: ["missing-rule-outbound", "clash-api-download-detour-missing"],
    assertRenamed: (config) => {
      expect(config.route?.final).toBe("proxy-renamed");
      expect(config.route?.rules?.[0]?.outbound).toBe("proxy-renamed");
      expect(config.outbounds?.find((item) => item.tag === "auto")?.outbounds).toEqual(["proxy-renamed", "backup"]);
      expect(config.outbounds?.find((item) => item.tag === "auto")?.default).toBe("proxy-renamed");
      expect(config.outbounds?.find((item) => item.tag === "dialer")?.detour).toBe("proxy-renamed");
      expect(config.dns?.servers?.[0]?.detour).toBe("proxy-renamed");
      expect(config.endpoints?.[0]?.detour).toBe("proxy-renamed");
      expect(config.services?.find((item) => item.tag === "derp")?.detour).toBe("proxy-renamed");
      expect(config.route?.rule_set?.[0]?.download_detour).toBe("proxy-renamed");
      expect(config.ntp?.detour).toBe("proxy-renamed");
      expect(config.experimental?.clash_api).toMatchObject({ external_ui_download_detour: "proxy-renamed" });
      expect((config.experimental?.v2ray_api as Record<string, unknown>)?.stats).toMatchObject({ outbounds: ["proxy-renamed"] });
      const stls = config.inbounds?.find((item) => item.tag === "stls-in") as Record<string, unknown> | undefined;
      expect((stls?.handshake as Record<string, unknown>)?.detour).toBe("proxy-renamed");
      expect(((stls?.handshake_for_server_name as Record<string, Record<string, unknown>> | undefined)?.["example.com"])?.detour).toBe("proxy-renamed");
      const cf = config.inbounds?.find((item) => item.tag === "cf-in") as Record<string, unknown> | undefined;
      expect((cf?.control_dialer as Record<string, unknown>)?.detour).toBe("proxy-renamed");
      expect((cf?.tunnel_dialer as Record<string, unknown>)?.detour).toBe("proxy-renamed");
      const derp = config.services?.find((item) => item.tag === "derp") as Record<string, unknown> | undefined;
      expect((derp?.mesh_with as Array<Record<string, unknown>> | undefined)?.[0]?.detour).toBe("proxy-renamed");
      expect((derp?.verify_client_url as Array<Record<string, unknown>> | undefined)?.[0]?.detour).toBe("proxy-renamed");
    },
    assertDeleted: (config) => {
      expect(config.route?.final).toBeUndefined();
      expect(config.route?.rules?.[0]?.outbound).toBeUndefined();
      expect(config.outbounds?.find((item) => item.tag === "auto")?.outbounds).toEqual(["backup"]);
      expect(config.outbounds?.find((item) => item.tag === "auto")?.default).toBeUndefined();
      expect(config.outbounds?.find((item) => item.tag === "dialer")?.detour).toBeUndefined();
      expect(config.dns?.servers?.[0]?.detour).toBeUndefined();
      expect(config.endpoints?.[0]?.detour).toBeUndefined();
      expect(config.services?.find((item) => item.tag === "derp")?.detour).toBeUndefined();
      expect(config.route?.rule_set?.[0]?.download_detour).toBeUndefined();
      expect(config.ntp?.detour).toBeUndefined();
      expect(config.experimental?.clash_api).toMatchObject({ external_ui_download_detour: undefined });
      expect((config.experimental?.v2ray_api as Record<string, unknown>)?.stats).toMatchObject({ outbounds: [] });
      const stls = config.inbounds?.find((item) => item.tag === "stls-in") as Record<string, unknown> | undefined;
      expect((stls?.handshake as Record<string, unknown>)?.detour).toBeUndefined();
      expect(((stls?.handshake_for_server_name as Record<string, Record<string, unknown>> | undefined)?.["example.com"])?.detour).toBeUndefined();
      const cf = config.inbounds?.find((item) => item.tag === "cf-in") as Record<string, unknown> | undefined;
      expect((cf?.control_dialer as Record<string, unknown>)?.detour).toBeUndefined();
      expect((cf?.tunnel_dialer as Record<string, unknown>)?.detour).toBeUndefined();
      const derp = config.services?.find((item) => item.tag === "derp") as Record<string, unknown> | undefined;
      expect((derp?.mesh_with as Array<Record<string, unknown>> | undefined)?.[0]?.detour).toBeUndefined();
      expect((derp?.verify_client_url as Array<Record<string, unknown>> | undefined)?.[0]?.detour).toBeUndefined();
    },
  },
  {
    kind: "dns-server",
    tag: "local-dns",
    nextTag: "dns-renamed",
    paths: ["/dns/final", "/dns/rules/*/server", "/route/rules/*/server", "/route/default_domain_resolver", "*/domain_resolver", "/dns/servers/*/address_resolver"],
    // A11: removing local-dns leaves route.default_domain_resolver={server:"local-dns"} dangling, and the
    // config has domain consumers (the "dialer" outbound + the ts-ep tailscale endpoint), so
    // missing-default-domain-resolver fires (error) — binding the new ref check to the W7 catalog.
    staleDiagnosticCodes: ["missing-dns-final", "missing-default-domain-resolver"],
    // A3: a dangling dns-rule `server` (legacy form + `action:"route"` form) is check+run clean — the rule
    // just never matches — so it warns instead of erroring. NOTE: `server` only; `missing-dns-rule-set` stays
    // an error (1.14 `check` DOES resolve dns rule_set — § Coverage 1).
    staleWarningCodes: ["missing-dns-rule-server"],
    assertRenamed: (config) => {
      expect(config.dns?.final).toBe("dns-renamed");
      expect(config.dns?.rules?.[0]?.server).toBe("dns-renamed");
      expect(config.route?.default_domain_resolver).toMatchObject({ server: "dns-renamed" });
      expect(config.outbounds?.find((item) => item.tag === "dialer")?.domain_resolver).toBe("dns-renamed");
      expect(config.dns?.servers?.find((item) => item.tag === "ts-dns")?.domain_resolver).toMatchObject({ server: "dns-renamed" });
      expect(config.endpoints?.find((item) => item.tag === "wg-ep")?.domain_resolver).toMatchObject({ server: "dns-renamed" });
      expect(config.route?.rule_set?.[0]?.domain_resolver).toMatchObject({ server: "dns-renamed" });
      expect(config.http_clients?.[0]?.domain_resolver).toBe("dns-renamed");
      expect(config.ntp?.domain_resolver).toMatchObject({ server: "dns-renamed" });
      expect((config.route?.rules?.[1] as Record<string, unknown> | undefined)?.server).toBe("dns-renamed");
    },
    assertDeleted: (config) => {
      expect(config.dns?.final).toBeUndefined();
      expect(config.dns?.rules?.[0]?.server).toBeUndefined();
      expect(config.route?.default_domain_resolver).toBeUndefined();
      expect(config.outbounds?.find((item) => item.tag === "dialer")?.domain_resolver).toBeUndefined();
      expect(config.dns?.servers?.find((item) => item.tag === "ts-dns")?.domain_resolver).toBeUndefined();
      expect(config.endpoints?.find((item) => item.tag === "wg-ep")?.domain_resolver).toBeUndefined();
      expect(config.route?.rule_set?.[0]?.domain_resolver).toBeUndefined();
      expect(config.http_clients?.[0]?.domain_resolver).toBeUndefined();
      expect(config.ntp?.domain_resolver).toBeUndefined();
      expect((config.route?.rules?.[1] as Record<string, unknown> | undefined)?.server).toBeUndefined();
    },
  },
  {
    kind: "endpoint",
    tag: "ts-ep",
    nextTag: "tailnet",
    paths: ["/dns/servers/*/endpoint", "/services/*/verify_client_endpoint", "/certificate_providers/*/endpoint"],
    staleDiagnosticCodes: ["missing-dns-server-endpoint", "missing-derp-verify-endpoint"],
    assertRenamed: (config) => {
      expect(config.dns?.servers?.find((item) => item.tag === "ts-dns")?.endpoint).toBe("tailnet");
      expect(config.services?.find((item) => item.tag === "derp")?.verify_client_endpoint).toEqual(["tailnet"]);
      expect(config.certificate_providers?.[0]?.endpoint).toBe("tailnet");
    },
    assertDeleted: (config) => {
      expect(config.dns?.servers?.find((item) => item.tag === "ts-dns")?.endpoint).toBeUndefined();
      expect(config.services?.find((item) => item.tag === "derp")?.verify_client_endpoint).toBeUndefined();
      expect(config.certificate_providers?.[0]?.endpoint).toBeUndefined();
    },
  },
  {
    kind: "service",
    tag: "resolved-svc",
    nextTag: "resolved-renamed",
    paths: ["/dns/servers/*/service"],
    staleDiagnosticCodes: ["dns-server-resolved-service-not-found"],
    assertRenamed: (config) => {
      expect(config.dns?.servers?.find((item) => item.tag === "resolved-dns")?.service).toBe("resolved-renamed");
    },
    assertDeleted: (config) => {
      expect(config.dns?.servers?.find((item) => item.tag === "resolved-dns")?.service).toBeUndefined();
    },
  },
  {
    kind: "rule-set",
    tag: "rs",
    nextTag: "rs-renamed",
    paths: ["/route/rules/*/rule_set", "/dns/rules/*/rule_set", "/inbounds/*/route_address_set", "/inbounds/*/route_exclude_address_set"],
    staleDiagnosticCodes: ["missing-route-rule-set", "missing-dns-rule-set"],
    assertRenamed: (config) => {
      expect(config.route?.rules?.[0]?.rule_set).toEqual(["rs-renamed"]);
      expect(config.dns?.rules?.[0]?.rule_set).toEqual(["rs-renamed"]);
      expect((config.inbounds?.find((item) => item.tag === "tun-in") as Record<string, unknown> | undefined)?.route_address_set).toEqual(["rs-renamed"]);
    },
    assertDeleted: (config) => {
      expect(config.route?.rules?.[0]?.rule_set).toBeUndefined();
      expect(config.dns?.rules?.[0]?.rule_set).toBeUndefined();
      expect((config.inbounds?.find((item) => item.tag === "tun-in") as Record<string, unknown> | undefined)?.route_address_set ?? []).not.toContain("rs");
    },
  },
  {
    kind: "http-client",
    tag: "client",
    nextTag: "client-renamed",
    paths: ["/route/default_http_client", "/route/rule_set/*/http_client", "/certificate_providers/*/http_client"],
    staleDiagnosticCodes: [],
    assertRenamed: (config) => {
      expect(config.route?.default_http_client).toBe("client-renamed");
      expect(config.route?.rule_set?.[0]?.http_client).toBe("client-renamed");
      expect(config.certificate_providers?.[0]?.http_client).toBe("client-renamed");
    },
    assertDeleted: (config) => {
      expect(config.route?.default_http_client).toBeUndefined();
      expect(config.route?.rule_set?.[0]?.http_client).toBeUndefined();
      expect(config.certificate_providers?.[0]?.http_client).toBeUndefined();
    },
  },
  {
    kind: "certificate-provider",
    tag: "cert",
    nextTag: "cert-renamed",
    paths: ["*/tls/certificate_provider"],
    staleDiagnosticCodes: [],
    assertRenamed: (config) => {
      expect(config.inbounds?.[0]?.tls).toMatchObject({ certificate_provider: "cert-renamed" });
      expect(config.outbounds?.[0]?.tls).toMatchObject({ certificate_provider: "cert-renamed" });
      expect(config.dns?.servers?.[0]?.tls).toMatchObject({ certificate_provider: "cert-renamed" });
      expect(config.services?.find((item) => item.tag === "derp")?.tls).toMatchObject({ certificate_provider: "cert-renamed" });
      expect(config.http_clients?.[0]?.tls).toMatchObject({ certificate_provider: "cert-renamed" });
    },
    assertDeleted: (config) => {
      expect(config.inbounds?.[0]?.tls).toMatchObject({ certificate_provider: undefined });
      expect(config.outbounds?.[0]?.tls).toMatchObject({ certificate_provider: undefined });
      expect(config.dns?.servers?.[0]?.tls).toMatchObject({ certificate_provider: undefined });
      expect(config.services?.find((item) => item.tag === "derp")?.tls).toMatchObject({ certificate_provider: undefined });
      expect(config.http_clients?.[0]?.tls).toMatchObject({ certificate_provider: undefined });
    },
  },
];

describe("canonical sing-box domain model", () => {
  it("round-trips stable TUN split config without layout metadata", () => {
    const config = createStableTunSplitConfig();
    const json = stringifyConfig(config);
    expect(json).toContain('"inbounds"');
    expect(json).not.toContain("positions");
    expect(parseConfigJson(json)).toEqual(config);
  });

  it.each([
    ["inbounds", { inbounds: "bad" }],
    ["outbounds", { outbounds: "bad" }],
    ["endpoints", { endpoints: "bad" }],
    ["services", { services: "bad" }],
    ["certificate_providers", { certificate_providers: "bad" }],
    ["http_clients", { http_clients: "bad" }],
    ["route.rules", { route: { rules: "bad" } }],
    ["route.rule_set", { route: { rule_set: "bad" } }],
    ["dns.servers", { dns: { servers: "bad" } }],
    ["dns.rules", { dns: { rules: "bad" } }],
  ])("rejects malformed collection shape %s during parse", (path, value) => {
    expect(() => parseConfigJson(JSON.stringify(value))).toThrow(`"${path}" must be an array`);
  });

  it("preserves JSON key order when stringifying updated config objects", () => {
    const config = parseConfigJson(`{
  "outbounds": [
    {
      "tag": "proxy",
      "type": "socks",
      "server": "old.example",
      "server_port": 1080,
      "detour": "direct"
    }
  ],
  "route": {
    "final": "proxy"
  }
}`);
    const updated = updateEntityField(config, { kind: "outbound", tag: "proxy" }, "server", "new.example");
    const cleared = updateEntityField(updated, { kind: "outbound", tag: "proxy" }, "detour", undefined);
    const json = stringifyConfig(cleared);

    expect(json).not.toContain('"detour"');
    expect(json.indexOf('"tag"')).toBeLessThan(json.indexOf('"type"'));
    expect(json.indexOf('"type"')).toBeLessThan(json.indexOf('"server"'));
    expect(json.indexOf('"server"')).toBeLessThan(json.indexOf('"server_port"'));
    expect(json.indexOf('"outbounds"')).toBeLessThan(json.indexOf('"route"'));
  });

  it("renames tags and cascades route and selector references", () => {
    const renamed = renameTag(createStableTunSplitConfig(), "outbound", "proxy", "main-proxy");
    expect(renamed.route?.final).toBe("main-proxy");
    expect(renamed.outbounds?.find((item) => item.tag === "main-proxy")).toBeTruthy();
  });

  it("rejects duplicate tag renames before mutating config", () => {
    const config = createStableTunSplitConfig();
    const renamed = renameTag(config, "outbound", "proxy", "direct");

    expect(renamed).toBe(config);
    expect(renamed.outbounds?.filter((item) => item.tag === "direct")).toHaveLength(1);
    expect(renamed.outbounds?.find((item) => item.tag === "proxy")).toBeTruthy();
  });

  it("keeps reference registry path coverage explicit in domain tests", () => {
    const registryPaths = new Map(referenceRegistry.map((entry) => [entry.kind, entry.paths]));
    const casePaths = new Map(referenceCoverageCases.map((entry) => [entry.kind, entry.paths]));

    expect([...casePaths.keys()].sort()).toEqual([...registryPaths.keys()].sort());
    for (const [kind, paths] of registryPaths) {
      expect(casePaths.get(kind)).toEqual(paths);
    }
  });

  it.each(referenceCoverageCases)("diagnostics flag every dangling $kind reference (3rd registry-parity binding)", (testCase) => {
    // W7: the reference graph is enumerated in THREE places — referenceRegistry (cascade), portRelation-
    // Registry (canvas edges, parity-bound above), and the diagnostics missing-* checks. This binds that
    // THIRD enumeration to the catalog: with the referenced entity removed, every dangling ref of this kind
    // must surface a missing-* diagnostic — an error, or (for the binary-tolerated long-chain refs the audit
    // downgraded, A1–A5) a warning declared in staleWarningCodes. http-client / certificate-provider declare
    // NO codes because sing-box TOLERATES their dangling refs (binary-verified), so the empty lists are
    // intentional — not a coverage gap.
    const dangling = validateConfig(danglingByRemoving(testCase.kind, testCase.tag), "testing");
    const codesByLevel = (level: "error" | "warning") =>
      new Set(dangling.filter((d) => d.level === level).map((d) => d.code));
    const errors = codesByLevel("error");
    const warnings = codesByLevel("warning");
    for (const code of testCase.staleDiagnosticCodes) {
      expect(errors.has(code), `dangling ${testCase.kind} ref should emit error ${code}`).toBe(true);
    }
    for (const code of testCase.staleWarningCodes ?? []) {
      expect(warnings.has(code), `dangling ${testCase.kind} ref should emit warning ${code}`).toBe(true);
    }
    if (testCase.staleDiagnosticCodes.length === 0 && (testCase.staleWarningCodes?.length ?? 0) === 0) {
      expect(["http-client", "certificate-provider"]).toContain(testCase.kind);
    }
  });

  it.each(referenceCoverageCases)("renames $kind references through the canonical registry", (testCase) => {
    const renamed = renameTag(createReferenceCoverageConfig(), testCase.kind, testCase.tag, testCase.nextTag);
    testCase.assertRenamed(renamed);
  });

  it.each(referenceCoverageCases)("deletes $kind references without leaving diagnosable stale refs", (testCase) => {
    const deleted = deleteEntity(createReferenceCoverageConfig(), { kind: testCase.kind, tag: testCase.tag });
    testCase.assertDeleted(deleted);

    const codes = validateConfig(deleted, "testing").map((diagnostic) => diagnostic.code);
    for (const code of [...testCase.staleDiagnosticCodes, ...(testCase.staleWarningCodes ?? [])]) {
      expect(codes).not.toContain(code);
    }
  });

  // ── Long-chain false-positive downgrades (A1–A5) ────────────────────────────────────────────────
  // The audit cross-checked these against all three real binaries with BOTH `check` AND `run`: the
  // dangling cross-section reference is accepted (the rule just never matches / lazily resolves, no
  // FATAL), so erroring on it wrongly blocks a runnable config. Each downgrades error→warning while
  // keeping the genuinely run-FATAL siblings (route.final, detour, …) as errors.
  describe("long-chain false-positive downgrades (binary check+run clean)", () => {
    const diagOf = (config: unknown, code: string) =>
      validateConfig(config as SingBoxConfig, "testing").find((d) => d.code === code);

    // A1 — a route rule's dangling `outbound` (matcher form + Rule-Action `action:"route"` form) is a
    // warning, not an error: binary `check` exit 0 and `run` "sing-box started" on all of 1.12/1.13/1.14.
    const routeWith = (route: Record<string, unknown>) => ({
      inbounds: [{ type: "mixed", tag: "in", listen: "127.0.0.1", listen_port: 2080 }],
      outbounds: [{ type: "direct", tag: "direct" }],
      route,
    });

    it("A1: dangling route-rule outbound (matcher form) warns, not errors", () => {
      const diag = diagOf(routeWith({ rules: [{ inbound: ["in"], outbound: "ghost" }], final: "direct" }), "missing-rule-outbound");
      expect(diag?.level).toBe("warning");
    });

    it("A1: dangling route-rule outbound (action:\"route\" form) warns, not errors", () => {
      const diag = diagOf(routeWith({ rules: [{ inbound: ["in"], action: "route", outbound: "ghost" }], final: "direct" }), "missing-rule-outbound");
      expect(diag?.level).toBe("warning");
    });

    it("A1 control: dangling route.final stays an error (run FATAL — not downgraded)", () => {
      const diag = diagOf(routeWith({ final: "ghost" }), "missing-route-final");
      expect(diag?.level).toBe("error");
    });

    // A2 — a route rule's dangling `inbound` matcher is a warning, not an error: binary `check` exit 0
    // and `run` "sing-box started" on all of 1.12/1.13/1.14 (the rule simply never matches).
    it("A2: dangling route-rule inbound matcher warns, not errors", () => {
      const diag = diagOf(routeWith({ rules: [{ inbound: ["ghost-in"], outbound: "direct" }], final: "direct" }), "missing-route-rule-inbound");
      expect(diag?.level).toBe("warning");
    });

    // A3 — a dns rule's dangling `server` (legacy form + Rule-Action `action:"route"` form) is a warning:
    // `check` exit 0 + `run` "sing-box started" on all three (the rule never matches). The dns `rule_set`
    // ref is NOT in scope and stays an error (1.14 `check` resolves it → "rule-set not found").
    const dnsWith = (rule: Record<string, unknown>) => ({
      outbounds: [{ type: "direct", tag: "direct" }],
      dns: { servers: [{ type: "udp", tag: "d1", server: "8.8.8.8" }], rules: [rule] },
    });

    it("A3: dangling dns-rule server (legacy form) warns, not errors", () => {
      const diag = diagOf(dnsWith({ domain: ["example.com"], server: "ghost" }), "missing-dns-rule-server");
      expect(diag?.level).toBe("warning");
    });

    it("A3: dangling dns-rule server (action:\"route\" form) warns, not errors", () => {
      const diag = diagOf(dnsWith({ domain: ["example.com"], action: "route", server: "ghost" }), "missing-dns-rule-server");
      expect(diag?.level).toBe("warning");
    });

    it("A3 control: dangling dns-rule rule_set stays an error (1.14 check resolves it — not downgraded)", () => {
      const diag = diagOf(dnsWith({ rule_set: "ghost-set", server: "d1" }), "missing-dns-rule-set");
      expect(diag?.level).toBe("error");
    });

    // A4 — a dangling clash_api `external_ui_download_detour` is a warning: `check` exit 0 + `run`
    // started on all three (the detour is only lazily resolved when downloading the external UI), and the
    // doc documents the empty default ("Default outbound will be used if empty").
    it("A4: dangling clash_api external_ui_download_detour warns, not errors", () => {
      const diag = diagOf(
        { outbounds: [{ type: "direct", tag: "direct" }], experimental: { clash_api: { external_controller: "127.0.0.1:9090", external_ui_download_detour: "ghost-detour" } } },
        "clash-api-download-detour-missing",
      );
      expect(diag?.level).toBe("warning");
    });
  });

  // ── Long-chain runtime true-positives (binary check-pass / run-FATAL — STAY error) ──────────────
  // A5: the audit spec proposed downgrading missing-dns-server-endpoint to a warning, but a 3-binary
  // replay REFUTES that premise. A tailscale DNS server's `endpoint` ref IS resolved at run/init and is
  // FATAL when it does not name a real endpoint: `check` exits 0 on all three (1.12/1.13/1.14) but `run`
  // FATALs `initialize dns/tailscale[..]: endpoint not found: ..` (non-empty dangling / wrong-namespace)
  // or `missing tailscale endpoint tag` (empty/missing). This is the same shape as route.final — a runtime
  // true positive — so it MUST stay an error. The clean control (endpoint → a real tailscale endpoint) runs
  // to "sing-box started" (only TRACE health warnings), which isolates the dangling ref as the FATAL cause.
  describe("long-chain runtime true-positives (binary run-FATAL — stay error)", () => {
    const diagOf = (config: unknown, code: string) =>
      validateConfig(config as SingBoxConfig, "testing").find((d) => d.code === code);

    it("A5: a non-empty dangling tailscale DNS-server endpoint stays an error (run FATAL endpoint-not-found)", () => {
      const diag = diagOf(
        { dns: { servers: [{ type: "tailscale", tag: "ts", endpoint: "does-not-exist" }] }, endpoints: [{ type: "tailscale", tag: "ts-ep" }] },
        "missing-dns-server-endpoint",
      );
      expect(diag?.level).toBe("error");
    });

    it("A5: a wrong-namespace tailscale DNS-server endpoint (→ outbound tag) stays an error", () => {
      const diag = diagOf(
        { dns: { servers: [{ type: "tailscale", tag: "ts", endpoint: "direct-out" }] }, outbounds: [{ type: "direct", tag: "direct-out" }], endpoints: [{ type: "tailscale", tag: "ts-ep" }] },
        "missing-dns-server-endpoint",
      );
      expect(diag?.level).toBe("error");
    });

    it("A5: an empty/missing tailscale endpoint stays an error (covered by dns-server-tailscale-endpoint-missing)", () => {
      const empty = diagOf({ dns: { servers: [{ type: "tailscale", tag: "ts", endpoint: "" }] } }, "dns-server-tailscale-endpoint-missing");
      expect(empty?.level).toBe("error");
      const missing = diagOf({ dns: { servers: [{ type: "tailscale", tag: "ts" }] } }, "dns-server-tailscale-endpoint-missing");
      expect(missing?.level).toBe("error");
    });

    it("A5 control: a tailscale endpoint pointing at a REAL endpoint emits no missing-dns-server-endpoint (no over-fire)", () => {
      // The clean control runs to "sing-box started" on all three binaries; we must not false-positive on it.
      const clean = { dns: { servers: [{ type: "tailscale", tag: "ts", endpoint: "ts-ep" }] }, endpoints: [{ type: "tailscale", tag: "ts-ep" }] };
      expect(diagOf(clean, "missing-dns-server-endpoint")).toBeUndefined();
      expect(diagOf(clean, "dns-server-tailscale-endpoint-missing")).toBeUndefined();
    });
  });

  // ── A11: missing-default-domain-resolver (dangling route.default_domain_resolver) ⚠️#303 ─────────
  // Binary-verified: a route.default_domain_resolver that names a non-existent DNS server is a hard init
  // error on all three binaries ("default domain resolver not found: <tag>") — but ONLY when some entity
  // actually consumes domain resolution via dial fields (a domain/direct outbound, or a tailscale/domain-
  // wireguard endpoint). With no such consumer (e.g. an IP-only outbound) the dangling value is tolerated,
  // so the check is consumer-gated to avoid a #303-style false positive. Single-DNS does NOT save a
  // dangling default (verified). Handles both string and {server:...} forms.
  describe("A11: missing-default-domain-resolver (dangling default_domain_resolver)", () => {
    const diagOf = (config: unknown, code: string) =>
      validateConfig(config as SingBoxConfig, "testing").find((d) => d.code === code);
    const twoDns = [{ type: "udp", tag: "a", server: "1.1.1.1" }, { type: "udp", tag: "b", server: "8.8.8.8" }];
    const domainOutbound = { type: "trojan", tag: "p", server: "example.com", server_port: 443, password: "x", tls: { enabled: true } };

    it("dangling default (string) + domain outbound → error at /route/default_domain_resolver", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [domainOutbound] }, "missing-default-domain-resolver");
      expect(d?.level).toBe("error");
      expect(d?.path).toBe("/route/default_domain_resolver");
    });

    it("dangling default (object {server}) + domain outbound → error", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: { server: "DoesNotExist" } }, outbounds: [domainOutbound] }, "missing-default-domain-resolver");
      expect(d?.level).toBe("error");
    });

    it("dangling default + direct outbound (resolves request domains) → error", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "direct", tag: "d" }] }, "missing-default-domain-resolver");
      expect(d?.level).toBe("error");
    });

    it("dangling default + SINGLE DNS server + domain outbound → error (single-DNS does not save a dangling default)", () => {
      const d = diagOf({ dns: { servers: [{ type: "udp", tag: "only", server: "1.1.1.1" }] }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [domainOutbound] }, "missing-default-domain-resolver");
      expect(d?.level).toBe("error");
    });

    it("dangling default + tailscale endpoint (implicit domain control_url) → error", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "block", tag: "blk" }], endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k" }] }, "missing-default-domain-resolver");
      expect(d?.level).toBe("error");
    });

    it("dangling default + wireguard domain-peer endpoint → error", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "block", tag: "blk" }], endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [{ address: "peer.example.com", port: 51820, public_key: "k", allowed_ips: ["0.0.0.0/0"] }] }] }, "missing-default-domain-resolver");
      expect(d?.level).toBe("error");
    });

    it("dangling default + ONLY an IP outbound (no domain consumer) → silent (no false positive)", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "trojan", tag: "ip", server: "192.0.2.1", server_port: 443, password: "x", tls: { enabled: true } }] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });

    it("real default (resolves to a DNS server tag) + domain outbound → silent", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "a" }, outbounds: [domainOutbound] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });

    it("no default set + domain outbound → no missing-default-domain-resolver (absence is not dangling)", () => {
      const d = diagOf({ dns: { servers: twoDns }, outbounds: [domainOutbound] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });

    // A per-entity domain_resolver OVERRIDES the default, so the entity never falls back to it — a dangling
    // default is then unconsumed and the binary accepts it (3-binary check exit 0, verified). The consumer
    // gate must exclude these or it becomes a #303-shape false positive on valid runnable configs.
    it("dangling default + domain outbound WITH its own domain_resolver → silent (override, no false positive)", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ ...domainOutbound, domain_resolver: "a" }] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });

    it("dangling default + direct outbound WITH its own domain_resolver → silent (override)", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "direct", tag: "d", domain_resolver: "a" }] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });

    it("dangling default + tailscale endpoint WITH its own domain_resolver → silent (override)", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "block", tag: "blk" }], endpoints: [{ type: "tailscale", tag: "ts", auth_key: "k", domain_resolver: "a" }] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });

    it("dangling default + wireguard domain-peer endpoint WITH its own domain_resolver → silent (override)", () => {
      const d = diagOf({ dns: { servers: twoDns }, route: { default_domain_resolver: "DoesNotExist" }, outbounds: [{ type: "block", tag: "blk" }], endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", domain_resolver: "a", peers: [{ address: "peer.example.com", port: 51820, public_key: "k", allowed_ips: ["0.0.0.0/0"] }] }] }, "missing-default-domain-resolver");
      expect(d).toBeUndefined();
    });
  });

  it("renames extended tag references through the canonical reference registry", () => {
    const config = {
      ...createStableTunSplitConfig(),
      inbounds: [{ type: "tun", tag: "tun-in" }],
      outbounds: [
        { type: "direct", tag: "proxy" },
        { type: "selector", tag: "auto", outbounds: ["proxy"], default: "proxy" },
        { type: "trojan", tag: "dialer", server: "example.com", server_port: 443, password: "x", detour: "proxy", domain_resolver: "local-dns" },
      ],
      dns: {
        final: "local-dns",
        servers: [
          { type: "local", tag: "local-dns", detour: "proxy" },
          { type: "resolved", tag: "resolved-dns", service: "resolved-svc" } as never,
        ],
        rules: [{ inbound: ["tun-in"], server: "local-dns", rule_set: "rs" }],
      },
      endpoints: [
        { type: "wireguard", tag: "ep", detour: "proxy" },
        { type: "tailscale", tag: "ts-ep" },
      ],
      services: [
        { type: "ssm-api", tag: "ssm", servers: { "/": "tun-in" } },
        { type: "derp", tag: "derp", detour: "proxy", verify_client_endpoint: "ts-ep" },
        { type: "resolved", tag: "resolved-svc" },
      ],
      route: {
        final: "proxy",
        default_domain_resolver: "local-dns",
        default_http_client: "client",
        rules: [{ inbound: "tun-in", outbound: "proxy", rule_set: "rs" }],
        rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://example.com/rules.srs", download_detour: "proxy", http_client: "client", domain_resolver: "local-dns" }],
      },
      http_clients: [{ tag: "client", detour: "proxy", domain_resolver: "local-dns", tls: { certificate_provider: "cert" } }],
      certificate_providers: [{ type: "tailscale", tag: "cert", endpoint: "ts-ep", http_client: "client" }],
      ntp: { enabled: true, server: "time.example.com", server_port: 123, detour: "proxy", domain_resolver: "local-dns" },
      experimental: {
        clash_api: { external_ui_download_detour: "proxy" },
        v2ray_api: { stats: { inbounds: ["tun-in"], outbounds: ["proxy"] } },
      },
    } as ReturnType<typeof createStableTunSplitConfig>;

    const outboundRenamed = renameTag(config, "outbound", "proxy", "proxy-2");
    expect(outboundRenamed.route?.final).toBe("proxy-2");
    expect(outboundRenamed.route?.rules?.[0]?.outbound).toBe("proxy-2");
    expect(outboundRenamed.outbounds?.find((item) => item.tag === "auto")?.outbounds).toEqual(["proxy-2"]);
    expect(outboundRenamed.outbounds?.find((item) => item.tag === "auto")?.default).toBe("proxy-2");
    expect(outboundRenamed.dns?.servers?.[0]?.detour).toBe("proxy-2");
    expect(outboundRenamed.endpoints?.[0]?.detour).toBe("proxy-2");
    expect(outboundRenamed.services?.find((item) => item.tag === "derp")?.detour).toBe("proxy-2");
    expect(outboundRenamed.route?.rule_set?.[0]?.download_detour).toBe("proxy-2");
    expect((outboundRenamed.ntp as Record<string, unknown>).detour).toBe("proxy-2");
    expect((outboundRenamed.experimental as Record<string, unknown>).clash_api).toMatchObject({ external_ui_download_detour: "proxy-2" });
    expect(((outboundRenamed.experimental as Record<string, unknown>).v2ray_api as Record<string, unknown>).stats).toMatchObject({ outbounds: ["proxy-2"] });

    const dnsRenamed = renameTag(outboundRenamed, "dns-server", "local-dns", "bootstrap-dns");
    expect(dnsRenamed.dns?.final).toBe("bootstrap-dns");
    expect(dnsRenamed.dns?.rules?.[0]?.server).toBe("bootstrap-dns");
    expect(dnsRenamed.route?.default_domain_resolver).toBe("bootstrap-dns");
    expect(dnsRenamed.outbounds?.find((item) => item.tag === "dialer")?.domain_resolver).toBe("bootstrap-dns");
    expect(dnsRenamed.route?.rule_set?.[0]?.domain_resolver).toBe("bootstrap-dns");
    expect((dnsRenamed.ntp as Record<string, unknown>).domain_resolver).toBe("bootstrap-dns");

    const httpRenamed = renameTag(dnsRenamed, "http-client", "client", "client-2");
    expect(httpRenamed.route?.default_http_client).toBe("client-2");
    expect(httpRenamed.route?.rule_set?.[0]?.http_client).toBe("client-2");
    expect(httpRenamed.certificate_providers?.[0]?.http_client).toBe("client-2");

    const certRenamed = renameTag(httpRenamed, "certificate-provider", "cert", "cert-2");
    expect(((certRenamed.http_clients?.[0] as Record<string, unknown>).tls as Record<string, unknown>).certificate_provider).toBe("cert-2");

    const endpointRenamed = renameTag(certRenamed, "endpoint", "ts-ep", "tailnet");
    expect(endpointRenamed.services?.find((item) => item.tag === "derp")?.verify_client_endpoint).toBe("tailnet");
    expect(endpointRenamed.certificate_providers?.[0]?.endpoint).toBe("tailnet");

    const serviceRenamed = renameTag(endpointRenamed, "service", "resolved-svc", "systemd-resolved");
    expect(serviceRenamed.dns?.servers?.find((server) => server.tag === "resolved-dns")?.service).toBe("systemd-resolved");
  });

  it("deletes extended tag references through the canonical reference registry", () => {
    const config = {
      ...createStableTunSplitConfig(),
      inbounds: [{ type: "tun", tag: "tun-in" }],
      outbounds: [
        { type: "direct", tag: "proxy" },
        { type: "selector", tag: "auto", outbounds: ["proxy"], default: "proxy" },
      ],
      dns: {
        final: "local-dns",
        servers: [{ type: "local", tag: "local-dns", detour: "proxy" }],
        rules: [{ inbound: "tun-in", server: "local-dns", rule_set: "rs" }],
      },
      endpoints: [{ type: "tailscale", tag: "ts-ep", detour: "proxy" }],
      services: [
        { type: "ssm-api", tag: "ssm", servers: { "/": "tun-in" } },
        { type: "derp", tag: "derp", detour: "proxy", verify_client_endpoint: "ts-ep" },
      ],
      route: {
        final: "proxy",
        default_domain_resolver: "local-dns",
        default_http_client: "client",
        rules: [{ inbound: "tun-in", outbound: "proxy", rule_set: "rs" }],
        rule_set: [{ type: "remote", tag: "rs", format: "binary", url: "https://example.com/rules.srs", download_detour: "proxy", http_client: "client", domain_resolver: "local-dns" }],
      },
      http_clients: [{ tag: "client", detour: "proxy", domain_resolver: "local-dns", tls: { certificate_provider: "cert" } }],
      certificate_providers: [{ type: "tailscale", tag: "cert", endpoint: "ts-ep", http_client: "client" }],
      experimental: { v2ray_api: { stats: { inbounds: ["tun-in"], outbounds: ["proxy"] } } },
    } as ReturnType<typeof createStableTunSplitConfig>;

    const noInbound = deleteEntity(config, { kind: "inbound", tag: "tun-in" });
    expect(noInbound.route?.rules?.[0]?.inbound).toBeUndefined();
    expect(noInbound.dns?.rules?.[0]?.inbound).toBeUndefined();
    expect(noInbound.services?.find((item) => item.tag === "ssm")?.servers).toEqual({});
    expect(((noInbound.experimental as Record<string, unknown>).v2ray_api as Record<string, unknown>).stats).toMatchObject({ inbounds: [] });

    const noOutbound = deleteEntity(config, { kind: "outbound", tag: "proxy" });
    expect(noOutbound.route?.final).toBeUndefined();
    expect(noOutbound.route?.rules?.[0]?.outbound).toBeUndefined();
    expect(noOutbound.outbounds?.find((item) => item.tag === "auto")?.outbounds).toEqual([]);
    expect(noOutbound.outbounds?.find((item) => item.tag === "auto")?.default).toBeUndefined();
    expect(noOutbound.dns?.servers?.[0]?.detour).toBeUndefined();
    expect(noOutbound.endpoints?.[0]?.detour).toBeUndefined();
    expect(noOutbound.services?.find((item) => item.tag === "derp")?.detour).toBeUndefined();
    expect(noOutbound.route?.rule_set?.[0]?.download_detour).toBeUndefined();
    expect(((noOutbound.experimental as Record<string, unknown>).v2ray_api as Record<string, unknown>).stats).toMatchObject({ outbounds: [] });

    const noDnsServer = deleteEntity(config, { kind: "dns-server", tag: "local-dns" });
    expect(noDnsServer.dns?.final).toBeUndefined();
    expect(noDnsServer.dns?.rules?.[0]?.server).toBeUndefined();
    expect(noDnsServer.route?.default_domain_resolver).toBeUndefined();
    expect(noDnsServer.route?.rule_set?.[0]?.domain_resolver).toBeUndefined();

    const noEndpoint = deleteEntity(config, { kind: "endpoint", tag: "ts-ep" });
    expect(noEndpoint.services?.find((item) => item.tag === "derp")?.verify_client_endpoint).toBeUndefined();
    expect(noEndpoint.certificate_providers?.[0]?.endpoint).toBeUndefined();

    const noHttpClient = deleteEntity(config, { kind: "http-client", tag: "client" });
    expect(noHttpClient.route?.default_http_client).toBeUndefined();
    expect(noHttpClient.route?.rule_set?.[0]?.http_client).toBeUndefined();
    expect(noHttpClient.certificate_providers?.[0]?.http_client).toBeUndefined();

    const noCert = deleteEntity(config, { kind: "certificate-provider", tag: "cert" });
    expect(((noCert.http_clients?.[0] as Record<string, unknown>).tls as Record<string, unknown>).certificate_provider).toBeUndefined();
  });

  it("scrubs dependent endpoint and service references on type change", () => {
    const config = {
      ...createStableTunSplitConfig(),
      endpoints: [{ type: "tailscale", tag: "ts-ep" }],
      dns: {
        servers: [
          { type: "tailscale", tag: "ts-dns", endpoint: "ts-ep", accept_default_resolvers: false },
          { type: "resolved", tag: "resolved-dns", service: "resolved-svc" } as never,
        ],
      },
      services: [
        { type: "derp", tag: "derp", verify_client_endpoint: "ts-ep" },
        { type: "resolved", tag: "resolved-svc" },
      ],
      certificate_providers: [{ type: "tailscale", tag: "cert", endpoint: "ts-ep" }],
    } as ReturnType<typeof createStableTunSplitConfig>;

    const endpointChanged = changeEntityType(config, { kind: "endpoint", tag: "ts-ep" }, "wireguard");
    expect(endpointChanged.dns?.servers?.find((server) => server.tag === "ts-dns")?.endpoint).toBeUndefined();
    expect(endpointChanged.services?.find((service) => service.tag === "derp")?.verify_client_endpoint).toBeUndefined();
    expect(endpointChanged.certificate_providers?.[0]?.endpoint).toBeUndefined();

    const serviceChanged = changeEntityType(config, { kind: "service", tag: "resolved-svc" }, "derp");
    expect(serviceChanged.dns?.servers?.find((server) => server.tag === "resolved-dns")?.service).toBeUndefined();
  });

  it("updates ordered route rules without using canvas edge order", () => {
    const config = createStableTunSplitConfig();
    const updated = updateRouteRule(config, 0, { domain_suffix: ["sg"], outbound: "proxy" });
    expect(updated.route?.rules?.[0]?.domain_suffix).toEqual(["sg"]);
    expect(updated.route?.rules?.[0]?.outbound).toBe("proxy");
    const moved = moveRouteRule(updated, 0, 1);
    expect(moved.route?.rules?.[1]?.domain_suffix).toEqual(["sg"]);
  });

  it("guards selector candidate writes to selector and urltest parents with existing children", () => {
    const config = createStableTunSplitConfig();
    const directAsParent = connectSelectorCandidate(config, "direct", "hk");
    expect(directAsParent).toBe(config);
    expect(directAsParent.outbounds?.find((outbound) => outbound.tag === "direct")?.outbounds).toBeUndefined();

    const missingChild = connectSelectorCandidate(config, "proxy", "missing-outbound");
    expect(missingChild).toBe(config);

    const updated = connectSelectorCandidate(config, "proxy", "direct");
    expect(updated.outbounds?.find((outbound) => outbound.tag === "proxy")?.outbounds).toContain("direct");
  });

  it("scrubs route and DNS action target refs when actions do not accept them", () => {
    const config = createStableTunSplitConfig();

    const routeReject = updateRouteRule(config, 0, { action: "reject", outbound: "proxy" });
    expect(routeReject.route?.rules?.[0]?.outbound).toBeUndefined();
    const routeBack = updateRouteRule(routeReject, 0, { action: "route", outbound: "proxy" });
    expect(routeBack.route?.rules?.[0]?.outbound).toBe("proxy");

    const dnsReject = updateDnsRule(config, 0, { action: "reject", server: "remote-doh" });
    expect(dnsReject.dns?.rules?.[0]?.server).toBeUndefined();
    const dnsEvaluate = updateDnsRule(dnsReject, 0, { action: "evaluate", server: "remote-doh" });
    expect(dnsEvaluate.dns?.rules?.[0]?.server).toBe("remote-doh");
  });

  it("rejects unknown rule-set scaffold types instead of falling back to remote", () => {
    expect(() => createRuleSet("adguard", "adguard-rules")).toThrow(/Unsupported rule-set type/);
  });

  it("detects missing outbound references", () => {
    const config = createStableTunSplitConfig();
    config.outbounds = config.outbounds?.map((outbound) =>
      outbound.tag === "proxy" ? { ...outbound, outbounds: [...(outbound.outbounds ?? []), "missing"] } : outbound,
    );
    const diagnostics = validateConfig(config, "stable");
    expect(diagnostics.some((diagnostic) => diagnostic.code === "missing-outbound-candidate")).toBe(true);
  });

  it("warns for official sing-box testing deprecations that can still exit zero", () => {
    const config = createStableTunSplitConfig();
    config.dns = {
      ...config.dns,
      independent_cache: true,
    };

    expect(validateConfig(config, "stable").some((diagnostic) => diagnostic.code === "deprecated-dns-independent-cache")).toBe(false);
    expect(validateConfig(config, "testing").some((diagnostic) => diagnostic.code === "deprecated-dns-independent-cache")).toBe(true);
  });

  it("keeps selector candidate graph edge ids unique when candidate tags repeat", () => {
    const config = createStableTunSplitConfig();
    const selector = config.outbounds?.find((outbound) => outbound.type === "selector");
    if (!selector) throw new Error("missing selector fixture");
    selector.outbounds = ["auto", "auto"];

    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));
    const edgeIds = edges.map((edge) => edge.id);

    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });

  it("does not render candidate edges for non-group outbounds with stale outbounds arrays", () => {
    const config: SingBoxConfig = {
      outbounds: [
        { type: "direct", tag: "invalid-parent", outbounds: ["child"] },
        { type: "selector", tag: "valid-parent", outbounds: ["child"] },
        { type: "direct", tag: "child" },
      ],
      route: { final: "valid-parent" },
    };

    const { edges, nodes } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(edges.some((edge) => edge.id.startsWith("edge:direct:invalid-parent"))).toBe(false);
    expect(edges.some((edge) => edge.id === "edge:selector:valid-parent:0:child")).toBe(true);
    expect(nodes.find((node) => node.id === "outbound:child")?.position.x).toBeGreaterThan(
      nodes.find((node) => node.id === "outbound:valid-parent")?.position.x ?? 0,
    );
  });

  it("disconnects selector candidate references from rendered graph edge ids", () => {
    const config = createStableTunSplitConfig();
    const updated = disconnectEdge(config, "edge:selector:proxy:0:auto");
    const proxy = updated.outbounds?.find((outbound) => outbound.tag === "proxy");

    expect(proxy?.outbounds).toEqual(["hk", "jp"]);
  });

  it("renders DNS and outbound detour references with semantic handles", () => {
    const config = createStableTunSplitConfig();
    const dnsServer = config.dns?.servers?.[0];
    const hk = config.outbounds?.find((outbound) => outbound.tag === "hk");
    if (!dnsServer || !hk) throw new Error("missing detour fixture targets");
    dnsServer.detour = "proxy";
    hk.detour = "direct";

    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `edge:dns-server-detour:${dnsServer.tag}:proxy`,
          sourceHandle: "outbound",
          targetHandle: "dns-detour",
        }),
        expect.objectContaining({
          id: "edge:outbound-detour:hk:direct",
          sourceHandle: "dial-detour",
          targetHandle: "detour-target",
        }),
      ]),
    );
  });

  it("lays out the stable split graph in semantic columns without same-column overlap", () => {
    const { nodes } = deriveGraph(createStableTunSplitConfig(), { positions: {} }, []);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const route = byId.get("route:main");
    const inbound = byId.get("inbound:tun-in");
    const ruleOne = byId.get("route-rule:0");
    const direct = byId.get("outbound:direct");
    const proxy = byId.get("outbound:proxy");
    const auto = byId.get("outbound:auto");
    const hk = byId.get("outbound:hk");
    const jp = byId.get("outbound:jp");

    expect(inbound?.position.x).toBe(route?.position.x);
    expect(route?.position.x).toBeLessThan(ruleOne?.position.x ?? 0);
    expect(ruleOne?.position.x).toBeLessThan(direct?.position.x ?? 0);
    expect(proxy?.position.x).toBe(direct?.position.x);
    expect(auto?.position.x).toBeGreaterThan(proxy?.position.x ?? 0);
    expect(hk?.position.x).toBeGreaterThan(auto?.position.x ?? 0);
    expect(jp?.position.x).toBe(hk?.position.x);

    const byX = new Map<number, typeof nodes>();
    for (const node of nodes) {
      byX.set(node.position.x, [...(byX.get(node.position.x) ?? []), node]);
    }
    for (const columnNodes of byX.values()) {
      const sorted = [...columnNodes].sort((a, b) => a.position.y - b.position.y);
      for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index];
        const previous = sorted[index - 1];
        if (!current || !previous) throw new Error("missing sorted layout node");
        expect(current.position.y - previous.position.y).toBeGreaterThanOrEqual(330);
      }
    }

    const ys = nodes.map((node) => node.position.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1_400);
  });

  it("keeps large ordered rule lists in tables instead of flooding the canvas", () => {
    const config = createStableTunSplitConfig();
    config.route = {
      ...config.route,
      rules: Array.from({ length: 100 }, (_, index) => ({
        domain_suffix: [`example-${index}.com`],
        outbound: "direct",
      })),
    };

    const { nodes } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(nodes.some((node) => node.id === "route:main")).toBe(true);
    expect(nodes.filter((node) => node.data.kind === "route-rule")).toHaveLength(24);
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "notice:route-rules-overflow",
          data: expect.objectContaining({ title: "+76 route rules not visualized" }),
        }),
      ]),
    );
  });

  it("adds a visible overflow notice for dense DNS rule lists", () => {
    const config = createStableTunSplitConfig();
    config.dns = {
      ...config.dns,
      rules: Array.from({ length: 25 }, (_, index) => ({
        domain_suffix: [`dns-${index}.example`],
        server: "local-dns",
      })),
    };

    const { nodes } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(nodes.filter((node) => node.data.kind === "dns-rule")).toHaveLength(24);
    expect(nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "notice:dns-rules-overflow",
          data: expect.objectContaining({ title: "+1 DNS rules not visualized" }),
        }),
      ]),
    );
  });

  it("keeps diagnostic paths segment-scoped while deriving node status", () => {
    const config: SingBoxConfig = {
      outbounds: Array.from({ length: 11 }, (_, index) => ({ type: "direct", tag: `out-${index}` })),
    };
    const { nodes } = deriveGraph(config, { positions: {} }, [
      {
        level: "error",
        code: "test-outbound-10",
        path: "/outbounds/10/server",
        message: "Only outbound 10 should be marked.",
        source: "semantic",
      },
    ]);

    expect(nodes.find((node) => node.id === "outbound:out-1")?.data.status).toBe("valid");
    expect(nodes.find((node) => node.id === "outbound:out-10")?.data.status).toBe("error");
  });

  it("targets duplicate-tag diagnostics at individual tag paths", () => {
    // C9: duplicate-tag is namespaced — a tag reused across namespaces (inbound vs outbound) is NOT a
    // collision, so the per-path assertion uses two same-namespace outbounds.
    const config: SingBoxConfig = {
      outbounds: [{ type: "direct", tag: "dup" }, { type: "block", tag: "dup" }],
    };
    const duplicates = validateConfig(config, "stable").filter((diagnostic) => diagnostic.code === "duplicate-tag");

    expect(duplicates.map((diagnostic) => diagnostic.path).sort()).toEqual(["/outbounds/0/tag", "/outbounds/1/tag"]);
    expect(duplicates.map((diagnostic) => nodeIdForDiagnosticPath(diagnostic.path, config)).sort()).toEqual(["outbound:dup", "outbound:dup"]);
  });

  it("places DNS-only rule-set nodes after route-referenced rule-set nodes", () => {
    const config = createStableTunSplitConfig();
    config.route = {
      ...config.route,
      rule_set: [
        { type: "remote", tag: "route-rs", format: "source", url: "https://example.com/route.json" },
        { type: "remote", tag: "dns-rs", format: "source", url: "https://example.com/dns.json" },
      ],
      rules: Array.from({ length: 20 }, (_, index) => ({
        domain_suffix: [`route-${index}.example`],
        outbound: "direct",
        ...(index === 12 ? { rule_set: "route-rs" } : {}),
      })),
    };
    config.dns = {
      ...config.dns,
      rules: [{ rule_set: "dns-rs", server: "local-dns" }],
    };

    const { nodes } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));
    const routeRuleSetY = nodes.find((node) => node.id === "rule-set:route-rs")?.position.y;
    const dnsRuleSetY = nodes.find((node) => node.id === "rule-set:dns-rs")?.position.y;

    expect(routeRuleSetY).toBeLessThan(dnsRuleSetY ?? 0);
  });

  it("caps selector candidate edges for dense group configs", () => {
    const config = createStableTunSplitConfig();
    config.outbounds = [
      { type: "selector", tag: "dense", outbounds: Array.from({ length: 150 }, (_, index) => `node-${index}`) },
      ...Array.from({ length: 150 }, (_, index) => ({ type: "direct", tag: `node-${index}` })),
    ];

    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));
    const candidateEdges = edges.filter((edge) => edge.id.startsWith("edge:selector:dense:"));

    expect(candidateEdges).toHaveLength(96);
  });

  it("loads curated and official client template presets with explicit channels", () => {
    const legacy = createTemplatePreset("template-1.12");
    const stable = createTemplatePreset("template-1.13");
    const testing = createTemplatePreset("template-1.14");
    const officialFakeIp = createTemplatePreset("template-official-client-tun-fakeip");
    const officialRouteRules = createTemplatePreset("template-official-client-bypass-route-rules");

    expect(TEMPLATE_PRESETS).toHaveLength(TEMPLATE_PRESET_IDS.length);
    expect(legacy.channel).toBe("stable");
    expect(stable.channel).toBe("stable");
    expect(testing.channel).toBe("testing");
    expect(officialFakeIp.channel).toBe("stable");
    expect(officialRouteRules.channel).toBe("stable");
    expect(legacy.version).toBe("1.12");
    expect(stable.config.route?.final).toBe("Default");
    expect(testing.config.http_clients?.[0]?.tag).toBe("default");
    expect(officialFakeIp.config.dns?.servers?.some((server) => server.type === "fakeip")).toBe(true);
    expect(officialRouteRules.config.route?.rules).toHaveLength(6);
    expect(TEMPLATE_PRESET_IDS).toContain("template-official-client-bypass-no-leak");
  });

  it("keeps every template preset semantically valid for its channel", () => {
    for (const preset of TEMPLATE_PRESETS) {
      const diagnostics = validateConfig(preset.config, preset.channel);
      expect(diagnostics.filter((diagnostic) => diagnostic.level === "error"), preset.id).toEqual([]);
    }
  });

  it("creates outbound setup drafts with the requested official protocol type", () => {
    const setupTypes = [
      "http",
      "shadowsocks",
      "vmess",
      "trojan",
      "naive",
      "hysteria",
      "shadowtls",
      "vless",
      "tuic",
      "hysteria2",
      "anytls",
      "tor",
      "ssh",
    ];

    for (const type of setupTypes) {
      const outbound = createOutbound(type, `${type}-out`);

      expect(outbound.type).toBe(type);
      expect(outbound.tag).toBe(`${type}-out`);
      expect(outbound.type).not.toBe("socks");
    }
  });

  it("lock-tests dial-domain-strategy-deprecated covers outbound:direct (1.12-C)", () => {
    const config = createStableTunSplitConfig();
    const direct = config.outbounds?.find((o) => o.type === "direct") as Record<string, unknown>;
    expect(direct).toBeDefined();
    direct.domain_strategy = "prefer_ipv4";
    const findings = validateConfig(config, "stable").filter(
      (f) => f.code === "dial-domain-strategy-deprecated",
    );
    expect(findings.some((f) => f.path.endsWith("/domain_strategy") && f.message.toLowerCase().includes("direct"))).toBe(true);
  });

  it("warns on Hysteria v1 in both inbound and outbound", () => {
    const config = createStableTunSplitConfig();
    config.outbounds = [
      ...(config.outbounds ?? []),
      {
        type: "hysteria",
        tag: "hy1-out",
        server: "127.0.0.1",
        server_port: 8443,
        up_mbps: 100,
        down_mbps: 100,
        tls: { enabled: true },
      } as never,
    ];
    config.inbounds = [
      ...(config.inbounds ?? []),
      {
        type: "hysteria",
        tag: "hy1-in",
        listen: "127.0.0.1",
        listen_port: 8443,
        users: [{ name: "u", auth_str: "p" }],
        tls: { enabled: true },
      } as never,
    ];
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("hysteria-v1-deprecated");
    expect(codes).toContain("inbound-hysteria-v1-deprecated");
  });

  it("locks vless flow + multiplex / flow + TLS mutual-exclusion diagnostics", () => {
    const config = createStableTunSplitConfig();
    config.outbounds = [
      ...(config.outbounds ?? []),
      {
        type: "vless",
        tag: "vless-out",
        server: "127.0.0.1",
        server_port: 4443,
        uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
        flow: "xtls-rprx-vision",
        multiplex: { enabled: true, protocol: "smux" },
      } as never,
    ];
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("vless-flow-multiplex-conflict");
    expect(codes).toContain("vless-flow-requires-tls");

    const last = (config.outbounds as Array<Record<string, unknown>>)[
      (config.outbounds as Array<Record<string, unknown>>).length - 1
    ]!;
    last.tls = { enabled: true };
    last.multiplex = undefined;
    expect(
      validateConfig(config, "stable").some(
        (d) =>
          d.code === "vless-flow-multiplex-conflict" || d.code === "vless-flow-requires-tls",
      ),
    ).toBe(false);
  });

  it("warns on SSH outbound with multiple auth methods set simultaneously", () => {
    const config = createStableTunSplitConfig();
    config.outbounds = [
      ...(config.outbounds ?? []),
      {
        type: "ssh",
        tag: "ssh-out",
        server: "127.0.0.1",
        server_port: 22,
        user: "root",
        password: "secret",
        private_key_path: "~/.ssh/id_ed25519",
      } as never,
    ];
    expect(
      validateConfig(config, "stable").some((finding) => finding.code === "ssh-auth-mutex"),
    ).toBe(true);

    delete (config.outbounds[config.outbounds.length - 1] as Record<string, unknown>).password;
    expect(
      validateConfig(config, "stable").some((finding) => finding.code === "ssh-auth-mutex"),
    ).toBe(false);
  });

  it("version-gates settings.certificate block and chrome store by target version (A5)", () => {
    const config = createStableTunSplitConfig();
    config.certificate = { store: "chrome" } as never;

    // 1.13 stable supports both the top-level certificate block (1.12+) and store=chrome (1.13+).
    const v113 = validateConfig(config, "stable", "1.13").map((d) => d.code);
    expect(v113).not.toContain("settings-certificate-block-testing-only");
    expect(v113).not.toContain("settings-certificate-store-chrome-testing-only");

    // 1.12 legacy: store=chrome is 1.13+, so it is flagged; the certificate block (1.12+) is still fine.
    const v112 = validateConfig(config, "stable", "1.12").map((d) => d.code);
    expect(v112).not.toContain("settings-certificate-block-testing-only");
    expect(v112).toContain("settings-certificate-store-chrome-testing-only");

    const testing = validateConfig(config, "testing").map((d) => d.code);
    expect(testing).not.toContain("settings-certificate-block-testing-only");
    expect(testing).not.toContain("settings-certificate-store-chrome-testing-only");
  });

  it("version-gates tailscale endpoint 1.13+ fields by target version (A5)", () => {
    const config = createStableTunSplitConfig();
    config.endpoints = [
      { type: "tailscale", tag: "ts", advertise_tags: ["tag:x"], system_interface: true },
    ] as never;

    const v112 = validateConfig(config, "stable", "1.12").map((d) => d.code);
    expect(v112).toContain("endpoint-tailscale-advertise-tags-1-13-only");
    expect(v112).toContain("endpoint-tailscale-system-interface-1-13-only");

    const v113 = validateConfig(config, "stable", "1.13").map((d) => d.code);
    expect(v113).not.toContain("endpoint-tailscale-advertise-tags-1-13-only");
    expect(v113).not.toContain("endpoint-tailscale-system-interface-1-13-only");
  });

  it("does NOT warn about an empty hosts DNS server (path defaults to /etc/hosts)", () => {
    // dns/server/hosts.md: `path` defaults to /etc/hosts (the Windows system hosts file on Windows). So a
    // hosts server with no predefined entries and no explicit path is a valid, purposeful "serve the system
    // hosts file" config — it does NOT "match nothing", so the old dns-server-hosts-empty warning was both
    // noise and factually wrong, and was removed.
    const config = createStableTunSplitConfig();
    config.dns = {
      ...config.dns,
      servers: [
        ...(config.dns?.servers ?? []),
        { type: "hosts", tag: "empty-hosts" } as never,
      ],
    };
    expect(
      validateConfig(config, "stable").some((finding) => finding.code === "dns-server-hosts-empty"),
    ).toBe(false);
  });

  it("flags every dns-server type that requires a server address when server is missing", () => {
    const config = createStableTunSplitConfig();
    const remoteTypes = ["udp", "tcp", "tls", "https", "quic", "h3"];
    config.dns = {
      ...config.dns,
      servers: [
        ...(config.dns?.servers ?? []),
        ...remoteTypes.map((type) => ({ type, tag: `${type}-dns` } as never)),
      ],
    };
    const findings = validateConfig(config, "stable").filter(
      (finding) => finding.code === "dns-server-missing-server",
    );
    expect(findings).toHaveLength(remoteTypes.length);
    for (const type of remoteTypes) {
      expect(findings.some((finding) => finding.message.includes(`${type}-dns`))).toBe(true);
    }
  });

  it("draws a dns-server:resolved -> service:resolved edge when resolved.service is set", () => {
    const config = createStableTunSplitConfig();
    config.dns = {
      ...config.dns,
      servers: [
        ...(config.dns?.servers ?? []),
        { type: "resolved", tag: "resolved-dns", service: "resolved-svc" } as never,
      ],
    };
    config.services = [
      ...(config.services ?? []),
      { type: "resolved", tag: "resolved-svc", listen: "127.0.0.53", listen_port: 53 } as never,
    ];
    const { edges } = deriveGraph(config, { positions: {} }, []);
    const edge = edges.find(
      (item) => item.id === "edge:dns-server-service:resolved-dns:resolved-svc",
    );
    expect(edge).toBeDefined();
    expect(edge?.source).toBe("dns-server:resolved-dns");
    expect(edge?.target).toBe("service:resolved-svc");
  });

  it("flags resolved dns-server with missing or unresolved service reference", () => {
    const config = createStableTunSplitConfig();
    config.dns = {
      ...config.dns,
      servers: [
        ...(config.dns?.servers ?? []),
        { type: "resolved", tag: "resolved-dns" } as never,
      ],
    };
    expect(
      validateConfig(config, "stable").some(
        (finding) => finding.code === "dns-server-resolved-service-missing",
      ),
    ).toBe(true);

    (config.dns!.servers as Array<Record<string, unknown>>)[
      (config.dns!.servers as Array<Record<string, unknown>>).length - 1
    ]!.service = "ghost";
    expect(
      validateConfig(config, "stable").some(
        (finding) => finding.code === "dns-server-resolved-service-not-found",
      ),
    ).toBe(true);
  });

  it("draws a settings:ntp -> outbound edge when ntp.detour is set", () => {
    const config = createStableTunSplitConfig();
    config.ntp = { enabled: true, server: "time.apple.com", detour: "direct" } as never;
    const { edges } = deriveGraph(config, { positions: { "settings:ntp": { x: -300, y: 0 } } }, []);
    const ntpDetourEdge = edges.find((edge) => edge.id === "edge:settings-ntp-detour:direct");
    expect(ntpDetourEdge).toBeDefined();
    expect(ntpDetourEdge?.source).toBe("settings:ntp");
    expect(ntpDetourEdge?.target).toBe("outbound:direct");
  });

  it("hides route-rule outbound canvas edge when action is not route/bypass (CC-6)", () => {
    const config = createStableTunSplitConfig();
    config.route = {
      ...config.route,
      rules: [
        { domain_suffix: ["cn"], outbound: "direct" },
        { domain_keyword: ["ads"], action: "reject", outbound: "direct" },
      ],
    };
    const { edges } = deriveGraph(config, { positions: {} }, []);
    const routeOutboundEdges = edges.filter((edge) => edge.id.startsWith("edge:route-rule:"));
    expect(routeOutboundEdges.some((edge) => edge.id === "edge:route-rule:0:direct")).toBe(true);
    expect(routeOutboundEdges.some((edge) => edge.id === "edge:route-rule:1:direct")).toBe(false);
  });

  it("hides dns-rule server canvas edge when action is not route/evaluate (CC-6)", () => {
    const config = createStableTunSplitConfig();
    config.dns = {
      ...config.dns,
      rules: [
        { domain_suffix: ["cn"], server: "local-dns" } as never,
        { domain_keyword: ["ads"], action: "reject", server: "local-dns" } as never,
      ],
    };
    const { edges } = deriveGraph(config, { positions: {} }, []);
    const dnsServerEdges = edges.filter((edge) => edge.id.startsWith("edge:dns-rule:"));
    expect(dnsServerEdges.some((edge) => edge.id === "edge:dns-rule:0:local-dns")).toBe(true);
    expect(dnsServerEdges.some((edge) => edge.id === "edge:dns-rule:1:local-dns")).toBe(false);
  });

  it("locks derp-config-path-missing diagnostic", () => {
    const config = createStableTunSplitConfig();
    config.services = [
      ...(config.services ?? []),
      {
        type: "derp",
        tag: "derp-no-key",
        listen: "::",
        listen_port: 8443,
        tls: { enabled: true },
      } as never,
    ];
    expect(
      validateConfig(config, "stable").some(
        (finding) => finding.code === "derp-config-path-missing",
      ),
    ).toBe(true);

    const last = (config.services as Array<Record<string, unknown>>)[
      (config.services as Array<Record<string, unknown>>).length - 1
    ]!;
    last.config_path = "derper.key";
    expect(
      validateConfig(config, "stable").some(
        (finding) => finding.code === "derp-config-path-missing",
      ),
    ).toBe(false);
  });

  it("seeds tls.enabled=true on derp service scaffold", () => {
    const config = createStableTunSplitConfig();
    config.services = [
      ...(config.services ?? []),
      {
        type: "derp",
        tag: "derp-test",
        listen: "127.0.0.1",
        listen_port: 8443,
        config_path: "derper.key",
        tls: { enabled: true, server_name: "" },
      } as never,
    ];
    expect(
      validateConfig(config, "stable").some((finding) => finding.code === "derp-service-needs-tls"),
    ).toBe(false);

    const derpNoTls = { ...config.services?.[config.services.length - 1] };
    delete (derpNoTls as Record<string, unknown>).tls;
    config.services = [...(config.services ?? []).slice(0, -1), derpNoTls as never];
    expect(
      validateConfig(config, "stable").some((finding) => finding.code === "derp-service-needs-tls"),
    ).toBe(true);
  });

  it("does not seed a dangling tailscale endpoint reference in dns-server scaffold", () => {
    const tailscaleServer = createDnsServer("tailscale", "tailscale-dns") as Record<string, unknown>;
    expect(tailscaleServer).not.toHaveProperty("endpoint");

    const config = createStableTunSplitConfig();
    config.dns = { ...config.dns, servers: [...(config.dns?.servers ?? []), tailscaleServer as never] };
    const diagnosticCodes = validateConfig(config, "stable").map((finding) => finding.code);
    expect(diagnosticCodes).toContain("dns-server-tailscale-endpoint-missing");
  });

  it("adds dependent resources for DNS server scaffolds that require tag references", () => {
    const withTailscale = addDnsServer(createStableTunSplitConfig(), "tailscale", "tailscale-dns");
    const tailscaleServer = withTailscale.dns?.servers?.find((server) => server.tag === "tailscale-dns");
    expect(tailscaleServer).toMatchObject({ type: "tailscale", endpoint: "ts-ep" });
    expect(withTailscale.endpoints?.find((endpoint) => endpoint.tag === "ts-ep")).toMatchObject({ type: "tailscale" });

    const withResolved = addDnsServer(createStableTunSplitConfig(), "resolved", "resolved-dns");
    const resolvedServer = withResolved.dns?.servers?.find((server) => server.tag === "resolved-dns") as Record<string, unknown> | undefined;
    expect(resolvedServer).toMatchObject({ type: "resolved", service: "resolved" });
    expect(withResolved.services?.find((service) => service.tag === "resolved")).toMatchObject({ type: "resolved" });

    expect(validateConfig(withTailscale, "stable").filter((finding) => finding.level === "error")).toEqual([]);
    expect(validateConfig(withResolved, "stable").filter((finding) => finding.level === "error")).toEqual([]);
  });

  it("does not seed legacy DNS server address strings (1.12-A)", () => {
    const httpsServer = createDnsServer("https", "doh-test") as Record<string, unknown>;
    expect(httpsServer).not.toHaveProperty("address");
    expect(httpsServer).toMatchObject({ type: "https", server: "1.1.1.1", server_port: 443, path: "/dns-query" });
  });

  it("seeds tun inbound with dual-stack address by default (1.10-A)", () => {
    const tunInbound = createInbound("tun", "tun-in") as Record<string, unknown>;
    expect(Array.isArray(tunInbound.address)).toBe(true);
    expect(tunInbound.address).toEqual(["172.19.0.1/30", "fdfe:dcba:9876::1/126"]);
  });

  it("omits the network field from scaffolds so sing-box defaults to both TCP and UDP", () => {
    const inboundTypes = ["direct", "naive", "tproxy"];
    for (const type of inboundTypes) {
      const inbound = createInbound(type, `${type}-in`) as Record<string, unknown>;
      expect(inbound).not.toHaveProperty("network");
    }
    const outboundTypes = [
      "shadowsocks",
      "vmess",
      "vless",
      "trojan",
      "hysteria",
      "hysteria2",
      "tuic",
    ];
    for (const type of outboundTypes) {
      const outbound = createOutbound(type, `${type}-out`) as Record<string, unknown>;
      expect(outbound).not.toHaveProperty("network");
    }
  });

  it("emits inbound-users-required error when authenticating inbounds have no users", () => {
    const config = createStableTunSplitConfig();
    const usersRequiredTypes = [
      "vmess",
      "vless",
      "trojan",
      "naive",
      "hysteria",
      "hysteria2",
      "tuic",
      "anytls",
    ] as const;
    config.inbounds = usersRequiredTypes.map((type) => ({
      type,
      tag: `${type}-in`,
      listen: "127.0.0.1",
      listen_port: 1080,
      users: [],
      tls: { enabled: true, server_name: "" },
    } as never));
    const findings = validateConfig(config, "stable").filter(
      (f) => f.code === "inbound-users-required",
    );
    expect(findings).toHaveLength(usersRequiredTypes.length);

    config.inbounds = [
      {
        type: "trojan",
        tag: "trojan-in",
        listen: "127.0.0.1",
        listen_port: 4443,
        users: [{ name: "alice", password: "p" }],
        tls: { enabled: true, server_name: "" },
      } as never,
    ];
    expect(
      validateConfig(config, "stable").filter((f) => f.code === "inbound-users-required"),
    ).toEqual([]);
  });

  it("emits outbound-missing-tls error for every tls-required outbound type", () => {
    const config = createStableTunSplitConfig();
    const tlsRequiredOutbounds = [
      "trojan",
      "naive",
      "hysteria",
      "hysteria2",
      "tuic",
      "anytls",
      "shadowtls",
    ] as const;
    config.outbounds = [
      ...(config.outbounds ?? []),
      ...tlsRequiredOutbounds.map((type) => ({
        type,
        tag: `${type}-out`,
        server: "127.0.0.1",
        server_port: 1080,
      } as never)),
    ];
    const findings = validateConfig(config, "stable").filter(
      (f) => f.code === "outbound-missing-tls",
    );
    expect(findings).toHaveLength(tlsRequiredOutbounds.length);
    for (const type of tlsRequiredOutbounds) {
      expect(findings.some((f) => f.message.includes(type))).toBe(true);
    }
  });

  it("warns on deprecated outbound type=block (1.11-A)", () => {
    const config = createStableTunSplitConfig();
    config.outbounds = [
      ...(config.outbounds ?? []),
      { type: "block", tag: "legacy-block" } as never,
    ];
    const findings = validateConfig(config, "stable").filter(
      (f) => f.code === "outbound-block-deprecated",
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toMatch(/\/outbounds\/\d+/);

    config.outbounds = (config.outbounds ?? []).filter((item) => item.type !== "block");
    expect(
      validateConfig(config, "stable").filter((f) => f.code === "outbound-block-deprecated"),
    ).toEqual([]);
  });

  it("warns on legacy inbound sniff / domain_strategy (1.11-C)", () => {
    const config = createStableTunSplitConfig();
    config.inbounds = [
      {
        type: "mixed",
        tag: "mixed-in",
        listen: "127.0.0.1",
        listen_port: 2080,
        sniff: true,
        sniff_timeout: "1s",
        domain_strategy: "prefer_ipv4",
      } as never,
    ];
    const findings = validateConfig(config, "stable");
    expect(findings.filter((f) => f.code === "inbound-legacy-sniff-deprecated")).toHaveLength(1);
    expect(findings.filter((f) => f.code === "inbound-legacy-domain-strategy-deprecated")).toHaveLength(1);
    expect(
      findings.find((f) => f.code === "inbound-legacy-sniff-deprecated")?.path,
    ).toBe("/inbounds/0/sniff");
    expect(
      findings.find((f) => f.code === "inbound-legacy-domain-strategy-deprecated")?.path,
    ).toBe("/inbounds/0/domain_strategy");

    config.inbounds = [
      { type: "mixed", tag: "mixed-in", listen: "127.0.0.1", listen_port: 2080 } as never,
    ];
    expect(
      validateConfig(config, "stable").filter(
        (f) =>
          f.code === "inbound-legacy-sniff-deprecated" ||
          f.code === "inbound-legacy-domain-strategy-deprecated",
      ),
    ).toEqual([]);
  });

  it("warns on inline tls.acme on testing channel only (1.14-A)", () => {
    const config = createStableTunSplitConfig();
    config.inbounds = [
      ...(config.inbounds ?? []),
      {
        type: "trojan",
        tag: "trojan-in",
        listen: "127.0.0.1",
        listen_port: 4443,
        users: [{ name: "u", password: "p" }],
        tls: {
          enabled: true,
          acme: { domain: ["example.com"], email: "admin@example.com" },
        },
      } as never,
    ];

    expect(
      validateConfig(config, "stable").filter((finding) => finding.code === "tls-acme-deprecated"),
    ).toEqual([]);

    const testingFindings = validateConfig(config, "testing").filter(
      (finding) => finding.code === "tls-acme-deprecated",
    );
    expect(testingFindings).toHaveLength(1);
    expect(testingFindings[0]?.path).toMatch(/\/inbounds\/\d+\/tls\/acme/);
  });

  it("warns on deprecated dial.domain_strategy across outbound / dns-server / endpoint / ntp", () => {
    const config = createStableTunSplitConfig();
    const findings = (cfg: typeof config) =>
      validateConfig(cfg, "stable").filter(
        (diagnostic) => diagnostic.code === "dial-domain-strategy-deprecated",
      );

    expect(findings(config)).toEqual([]);

    const proxyOutbound = config.outbounds?.find((item) => item.tag === "proxy") as Record<string, unknown>;
    proxyOutbound.domain_strategy = "prefer_ipv4";
    expect(findings(config).map((finding) => finding.path)).toContain(
      `/outbounds/${config.outbounds?.findIndex((item) => item.tag === "proxy")}/domain_strategy`,
    );

    const remoteDns = config.dns?.servers?.find((server) => server.tag === "remote-doh") as Record<string, unknown>;
    remoteDns.domain_strategy = "ipv4_only";
    expect(findings(config).some((finding) => finding.path.startsWith("/dns/servers/"))).toBe(true);

    config.endpoints = [
      {
        type: "wireguard",
        tag: "wg-ep",
        domain_strategy: "prefer_ipv6",
      } as never,
    ];
    expect(findings(config).some((finding) => finding.path === "/endpoints/0/domain_strategy")).toBe(true);

    config.ntp = { enabled: true, server: "time.apple.com", domain_strategy: "ipv4_only" } as never;
    expect(findings(config).some((finding) => finding.path === "/ntp/domain_strategy")).toBe(true);
  });

  it("changes inbound and outbound protocol type while preserving tags and references", () => {
    const config = createStableTunSplitConfig();
    const changedOutbound = changeEntityType(config, { kind: "outbound", tag: "hk" }, "http");
    const outbound = changedOutbound.outbounds?.find((item) => item.tag === "hk");

    expect(outbound).toMatchObject({
      type: "http",
      tag: "hk",
      server: "127.0.0.1",
      server_port: 1080,
    });
    expect(changedOutbound.outbounds?.find((item) => item.tag === "proxy")?.outbounds).toContain("hk");

    const changedInbound = changeEntityType(changedOutbound, { kind: "inbound", tag: "tun-in" }, "mixed");
    expect(changedInbound.inbounds?.[0]).toMatchObject({
      type: "mixed",
      tag: "tun-in",
      listen: "127.0.0.1",
    });
  });

  it("changes rule-set resource type while preserving the canonical tag references", () => {
    let config = addRuleSet(createStableTunSplitConfig(), "remote", "geo-rules");
    config = updateRouteRule(config, 0, { rule_set: "geo-rules" });

    const changed = changeEntityType(config, { kind: "rule-set", tag: "geo-rules" }, "local");

    expect(changed.route?.rule_set?.[0]).toMatchObject({
      type: "local",
      tag: "geo-rules",
      format: "source",
      path: "./rules.json",
    });
    expect(changed.route?.rules?.[0]?.rule_set).toBe("geo-rules");
  });

  it("creates inbound setup drafts with the requested official protocol type", () => {
    const setupTypes = [
      "direct",
      "socks",
      "http",
      "shadowsocks",
      "vmess",
      "trojan",
      "naive",
      "hysteria",
      "shadowtls",
      "vless",
      "tuic",
      "hysteria2",
      "anytls",
      "redirect",
      "tproxy",
    ];

    for (const type of setupTypes) {
      const inbound = createInbound(type, `${type}-in`);

      expect(inbound.type).toBe(type);
      expect(inbound.tag).toBe(`${type}-in`);
    }
  });

  it("creates DNS server setup drafts with the requested official server type", () => {
    const setupTypes = ["hosts", "tcp", "udp", "tls", "quic", "https", "h3", "dhcp", "fakeip", "tailscale", "resolved"];

    for (const type of setupTypes) {
      const server = createDnsServer(type, `${type}-dns`);

      expect(server.type).toBe(type);
      expect(server.tag).toBe(`${type}-dns`);
    }
  });

  it("creates endpoint setup drafts from official Endpoint docs", () => {
    const wireguard = createEndpoint("wireguard", "wg-ep");
    const tailscale = createEndpoint("tailscale", "ts-ep");

    expect(wireguard).toMatchObject({
      type: "wireguard",
      tag: "wg-ep",
      address: ["172.16.0.2/32"],
      mtu: 1408,
    });
    expect(tailscale).toMatchObject({
      type: "tailscale",
      tag: "ts-ep",
      state_directory: "$HOME/.tailscale",
    });
  });

  it("renders and validates DNS Tailscale endpoint references", () => {
    const config = createStableTunSplitConfig();
    config.endpoints = [createEndpoint("tailscale", "ts-ep")];
    config.dns = {
      ...config.dns,
      servers: [
        ...(config.dns?.servers ?? []),
        { type: "tailscale", tag: "ts-dns", endpoint: "ts-ep", accept_default_resolvers: false },
      ],
    };

    const { nodes, edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(validateConfig(config, "stable").some((diagnostic) => diagnostic.code === "missing-dns-server-endpoint")).toBe(false);
    expect(nodes.some((node) => node.id === "endpoint:ts-ep" && node.data.kind === "endpoint")).toBe(true);
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge:dns-server-endpoint:ts-dns:ts-ep",
          source: "dns-server:ts-dns",
          target: "endpoint:ts-ep",
          sourceHandle: "endpoint",
          targetHandle: "dns-server",
        }),
      ]),
    );
  });

  it("renames and deletes endpoint tag references", () => {
    const config = createStableTunSplitConfig();
    config.endpoints = [createEndpoint("tailscale", "ts-ep")];
    config.dns = {
      ...config.dns,
      servers: [{ type: "tailscale", tag: "ts-dns", endpoint: "ts-ep", accept_default_resolvers: false }],
    };

    const renamed = renameTag(config, "endpoint", "ts-ep", "tailnet");
    expect(renamed.endpoints?.[0]?.tag).toBe("tailnet");
    expect(renamed.dns?.servers?.[0]?.endpoint).toBe("tailnet");

    const deleted = deleteEntity(renamed, { kind: "endpoint", tag: "tailnet" });
    expect(deleted.endpoints).toEqual([]);
    expect(deleted.dns?.servers?.[0]?.endpoint).toBeUndefined();

    const missing = {
      ...renamed,
      dns: {
        ...renamed.dns,
        servers: [{ type: "tailscale", tag: "ts-dns", endpoint: "missing" }],
      },
    };
    expect(validateConfig(missing, "stable").some((diagnostic) => diagnostic.code === "missing-dns-server-endpoint")).toBe(true);
  });

  it("creates route rule-set resources and renders rule references from canonical JSON", () => {
    let config = addRuleSet(createStableTunSplitConfig(), "remote", "ads-rules");
    config = updateRouteRule(config, 1, { rule_set: "ads-rules" });

    const ruleSet = config.route?.rule_set?.[0];
    const { nodes, edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(ruleSet).toMatchObject({
      type: "remote",
      tag: "ads-rules",
      format: "source",
      url: "https://example.com/rules.json",
    });
    expect(nodes.some((node) => node.id === "rule-set:ads-rules" && node.data.kind === "rule-set")).toBe(true);
    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge:route-rule-set:1:ads-rules",
          source: "route-rule:1",
          target: "rule-set:ads-rules",
        }),
      ]),
    );
  });

  it("validates and cascades rule-set tag references", () => {
    const missing = updateRouteRule(createStableTunSplitConfig(), 0, { rule_set: "missing-rules" });
    expect(validateConfig(missing, "stable").some((diagnostic) => diagnostic.code === "missing-route-rule-set")).toBe(true);

    const withRuleSet = updateRouteRule(addRuleSet(createStableTunSplitConfig(), "remote", "ads-rules"), 0, {
      rule_set: "ads-rules",
    });
    const renamed = renameTag(withRuleSet, "rule-set", "ads-rules", "privacy-rules");

    expect(renamed.route?.rule_set?.[0]?.tag).toBe("privacy-rules");
    expect(renamed.route?.rules?.[0]?.rule_set).toBe("privacy-rules");
    expect(validateConfig(renamed, "stable").some((diagnostic) => diagnostic.code === "missing-route-rule-set")).toBe(false);
  });

  it("renders inbound rule matchers and rule-set download detours from official tag fields", () => {
    let config = addRuleSet(createStableTunSplitConfig(), "remote", "remote-rules");
    config = updateRouteRule(config, 0, { inbound: "tun-in", rule_set: "remote-rules" });
    config.dns = {
      ...config.dns,
      rules: [{ inbound: "tun-in", rule_set: "remote-rules", server: "local-dns" }],
    };
    const firstRuleSet = config.route?.rule_set?.[0];
    if (!firstRuleSet) throw new Error("missing rule-set fixture");
    config.route!.rule_set![0] = {
      ...firstRuleSet,
      download_detour: "proxy",
    };

    const { edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge:route-rule-inbound:0:tun-in",
          source: "inbound:tun-in",
          target: "route-rule:0",
          sourceHandle: "route-rule-match",
          targetHandle: "inbound",
        }),
        expect.objectContaining({
          id: "edge:dns-rule-inbound:0:tun-in",
          source: "inbound:tun-in",
          target: "dns-rule:0",
          sourceHandle: "dns-rule-match",
          targetHandle: "inbound",
        }),
        expect.objectContaining({
          id: "edge:rule-set-download:remote-rules:proxy",
          source: "rule-set:remote-rules",
          target: "outbound:proxy",
          sourceHandle: "download-detour",
          targetHandle: "rule-set-download",
        }),
      ]),
    );
  });

  it("keeps dense rule-set imports table-owned instead of rendering every resource node", () => {
    const config = createStableTunSplitConfig();
    config.route = {
      ...config.route,
      rule_set: Array.from({ length: 40 }, (_, index) => ({
        type: "remote",
        tag: `rules-${index}`,
        format: "source",
        url: `https://example.com/rules-${index}.json`,
      })),
      rules: [{ rule_set: "rules-0", outbound: "direct" }],
    };

    const { nodes, edges } = deriveGraph(config, { positions: {} }, validateConfig(config, "stable"));

    expect(nodes.filter((node) => node.data.kind === "rule-set")).toHaveLength(0);
    expect(edges.some((edge) => edge.id.startsWith("edge:route-rule-set"))).toBe(false);
  });

  it("derives settings nodes whenever the config has the singleton, regardless of layout pinning", () => {
    const config = ensureSettings(createStableTunSplitConfig(), "log");

    expect(deriveGraph(config, { positions: {} }, []).nodes.some((node) => node.id === "settings:log")).toBe(true);
    expect(
      deriveGraph(config, { positions: { "settings:log": { x: -300, y: 40 } } }, []).nodes.some(
        (node) => node.id === "settings:log" && node.data.kind === "settings",
      ),
    ).toBe(true);
  });

  it("creates independent settings defaults from official top-level docs", () => {
    const withNtp = ensureSettings(createStableTunSplitConfig(), "ntp");
    const withCertificate = ensureSettings(withNtp, "certificate");
    const withExperimental = ensureSettings(withCertificate, "experimental");

    expect(withExperimental.ntp).toMatchObject({
      enabled: false,
      server: "time.apple.com",
      server_port: 123,
      interval: "30m",
    });
    expect(withExperimental.certificate).toMatchObject({
      store: "system",
      certificate: [],
      certificate_path: [],
      certificate_directory_path: [],
    });
    expect(withExperimental.experimental?.cache_file).toMatchObject({
      enabled: false,
      path: "",
      cache_id: "",
      store_fakeip: false,
    });
    const settingsNodes = deriveGraph(withExperimental, { positions: {} }, []).nodes.filter(
      (node) => node.data.kind === "settings",
    );
    const expectedSettings = ["log", "ntp", "certificate", "experimental"].filter(
      (key) =>
        withExperimental[key as keyof typeof withExperimental] &&
        typeof withExperimental[key as keyof typeof withExperimental] === "object",
    );
    expect(settingsNodes.map((node) => node.id).sort()).toEqual(
      expectedSettings.map((key) => `settings:${key}`).sort(),
    );
  });

  it("emits vmess/vless validation diagnostics (uuid, alterId, flow/multiplex)", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        { type: "vmess", tag: "vmess-bad", server: "1.1.1.1", server_port: 443, uuid: "", alter_id: 4, tls: { enabled: true } },
        { type: "vmess", tag: "vmess-uuid-bad", server: "1.1.1.1", server_port: 443, uuid: "not-a-uuid", tls: { enabled: true } },
        {
          type: "vless",
          tag: "vless-conflict",
          server: "1.1.1.1",
          server_port: 443,
          uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
          flow: "xtls-rprx-vision",
          multiplex: { enabled: true },
          tls: { enabled: true },
        },
      ],
      inbounds: [
        ...(base.inbounds ?? []),
        { type: "vmess", tag: "vmess-in", listen: "127.0.0.1", listen_port: 2080, users: [{ name: "u", uuid: "", alterId: 8 }], tls: { enabled: true } },
      ],
    } as typeof base;

    const diagnostics = validateConfig(config, "testing");
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("vmess-missing-uuid");
    expect(codes).toContain("vmess-invalid-uuid");
    expect(codes).toContain("vmess-alterid-deprecated");
    expect(codes).toContain("vless-flow-multiplex-conflict");
    expect(codes).toContain("user-missing-uuid");
  });

  it("flags testing-only hysteria2 and tun fields when channel is stable", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        {
          type: "hysteria2",
          tag: "h2-realm",
          server: "1.1.1.1",
          server_port: 443,
          password: "x",
          tls: { enabled: true },
          realm: { server: "rendezvous.example.com" },
          bbr_profile: "aggressive",
          hop_interval_max: "30s",
        },
      ],
      inbounds: [
        ...(base.inbounds ?? []),
        {
          type: "tun",
          tag: "tun-testing",
          address: ["172.20.0.1/30"],
          dns_mode: "hijack",
          dns_address: ["1.1.1.1"],
          include_mac_address: ["aa:bb:cc:dd:ee:ff"],
        },
      ],
    } as typeof base;
    const stable = validateConfig(config, "stable");
    const codes = stable.map((d) => d.code);
    expect(codes).toContain("hysteria2-realm-testing-only");
    expect(codes).toContain("hysteria2-bbr-profile-testing-only");
    expect(codes).toContain("hysteria2-hop-interval-max-testing-only");
    expect(codes).toContain("tun-dns-mode-testing-only");
    expect(codes).toContain("tun-dns-address-testing-only");
    expect(codes).toContain("tun-mac-address-filter-testing-only");
    const testing = validateConfig(config, "testing");
    const testingCodes = testing.map((d) => d.code);
    expect(testingCodes).not.toContain("hysteria2-realm-testing-only");
    expect(testingCodes).not.toContain("tun-dns-mode-testing-only");
  });

  it("flags route hub 1.14 fields + dns rule 1.14 matchers on stable channel", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      route: {
        ...((base.route as Record<string, unknown>) ?? {}),
        find_neighbor: true,
        dhcp_lease_files: ["/var/lib/dhcp/dhcpd.leases"],
        default_http_client: { detour: "direct" },
      },
      dns: {
        ...((base.dns as Record<string, unknown>) ?? {}),
        rules: [
          ...(((base.dns as Record<string, unknown>)?.rules as Record<string, unknown>[]) ?? []),
          { source_mac_address: ["aa:bb:cc:dd:ee:ff"], source_hostname: ["host.local"], server: "x" },
          { preferred_by: ["best-server"], match_response: true, package_name_regex: ["^com\\.example$"], server: "x" },
        ],
      },
    } as typeof base;
    const stable = validateConfig(config, "stable").map((d) => d.code);
    expect(stable).toContain("route-find-neighbor-testing-only");
    expect(stable).toContain("route-dhcp-lease-files-testing-only");
    expect(stable).toContain("route-default-http-client-testing-only");
    expect(stable).toContain("dns-rule-source-mac-address-testing-only");
    expect(stable).toContain("dns-rule-source-hostname-testing-only");
    expect(stable).toContain("dns-rule-preferred-by-testing-only");
    expect(stable).toContain("dns-rule-match-response-testing-only");
    expect(stable).toContain("dns-rule-package-name-regex-testing-only");
    const testing = validateConfig(config, "testing").map((d) => d.code);
    expect(testing).not.toContain("route-find-neighbor-testing-only");
  });

  it("flags cache_file store_rdrc + store_dns version state", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      experimental: {
        ...((base as Record<string, unknown>).experimental as Record<string, unknown> | undefined ?? {}),
        cache_file: { enabled: true, store_rdrc: true, store_dns: true },
      },
    } as typeof base;
    const stable = validateConfig(config, "stable").map((d) => d.code);
    expect(stable).toContain("cache-file-store-rdrc-deprecated");
    expect(stable).toContain("cache-file-store-dns-testing-only");
    const testing = validateConfig(config, "testing").map((d) => d.code);
    expect(testing).toContain("cache-file-store-rdrc-deprecated");
    expect(testing).not.toContain("cache-file-store-dns-testing-only");
  });

  it("flags fakeip DNS server missing inet4/6_range + tailscale missing endpoint", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...((base.dns as Record<string, unknown>) ?? {}),
        servers: [
          ...(((base.dns as Record<string, unknown>)?.servers as Record<string, unknown>[]) ?? []),
          { type: "fakeip", tag: "fakeip-broken" },
          { type: "tailscale", tag: "ts-broken" },
        ],
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("dns-server-fakeip-range-missing");
    expect(codes).toContain("dns-server-tailscale-endpoint-missing");
  });

  it("flags top-level dns.fakeip as deprecated", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...((base.dns as Record<string, unknown>) ?? {}),
        fakeip: { enabled: true, inet4_range: "198.18.0.0/15" },
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("legacy-fakeip-deprecated");
  });

  it("flags deprecated direct.override_address / override_port", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        { type: "direct", tag: "lan", override_address: "10.0.0.1" },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("direct-override-deprecated");
  });

  it("flags hysteria2 server_port + server_ports overlap", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        {
          type: "hysteria2",
          tag: "h2-ports",
          server: "1.1.1.1",
          server_port: 443,
          server_ports: ["2080:3000"],
          password: "x",
          tls: { enabled: true },
        },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("hysteria2-server-port-vs-server-ports");
  });

  it("flags tuic udp_over_stream + udp_relay_mode mutual exclusion", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        {
          type: "tuic",
          tag: "tuic-conflict",
          server: "1.1.1.1",
          server_port: 443,
          uuid: "11111111-2222-3333-4444-555555555555",
          password: "x",
          tls: { enabled: true },
          udp_relay_mode: "quic",
          udp_over_stream: true,
        },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("tuic-udp-mode-conflict");
  });

  it("flags an invalid urltest url scheme but NOT a missing url (url has a documented default)", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        { type: "urltest", tag: "ut1", outbounds: ["direct"] },
        { type: "urltest", tag: "ut2", outbounds: ["direct"], url: "ftp://example.com" },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    // urltest.md: `url` is optional — "https://www.gstatic.com/generate_204 will be used if empty". An empty
    // url is purposeful and spec-compliant, so it must NOT be flagged. A set-but-malformed scheme still is.
    expect(codes).not.toContain("urltest-url-missing");
    expect(codes).toContain("urltest-url-invalid-scheme");
  });

  it("flags missing derp config_path and ntp.server when enabled", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      services: [
        ...(((base as Record<string, unknown>).services as Record<string, unknown>[]) ?? []),
        { type: "derp", tag: "derp", config_path: "" },
      ],
      ntp: { enabled: true, server: "" },
    } as unknown as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("derp-config-path-missing");
    expect(codes).toContain("ntp-server-missing");

    const configWithDangling = {
      ...base,
      ntp: { enabled: true, server: "time.cloudflare.com", server_port: 123, detour: "ghost-out" },
    } as typeof base;
    const codes2 = validateConfig(configWithDangling, "stable").map((d) => d.code);
    expect(codes2).toContain("ntp-detour-missing");
  });

  it("flags testing-only ssh allow-lists and tailscale accept_search_domain on stable", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        {
          type: "ssh",
          tag: "ssh-out",
          server: "1.2.3.4",
          server_port: 22,
          user: "x",
          password: "y",
          cipher: ["aes128-ctr"],
          mac: ["hmac-sha2-256"],
          kex_algorithm: ["curve25519-sha256"],
        },
      ],
      dns: {
        ...(base.dns ?? {}),
        servers: [
          ...((base.dns?.servers as Record<string, unknown>[]) ?? []),
          { type: "tailscale", tag: "ts", endpoint: "ts-ep", accept_search_domain: true },
        ],
      },
      endpoints: [
        ...(((base as Record<string, unknown>).endpoints as Record<string, unknown>[]) ?? []),
        { type: "tailscale", tag: "ts-ep", auth_key: "ak" },
      ],
    } as typeof base;
    const stable = validateConfig(config, "stable");
    const codes = stable.map((d) => d.code);
    expect(codes).toContain("ssh-cipher-testing-only");
    expect(codes).toContain("ssh-mac-testing-only");
    expect(codes).toContain("ssh-kex-algorithm-testing-only");
    expect(codes).toContain("dns-server-tailscale-accept-search-domain-testing-only");
    const testing = validateConfig(config, "testing");
    const testingCodes = testing.map((d) => d.code);
    expect(testingCodes).not.toContain("ssh-cipher-testing-only");
    expect(testingCodes).not.toContain("dns-server-tailscale-accept-search-domain-testing-only");
  });

  it("emits dns-rule-mixed-legacy-and-modern-conflict for mixed ip_cidr + ip_version rule", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        rules: [
          ...((base.dns?.rules as Record<string, unknown>[]) ?? []),
          { ip_cidr: ["198.18.0.0/15"], ip_version: 4, server: "fakeip" },
        ],
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("dns-rule-mixed-legacy-and-modern-conflict");
  });

  it("emits dns-server-legacy-address-deprecated when address uses tcp://...", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        servers: [
          ...((base.dns?.servers as Record<string, unknown>[]) ?? []),
          { type: "udp", tag: "legacy", address: "tcp://1.1.1.1" },
        ],
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("dns-server-legacy-address-deprecated");
  });

  it("emits outbound-dns-legacy-deprecated + outbound-wireguard-legacy-deprecated", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        { type: "dns", tag: "dns-out" },
        { type: "wireguard", tag: "wg-out" },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("outbound-dns-legacy-deprecated");
    expect(codes).toContain("outbound-wireguard-legacy-deprecated");
  });

  it("emits tun-legacy-address-fields-deprecated when tun uses inet4_address", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      inbounds: [
        ...(base.inbounds ?? []),
        { type: "tun", tag: "legacy-tun", inet4_address: "172.19.0.1/30" },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("tun-legacy-address-fields-deprecated");
  });

  it("emits dns-rule-outbound-matcher-deprecated when a DNS rule uses outbound: matcher", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        rules: [
          ...((base.dns?.rules as Record<string, unknown>[]) ?? []),
          { outbound: "proxy", server: "fakeip" },
        ],
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("dns-rule-outbound-matcher-deprecated");
  });

  it("emits dns-rule-legacy-address-filter-deprecated when ip_cidr is used without match_response", () => {
    const base = createStableTunSplitConfig();
    const configWithoutMatch = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        rules: [
          ...((base.dns?.rules as Record<string, unknown>[]) ?? []),
          { ip_cidr: ["198.18.0.0/15"], server: "fakeip" },
        ],
      },
    } as typeof base;
    const noMatchCodes = validateConfig(configWithoutMatch, "stable").map((d) => d.code);
    expect(noMatchCodes).toContain("dns-rule-legacy-address-filter-deprecated");
    const configWithMatch = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        rules: [
          ...((base.dns?.rules as Record<string, unknown>[]) ?? []),
          { ip_cidr: ["198.18.0.0/15"], match_response: true, server: "fakeip" },
        ],
      },
    } as typeof base;
    const matchCodes = validateConfig(configWithMatch, "stable").map((d) => d.code);
    expect(matchCodes).not.toContain("dns-rule-legacy-address-filter-deprecated");
  });

  it("emits v2ray-stats-inbound-missing + outbound-missing when stats references unknown tags", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      experimental: {
        ...(base.experimental ?? {}),
        v2ray_api: {
          listen: "127.0.0.1:8443",
          stats: {
            enabled: true,
            inbounds: ["does-not-exist"],
            outbounds: ["also-not-real"],
          },
        },
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("v2ray-stats-inbound-missing");
    expect(codes).toContain("v2ray-stats-outbound-missing");
  });

  it("does NOT emit v2ray-stats-*-missing when tags exist", () => {
    const base = createStableTunSplitConfig();
    const existingInboundTag = base.inbounds?.[0]?.tag;
    const existingOutboundTag = base.outbounds?.[0]?.tag;
    expect(existingInboundTag).toBeTruthy();
    expect(existingOutboundTag).toBeTruthy();
    const config = {
      ...base,
      experimental: {
        ...(base.experimental ?? {}),
        v2ray_api: {
          listen: "127.0.0.1:8443",
          stats: {
            enabled: true,
            inbounds: [existingInboundTag!],
            outbounds: [existingOutboundTag!],
          },
        },
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).not.toContain("v2ray-stats-inbound-missing");
    expect(codes).not.toContain("v2ray-stats-outbound-missing");
  });

  it("emits dns-optimistic-testing-only + dns-timeout-testing-only on stable channel", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        optimistic: true,
        timeout: "5s",
      },
    } as typeof base;
    const stableCodes = validateConfig(config, "stable").map((d) => d.code);
    expect(stableCodes).toContain("dns-optimistic-testing-only");
    expect(stableCodes).toContain("dns-timeout-testing-only");
    const testingCodes = validateConfig(config, "testing").map((d) => d.code);
    expect(testingCodes).not.toContain("dns-optimistic-testing-only");
    expect(testingCodes).not.toContain("dns-timeout-testing-only");
  });

  it("emits rule-set-format-missing when remote URL extension is unknown and format is unset", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      route: {
        ...(base.route ?? {}),
        rule_set: [
          ...(((base.route as Record<string, unknown>)?.rule_set as Record<string, unknown>[]) ?? []),
          { type: "remote", tag: "ads", url: "https://example.com/ads.txt" },
        ],
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("rule-set-format-missing");
  });

  it("does NOT emit rule-set-format-missing when url ends in .srs or .json or format is set", () => {
    const base = createStableTunSplitConfig();
    const variants = [
      { url: "https://example.com/ads.srs" },
      { url: "https://example.com/ads.json" },
      { url: "https://example.com/ads.txt", format: "binary" },
    ];
    for (const variant of variants) {
      const config = {
        ...base,
        route: {
          ...(base.route ?? {}),
          rule_set: [
            ...(((base.route as Record<string, unknown>)?.rule_set as Record<string, unknown>[]) ?? []),
            { type: "remote", tag: "ads", ...variant },
          ],
        },
      } as typeof base;
      const codes = validateConfig(config, "stable").map((d) => d.code);
      expect(codes).not.toContain("rule-set-format-missing");
    }
  });

  it("emits endpoint-tailscale-advertise-tags-1-13-only + system-interface gate on testing channel", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      endpoints: [
        ...(((base as Record<string, unknown>).endpoints as Record<string, unknown>[]) ?? []),
        {
          type: "tailscale",
          tag: "ts-ep",
          auth_key: "tskey",
          advertise_tags: ["tag:server"],
          system_interface: true,
        },
      ],
    } as typeof base;
    // advertise_tags / system_interface are 1.13+ fields, so they are flagged on the 1.12 target.
    const codes = validateConfig(config, "stable", "1.12").map((d) => d.code);
    expect(codes).toContain("endpoint-tailscale-advertise-tags-1-13-only");
    expect(codes).toContain("endpoint-tailscale-system-interface-1-13-only");
  });

  it("emits hysteria-realm-users-required when users[] is empty", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      services: [
        ...(((base as Record<string, unknown>).services as Record<string, unknown>[]) ?? []),
        { type: "hysteria-realm", tag: "realm", users: [] },
      ],
    } as typeof base;
    const codes = validateConfig(config, "testing").map((d) => d.code);
    expect(codes).toContain("hysteria-realm-users-required");
  });

  it("emits hysteria-realm-user-token-placeholder when token is 'change-me'", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      services: [
        ...(((base as Record<string, unknown>).services as Record<string, unknown>[]) ?? []),
        {
          type: "hysteria-realm",
          tag: "realm",
          users: [{ name: "alice", token: "change-me" }],
        },
      ],
    } as typeof base;
    const codes = validateConfig(config, "testing").map((d) => d.code);
    expect(codes).toContain("hysteria-realm-user-token-placeholder");
    expect(codes).not.toContain("hysteria-realm-user-token-required");
  });

  it("emits hysteria-realm-user-token-required when token is empty", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      services: [
        ...(((base as Record<string, unknown>).services as Record<string, unknown>[]) ?? []),
        { type: "hysteria-realm", tag: "realm", users: [{ name: "alice", token: "" }] },
      ],
    } as typeof base;
    const codes = validateConfig(config, "testing").map((d) => d.code);
    expect(codes).toContain("hysteria-realm-user-token-required");
  });

  it("flags a public ccm service without a secret, but NOT empty users (empty = no-auth, documented)", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      services: [
        ...(((base as Record<string, unknown>).services as Record<string, unknown>[]) ?? []),
        { type: "ccm", tag: "ccm", listen: "0.0.0.0", users: [] },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    // service/ccm.md: empty users = "no authentication required" (a documented mode) — clients are NOT
    // rejected, so the old ccm-users-empty warning was noise + factually wrong and was removed. The real
    // risk (a public listen with no auth) is still covered by ccm-public-listen.
    expect(codes).not.toContain("ccm-users-empty");
    expect(codes).toContain("ccm-public-listen");
  });

  it("does NOT emit ccm-users-empty/public-listen when service is properly configured", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      services: [
        ...(((base as Record<string, unknown>).services as Record<string, unknown>[]) ?? []),
        {
          type: "ccm",
          tag: "ccm",
          listen: "127.0.0.1",
          users: [{ name: "alice", token: "secret-token" }],
        },
      ],
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).not.toContain("ccm-users-empty");
    expect(codes).not.toContain("ccm-public-listen");
  });

  it("emits dns-server-dhcp-interface-empty when interface is set to an empty string", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        servers: [
          ...((base.dns?.servers as Record<string, unknown>[]) ?? []),
          { type: "dhcp", tag: "dhcp", interface: "" },
        ],
      },
    } as typeof base;
    const codes = validateConfig(config, "stable").map((d) => d.code);
    expect(codes).toContain("dns-server-dhcp-interface-empty");
  });

  it("does NOT emit dns-server-dhcp-interface-empty when interface is omitted or non-empty", () => {
    const base = createStableTunSplitConfig();
    const omittedConfig = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        servers: [
          ...((base.dns?.servers as Record<string, unknown>[]) ?? []),
          { type: "dhcp", tag: "dhcp-default" },
        ],
      },
    } as typeof base;
    expect(
      validateConfig(omittedConfig, "stable")
        .map((d) => d.code)
        .filter((c) => c === "dns-server-dhcp-interface-empty"),
    ).toHaveLength(0);
    const populatedConfig = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        servers: [
          ...((base.dns?.servers as Record<string, unknown>[]) ?? []),
          { type: "dhcp", tag: "dhcp-eth", interface: "eth0" },
        ],
      },
    } as typeof base;
    expect(
      validateConfig(populatedConfig, "stable")
        .map((d) => d.code)
        .filter((c) => c === "dns-server-dhcp-interface-empty"),
    ).toHaveLength(0);
  });

  it("emits dns-server-neighbor-domain-testing-only on stable only", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      dns: {
        ...(base.dns ?? {}),
        servers: [
          ...((base.dns?.servers as Record<string, unknown>[]) ?? []),
          { type: "local", tag: "lo", neighbor_domain: ["home.lan"] },
        ],
      },
    } as typeof base;
    const stableCodes = validateConfig(config, "stable").map((d) => d.code);
    expect(stableCodes).toContain("dns-server-neighbor-domain-testing-only");
    const testingCodes = validateConfig(config, "testing").map((d) => d.code);
    expect(testingCodes).not.toContain("dns-server-neighbor-domain-testing-only");
  });

  it("emits reality + xtls-rprx-vision diagnostics", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        {
          type: "vless",
          tag: "reality-out",
          server: "1.1.1.1",
          server_port: 443,
          uuid: "11111111-2222-3333-4444-555555555555",
          tls: {
            enabled: true,
            server_name: "x",
            reality: { enabled: true, public_key: "", short_id: "ZZ" },
          },
        },
        {
          type: "vless",
          tag: "flow-without-tls",
          server: "1.1.1.1",
          server_port: 443,
          uuid: "11111111-2222-3333-4444-555555555555",
          flow: "xtls-rprx-vision",
          tls: { enabled: false },
        },
      ],
      inbounds: [
        ...(base.inbounds ?? []),
        {
          type: "vless",
          tag: "reality-in",
          listen: "::",
          listen_port: 2080,
          users: [{ name: "u", uuid: "11111111-2222-3333-4444-555555555555" }],
          tls: { enabled: true, reality: { enabled: true } },
        },
      ],
    } as typeof base;
    const diagnostics = validateConfig(config, "stable");
    const codes = diagnostics.map((d) => d.code);
    expect(codes).toContain("reality-public-key-missing");
    expect(codes).toContain("reality-short-id-invalid");
    expect(codes).toContain("vless-flow-requires-tls");
    expect(codes).toContain("reality-private-key-missing");
    expect(codes).toContain("reality-handshake-server-missing");
  });

  it("emits required-server / required-TLS / selector-default diagnostics", () => {
    const base = createStableTunSplitConfig();
    const config = {
      ...base,
      outbounds: [
        ...(base.outbounds ?? []),
        { type: "trojan", tag: "missing-server", server: "", server_port: 0, password: "x" },
        { type: "vless", tag: "no-tls", server: "1.1.1.1", server_port: 443, uuid: "abc" },
        { type: "selector", tag: "empty-group", outbounds: [], default: "" },
        { type: "selector", tag: "stale-default", outbounds: ["proxy"], default: "ghost" },
      ],
    } as typeof base;
    const stable = validateConfig(config, "stable");
    const codes = stable.map((d) => d.code);
    expect(codes).toContain("outbound-missing-server");
    expect(codes).toContain("outbound-invalid-server-port");
    expect(codes).toContain("outbound-missing-tls"); // vless requires TLS by default
    expect(codes).toContain("group-outbound-empty");
    expect(codes).toContain("selector-default-not-in-candidates");
  });

  it("cascades selector default, dial detour, ntp/clash/rule-set detour on rename and delete", () => {
    const seeded = renameTag(
      {
        outbounds: [
          { type: "direct", tag: "direct" },
          { type: "direct", tag: "fallback" },
          { type: "selector", tag: "auto", outbounds: ["direct", "fallback"], default: "direct" },
          { type: "trojan", tag: "trojan", server: "1.1.1.1", server_port: 443, password: "x", detour: "direct" },
        ],
        ntp: { enabled: true, server: "time.cloudflare.com", server_port: 123, detour: "direct" },
        route: {
          rule_set: [{ type: "remote", tag: "rules", url: "https://x", download_detour: "direct" }],
        },
        experimental: { clash_api: { external_ui_download_detour: "direct" } },
      } as unknown as ReturnType<typeof createStableTunSplitConfig>,
      "outbound",
      "direct",
      "lan",
    );
    const renamedAuto = seeded.outbounds?.find((o) => o.tag === "auto");
    expect(renamedAuto?.default).toBe("lan");
    expect(seeded.outbounds?.find((o) => o.tag === "trojan")?.detour).toBe("lan");
    expect((seeded.ntp as Record<string, unknown>)?.detour).toBe("lan");
    expect(seeded.route?.rule_set?.[0]?.download_detour).toBe("lan");
    expect((seeded.experimental as Record<string, unknown>)?.clash_api).toMatchObject({
      external_ui_download_detour: "lan",
    });

    const deleted = deleteEntity(seeded, { kind: "outbound", tag: "lan" });
    expect(deleted.outbounds?.find((o) => o.tag === "auto")?.default).toBeUndefined();
    expect(deleted.outbounds?.find((o) => o.tag === "trojan")?.detour).toBeUndefined();
    expect((deleted.ntp as Record<string, unknown>)?.detour).toBeUndefined();
    expect(deleted.route?.rule_set?.[0]?.download_detour).toBeUndefined();
    expect((deleted.experimental as Record<string, unknown>)?.clash_api).toMatchObject({
      external_ui_download_detour: undefined,
    });
  });

  it("flags Clash API misconfigurations (dangling download_detour, public listen without secret)", () => {
    const base = createStableTunSplitConfig();
    const dangling = {
      ...base,
      experimental: {
        ...(base.experimental ?? {}),
        clash_api: {
          external_controller: "127.0.0.1:9090",
          external_ui_download_detour: "no-such-outbound",
        },
      },
    } as typeof base;
    expect(validateConfig(dangling, "stable").some((d) => d.code === "clash-api-download-detour-missing")).toBe(true);

    const publicListen = {
      ...base,
      experimental: {
        ...(base.experimental ?? {}),
        clash_api: {
          external_controller: "0.0.0.0:9090",
        },
      },
    } as typeof base;
    expect(validateConfig(publicListen, "stable").some((d) => d.code === "clash-api-public-listen-without-secret")).toBe(true);

    const secured = {
      ...base,
      experimental: {
        ...(base.experimental ?? {}),
        clash_api: {
          external_controller: "0.0.0.0:9090",
          secret: "shhh",
        },
      },
    } as typeof base;
    expect(validateConfig(secured, "stable").some((d) => d.code === "clash-api-public-listen-without-secret")).toBe(false);
  });

  it("flags rule-set issues (missing url/path/detour reference, empty inline rules, testing deprecation)", () => {
    const config = createStableTunSplitConfig();
    const ruleSets = (config.route?.rule_set ?? []).slice();
    const next = {
      ...config,
      route: {
        ...config.route,
        rule_set: [
          ...ruleSets,
          { type: "remote", tag: "no-url", format: "binary" },
          { type: "remote", tag: "bad-detour", format: "binary", url: "https://example.com/rules.srs", download_detour: "missing-outbound" },
          { type: "local", tag: "missing-path", format: "source" },
          { type: "inline", tag: "no-rules", rules: [] },
          { type: "remote", tag: "with-detour", format: "binary", url: "https://example.com/x.srs", download_detour: "direct" },
        ],
      },
    } as typeof config;

    const stable = validateConfig(next, "stable");
    expect(stable.some((diagnostic) => diagnostic.code === "rule-set-remote-missing-url")).toBe(true);
    expect(stable.some((diagnostic) => diagnostic.code === "rule-set-download-detour-missing")).toBe(true);
    expect(stable.some((diagnostic) => diagnostic.code === "rule-set-local-missing-path")).toBe(true);
    expect(stable.some((diagnostic) => diagnostic.code === "rule-set-inline-empty")).toBe(true);
    expect(stable.some((diagnostic) => diagnostic.code === "rule-set-download-detour-deprecated")).toBe(false);

    const testing = validateConfig(next, "testing");
    expect(testing.some((diagnostic) => diagnostic.code === "rule-set-download-detour-deprecated")).toBe(true);
  });

  it("flags a domain host without a resolver ONLY when none is reachable (no per-entity domain_resolver, no route.default_domain_resolver, and more than one DNS server)", () => {
    // dial.md, for DIAL FIELDS (outbounds/endpoints): "domain_resolver or route.default_domain_resolver is
    // optional when only one DNS server is configured." So an OUTBOUND domain server is covered when
    // route.default_domain_resolver is set OR exactly one DNS server exists. NOTE (A6): this fallback does
    // NOT apply to a DNS SERVER's own domain address — a domain DNS server must set its own per-server
    // domain_resolver (binary rejects otherwise, all versions), asserted separately below and in the A6 block.
    const domainOutbound: Record<string, unknown> = { type: "trojan", tag: "remote-host", server: "example.com", server_port: 443, password: "x", tls: { enabled: true } };
    const twoDnsServers: Record<string, unknown>[] = [
      { type: "local", tag: "LocalDNS" },
      { type: "tls", tag: "RemoteDNS", server: "cloudflare-dns.com", server_port: 853 },
    ];
    const codesOf = (c: unknown) => validateConfig(c as ReturnType<typeof createStableTunSplitConfig>, "testing").map((d) => d.code);
    const dsDiag = (c: unknown) => validateConfig(c as ReturnType<typeof createStableTunSplitConfig>, "testing").find((d) => d.code === "dns-server-domain-without-resolver");

    // A — route.default_domain_resolver set + 2 DNS servers. The OUTBOUND is covered by the default, so it is
    // silent. But the DOMAIN DNS server "RemoteDNS" (cloudflare-dns.com, no per-server resolver) is NOT
    // covered by the default — binary REJECTS this exact config on all three versions ("missing domain
    // resolver for domain server address"), so it is an error (A6 — this was #303's over-application).
    const withDefault = { ...createStableTunSplitConfig(), outbounds: [domainOutbound], dns: { servers: twoDnsServers }, route: { default_domain_resolver: "LocalDNS" } };
    expect(codesOf(withDefault)).not.toContain("outbound-domain-without-resolver");
    expect(dsDiag(withDefault)?.level).toBe("error");

    // B — no default + 2 DNS servers: the outbound now also lacks a resolver, and RemoteDNS still does.
    const noDefault = { ...withDefault, route: {} };
    expect(codesOf(noDefault)).toContain("outbound-domain-without-resolver");
    expect(dsDiag(noDefault)?.level).toBe("error");

    // C — no default but exactly ONE DNS server: implicit single-server fallback, no warning.
    const singleServer = { ...noDefault, dns: { servers: [{ type: "local", tag: "OnlyDNS" }] as never } };
    expect(codesOf(singleServer)).not.toContain("outbound-domain-without-resolver");

    // D — a per-outbound domain_resolver covers it even with no default + multiple servers.
    const perOutbound = { ...noDefault, outbounds: [{ ...domainOutbound, domain_resolver: "RemoteDNS" }] as never };
    expect(codesOf(perOutbound)).not.toContain("outbound-domain-without-resolver");

    // E — an IP server never warns.
    const ipServer = { ...noDefault, outbounds: [{ type: "trojan", tag: "ip-host", server: "1.1.1.1", server_port: 443, password: "x", tls: { enabled: true } }] as never };
    expect(codesOf(ipServer)).not.toContain("outbound-domain-without-resolver");
  });

  // ── A6: dns-server-domain-without-resolver is an ERROR; only a per-server domain_resolver covers it ⚠️#303
  // Binary-verified on 1.12/1.13/1.14 (check FATAL "missing domain resolver for domain server address"): a
  // DOMAIN DNS server must set its OWN per-server domain_resolver. route.default_domain_resolver and the
  // single-DNS-server fallback (which DO cover dial fields) do NOT cover a DNS server's self-resolution.
  // #303 wrongly applied the dial-field implicit-cover here, masking a hard error.
  describe("A6: domain DNS server requires a per-server domain_resolver (error, revises #303)", () => {
    const dsDiag = (config: unknown) =>
      validateConfig(config as SingBoxConfig, "testing").find((d) => d.code === "dns-server-domain-without-resolver");

    it("domain DNS server, no per-server resolver, WITH route.default_domain_resolver → error (default does not cover a DNS server)", () => {
      const c = { dns: { servers: [{ type: "https", tag: "doh", server: "dns.google" }, { type: "udp", tag: "u", server: "1.1.1.1" }] }, route: { default_domain_resolver: "u" }, outbounds: [{ type: "direct", tag: "d" }] };
      expect(dsDiag(c)?.level).toBe("error");
    });

    it("domain DNS server, no per-server resolver, SINGLE DNS server → error (single-DNS fallback does not cover a DNS server)", () => {
      const c = { dns: { servers: [{ type: "https", tag: "doh", server: "dns.google" }] }, outbounds: [{ type: "direct", tag: "d" }] };
      expect(dsDiag(c)?.level).toBe("error");
    });

    it("domain DNS server WITH its own per-server domain_resolver → silent", () => {
      const c = { dns: { servers: [{ type: "https", tag: "doh", server: "dns.google", domain_resolver: "u" }, { type: "udp", tag: "u", server: "1.1.1.1" }] }, route: { default_domain_resolver: "u" }, outbounds: [{ type: "direct", tag: "d" }] };
      expect(dsDiag(c)).toBeUndefined();
    });

    it("IP-literal DNS server with no resolver → silent (single-server optionality still saves IP servers)", () => {
      const c = { dns: { servers: [{ type: "tls", tag: "ip", server: "1.1.1.1", server_port: 853 }] }, outbounds: [{ type: "direct", tag: "d" }] };
      expect(dsDiag(c)).toBeUndefined();
    });
  });

  // ── A7/A8: outbound + direct dial-field resolver gate (version-keyed) ───────────────────────────
  // Binary-verified: a dial-field domain consumer with no resolver and ≥2 DNS servers hits the deprecation
  // gate — 1.12 WARN (check exit 0), 1.13/1.14 FATAL (ENABLE_DEPRECATED_MISSING_DOMAIN_RESOLVER). So the
  // severity is version-keyed (A7), mirroring dns-server-legacy-address-deprecated. A `direct` outbound has
  // no `server` field but resolves the REQUEST's domain, so it is a consumer too (A8). The gate needs ≥2 DNS
  // servers: 0 or 1 DNS server is unambiguous and the binary ACCEPTS it (A7 also fixes a pre-existing
  // false-positive warning on the 0-DNS case, which the version-gate would otherwise escalate to an error).
  describe("A7/A8: outbound/direct domain resolver gate is version-keyed (1.12 warn / 1.13+ error)", () => {
    const lvl = (config: unknown, version: string) =>
      validateConfig(config as SingBoxConfig, version === "1.14" ? "testing" : "stable", version).find((d) => d.code === "outbound-domain-without-resolver")?.level;
    const twoDns = [{ type: "udp", tag: "a", server: "1.1.1.1" }, { type: "udp", tag: "b", server: "8.8.8.8" }];
    const domainOb = { type: "trojan", tag: "p", server: "example.com", server_port: 443, password: "x", tls: { enabled: true } };

    it("A7: domain outbound + 2 DNS + no resolver → warning on 1.12, error on 1.13/1.14", () => {
      const c = { dns: { servers: twoDns }, outbounds: [domainOb] };
      expect(lvl(c, "1.12")).toBe("warning");
      expect(lvl(c, "1.13")).toBe("error");
      expect(lvl(c, "1.14")).toBe("error");
    });

    it("A7: resolver chain satisfied (default | per-outbound | single DNS) → silent on all versions", () => {
      const cases = [
        { dns: { servers: twoDns }, route: { default_domain_resolver: "a" }, outbounds: [domainOb] },
        { dns: { servers: twoDns }, outbounds: [{ ...domainOb, domain_resolver: "a" }] },
        { dns: { servers: [twoDns[0]] }, outbounds: [domainOb] },
      ];
      for (const c of cases) for (const v of ["1.12", "1.13", "1.14"]) expect(lvl(c, v)).toBeUndefined();
    });

    it("A7 fix: domain outbound + ZERO DNS servers → silent on all versions (binary accepts; gate needs ≥2 DNS)", () => {
      const c = { outbounds: [domainOb] };
      for (const v of ["1.12", "1.13", "1.14"]) expect(lvl(c, v)).toBeUndefined();
    });

    it("A8: direct outbound + 2 DNS + no resolver → warning on 1.12, error on 1.13/1.14", () => {
      const c = { dns: { servers: twoDns }, outbounds: [{ type: "direct", tag: "d" }] };
      expect(lvl(c, "1.12")).toBe("warning");
      expect(lvl(c, "1.13")).toBe("error");
      expect(lvl(c, "1.14")).toBe("error");
    });

    it("A8: direct + (single DNS | zero DNS | default | per-outbound resolver) → silent (no false positive)", () => {
      const cases = [
        { dns: { servers: [twoDns[0]] }, outbounds: [{ type: "direct", tag: "d" }] },
        { outbounds: [{ type: "direct", tag: "d" }] },
        { dns: { servers: twoDns }, route: { default_domain_resolver: "a" }, outbounds: [{ type: "direct", tag: "d" }] },
        { dns: { servers: twoDns }, outbounds: [{ type: "direct", tag: "d", domain_resolver: "a" }] },
      ];
      for (const c of cases) for (const v of ["1.12", "1.13", "1.14"]) expect(lvl(c, v)).toBeUndefined();
    });
  });

  // ── A9/A10: endpoints resolver checks (parallel to outbounds) ───────────────────────────────────
  // Binary-verified: endpoints resolve domains via dial fields too. A wireguard DOMAIN peer address hits
  // the dial-field deprecation gate (1.12 warn / 1.13+ error — A9). A tailscale endpoint always resolves
  // its control_url (controlplane.tailscale.com), a HARD init error on ALL versions (1.12 FATALs too — A10).
  // Same coverage gate as outbounds (per-endpoint domain_resolver | default | ≤1 DNS server).
  describe("A9/A10: endpoint domain resolver checks (wireguard version-gated, tailscale unconditional error)", () => {
    const lvl = (config: unknown, code: string, version: string) =>
      validateConfig(config as SingBoxConfig, version === "1.14" ? "testing" : "stable", version).find((d) => d.code === code)?.level;
    const twoDns = [{ type: "udp", tag: "a", server: "1.1.1.1" }, { type: "udp", tag: "b", server: "8.8.8.8" }];
    const wgDomainPeer = (extra: Record<string, unknown> = {}) => ({ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [{ address: "peer.example.com", port: 51820, public_key: "k", allowed_ips: ["0.0.0.0/0"] }], ...extra });
    const tsEndpoint = (extra: Record<string, unknown> = {}) => ({ type: "tailscale", tag: "ts", auth_key: "k", ...extra });
    const block = [{ type: "block", tag: "blk" }];

    it("A9: wireguard domain peer + 2 DNS + no resolver → warning on 1.12, error on 1.13/1.14", () => {
      const c = { dns: { servers: twoDns }, outbounds: block, endpoints: [wgDomainPeer()] };
      expect(lvl(c, "endpoint-domain-without-resolver", "1.12")).toBe("warning");
      expect(lvl(c, "endpoint-domain-without-resolver", "1.13")).toBe("error");
      expect(lvl(c, "endpoint-domain-without-resolver", "1.14")).toBe("error");
    });

    it("A9: wireguard domain peer covered (per-endpoint | default | single DNS | zero DNS) → silent", () => {
      const cases = [
        { dns: { servers: twoDns }, outbounds: block, endpoints: [wgDomainPeer({ domain_resolver: "a" })] },
        { dns: { servers: twoDns }, route: { default_domain_resolver: "a" }, outbounds: block, endpoints: [wgDomainPeer()] },
        { dns: { servers: [twoDns[0]] }, outbounds: block, endpoints: [wgDomainPeer()] },
        { outbounds: block, endpoints: [wgDomainPeer()] },
      ];
      for (const c of cases) for (const v of ["1.12", "1.13", "1.14"]) expect(lvl(c, "endpoint-domain-without-resolver", v)).toBeUndefined();
    });

    it("A9: wireguard with an IP peer (no domain) → silent (not a domain consumer)", () => {
      const c = { dns: { servers: twoDns }, outbounds: block, endpoints: [{ type: "wireguard", tag: "wg", address: ["10.0.0.2/32"], private_key: "k", peers: [{ address: "192.0.2.1", port: 51820, public_key: "k", allowed_ips: ["0.0.0.0/0"] }] }] };
      for (const v of ["1.12", "1.13", "1.14"]) expect(lvl(c, "endpoint-domain-without-resolver", v)).toBeUndefined();
    });

    it("A10: tailscale endpoint + 2 DNS + no resolver → ERROR on ALL versions (1.12 too — hard init, not a deprecation)", () => {
      const c = { dns: { servers: twoDns }, outbounds: block, endpoints: [tsEndpoint()] };
      expect(lvl(c, "endpoint-tailscale-without-resolver", "1.12")).toBe("error");
      expect(lvl(c, "endpoint-tailscale-without-resolver", "1.13")).toBe("error");
      expect(lvl(c, "endpoint-tailscale-without-resolver", "1.14")).toBe("error");
    });

    it("A10: tailscale covered (per-endpoint | default | single DNS | zero DNS) → silent", () => {
      const cases = [
        { dns: { servers: twoDns }, outbounds: block, endpoints: [tsEndpoint({ domain_resolver: "a" })] },
        { dns: { servers: twoDns }, route: { default_domain_resolver: "a" }, outbounds: block, endpoints: [tsEndpoint()] },
        { dns: { servers: [twoDns[0]] }, outbounds: block, endpoints: [tsEndpoint()] },
        { outbounds: block, endpoints: [tsEndpoint()] },
      ];
      for (const c of cases) for (const v of ["1.12", "1.13", "1.14"]) expect(lvl(c, "endpoint-tailscale-without-resolver", v)).toBeUndefined();
    });
  });

  it("seeds default TLS for TLS-required inbound and outbound protocols", () => {
    // A18 (W26): VLESS inbound TLS is optional upstream, so it is intentionally NOT seeded (it can run
    // over Reality / a plain transport). The outbound keeps a TLS-on client default below.
    const tlsRequiredInbounds = ["trojan", "naive", "hysteria", "hysteria2", "tuic", "anytls"];
    for (const type of tlsRequiredInbounds) {
      const stub = createInbound(type, `${type}-in`) as Record<string, unknown>;
      expect(stub.tls, `inbound ${type} should seed default tls block`).toMatchObject({ enabled: true });
    }
    const tlsRequiredOutbounds = ["trojan", "naive", "hysteria", "hysteria2", "tuic", "anytls", "shadowtls", "vless"];
    for (const type of tlsRequiredOutbounds) {
      const stub = createOutbound(type, `${type}-out`) as Record<string, unknown>;
      expect(stub.tls, `outbound ${type} should seed default tls block`).toMatchObject({ enabled: true });
    }
    const shadowtlsInbound = createInbound("shadowtls", "shadowtls-in") as Record<string, unknown>;
    expect(shadowtlsInbound.handshake).toMatchObject({ server: "google.com", server_port: 443 });
    expect(shadowtlsInbound.password).toBeUndefined();
  });
});
