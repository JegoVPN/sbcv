import { describe, expect, it } from "vitest";
import { createStableTunSplitConfig } from "../src/domain/commands";
import { deriveGraph } from "../src/canvas/graph";

// The node toolbar's count pill shows `data.connections` — the node's real downstream connection count
// (out-degree), not the old `compatible` "addable types" number that showed 18 on a 3-member selector.
describe("node connection count", () => {
  it("equals each node's outgoing-edge count (downstream connections)", () => {
    const { nodes, edges } = deriveGraph(createStableTunSplitConfig(), { positions: {} }, []);
    const outgoing = new Map<string, number>();
    for (const edge of edges) outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    for (const node of nodes) {
      expect(node.data.connections).toBe(outgoing.get(node.id) ?? 0);
    }
  });

  it("shows a selector's real member count, not the old addable-types count", () => {
    const config = createStableTunSplitConfig();
    const { nodes } = deriveGraph(config, { positions: {} }, []);
    const selector = config.outbounds?.find((outbound) => outbound.type === "selector");
    expect(selector?.outbounds?.length).toBeGreaterThan(0);
    const selectorNode = nodes.find((node) => node.id === `outbound:${selector!.tag}`);
    expect(selectorNode?.data.connections).toBe(selector!.outbounds!.length);
    // Sanity: a real member count, nowhere near the old hardcoded 18 "compatible types".
    expect(selectorNode!.data.connections).toBeLessThan(18);
  });

  it("reports 0 downstream connections for a terminal leaf outbound (direct)", () => {
    const config = createStableTunSplitConfig();
    const { nodes } = deriveGraph(config, { positions: {} }, []);
    const direct = nodes.find((node) => node.id === "outbound:direct");
    expect(direct).toBeDefined();
    expect(direct!.data.connections).toBe(0);
  });
});
