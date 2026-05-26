import { describe, expect, it } from "vitest";
import {
  connectSelectorCandidate,
  createStableTunSplitConfig,
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
