import { describe, expect, it } from "vitest";

import { deriveGraph } from "../src/canvas/graph";
import type { SingBoxConfig } from "../src/domain/types";

// C11a (G7): the 6 dial-style detour edges resolve their target through outboundTargetNodeId, so a
// detour pointing at an endpoint tag (the detour namespace is shared with endpoints) renders an
// `endpoint:<tag>` edge instead of a phantom `outbound:<tag>`. Source: shared/dial.md, endpoint/index.md.

const layout = { positions: {} };

function edges(config: SingBoxConfig) {
  return deriveGraph(config, layout, []).edges;
}
function nodeIds(config: SingBoxConfig) {
  return new Set(deriveGraph(config, layout, []).nodes.map((n) => n.id));
}

describe("C11a — detour edges resolve endpoint targets", () => {
  it("an outbound detour at an endpoint targets endpoint:<tag>, not a phantom outbound:<tag>", () => {
    const config = {
      endpoints: [{ type: "wireguard", tag: "wg-ep" }],
      outbounds: [{ type: "direct", tag: "o", detour: "wg-ep" }],
    } as unknown as SingBoxConfig;
    const detourEdge = edges(config).find((e) => e.source === "outbound:o" && e.id.startsWith("edge:outbound-detour"));
    expect(detourEdge?.target).toBe("endpoint:wg-ep");
    // No phantom outbound node was implied for the endpoint tag.
    expect(nodeIds(config).has("outbound:wg-ep")).toBe(false);
    expect(nodeIds(config).has("endpoint:wg-ep")).toBe(true);
  });

  it("an endpoint detour at another endpoint targets endpoint:<tag>", () => {
    const config = {
      endpoints: [
        { type: "wireguard", tag: "wg-a" },
        { type: "wireguard", tag: "wg-b", detour: "wg-a" },
      ],
    } as unknown as SingBoxConfig;
    const detourEdge = edges(config).find((e) => e.source === "endpoint:wg-b" && e.id.startsWith("edge:endpoint-detour"));
    expect(detourEdge?.target).toBe("endpoint:wg-a");
  });

  it("a detour at a real outbound still targets outbound:<tag> (no regression)", () => {
    const config = {
      outbounds: [
        { type: "direct", tag: "up" },
        { type: "direct", tag: "o", detour: "up" },
      ],
    } as unknown as SingBoxConfig;
    const detourEdge = edges(config).find((e) => e.source === "outbound:o" && e.id.startsWith("edge:outbound-detour"));
    expect(detourEdge?.target).toBe("outbound:up");
  });
});
