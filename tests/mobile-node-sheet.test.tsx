import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A25 (W31): mobile rendered no Palette, so nodes couldn't be added. A mobile "Add node" button now
// opens a bottom sheet hosting the existing Palette (the node-add path on touch).

function setMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(max-width: 768px)" ? matches : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe("A25 — mobile node-add path", () => {
  beforeEach(() => {
    setMatchMedia(true);
    useProjectStore.getState().importJson(JSON.stringify({}));
  });
  afterEach(() => {
    // @ts-expect-error matchMedia is not part of jsdom by default
    delete window.matchMedia;
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("opens a node sheet with the Palette from the mobile Add button", async () => {
    render(<App />);
    expect(screen.getByTestId("app-mobile")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-add-node"));
    const sheet = await screen.findByTestId("mobile-node-sheet");
    // The Palette (Add Library) is hosted inside the sheet — its search is present.
    expect(within(sheet).getByLabelText("Node palette")).toBeInTheDocument();
  });

  it("closes the node sheet after adding a node (no stacked sheets)", async () => {
    render(<App />);
    fireEvent.click(screen.getByTestId("mobile-add-node"));
    await screen.findByTestId("mobile-node-sheet");

    // Adding a node selects it; the node sheet should close so it doesn't stack over the inspector.
    useProjectStore.getState().setSelectedId("outbound:probe");
    await waitFor(() => expect(screen.queryByTestId("mobile-node-sheet")).toBeNull());
  });
});
