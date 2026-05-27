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

  it("warns on settings.certificate top-level block on stable channel + chrome store gate", () => {
    const config = createStableTunSplitConfig();
    config.certificate = { store: "system" } as never;
    const stableNoChrome = validateConfig(config, "stable").map((d) => d.code);
    expect(stableNoChrome).toContain("settings-certificate-block-testing-only");
    expect(stableNoChrome).not.toContain("settings-certificate-store-chrome-testing-only");

    config.certificate = { store: "chrome" } as never;
    const stableChrome = validateConfig(config, "stable").map((d) => d.code);
    expect(stableChrome).toContain("settings-certificate-block-testing-only");
    expect(stableChrome).toContain("settings-certificate-store-chrome-testing-only");

    const testing = validateConfig(config, "testing").map((d) => d.code);
    expect(testing).not.toContain("settings-certificate-block-testing-only");
    expect(testing).not.toContain("settings-certificate-store-chrome-testing-only");
  });

  it("warns when a hosts DNS server has no predefined or path", () => {
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
    ).toBe(true);

    (config.dns!.servers as Array<Record<string, unknown>>)[
      (config.dns!.servers as Array<Record<string, unknown>>).length - 1
    ].path = "/etc/hosts";
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
    ].service = "ghost";
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

  it("flags urltest missing url + invalid scheme", () => {
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
    expect(codes).toContain("urltest-url-missing");
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
