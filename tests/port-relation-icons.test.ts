import { describe, expect, it } from "vitest";
import { portRelations, type PortIconId } from "../src/domain/portRelationRegistry";

// A8b-ports (IC-P2-5): the port-relation glyph vocabulary from the confirmed v4 icon set
// (docs/ui-reviews-pass2/_icons-preview-v4.html → "port relationship icons" + docs/ui-icon-set.md).
// Each relation's source/action port now reads with its semantic glyph instead of a reused generic
// one. The glyph is assigned to the OUTPUT (source) endpoint — the port that authors the relation.
// (Exhaustiveness of the id → Lucide component map is enforced by tsc via Record<PortIconId, …> in
// SbcNode; the no-copy-of-the-node-icon invariant is covered by sbc-node-ports.test.ts.)

const EXPECTED_SOURCE_ICON: Record<string, PortIconId> = {
  "route-rule-order": "list-ordered",
  "dns-rule-order": "list-ordered",
  "route-final": "flag-triangle-right",
  "dns-final": "flag",
  "route-rule": "target",
  "dns-rule": "crosshair",
  "route-rule-inbound": "filter",
  "dns-rule-inbound": "filter",
  selector: "list-checks",
  urltest: "list-checks",
  "outbound-detour": "spline",
  "endpoint-detour": "spline",
  "settings-ntp-detour": "spline",
  "dns-server-detour": "milestone",
  "service-detour-ccm": "corner-down-right",
  "service-detour-ocm": "corner-down-right",
  "rule-set-download": "download-cloud",
  "clash-api-download-detour": "download-cloud",
  "service-ssm-inbound": "cog",
  "service-verify-endpoint": "shield-check",
};

describe("A8b-ports — v4 port-relation glyph vocabulary", () => {
  it.each(Object.entries(EXPECTED_SOURCE_ICON))(
    "%s source port uses the %s glyph",
    (relationId, expected) => {
      const relation = portRelations.find((r) => r.id === relationId);
      expect(relation, relationId).toBeDefined();
      expect(relation?.source.icon).toBe(expected);
    },
  );

  it("every relation row in the spec exists in portRelations (no stale mapping)", () => {
    for (const relationId of Object.keys(EXPECTED_SOURCE_ICON)) {
      expect(portRelations.some((r) => r.id === relationId), relationId).toBe(true);
    }
  });
});
