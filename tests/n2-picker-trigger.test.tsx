import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// N2-picker-trigger: an unconnected editable port IS the "Add a node" affordance — clicking the port
// opens the searchable ChipPickerPopover (port-scoped), the discoverable counterpart to dragging the
// port out to empty canvas. (The old separate "+" badge was dropped — it overlapped the port icon and
// duplicated this action.) The picker open/placement needs React Flow's flow-coordinate system, so the
// full click→pick→create flow is verified in Playwright (e2e/port-click-redesign.spec.ts); jsdom guards
// the affordance markup.

describe("N2-picker-trigger — the port add affordance", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("marks an unconnected editable port as the clickable 'Add a node' affordance", () => {
    useProjectStore.getState().importJson(JSON.stringify({ route: {} }));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route:main"));

    const node = screen.getByTestId("node-route:main");
    const port = node.querySelector('[data-port-type="outbound"]') as HTMLElement | null;
    expect(port).not.toBeNull();
    expect(port!.classList.contains("is-addable")).toBe(true);
    expect(port!.getAttribute("role")).toBe("button");
    expect(port!.getAttribute("aria-label")).toMatch(/^Add a node to .+ of /);
    // The old separate "+" badge is gone — the port itself is the trigger.
    expect(node.querySelector(".sbc-port__add")).toBeNull();
  });
});
