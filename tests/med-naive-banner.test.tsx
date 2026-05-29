import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-med-naive-banner (MED audit, behavior): the naive outbound had no platform-support banner.
// Upstream (outbound/naive.md): "NaiveProxy outbound is only available on Apple platforms, Android,
// Windows and certain Linux builds" — Linux/Windows builds must ship libcronet (libcronet.so / .dll).

describe("L2-med-naive-banner — naive outbound platform-support banner", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("shows the platform-support banner for a naive outbound", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "naive", tag: "n", server: "s", server_port: 443 }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:n"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText(/only on Apple platforms, Android, Windows/i)).toBeInTheDocument();
    expect(inspector.getByText(/libcronet/i)).toBeInTheDocument();
  });

  it("does not show the naive platform banner for a non-naive outbound", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ outbounds: [{ type: "direct", tag: "d" }] }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-outbound:d"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.queryByText(/libcronet/i)).toBeNull();
  });
});
