import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-brandmenu: the brand control now opens the app menu; reset view moved into that menu so the
// brand click can also surface sbcv's expanded meaning and project links.

afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

describe("L1-brandmenu — brand menu exposes product identity", () => {
  it("opens the sbcv menu with the expanded product meaning", () => {
    render(<App />);
    const brand = screen.getByTestId("brand-menu-toggle");
    const label = brand.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/open sbcv\.app menu/i);
    expect(label).not.toMatch(/return to home/i);
    fireEvent.click(brand);
    // The expanded meaning shows both as the always-on brand tagline and in the menu intro; assert the
    // menu intro specifically (the tagline now carries the same text outside the menu).
    const menu = screen.getByRole("menu", { name: /sbcv\.app menu/i });
    expect(within(menu).getByText("sing-box configuration visualizer")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /View JSON/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /GitHub/i })).toHaveAttribute(
      "href",
      "https://github.com/JegoVPN/sbcv",
    );
  });
});
