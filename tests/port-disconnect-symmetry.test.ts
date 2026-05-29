import { describe, expect, it } from "vitest";
import { deriveGraph } from "../src/canvas/graph";
import { createStableTunSplitConfig, disconnectEdge } from "../src/domain/commands";
import { formatEdgeId, parseEdgeId } from "../src/domain/portRelationRegistry";
import type { SingBoxConfig } from "../src/domain/types";

function createDisconnectFixture(): SingBoxConfig {
  const config = createStableTunSplitConfig();
  config.inbounds = [
    ...(config.inbounds ?? []),
    { type: "shadowsocks", tag: "ss-in", listen: "127.0.0.1", listen_port: 1088, method: "none", password: "" } as never,
  ];
  config.outbounds = (config.outbounds ?? []).map((outbound) =>
    outbound.tag === "hk" ? { ...outbound, detour: "direct", domain_resolver: "local-dns" } : outbound,
  );
  config.route = {
    ...config.route,
    final: "proxy",
    // C11c: route.default_http_client + a remote rule_set http_client reference (testing-only edges).
    default_http_client: "hc",
    rules: [
      { domain_suffix: ["cn"], inbound: ["tun-in", "ss-in"], outbound: "direct", rule_set: ["remote-rules", "other-rules"] },
      ...(config.route?.rules?.slice(1) ?? []),
    ],
    rule_set: [
      { type: "remote", tag: "remote-rules", format: "binary", url: "https://example.com/rules.srs", download_detour: "proxy" },
      { type: "remote", tag: "other-rules", format: "binary", url: "https://example.com/other.srs", http_client: "hc" } as never,
    ],
  } as never;
  config.dns = {
    ...config.dns,
    servers: [
      // C11b: remote-doh (https, dial) resolves its own host through local-dns — a dns-server source.
      ...(config.dns?.servers ?? []).map((server) =>
        server.tag === "remote-doh" ? ({ ...server, domain_resolver: "local-dns" } as never) : server,
      ),
      { type: "tailscale", tag: "ts-dns", endpoint: "ts-ep", detour: "proxy", accept_default_resolvers: false },
      { type: "resolved", tag: "resolved-dns", service: "resolved-svc" } as never,
    ],
    rules: [{ domain_suffix: ["cn"], inbound: ["tun-in", "ss-in"], server: "local-dns", rule_set: ["remote-rules", "other-rules"] }],
    final: "remote-doh",
  };
  config.endpoints = [
    { type: "tailscale", tag: "ts-ep", detour: "proxy" },
    // C11b: an endpoint source resolving its server name through local-dns.
    { type: "tailscale", tag: "ts-ep-2", domain_resolver: "local-dns" } as never,
  ];
  config.certificate_providers = [
    { type: "tailscale", tag: "ts-cert", endpoint: "ts-ep" },
    // C11c: a non-tailscale provider carrying an http_client reference.
    { type: "acme", tag: "acme-cp", domain: ["example.com"], http_client: "hc" } as never,
  ];
  // C11c: a shared HTTP client with its own dial detour (the node is no longer floating).
  config.http_clients = [{ tag: "hc", detour: "proxy" } as never];
  config.services = [
    { type: "resolved", tag: "resolved-svc", listen: "127.0.0.53", listen_port: 53 } as never,
    { type: "ssm-api", tag: "ssm", servers: { "/": "ss-in", "/alt": "tun-in" } } as never,
    { type: "derp", tag: "derp", verify_client_endpoint: ["ts-ep", "ts-ep-2"] } as never,
    { type: "ccm", tag: "ccm", detour: "proxy" } as never,
  ];
  config.ntp = { enabled: true, server: "time.apple.com", detour: "proxy" } as never;
  config.experimental = {
    clash_api: { external_ui_download_detour: "proxy" },
  };
  return config;
}

function visibleEdge(config: SingBoxConfig, edgeId: string) {
  return deriveGraph(config, { positions: {} }, []).edges.find((edge) => edge.id === edgeId);
}

const cases: Array<{
  name: string;
  edgeId: string;
  assert: (config: SingBoxConfig) => void;
}> = [
  {
    name: "route final",
    edgeId: formatEdgeId("route-final", "proxy"),
    assert: (config) => expect(config.route?.final).toBeUndefined(),
  },
  {
    name: "route rule outbound",
    edgeId: formatEdgeId("route-rule", 0, "direct"),
    assert: (config) => expect(config.route?.rules?.[0]?.outbound).toBeUndefined(),
  },
  {
    name: "route rule inbound",
    edgeId: formatEdgeId("route-rule-inbound", 0, "tun-in"),
    assert: (config) => expect(config.route?.rules?.[0]?.inbound).toEqual(["ss-in"]),
  },
  {
    name: "route rule-set",
    edgeId: formatEdgeId("route-rule-set", 0, "remote-rules"),
    assert: (config) => expect(config.route?.rules?.[0]?.rule_set).toEqual(["other-rules"]),
  },
  {
    name: "DNS final",
    edgeId: formatEdgeId("dns-final", "remote-doh"),
    assert: (config) => expect(config.dns?.final).toBeUndefined(),
  },
  {
    name: "DNS rule server",
    edgeId: formatEdgeId("dns-rule", 0, "local-dns"),
    assert: (config) => expect(config.dns?.rules?.[0]?.server).toBeUndefined(),
  },
  {
    name: "DNS rule inbound",
    edgeId: formatEdgeId("dns-rule-inbound", 0, "tun-in"),
    assert: (config) => expect(config.dns?.rules?.[0]?.inbound).toEqual(["ss-in"]),
  },
  {
    name: "DNS rule-set",
    edgeId: formatEdgeId("dns-rule-set", 0, "remote-rules"),
    assert: (config) => expect(config.dns?.rules?.[0]?.rule_set).toEqual(["other-rules"]),
  },
  {
    name: "selector member",
    edgeId: formatEdgeId("selector", "proxy", 0, "hk"),
    assert: (config) => expect(config.outbounds?.find((outbound) => outbound.tag === "proxy")?.outbounds).toEqual(["jp", "auto"]),
  },
  {
    name: "urltest member",
    edgeId: formatEdgeId("urltest", "auto", 0, "hk"),
    assert: (config) => expect(config.outbounds?.find((outbound) => outbound.tag === "auto")?.outbounds).toEqual(["jp"]),
  },
  {
    name: "outbound detour",
    edgeId: formatEdgeId("outbound-detour", "hk", "direct"),
    assert: (config) => expect(config.outbounds?.find((outbound) => outbound.tag === "hk")?.detour).toBeUndefined(),
  },
  {
    name: "DNS-server detour",
    edgeId: formatEdgeId("dns-server-detour", "remote-doh", "proxy"),
    assert: (config) => expect(config.dns?.servers?.find((server) => server.tag === "remote-doh")?.detour).toBeUndefined(),
  },
  {
    name: "DNS-server endpoint",
    edgeId: formatEdgeId("dns-server-endpoint", "ts-dns", "ts-ep"),
    assert: (config) => expect(config.dns?.servers?.find((server) => server.tag === "ts-dns")?.endpoint).toBeUndefined(),
  },
  {
    name: "DNS-server service",
    edgeId: formatEdgeId("dns-server-service", "resolved-dns", "resolved-svc"),
    assert: (config) => expect(config.dns?.servers?.find((server) => server.tag === "resolved-dns")?.service).toBeUndefined(),
  },
  {
    name: "endpoint detour",
    edgeId: formatEdgeId("endpoint-detour", "ts-ep", "proxy"),
    assert: (config) => expect(config.endpoints?.find((endpoint) => endpoint.tag === "ts-ep")?.detour).toBeUndefined(),
  },
  {
    name: "service detour",
    edgeId: formatEdgeId("service-detour-ccm", "ccm", "proxy"),
    assert: (config) => expect(config.services?.find((service) => service.tag === "ccm")?.detour).toBeUndefined(),
  },
  {
    name: "service verify endpoint",
    edgeId: formatEdgeId("service-verify-endpoint", "derp", "ts-ep"),
    assert: (config) => expect(config.services?.find((service) => service.tag === "derp")?.verify_client_endpoint).toEqual(["ts-ep-2"]),
  },
  {
    name: "SSM inbound service entry",
    edgeId: formatEdgeId("service-ssm-inbound", "ssm", "/", "ss-in"),
    assert: (config) => expect(config.services?.find((service) => service.tag === "ssm")?.servers).toEqual({ "/alt": "tun-in" }),
  },
  {
    name: "rule-set download detour",
    edgeId: formatEdgeId("rule-set-download", "remote-rules", "proxy"),
    assert: (config) => expect(config.route?.rule_set?.find((ruleSet) => ruleSet.tag === "remote-rules")?.download_detour).toBeUndefined(),
  },
  {
    name: "Clash API external UI download detour",
    edgeId: formatEdgeId("clash-api-download-detour", "proxy"),
    assert: (config) => expect(config.experimental?.clash_api).toMatchObject({ external_ui_download_detour: undefined }),
  },
  {
    name: "certificate provider endpoint",
    edgeId: formatEdgeId("certificate-provider-endpoint", "ts-cert", "ts-ep"),
    assert: (config) => expect(config.certificate_providers?.find((provider) => provider.tag === "ts-cert")?.endpoint).toBeUndefined(),
  },
  {
    name: "settings NTP detour",
    edgeId: formatEdgeId("settings-ntp-detour", "proxy"),
    assert: (config) => expect(config.ntp?.detour).toBeUndefined(),
  },
  {
    name: "outbound domain_resolver",
    edgeId: formatEdgeId("dial-domain-resolver", "hk", "local-dns"),
    assert: (config) =>
      expect((config.outbounds?.find((outbound) => outbound.tag === "hk") as Record<string, unknown> | undefined)?.domain_resolver).toBeUndefined(),
  },
  {
    name: "endpoint domain_resolver",
    edgeId: formatEdgeId("endpoint-domain-resolver", "ts-ep-2", "local-dns"),
    assert: (config) =>
      expect((config.endpoints?.find((endpoint) => endpoint.tag === "ts-ep-2") as Record<string, unknown> | undefined)?.domain_resolver).toBeUndefined(),
  },
  {
    name: "dns-server domain_resolver",
    edgeId: formatEdgeId("dns-server-domain-resolver", "remote-doh", "local-dns"),
    assert: (config) =>
      expect((config.dns?.servers?.find((server) => server.tag === "remote-doh") as Record<string, unknown> | undefined)?.domain_resolver).toBeUndefined(),
  },
  {
    name: "route default_http_client",
    edgeId: formatEdgeId("route-default-http-client", "hc"),
    assert: (config) => expect((config.route as Record<string, unknown> | undefined)?.default_http_client).toBeUndefined(),
  },
  {
    name: "rule-set http_client",
    edgeId: formatEdgeId("rule-set-http-client", "other-rules", "hc"),
    assert: (config) =>
      expect((config.route?.rule_set?.find((ruleSet) => ruleSet.tag === "other-rules") as Record<string, unknown> | undefined)?.http_client).toBeUndefined(),
  },
  {
    name: "certificate-provider http_client",
    edgeId: formatEdgeId("certificate-provider-http-client", "acme-cp", "hc"),
    assert: (config) =>
      expect((config.certificate_providers?.find((provider) => provider.tag === "acme-cp") as Record<string, unknown> | undefined)?.http_client).toBeUndefined(),
  },
  {
    name: "http-client dial detour",
    edgeId: formatEdgeId("http-client-detour", "hc", "proxy"),
    assert: (config) =>
      expect((config.http_clients?.find((client) => client.tag === "hc") as Record<string, unknown> | undefined)?.detour).toBeUndefined(),
  },
];

describe("port edge disconnect coverage", () => {
  it.each(cases)("disconnects $name visible edge through canonical config", ({ edgeId, assert }) => {
    const config = createDisconnectFixture();
    expect(visibleEdge(config, edgeId), edgeId).toMatchObject({ id: edgeId, deletable: true });

    const updated = disconnectEdge(config, edgeId);

    assert(updated);
  });

  it("marks visual-only order and decorative edges non-deletable no-ops", () => {
    const config = createDisconnectFixture();
    const edges = deriveGraph(config, { positions: {} }, []).edges;

    for (const relationId of ["inbound", "route-rule-order", "dns-rule-order"]) {
      const edge = edges.find((item) => parseEdgeId(item.id)?.relationId === relationId);
      expect(edge, relationId).toMatchObject({ deletable: false });
      expect(disconnectEdge(config, edge!.id)).toBe(config);
    }
  });

  it("has a disconnect assertion for every deletable relation emitted by the broad fixture", () => {
    const config = createDisconnectFixture();
    const coveredRelations = new Set(cases.map((item) => parseEdgeId(item.edgeId)?.relationId));
    const emittedDisconnectableRelations = new Set(
      deriveGraph(config, { positions: {} }, [])
        .edges
        .filter((edge) => edge.deletable)
        .map((edge) => parseEdgeId(edge.id)?.relationId),
    );

    expect(emittedDisconnectableRelations).toEqual(coveredRelations);
  });
});
