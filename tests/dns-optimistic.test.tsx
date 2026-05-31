import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U9 — DNS `optimistic` accepts a boolean OR an object {enabled, timeout} (the stale-serve window, default
// 3d) per dns/index.md. The control was a bare on/off bool, so the object form (a custom stale-serve
// window) could not be written. Make it a composite: an enabled checkbox + a conditional window text that
// promotes the value to the object form. Also relabel the adjacent per-query `dns.timeout` (10s) — it is an
// unrelated field, not the optimistic window — to disambiguate.

const dns = () => useProjectStore.getState().config.dns as Record<string, unknown>;

function openDnsHub() {
  useProjectStore.getState().loadTemplate();
  act(() => {
    useProjectStore.getState().setSelectedId("dns:main");
  });
  render(<App />);
  return within(screen.getByLabelText("Node inspector"));
}

describe("U9 — DNS optimistic composite + query-timeout label", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("enables optimistic as the boolean form when no window is set", () => {
    const inspector = openDnsHub();
    const fieldset = inspector.getByTestId("dns-hub-optimistic");
    const enabled = within(fieldset).getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(enabled);
    expect(dns().optimistic).toBe(true);
    fireEvent.click(enabled);
    expect(dns().optimistic).toBeUndefined();
  });

  it("writes the object form {enabled, timeout} when a stale-serve window is set", () => {
    const inspector = openDnsHub();
    const fieldset = inspector.getByTestId("dns-hub-optimistic");
    fireEvent.click(within(fieldset).getByRole("checkbox"));
    const window = within(fieldset).getByLabelText(/Stale-serve window/i) as HTMLInputElement;
    fireEvent.change(window, { target: { value: "1d" } });
    expect(dns().optimistic).toEqual({ enabled: true, timeout: "1d" });
    // clearing the window collapses back to the boolean form (default 3d window)
    fireEvent.change(window, { target: { value: "" } });
    expect(dns().optimistic).toBe(true);
  });

  it("reads back an imported object form", () => {
    useProjectStore.getState().importJson(JSON.stringify({ dns: { optimistic: { enabled: true, timeout: "2d" } } }));
    act(() => {
      useProjectStore.getState().setSelectedId("dns:main");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const fieldset = inspector.getByTestId("dns-hub-optimistic");
    expect((within(fieldset).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect((within(fieldset).getByLabelText(/Stale-serve window/i) as HTMLInputElement).value).toBe("2d");
  });

  it("hides the stale-serve window until optimistic is enabled", () => {
    const inspector = openDnsHub();
    const fieldset = inspector.getByTestId("dns-hub-optimistic");
    expect(within(fieldset).queryByLabelText(/Stale-serve window/i)).toBeNull();
  });

  it("relabels the per-query timeout as Query Timeout (distinct from the optimistic window)", () => {
    const inspector = openDnsHub();
    const qt = within(inspector.getByTestId("dns-hub-timeout")).getByLabelText(/Query Timeout/i) as HTMLInputElement;
    fireEvent.change(qt, { target: { value: "7s" } });
    expect(dns().timeout).toBe("7s");
  });
});
