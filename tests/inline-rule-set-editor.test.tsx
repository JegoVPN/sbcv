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

  it("does not leak JSON mode across two different inline rule-sets (keyed by entity)", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({
        route: {
          rule_set: [
            { type: "inline", tag: "rs-a", rules: [{ domain_suffix: ["a.com"] }] },
            { type: "inline", tag: "rs-b", rules: [{ domain_suffix: ["b.com"] }] },
          ],
        },
      }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:rs-a"));
    fireEvent.click(screen.getByRole("button", { name: "Edit rules as JSON" }));
    expect(screen.getByTestId("inline-rules-json")).toBeInTheDocument();

    // Switch to the other rule-set: it must open in structured mode, not inherit A's JSON mode.
    fireEvent.click(screen.getByTestId("node-rule-set:rs-b"));
    expect(screen.queryByTestId("inline-rules-json")).toBeNull();
    expect(screen.getByTestId("inline-rule-0")).toBeInTheDocument();
  });

  it("clears a numeric field (port) when the input has no numbers, instead of storing []", () => {
    importInline([{ port: [443] }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));

    const row = within(screen.getByTestId("inline-rule-0"));
    fireEvent.change(row.getByLabelText("Port"), { target: { value: "abc" } });
    expect(ruleSet()?.rules?.[0]?.port).toBeUndefined();
  });
});

// C12 (G5): a nested logical (and/or) sub-rule is editable with the same structured editor as a
// top-level rule (mode select + nested rule list), instead of dead-ending at a JSON-mode hint.
// Beyond MAX_INLINE_RULE_DEPTH (5, W6) it falls back to the JSON escape hatch.
// Source: stable/.../rule-set/headless-rule.md (Logical Fields: type/mode/rules, recursive).
describe("C12 — nested logical sub-rule recursion", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  function openInlineLogical(inner: unknown[]) {
    importInline([{ type: "logical", mode: "and", rules: inner }]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));
  }

  it("edits a nested match field structurally (no JSON-mode dead-end)", () => {
    openInlineLogical([{ domain_suffix: ["a.com"] }]);
    expect(screen.queryByText(/nested too deep/i)).toBeNull();
    const nested = within(screen.getByTestId("inline-rule-0-sub-0"));
    fireEvent.change(nested.getByLabelText("Domain suffix"), { target: { value: "z.com" } });
    expect(ruleSet()?.rules?.[0]?.rules?.[0]?.domain_suffix).toEqual(["z.com"]);
    expect(ruleSet()?.rules?.[0]?.type).toBe("logical");
    expect(ruleSet()?.rules?.[0]?.mode).toBe("and");
  });

  it("flips the nested logical mode and → or", () => {
    openInlineLogical([{ domain_suffix: ["a.com"] }]);
    const logical = within(screen.getByTestId("inline-rule-0"));
    fireEvent.change(logical.getByLabelText("Mode"), { target: { value: "or" } });
    expect(ruleSet()?.rules?.[0]?.mode).toBe("or");
  });

  it("adds a rule inside the nested group", () => {
    openInlineLogical([{ domain_suffix: ["a.com"] }]);
    const logical = within(screen.getByTestId("inline-rule-0"));
    fireEvent.click(logical.getByRole("button", { name: "Add inline rule" }));
    expect(ruleSet()?.rules?.[0]?.rules?.length).toBe(2);
  });

  it("falls back to the JSON hint beyond the depth cap and round-trips the deep structure", () => {
    // W6: cap raised to 5 — nest 6 logical levels so the innermost exceeds the disclosure cap.
    let deep: Record<string, unknown> = { domain_suffix: ["x.com"] };
    for (let i = 0; i < 6; i += 1) deep = { type: "logical", mode: "and", rules: [deep] };
    importInline([deep]);
    render(<App />);
    fireEvent.click(screen.getByTestId("node-rule-set:inline-rs"));
    expect(screen.getByText(/nested too deep/i)).toBeTruthy();
    expect(ruleSet()?.rules?.[0]).toEqual(deep);
  });
});
