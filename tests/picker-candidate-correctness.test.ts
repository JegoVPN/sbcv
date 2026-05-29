import { describe, expect, it } from "vitest";
import { chipCandidatesForPending, type PendingPort } from "../src/components/CanvasWorkspace";

// N2-candidate-correctness: the port picker's candidate generator (chipCandidatesForPending) must only
// ever offer targets that are valid for that port per upstream — never silently offer an invalid kind.
// An agent audit confirmed the current sets are sound (0 dead, 0 upstream-invalid); this guards the
// per-port FILTERING against regressions (the generator was previously untested).

const pending = (kind: string, type: string, handleId: string): PendingPort =>
  ({ nodeId: `${kind}:x`, handleId, kind: kind as PendingPort["kind"], type, sourceFlowPosition: null });

describe("N2-candidate-correctness — picker candidate filtering", () => {
  it("route final port offers only outbound candidates", () => {
    const candidates = chipCandidatesForPending(pending("route", "route", "outbound"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.nodeKind === "outbound")).toBe(true);
  });

  it("dns final port offers only dns-server candidates", () => {
    const candidates = chipCandidatesForPending(pending("dns", "dns", "dns-server"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.nodeKind === "dns-server")).toBe(true);
  });

  it("a route-rule rule-set port offers only rule-set candidates", () => {
    const candidates = chipCandidatesForPending(pending("route-rule", "route-rule", "rule-set"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.nodeKind === "rule-set")).toBe(true);
  });

  it("a dns-server tailscale-endpoint port offers only tailscale endpoints", () => {
    const candidates = chipCandidatesForPending(pending("dns-server", "tailscale", "endpoint"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.nodeKind === "endpoint" && c.nodeType === "tailscale")).toBe(true);
  });

  it("an outbound dial-detour port offers outbounds but never the self/block outbound", () => {
    const candidates = chipCandidatesForPending(pending("outbound", "direct", "dial-detour"));
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.nodeKind === "outbound")).toBe(true);
    // `block` is removed in 1.13 and is not creatable — it must never be offered as a detour target.
    expect(candidates.some((c) => c.nodeType === "block")).toBe(false);
  });
});
