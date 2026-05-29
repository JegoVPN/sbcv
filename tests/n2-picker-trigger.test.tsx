import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// N2-picker-trigger: an unconnected editable port shows an "Add a node" button that opens the searchable
// ChipPickerPopover (port-scoped) — the discoverable counterpart to dragging the port out to empty
// canvas. The picker open/placement needs React Flow's flow-coordinate system, so the full click→pick→
// create flow is verified in Playwright (e2e/port-click-redesign.spec.ts); jsdom guards the affordance.

describe("N2-picker-trigger — the port add affordance", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders an 'Add a node' button on an unconnected editable port", () => {
    useProjectStore.getState().importJson(JSON.stringify({ route: {} }));
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route:main"));

    const node = screen.getByTestId("node-route:main");
    const addButton = node.querySelector('[data-port-type="outbound"] button.sbc-port__add');
    expect(addButton).not.toBeNull();
    expect((addButton as HTMLElement).getAttribute("aria-label")).toMatch(/^Add a node to .+ of /);
  });
});
