import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A16 (W24): the route hub rendered `default_network_strategy` and `default_network_type` TWICE — a
// hardcoded block plus the shared Dial-group controls. The hardcoded `default_network_type` was a
// text input writing a raw STRING into a `string[]` field (invalid JSON). Remove the duplicates; the
// Dial-group `list` control (string[]) is the single source.

function importRoute() {
  useProjectStore.getState().importJson(
    JSON.stringify({ outbounds: [{ type: "direct", tag: "out" }], route: { final: "out" } }),
  );
}

describe("A16 — route default_network_type array shape + de-duplicated controls", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("drops the hardcoded string controls, keeping only the Dial-group list controls", () => {
    importRoute();
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route:main"));

    // The hardcoded "(1.13+)" duplicates are gone; the canonical Dial-group controls remain.
    expect(screen.queryByLabelText("Default Network Type (1.13+)")).toBeNull();
    expect(screen.queryByLabelText("Default Network Strategy (1.13+)")).toBeNull();
    expect(screen.getByLabelText("Default Network Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Default Network Strategy")).toBeInTheDocument();
  });

  it("writes default_network_type as a string[] (not a raw string)", () => {
    importRoute();
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route:main"));

    fireEvent.change(screen.getByLabelText("Default Network Type"), { target: { value: "wifi, cellular" } });
    expect(useProjectStore.getState().config.route?.default_network_type).toEqual(["wifi", "cellular"]);
  });
});
