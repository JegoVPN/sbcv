import { describe, expect, it } from "vitest";

import { referenceRegistry } from "../src/domain/referenceRegistry";
import { portRelations } from "../src/domain/portRelationRegistry";

// V7-S1 — registry parity guard. referenceRegistry is the FULL reference cascade (every tag pointer, used
// for rename/remove); portRelationRegistry is the subset connectable as canvas edges. Two hand-maintained
// registries drift silently — a new reference path can be added to one and forgotten in the other. This
// test asserts every writable referenceRegistry path is EITHER edged (a portRelation canonicalPath) OR in
// an explicit Inspector-only allowlist, and that the allowlist has no stale/redundant entries.

// Paths a user edits only through the Inspector (a select / CSV / nested list), never as a canvas edge —
// each with the reason. As V7-S2/S3 promote paths to edges, they move OUT of this list (the test keeps it
// honest: a promoted-but-not-removed entry becomes "redundant", a removed-but-not-edged path becomes
// "uncovered").
const INSPECTOR_ONLY: Record<string, string> = {
  "/outbounds/*/default": "selector default — a <select> of the node's own candidates, not a cross-node edge",
  "/route/default_domain_resolver": "route default domain resolver — Inspector dial <select>",
  "*/tls/certificate_provider": "tls.certificate_provider — Inspector TLS <select>",
  "/inbounds/*/route_address_set": "tun route_address_set — Inspector CSV of rule-set tags",
  "/inbounds/*/route_exclude_address_set": "tun route_exclude_address_set — Inspector CSV of rule-set tags",
  "/experimental/v2ray_api/stats/inbounds": "v2ray stats — Inspector list of inbound tags",
  "/experimental/v2ray_api/stats/outbounds": "v2ray stats — Inspector list of outbound tags",
  "/services/*/mesh_with/*/detour": "derp mesh_with[].detour — nested-array detour, Inspector-only",
  "/services/*/verify_client_url/*/detour": "derp verify_client_url[].detour — nested-array detour, Inspector-only",
  "/inbounds/*/handshake/detour": "shadowtls handshake.detour — Inspector dial <select>",
  "/inbounds/*/handshake_for_server_name/*/detour": "shadowtls handshake_for_server_name[].detour — Inspector-only",
  "/inbounds/*/control_dialer/detour": "cloudflared control_dialer.detour — Inspector dial <select>",
  "/inbounds/*/tunnel_dialer/detour": "cloudflared tunnel_dialer.detour — Inspector dial <select>",
  // ── candidates for promotion to canvas edges ──────────────────────────────────────────────────────
  "/inbounds/*/detour": "inbound detour (inbound→inbound) — V7-S2 will promote to a writable edge",
  "/route/rules/*/server": "route-rule resolve action server — V7-S3 will promote to a writable edge",
};

const relationPaths = new Set(
  portRelations.map((relation) => relation.canonicalPath).filter((path): path is string => Boolean(path)),
);
const refPaths = [...new Set(referenceRegistry.flatMap((entry) => entry.paths))];

// A `*/x` reference path is a catch-all suffix; treat it as edged if any relation canonicalPath ends with
// the literal suffix after the leading `*` (e.g. `*/domain_resolver` ← `/outbounds/*/domain_resolver`).
function isEdged(refPath: string): boolean {
  if (relationPaths.has(refPath)) return true;
  if (refPath.startsWith("*/")) {
    const suffix = refPath.slice(1); // "/domain_resolver"
    for (const path of relationPaths) if (path.endsWith(suffix)) return true;
  }
  return false;
}

describe("V7-S1 — referenceRegistry ↔ portRelationRegistry parity", () => {
  it("every writable reference path is edged or explicitly Inspector-only", () => {
    const uncovered = refPaths.filter((path) => !isEdged(path) && !(path in INSPECTOR_ONLY));
    expect(uncovered).toEqual([]);
  });

  it("the Inspector-only allowlist has no stale entries (each is a real, non-edged reference path)", () => {
    const refSet = new Set(refPaths);
    const stale = Object.keys(INSPECTOR_ONLY).filter((path) => !refSet.has(path));
    expect(stale).toEqual([]);
  });

  it("the Inspector-only allowlist has no redundant entries (none are already edged)", () => {
    const redundant = Object.keys(INSPECTOR_ONLY).filter((path) => isEdged(path));
    expect(redundant).toEqual([]);
  });
});
