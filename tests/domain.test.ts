import { describe, expect, it } from "vitest";
import {
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
  updateRouteRule,
} from "../src/domain/commands";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { createTemplatePreset, TEMPLATE_PRESETS, TEMPLATE_PRESET_IDS } from "../src/domain/templates";

describe("canonical sing-box domain model", () => {
  it("round-trips stable TUN split config without layout metadata", () => {
    const config = createStableTunSplitConfig();
    const json = stringifyConfig(config);
    expect(json).toContain('"inbounds"');
    expect(json).not.toContain("positions");
    expect(parseConfigJson(json)).toEqual(config);
  });

  it("renames tags and cascades route and selector references", () => {
    const renamed = renameTag(createStableTunSplitConfig(), "proxy", "main-proxy");
    expect(renamed.route?.final).toBe("main-proxy");
    expect(renamed.outbounds?.find((item) => item.tag === "main-proxy")).toBeTruthy();
  });

  it("updates ordered route rules without using canvas edge order", () => {
    const config = createStableTunSplitConfig();
    const updated = updateRouteRule(config, 0, { domain_suffix: ["sg"], outbound: "proxy" });
    expect(updated.route?.rules?.[0]?.domain_suffix).toEqual(["sg"]);
    expect(updated.route?.rules?.[0]?.outbound).toBe("proxy");
    const moved = moveRouteRule(updated, 0, 1);
    expect(moved.route?.rules?.[1]?.domain_suffix).toEqual(["sg"]);
  });

  it("detects missing outbound references", () => {
    const config = connectSelectorCandidate(createStableTunSplitConfig(), "proxy", "missing");
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
    const ruleTwo = byId.get("route-rule:1");
    const direct = byId.get("outbound:direct");
    const block = byId.get("outbound:block");
    const proxy = byId.get("outbound:proxy");
    const auto = byId.get("outbound:auto");
    const hk = byId.get("outbound:hk");
    const jp = byId.get("outbound:jp");

    expect(inbound?.position.x).toBeLessThan(route?.position.x ?? 0);
    expect(route?.position.x).toBeLessThan(ruleOne?.position.x ?? 0);
    expect(ruleOne?.position.x).toBeLessThan(direct?.position.x ?? 0);
    expect(direct?.position.y).toBe(ruleOne?.position.y);
    expect(block?.position.y).toBe(ruleTwo?.position.y);
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
    expect(nodes.filter((node) => node.data.kind === "route-rule")).toHaveLength(0);
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
    expect(stable.config.route?.final).toBe("proxy");
    expect(testing.config.http_clients?.[0]?.tag).toBe("remote-client");
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

    const renamed = renameTag(config, "ts-ep", "tailnet");
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
    const renamed = renameTag(withRuleSet, "ads-rules", "privacy-rules");

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

  it("derives independent settings nodes only after the user pins them to the canvas", () => {
    const config = ensureSettings(createStableTunSplitConfig(), "log");

    expect(deriveGraph(config, { positions: {} }, []).nodes.some((node) => node.id === "settings:log")).toBe(false);
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
    expect(
      deriveGraph(withExperimental, {
        positions: {
          "settings:ntp": { x: -300, y: 370 },
          "settings:certificate": { x: -300, y: 700 },
          "settings:experimental": { x: -300, y: 1030 },
        },
      }, []).nodes.filter((node) => node.data.kind === "settings"),
    ).toHaveLength(3);
  });

  it("warns when an outbound or dns-server uses a domain host without a domain_resolver", () => {
    const config: ReturnType<typeof createStableTunSplitConfig> = createStableTunSplitConfig();
    const next: typeof config = {
      ...config,
      outbounds: [
        ...(config.outbounds ?? []),
        { type: "trojan", tag: "remote-host", server: "example.com", server_port: 443, password: "x", tls: { enabled: true } },
      ],
      dns: {
        ...(config.dns ?? {}),
        servers: [
          ...(config.dns?.servers ?? []),
          { type: "tls", tag: "remote-doh", server: "cloudflare-dns.com", server_port: 853 },
        ],
      },
    };

    const diagnostics = validateConfig(next, "testing");
    expect(diagnostics.some((diagnostic) => diagnostic.code === "outbound-domain-without-resolver")).toBe(true);
    expect(diagnostics.some((diagnostic) => diagnostic.code === "dns-server-domain-without-resolver")).toBe(true);

    const ipOnly: typeof config = {
      ...config,
      outbounds: [
        ...(config.outbounds ?? []),
        { type: "trojan", tag: "ip-host", server: "1.1.1.1", server_port: 443, password: "x", tls: { enabled: true } },
      ],
    };
    const ipDiagnostics = validateConfig(ipOnly, "testing");
    expect(ipDiagnostics.some((diagnostic) => diagnostic.code === "outbound-domain-without-resolver")).toBe(false);
  });

  it("seeds default TLS for TLS-required inbound and outbound protocols", () => {
    const tlsRequiredInbounds = ["trojan", "naive", "hysteria", "hysteria2", "tuic", "anytls", "vless"];
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
