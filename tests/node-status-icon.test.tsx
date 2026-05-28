import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A0 / W5 guardrail (Pass-2 T9/W10).
// SbcNode (src/components/SbcNode.tsx:297) picks the summary status glyph with a 2-way ternary
// (status === "error" ? CircleAlert : CheckCircle2), so a "warning" node renders the same green
// CheckCircle2 as a valid node. This is a characterization test: green today, it flips RED when A9
// (validity-readability) gives "warning" a distinct glyph (TriangleAlert) — at which point update it to
// assert the glyphs differ. A vless outbound with a malformed uuid yields a `warning` (not error) node.

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

  it("documents the warning glyph matching the valid glyph today (T9/W10)", () => {
    renderWarningGraph();
    expect(statusGlyphClass("outbound:warn-vless")).toBe(statusGlyphClass("outbound:ok-direct"));
  });
});
