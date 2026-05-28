import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A9 validity-readability (Pass-2 T9/W10).
// SbcNode renders the summary status glyph as a 3-way: error -> CircleAlert, warning -> TriangleAlert,
// valid -> CheckCircle2, so a "warning" node is visually distinct from a valid node. The compatible
// count affordance no longer reuses the valid checkmark. A vless outbound with a malformed uuid yields
// a `warning` (not error) node.

function renderWarningGraph() {
  useProjectStore.getState().importJson(JSON.stringify({
    outbounds: [
      { type: "direct", tag: "ok-direct" },
      { type: "vless", tag: "warn-vless", server: "127.0.0.1", server_port: 443, uuid: "not-a-uuid" },
    ],
  }));
  render(<App />);
}

function statusGlyphClass(nodeId: string): string {
  const node = screen.getByTestId(`node-${nodeId}`);
  return node.querySelector(".sbc-node__status svg")?.getAttribute("class") ?? "";
}

function cardStatusClass(nodeId: string): string {
  const node = screen.getByTestId(`node-${nodeId}`);
  return node.querySelector(".sbc-node")?.className ?? "";
}

describe("node status glyph distinguishes warning from valid (W5 -> A9)", () => {
  it("harness: warn-vless is a warning node and both nodes render a status glyph", () => {
    renderWarningGraph();
    expect(cardStatusClass("outbound:warn-vless")).toContain("warning");
    expect(statusGlyphClass("outbound:warn-vless")).not.toBe("");
    expect(statusGlyphClass("outbound:ok-direct")).not.toBe("");
  });

  it("renders a distinct warning glyph (TriangleAlert) from the valid glyph (CheckCircle2)", () => {
    renderWarningGraph();
    expect(statusGlyphClass("outbound:warn-vless")).toContain("triangle-alert");
    expect(statusGlyphClass("outbound:ok-direct")).toContain("circle-check");
    expect(statusGlyphClass("outbound:warn-vless")).not.toBe(statusGlyphClass("outbound:ok-direct"));
  });

  it("the compatible-count affordance no longer reuses the valid status checkmark (✓ N relabel)", () => {
    renderWarningGraph();
    const node = screen.getByTestId("node-outbound:ok-direct");
    const primaryGlyph = node.querySelector(".sbc-node-primary svg")?.getAttribute("class") ?? "";
    expect(primaryGlyph).not.toContain("circle-check");
  });
});
