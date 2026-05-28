import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A20 (rule / C1-1): the route-rule `bypass` action supports an optional `outbound` and route-options
// (rule_action.md), but the Inspector only exposed Outbound for `route` and route-options for
// `route`/`route-options`. Show both for `bypass` too.

function importRule(action: string) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      outbounds: [{ type: "direct", tag: "out" }],
      route: { rules: [{ domain_suffix: ["x"], action }] },
    }),
  );
}

describe("A20-rule — bypass exposes outbound + route-options (C1-1)", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("shows the Outbound select and Route options for a bypass rule", () => {
    importRule("bypass");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    const inspector = within(screen.getByLabelText(/rule .* inspector/i));
    expect(inspector.getByLabelText("Outbound")).toBeInTheDocument();
    expect(inspector.getByTestId("route-rule-route-options")).toBeInTheDocument();
  });

  it("editing the bypass outbound persists it", () => {
    importRule("bypass");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    const inspector = within(screen.getByLabelText(/rule .* inspector/i));
    fireEvent.change(inspector.getByLabelText("Outbound"), { target: { value: "out" } });
    expect(useProjectStore.getState().config.route?.rules?.[0]?.outbound).toBe("out");
  });

  it("does not show Outbound/route-options for a reject rule", () => {
    importRule("reject");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    const inspector = within(screen.getByLabelText(/rule .* inspector/i));
    expect(inspector.queryByLabelText("Outbound")).toBeNull();
    expect(inspector.queryByTestId("route-rule-route-options")).toBeNull();
  });
});
