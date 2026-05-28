import { describe, expect, it } from "vitest";
import { getPortSpecs } from "../src/components/SbcNode";

// A10c (claude P0): the dns-rule "DNS server" output port is advertised regardless of action, even
// though the graph edge is action-gated. A reject/respond/predefined/route-options rule therefore shows
// a clickable server port that can never produce a valid edge (and dragging it writes a no-op `server`).
// getPortSpecs is now action-aware: it drops the dns-server output port for non-server-bearing actions.

function outputKeys(action?: string) {
  return getPortSpecs("dns-rule", "dns-rule", "output", action).map((p) => p.key);
}

describe("A10c — dns-rule dns-server port is action-aware", () => {
  it("keeps the dns-server output port for server-bearing actions (route, evaluate, default)", () => {
    for (const action of ["route", "evaluate", undefined]) {
      expect(outputKeys(action), `action=${action}`).toContain("dns-server");
    }
  });

  it("drops the dns-server output port for non-server-bearing actions", () => {
    for (const action of ["reject", "respond", "predefined", "route-options"]) {
      expect(outputKeys(action), `action=${action}`).not.toContain("dns-server");
    }
  });

  it("keeps the rule-set output port regardless of action", () => {
    for (const action of ["route", "reject", "respond"]) {
      expect(outputKeys(action), `action=${action}`).toContain("rule-set");
    }
  });
});
