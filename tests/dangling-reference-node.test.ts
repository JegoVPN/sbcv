import { describe, expect, it } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import type { SingBoxConfig } from "../src/domain/types";

// V8-S2: a writable ref to a non-existent tag drew an edge to a never-rendered node, which React Flow
// dropped — the dangling reference was invisible on the canvas. deriveGraph now synthesizes a port-less
// "missing reference" pseudo-node for each unresolved endpoint and flags the edge `dangling`.

const layout = { positions: {} };
const graphOf = (config: SingBoxConfig) => deriveGraph(config, layout, []);
const missingNodes = (g: ReturnType<typeof deriveGraph>) => g.nodes.filter((n) => n.data.type === "missing-reference");
const danglingEdges = (g: ReturnType<typeof deriveGraph>) =>
  g.edges.filter((e) => (e.data as { dangling?: boolean } | undefined)?.dangling === true);

describe("V8-S2 — dangling reference visibility", () => {
  it("synthesizes a missing-reference node + flags the edge for a route.final to a non-existent outbound", () => {
    const g = graphOf({ route: { final: "ghost" }, outbounds: [{ type: "direct", tag: "real" }] } as unknown as SingBoxConfig);
    const missing = missingNodes(g);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.id).toBe("outbound:ghost");
    expect(missing[0]!.data.status).toBe("error");
    expect(missing[0]!.data.title).toContain("ghost");
    // the route.final edge is flagged dangling and targets the synthesized node
    const dangling = danglingEdges(g);
    expect(dangling.length).toBeGreaterThan(0);
    expect(dangling.some((e) => e.target === "outbound:ghost")).toBe(true);
  });

  it("flags a dangling SOURCE too (route rule matching a non-existent inbound)", () => {
    const g = graphOf({
      route: { rules: [{ inbound: "no-such-in", action: "reject" }] },
    } as unknown as SingBoxConfig);
    expect(missingNodes(g).some((n) => n.id === "inbound:no-such-in")).toBe(true);
    expect(danglingEdges(g).some((e) => e.source === "inbound:no-such-in")).toBe(true);
  });

  it("produces NO missing nodes or dangling edges for a fully-resolved config", () => {
    const g = graphOf({
      outbounds: [{ type: "direct", tag: "out" }],
      route: { final: "out", rules: [{ outbound: "out", domain_suffix: ["a.com"] }] },
    } as unknown as SingBoxConfig);
    expect(missingNodes(g)).toHaveLength(0);
    expect(danglingEdges(g)).toHaveLength(0);
  });

  it("dedupes: two refs to the same missing tag yield one missing node", () => {
    const g = graphOf({
      route: {
        final: "ghost",
        rules: [{ outbound: "ghost", domain_suffix: ["a.com"] }],
      },
    } as unknown as SingBoxConfig);
    expect(missingNodes(g).filter((n) => n.id === "outbound:ghost")).toHaveLength(1);
  });
});
