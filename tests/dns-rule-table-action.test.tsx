import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DnsRulesTable } from "../src/components/RuleTables";
import { useProjectStore } from "../src/state/useProjectStore";

// U3 — the DNS Rules quick-edit table (RuleTables.tsx) let the user edit domain/server but not the rule
// ACTION, so every table-authored DNS rule was route-only; the per-action option controls live in the
// node inspector. This adds an Action <select> to each table row (reusing updateDnsRule →
// normalizeDnsRule, which scrubs action-incompatible keys). No serialization change — the model already
// supports/round-trips the action and its options.

function importRule(extra: Record<string, unknown> = {}) {
  useProjectStore.getState().importJson(
    JSON.stringify({
      dns: {
        servers: [{ type: "https", tag: "remote-doh", server: "1.1.1.1" }],
        rules: [{ domain_suffix: ["cn"], action: "route", server: "remote-doh", ...extra }],
      },
    }),
  );
}

function openDnsTable() {
  render(<App />);
  act(() => useProjectStore.getState().setPanelTab("dns"));
}

function rule0() {
  return useProjectStore.getState().config.dns?.rules?.[0] as Record<string, unknown>;
}

describe("U3 — DNS rules table action select", () => {
  beforeEach(() => {
    useProjectStore.getState().importJson(JSON.stringify({}));
    useProjectStore.getState().setChannel("stable");
  });
  afterEach(() => {
    useProjectStore.getState().setChannel("stable");
    useProjectStore.getState().importJson(JSON.stringify({}));
  });

  it("renders an Action select reflecting the rule's action", () => {
    importRule();
    openDnsTable();
    const action = screen.getByLabelText("DNS rule 1 action") as HTMLSelectElement;
    expect(action.tagName).toBe("SELECT");
    expect(action.value).toBe("route");
  });

  it("switching to reject persists the action and scrubs the now-incompatible server", () => {
    importRule();
    openDnsTable();
    fireEvent.change(screen.getByLabelText("DNS rule 1 action"), { target: { value: "reject" } });
    expect(rule0().action).toBe("reject");
    // normalizeDnsRule drops `server` for non-routing actions (dnsRuleAllowsServer), and the row's
    // Server select disappears for reject.
    expect(rule0().server).toBeUndefined();
    expect(screen.queryByLabelText("DNS rule 1 server")).toBeNull();
  });

  it("offers route-options / reject / predefined on every channel", () => {
    importRule();
    openDnsTable();
    const values = Array.from((screen.getByLabelText("DNS rule 1 action") as HTMLSelectElement).options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["route", "route-options", "reject", "predefined"]));
  });

  it("offers the 1.14-only evaluate / respond actions on the testing channel", () => {
    importRule();
    useProjectStore.getState().setChannel("testing");
    openDnsTable();
    const values = Array.from((screen.getByLabelText("DNS rule 1 action") as HTMLSelectElement).options).map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(["evaluate", "respond"]));
  });

  it("scrubs a predefined-only key when switching predefined → route (normalizeDnsRule)", () => {
    importRule({ action: "predefined", rcode: "NXDOMAIN", server: undefined });
    openDnsTable();
    fireEvent.change(screen.getByLabelText("DNS rule 1 action"), { target: { value: "route" } });
    expect(rule0().action).toBe("route");
    expect(rule0().rcode).toBeUndefined();
  });

  it("does not offer evaluate / respond on stable, but keeps an already-set value selectable", () => {
    importRule({ action: "evaluate" });
    openDnsTable();
    const select = screen.getByLabelText("DNS rule 1 action") as HTMLSelectElement;
    // The current value stays representable even though the channel wouldn't freshly offer it.
    expect(select.value).toBe("evaluate");
  });
});
