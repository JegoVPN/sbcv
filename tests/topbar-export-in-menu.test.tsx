import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// The three JSON operations (View / Import / Export) belong together in the brand menu; the top-right
// action bar keeps only validation (Target / Check / status pill + its notification popover). Export was
// moved out of the action bar into the menu, grouped next to View JSON / Import JSON.

describe("desktop topbar — Export JSON grouped in the brand menu", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("keeps Export out of the top-right action bar (it lives in the menu, hidden until opened)", () => {
    render(<App />);
    // With the brand menu closed, the Export control is not rendered in the action bar at all.
    expect(screen.queryByTestId("export-button")).toBeNull();
  });

  it("groups Export JSON adjacent to View/Import JSON inside the brand menu", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("brand-menu-toggle"));
    const menu = screen.getByRole("menu", { name: /sbcv\.app menu/i });
    const labels = within(menu).getAllByRole("menuitem").map((el) => (el.textContent ?? "").trim());

    const viewIdx = labels.findIndex((t) => /view json/i.test(t));
    const importIdx = labels.findIndex((t) => /import json/i.test(t));
    const exportIdx = labels.findIndex((t) => /export json/i.test(t));

    expect(viewIdx).toBeGreaterThanOrEqual(0);
    expect(importIdx).toBe(viewIdx + 1);
    expect(exportIdx).toBe(importIdx + 1); // the three JSON ops are contiguous
    expect(within(menu).getByTestId("export-button")).toBeInTheDocument();
  });
});
