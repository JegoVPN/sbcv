import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-brandbtn: the brand-logo button's aria-label said "return to home", but goHome only deselects +
// closes the global panel + re-fits the canvas (no navigation/reset of the config). Relabeled to
// describe what it actually does.

afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

describe("L1-brandbtn — brand button label describes the real action", () => {
  it("reads 'reset view (deselect …)' not 'return to home'", () => {
    render(<App />);
    const brand = screen.getByTestId("brand-home");
    const label = brand.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/reset view/i);
    expect(label).not.toMatch(/return to home/i);
  });
});
