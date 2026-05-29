import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-med-rules-copy (MED audit): two rule-editing strings were imprecise, in both the per-rule node
// inspector and the table editor.
// - "Rule Set" as a *match* field reads ambiguously against the rule-set entity; upstream describes it
//   as "Match [rule-set]" → relabel "Match rule-set" everywhere a rule is matched.
// - reject `no_drop` "(only return)" was vague; upstream: without it, `method` is temporarily forced to
//   `drop` after 50 triggers in 30s → surface the throttle.

describe("L2-med-rules-copy — rule match/action copy accuracy", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("route rule inspector: 'Match rule-set' + no_drop names the 50/30s throttle", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ route: { rules: [{ domain_suffix: ["x"], action: "reject" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route-rule:0"));
    const inspector = within(screen.getByLabelText("Route rule 1 inspector"));
    expect(inspector.getByText("Match rule-set")).toBeInTheDocument();
    expect(inspector.queryByText("Rule Set")).toBeNull();
    expect(inspector.getByText(/No drop.*50.*30s/i)).toBeInTheDocument();
  });

  it("dns rule inspector: 'Match rule-set' + no_drop names the 50/30s throttle", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { rules: [{ domain_suffix: ["x"], action: "reject" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));
    const inspector = within(screen.getByLabelText("DNS rule 1 inspector"));
    expect(inspector.getByText("Match rule-set")).toBeInTheDocument();
    expect(inspector.queryByText("Rule Set")).toBeNull();
    expect(inspector.getByText(/No drop.*50.*30s/i)).toBeInTheDocument();
  });

  it("route rules table uses the same 'Match rule-set' label", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ route: { rules: [{ domain_suffix: ["x"], action: "reject" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-route:main"));
    const inspector = within(screen.getByTestId("node-inspector"));
    expect(inspector.getByText("Match rule-set")).toBeInTheDocument();
    expect(inspector.queryByText("Rule Set")).toBeNull();
  });
});
