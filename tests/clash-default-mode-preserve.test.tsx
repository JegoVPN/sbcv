import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// DF4 — clash_api.default_mode is a free-form string (matched against the `clash_mode` rule item, which can
// be any user-defined mode); the upstream doc's own example is the capitalized `Rule`. The <select> only
// offered lowercase rule/global/direct, so an imported "Rule"/"Enhanced"/custom value matched no <option>
// → it rendered as (unset) while the card showed ON, and the first interaction wrote a value over the
// original. Fix: keep an already-set unrecognized value selectable (mirrors the evaluate/respond precedent
// in ruleInspectors — render an extra <option> for the set value).

describe("DF4 — clash_api default_mode preserves an unrecognized value", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("displays a capitalized/custom default_mode without clobbering it", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ experimental: { clash_api: { external_controller: "127.0.0.1:9090", default_mode: "Rule" } } }),
    );
    act(() => {
      useProjectStore.getState().setSelectedId("settings:experimental");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const select = inspector.getByLabelText("Default Mode") as HTMLSelectElement;

    // The imported value displays as selected rather than collapsing to (unset).
    expect(select.value).toBe("Rule");
    // And it survives untouched in the config (no first-render clobber).
    const clashApi = () =>
      useProjectStore.getState().config.experimental?.clash_api as Record<string, unknown> | undefined;
    expect(clashApi()?.default_mode).toBe("Rule");
  });

  it("still offers the canonical lowercase modes and selects a known value", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ experimental: { clash_api: { external_controller: "127.0.0.1:9090", default_mode: "global" } } }),
    );
    act(() => {
      useProjectStore.getState().setSelectedId("settings:experimental");
    });
    render(<App />);
    const inspector = within(screen.getByLabelText("Node inspector"));
    const select = inspector.getByLabelText("Default Mode") as HTMLSelectElement;
    expect(select.value).toBe("global");

    // Switching to a canonical mode still works and writes the lowercase value.
    fireEvent.change(select, { target: { value: "direct" } });
    const clashApi = useProjectStore.getState().config.experimental?.clash_api as Record<string, unknown> | undefined;
    expect(clashApi?.default_mode).toBe("direct");
  });
});
