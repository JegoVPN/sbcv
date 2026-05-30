import { describe, expect, it } from "vitest";

import { relationLabelForEdge } from "../src/components/CanvasEdge";
import { formatEdgeId } from "../src/domain/portRelationRegistry";

// V8-S1: an edge's relation label is derived from its id (the relationId formatEdgeId encodes), so parallel
// edges between the same node pair are distinguishable on hover. Order/decorative edges have no registry
// relation → empty label (no tooltip).

describe("V8-S1 — per-relation edge label", () => {
  it("names each writable relation from its edge id", () => {
    expect(relationLabelForEdge(formatEdgeId("route-rule", 0, "proxy"))).toBe("Outbound");
    expect(relationLabelForEdge(formatEdgeId("selector", "sel", "proxy"))).toBe("Downstream candidate");
    expect(relationLabelForEdge(formatEdgeId("route-rule-resolve", 0, "boot"))).toBe("Resolve server");
    expect(relationLabelForEdge(formatEdgeId("dns-rule", 0, "doh"))).toBe("DNS server");
  });

  it("survives a hyphenated relationId AND a hyphenated tag value (':'-delimited, encoded parts)", () => {
    expect(relationLabelForEdge(formatEdgeId("certificate-provider-http-client", "prov-1", "client-a-b"))).toBe("HTTP client");
  });

  it("distinguishes two different relations that could share a node pair", () => {
    // An outbound that is both a route-rule target and a selector member: the two edges carry distinct labels.
    expect(relationLabelForEdge(formatEdgeId("route-rule", 0, "px"))).not.toBe(
      relationLabelForEdge(formatEdgeId("selector", "grp", "px")),
    );
  });

  it("returns an empty label (no tooltip) for an id whose relation is not in the registry", () => {
    expect(relationLabelForEdge("not-a-real-edge-id")).toBe("");
    expect(relationLabelForEdge(formatEdgeId("nonexistent-relation", 0))).toBe("");
  });
});
