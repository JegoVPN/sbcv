import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A0 / multi-edge-disconnect stub (Codex C1-7, C1-8, C1-23).
// CanvasWorkspace.edgeByPort (src/components/CanvasWorkspace.tsx:333-347) maps each port to the FIRST
// edge only (`if (!result.has(key)) result.set(key, edge.id)`), so the per-port disconnect control on a
// port shared by several references can only remove the first reference. The domain command
// disconnectEdge(edgeId) is already edge-specific; the gap is the UI mapping. A selector "proxy" with
// members [hk, jp] shares one "outbound-member" output handle across both member edges.
//   - the characterization `it` proves the single control removes the first member (hk), leaving jp; it
//     flips RED when A8 changes the disconnect behavior.
//   - the `it.fails` stub encodes the post-fix contract (one disconnect affordance per connected member).
//     A8 may realize this differently (e.g. a per-edge hover affordance); update the assertion to match
//     A8's affordance and convert `it.fails` -> `it`.

const MEMBER_DISCONNECT_LABEL = "Disconnect Downstream candidate from proxy";

function renderSelectorWithTwoMembers() {
  useProjectStore.getState().importJson(JSON.stringify({
    outbounds: [
      { type: "direct", tag: "hk" },
      { type: "direct", tag: "jp" },
      { type: "selector", tag: "proxy", outbounds: ["hk", "jp"] },
    ],
  }));
  render(<App />);
}

function selectorMembers(): string[] {
  return (useProjectStore.getState().config.outbounds?.find((entry) => entry.tag === "proxy")?.outbounds as string[]) ?? [];
}

describe("multi-edge disconnect targets a specific reference (stub -> A8; C1-7/8/23)", () => {
  it("harness: the selector starts with two members and exposes a member disconnect control", () => {
    renderSelectorWithTwoMembers();
    expect(selectorMembers()).toEqual(["hk", "jp"]);
    expect(screen.getAllByLabelText(MEMBER_DISCONNECT_LABEL).length).toBeGreaterThan(0);
  });

  it("documents the per-port control removing only the first member today (C1-7/8/23)", () => {
    renderSelectorWithTwoMembers();
    const controls = screen.getAllByLabelText(MEMBER_DISCONNECT_LABEL);
    expect(controls).toHaveLength(1);
    fireEvent.click(controls[0]!);
    expect(selectorMembers()).toEqual(["jp"]);
  });

  it.fails("exposes a disconnect affordance per connected selector member", () => {
    renderSelectorWithTwoMembers();
    expect(screen.getAllByLabelText(MEMBER_DISCONNECT_LABEL)).toHaveLength(2);
  });
});
