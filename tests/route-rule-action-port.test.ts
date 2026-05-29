import { describe, expect, it } from "vitest";
import { getPortSpecs } from "../src/components/SbcNode";

// Symmetric to the dns-rule gate (A10c): the route-rule "outbound" output port was advertised
// regardless of action, even though only route/bypass dial an outbound. A reject/sniff/resolve rule
// therefore showed a draggable outbound port that the connect command refuses (silent no-op) and whose
// graph edge is suppressed — a misleading drag source. getPortSpecs is now action-aware.

function outputKeys(action?: string) {
  return getPortSpecs("route-rule", "route-rule", "output", action).map((p) => p.key);
}

describe("route-rule outbound port is action-aware", () => {
  it("keeps the outbound output port for routing actions (route, bypass, default)", () => {
    for (const action of ["route", "bypass", undefined]) {
      expect(outputKeys(action), `action=${action}`).toContain("outbound");
    }
  });

  it("drops the outbound output port for non-routing actions", () => {
    for (const action of ["reject", "sniff", "resolve", "hijack-dns", "route-options"]) {
      expect(outputKeys(action), `action=${action}`).not.toContain("outbound");
    }
  });

  it("keeps the rule-set output port regardless of action", () => {
    for (const action of ["route", "reject", "sniff"]) {
      expect(outputKeys(action), `action=${action}`).toContain("rule-set");
    }
  });
});
