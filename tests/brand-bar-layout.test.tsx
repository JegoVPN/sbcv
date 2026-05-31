import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// Brand bar redesign: the clickable brand control is LOGO + "sbcv" + chevron (toggles the menu, hover
// #292B2D). The expanded name "sing-box configuration visualizer" sits beside it as a NON-clickable
// tagline label inside the same pill — it must not be part of the menu-toggle button.

describe("brand bar — clickable [logo·sbcv·chevron] + non-clickable tagline", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("shows the short 'sbcv' title inside the clickable toggle", () => {
    render(<App />);
    const toggle = screen.getByTestId("brand-menu-toggle");
    expect(within(toggle).getByText("sbcv")).toBeInTheDocument();
  });

  it("keeps the tagline OUT of the clickable toggle (separate non-clickable label)", () => {
    render(<App />);
    const toggle = screen.getByTestId("brand-menu-toggle");
    // The tagline is not part of the menu-toggle button…
    expect(within(toggle).queryByText(/sing-box configuration visualizer/i)).toBeNull();
    // …it is a sibling label (menu closed ⇒ the only occurrence is the tagline).
    const tagline = screen.getByText("sing-box configuration visualizer");
    expect(toggle.contains(tagline)).toBe(false);
    // Clicking the tagline does not toggle the menu (it has no menu role / is not the button).
    fireEvent.click(tagline);
    expect(screen.queryByRole("menu", { name: /sbcv\.app menu/i })).toBeNull();
  });

  it("toggles the menu when the clickable control is clicked", () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("brand-menu-toggle"));
    expect(screen.getByRole("menu", { name: /sbcv\.app menu/i })).toBeInTheDocument();
  });
});
