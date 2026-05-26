import { describe, expect, it } from "vitest";
import {
  connectSelectorCandidate,
  createDnsServer,
  createInbound,
  createOutbound,
  createStableTunSplitConfig,
  disconnectEdge,
  ensureSettings,
  moveRouteRule,
  renameTag,
  updateRouteRule,
} from "../src/domain/commands";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";
import { createTemplatePreset } from "../src/domain/templates";

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

  it("loads curated 1.12, 1.13, and 1.14 template presets with explicit channels", () => {
    const legacy = createTemplatePreset("template-1.12");
    const stable = createTemplatePreset("template-1.13");
    const testing = createTemplatePreset("template-1.14");

    expect(legacy.channel).toBe("stable");
    expect(stable.channel).toBe("stable");
    expect(testing.channel).toBe("testing");
    expect(legacy.version).toBe("1.12");
    expect(stable.config.route?.final).toBe("proxy");
    expect(testing.config.http_clients?.[0]?.tag).toBe("remote-client");
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
});
