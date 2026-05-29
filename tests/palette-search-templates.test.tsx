import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { TEMPLATE_PRESETS } from "../src/domain/templates";
import { useProjectStore } from "../src/state/useProjectStore";

// A23 (W29): the Add Library search filtered only the library groups and skipped Templates. Search must
// also surface matching template presets.

describe("A23 — palette search covers templates", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("surfaces a matching template preset when searching", async () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);
    const palette = within(await screen.findByLabelText("Node palette"));

    // Pick a distinctive word from a real template label.
    const sample = TEMPLATE_PRESETS[0]!;
    const word = sample.label.split(/\s+/).find((w) => w.length >= 4) ?? sample.label;

    fireEvent.change(palette.getByPlaceholderText(/search/i), { target: { value: word } });
    // The matching template label is now visible in the search results.
    expect(palette.getByText(new RegExp(sample.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))).toBeInTheDocument();
  });

  it("shows nothing template-side for a non-matching query (no false surfacing)", async () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);
    const palette = within(await screen.findByLabelText("Node palette"));
    fireEvent.change(palette.getByPlaceholderText(/search/i), { target: { value: "zzzznomatchqwerty" } });
    for (const preset of TEMPLATE_PRESETS) {
      expect(palette.queryByText(preset.label)).toBeNull();
    }
  });
});
