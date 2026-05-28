import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// A11 (W19): the inline rule-set `rules[]` was editable only as one raw JSON blob. It now has a
// structured per-rule list (add / remove / reorder + common headless match fields) with a JSON-mode
// escape hatch for logical / exotic rules.

function importInline(rules: unknown[]) {
  useProjectStore.getState().importJson(
    JSON.stringify({ route: { rule_set: [{ type: "inline", tag: "inline-rs", rules }] } }),
  );
}
function ruleSet() {
  return useProjectStore.getState().config.route?.rule_set?.[0] as { rules?: any[] } | undefined;
}

describe("A11 — inline rule-set structured editor", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("renders one structured row per rule and edits a common match field", () => {
    importInline([{ domain_suffix: ["a.com"] }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));

    const row = within(screen.getByTestId("inline-rule-0"));
    const input = row.getByLabelText("Domain suffix") as HTMLInputElement;
    expect(input.value).toContain("a.com");

    fireEvent.change(input, { target: { value: "b.com, c.com" } });
    expect(ruleSet()?.rules?.[0]?.domain_suffix).toEqual(["b.com", "c.com"]);
  });

  it("adds a new rule", () => {
    importInline([{ domain_suffix: ["a.com"] }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));

    fireEvent.click(screen.getByRole("button", { name: "Add inline rule" }));
    expect(ruleSet()?.rules?.length).toBe(2);
  });

  it("removes a rule", () => {
    importInline([{ domain_suffix: ["a.com"] }, { domain: ["x.com"] }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));

    fireEvent.click(screen.getByRole("button", { name: "Remove inline rule 1" }));
    expect(ruleSet()?.rules?.length).toBe(1);
    expect(ruleSet()?.rules?.[0]?.domain).toEqual(["x.com"]);
  });

  it("preserves non-structured keys (logical rules) when editing in structured mode", () => {
    importInline([{ type: "logical", mode: "and", rules: [{ domain: ["a"] }] }, { domain_suffix: ["b.com"] }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));

    // Edit the second (simple) rule; the logical rule at index 0 must be untouched.
    const row = within(screen.getByTestId("inline-rule-1"));
    fireEvent.change(row.getByLabelText("Domain suffix"), { target: { value: "c.com" } });
    expect(ruleSet()?.rules?.[0]).toEqual({ type: "logical", mode: "and", rules: [{ domain: ["a"] }] });
    expect(ruleSet()?.rules?.[1]?.domain_suffix).toEqual(["c.com"]);
  });

  it("exposes a JSON escape hatch", () => {
    importInline([{ domain_suffix: ["a.com"] }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));

    fireEvent.click(screen.getByRole("button", { name: "Edit rules as JSON" }));
    expect(screen.getByTestId("inline-rules-json")).toBeInTheDocument();
  });
});
