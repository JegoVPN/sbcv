import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// L2-med-dns-rule-actions (MED audit, behavior): the DNS rule Action select offered `evaluate` and
// `respond` on every channel with no explanation. They are 1.14-only actions, so gate them to the
// testing channel (but keep an already-set value visible), and add a hint describing their semantics
// (evaluate: queries + saves, top-level only, doesn't terminate; respond: returns a preceding
// evaluate's response, no query, errors if none) — dns/rule_action.md.

function actionOptionNames(inspector: ReturnType<typeof within>) {
  const select = inspector.getByLabelText("Action");
  return within(select).getAllByRole("option").map((option) => option.textContent);
}

describe("L2-med-dns-rule-actions — evaluate/respond gating + hints", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("testing: evaluate/respond are offered and show a 1.14 hint", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { rules: [{ domain_suffix: ["x"], action: "route" }] } }),
    );
    useProjectStore.getState().setChannel("testing");
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));
    const inspector = within(screen.getByLabelText("DNS rule 1 inspector"));
    expect(actionOptionNames(inspector)).toEqual(expect.arrayContaining(["evaluate", "respond"]));

    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "evaluate" } });
    expect(inspector.getByText(/evaluate \(1\.14\+\)/i)).toBeInTheDocument();
    expect(inspector.getByText(/top-level/i)).toBeInTheDocument();

    fireEvent.change(inspector.getByLabelText("Action"), { target: { value: "respond" } });
    expect(inspector.getByText(/respond \(1\.14\+\)/i)).toBeInTheDocument();
  });

  it("stable: evaluate/respond are not offered as new choices", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { rules: [{ domain_suffix: ["x"], action: "route" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));
    const inspector = within(screen.getByLabelText("DNS rule 1 inspector"));
    const names = actionOptionNames(inspector);
    expect(names).not.toContain("evaluate");
    expect(names).not.toContain("respond");
  });

  it("stable: an already-set evaluate action stays selectable so the control still displays it", () => {
    useProjectStore.getState().importJson(
      JSON.stringify({ dns: { rules: [{ domain_suffix: ["x"], action: "evaluate", server: "s" }] } }),
    );
    render(<App />);
    fireEvent.click(screen.getByTestId("node-dns-rule:0"));
    const inspector = within(screen.getByLabelText("DNS rule 1 inspector"));
    expect(actionOptionNames(inspector)).toContain("evaluate");
    expect(inspector.getByText(/evaluate \(1\.14\+\)/i)).toBeInTheDocument();
  });
});
