import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { useProjectStore } from "../src/state/useProjectStore";

// U15a — the route/DNS rule `network` matcher is `tcp` / `udp` / `icmp` (route/rule.md; icmp since 1.13),
// but it was a free-text list, so typos (`TCP`, `icmpv6`) were silently accepted. Render it as a fixed
// tcp/udp/icmp checkbox group (a multi-value enum). Also fix the inline-rule label "Network (tcp/udp)" that
// omitted icmp.

function openRouteRule(rule: Record<string, unknown> = { inbound: ["in"] }) {
  useProjectStore.getState().importJson(JSON.stringify({ route: { rules: [rule] } }));
  render(<App />);
  fireEvent.click(screen.getByTestId("node-route-rule:0"));
}
const routeRule = () => useProjectStore.getState().config.route?.rules?.[0] as Record<string, unknown> | undefined;

describe("U15a — network matcher enum", () => {
  beforeEach(() => useProjectStore.getState().importJson(JSON.stringify({})));
  afterEach(() => useProjectStore.getState().importJson(JSON.stringify({})));

  it("offers exactly tcp / udp / icmp as the network options", () => {
    openRouteRule();
    const group = within(screen.getByTestId("rule-network-enum"));
    for (const net of ["tcp", "udp", "icmp"]) {
      expect((group.getByLabelText(net) as HTMLInputElement).type).toBe("checkbox");
    }
  });

  it("writes the chosen networks as a list and clears to undefined when none are checked", () => {
    openRouteRule();
    const group = within(screen.getByTestId("rule-network-enum"));
    fireEvent.click(group.getByLabelText("icmp"));
    expect(routeRule()?.network).toEqual(["icmp"]);
    fireEvent.click(group.getByLabelText("tcp"));
    expect(routeRule()?.network).toEqual(["icmp", "tcp"]);
    fireEvent.click(group.getByLabelText("icmp"));
    expect(routeRule()?.network).toEqual(["tcp"]);
    fireEvent.click(group.getByLabelText("tcp"));
    expect(routeRule()?.network).toBeUndefined();
  });

  it("reflects an imported network value (string or list) as checked boxes", () => {
    openRouteRule({ inbound: ["in"], network: "udp" });
    const group = within(screen.getByTestId("rule-network-enum"));
    expect((group.getByLabelText("udp") as HTMLInputElement).checked).toBe(true);
    expect((group.getByLabelText("tcp") as HTMLInputElement).checked).toBe(false);
  });
});
