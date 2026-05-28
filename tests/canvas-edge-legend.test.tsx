import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A24 (W30): the canvas had no edge legend, so solid-vs-dashed edges and the disconnect affordance were
// undiscoverable. Add a desktop legend explaining active vs reference edges and how to disconnect.

describe("A24 — canvas edge legend", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders an edge legend with link / traffic-path / disconnect rows on desktop", () => {
    useProjectStore.getState().loadMinimal();
    render(<App />);
    const legend = within(screen.getByTestId("canvas-edge-legend"));
    expect(legend.getByText(/configured link \/ reference/i)).toBeInTheDocument();
    expect(legend.getByText(/traffic path/i)).toBeInTheDocument();
    expect(legend.getByText(/hover a writable edge to disconnect/i)).toBeInTheDocument();
  });
});
