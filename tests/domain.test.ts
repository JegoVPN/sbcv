import { describe, expect, it } from "vitest";
import {
  connectSelectorCandidate,
  createStableTunSplitConfig,
  disconnectEdge,
  moveRouteRule,
  renameTag,
  updateRouteRule,
} from "../src/domain/commands";
import { deriveGraph } from "../src/canvas/graph";
import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson, stringifyConfig } from "../src/domain/serialization";

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
    const candidateEdges = edges.filter((edge) => edge.label === "candidate");

    expect(candidateEdges).toHaveLength(96);
  });
});
