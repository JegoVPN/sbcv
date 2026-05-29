import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-med-dial-fields (MED audit, behavior): two dial shared-field corrections.
// - `domain_strategy` was mislabeled "(deprecated 1.12+)" but is actually REMOVED in 1.14 → hide it on
//   the testing (1.14) channel; on stable (1.12/1.13) keep it but say it's removed in 1.14.
// - Network Type / Fallback Network had no value/platform hint; upstream (dial.md): values are
//   wifi/cellular/ethernet/other, supported only on graphical Android/Apple clients with
//   auto_detect_interface enabled.

describe("L2-med-dial-fields — dial field gating + hints", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("stable: Domain Strategy is shown and labeled removed-in-1.14", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:d"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/Domain Strategy/)).toBeInTheDocument();
    expect(inspector.getByText(/removed in 1\.14/i)).toBeInTheDocument();
  });

  it("testing: Domain Strategy is hidden (removed in 1.14)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }),
    );
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:d"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.queryByText(/Domain Strategy/)).toBeNull();
  });

  it("Network Type / Fallback Network show the value + platform hint", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:d"));
    const inspector = within(screen.getByTestId("node-inspector"));
    // both Network Type and Fallback Network carry the same value/platform hint.
    expect(inspector.getAllByText(/wifi, cellular, ethernet, other/i).length).toBeGreaterThanOrEqual(2);
    expect(inspector.getAllByText(/auto_detect_interface/i).length).toBeGreaterThanOrEqual(2);
  });
});
