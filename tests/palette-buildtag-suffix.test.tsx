import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L1-buildtags (D3): palette labels dropped the build-tag suffixes "(with_tailscale)" / "(with_tor)" —
// they're noise in the primary name; the build-tag requirement is surfaced by the Inspector banner.

describe("L1-buildtags — palette labels have no build-tag suffix", () => {
  beforeEach(() => useProjectStore.getState().loadMinimal());
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("endpoint Tailscale reads 'Tailscale', not 'Tailscale (with_tailscale)'", async () => {
    render(<App />);
    const palette = within(await screen.findByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Endpoints/ }));
    expect(palette.getByRole("button", { name: "Add Tailscale" })).toBeInTheDocument();
    expect(palette.queryByRole("button", { name: /with_tailscale/ })).toBeNull();
  });

  it("Tor outbound reads 'Tor', not 'Tor (with_tor)'", async () => {
    render(<App />);
    const palette = within(await screen.findByLabelText("Node palette"));
    fireEvent.click(palette.getByRole("button", { name: /Library/ }));
    fireEvent.click(palette.getByRole("button", { name: /^Outbounds/ }));
    expect(palette.queryByRole("button", { name: /with_tor/ })).toBeNull();
  });
});
