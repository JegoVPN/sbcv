import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-fix-route-strategy (audit H2): the route-rule route-options "Network Strategy" select offered
// `wifi/cellular/ethernet` — but those are `network_type` values; `network_strategy` accepts ONLY
// `default/hybrid/fallback` (shared/dial.md). Selecting one wrote an invalid network_strategy.

function importRouteRule() {
  useProjectStore.getState().importJson(
    JSON.stringify({
      outbounds: [{ type: "direct", tag: "out" }],
      route: { rules: [{ domain_suffix: ["x"], action: "route", outbound: "out" }] },
    }),
  );
}

describe("L2-fix-route-strategy — route-options Network Strategy valid values only", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("offers only unset/default/hybrid/fallback (no network_type values)", () => {
    importRouteRule();
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    const inspector = within(screen.getByLabelText(/rule .* inspector/i));
    const select = inspector.getByLabelText("Network Strategy");
    const values = Array.from(select.querySelectorAll("option")).map((o) => o.getAttribute("value"));
    expect(values).toEqual(["", "default", "hybrid", "fallback"]);
    expect(values).not.toContain("wifi");
    expect(values).not.toContain("cellular");
    expect(values).not.toContain("ethernet");
  });
});
