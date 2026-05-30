import { describe, expect, it } from "vitest";

import { INSPECTOR_ONLY_REFERENCE_PATHS, referenceRegistry } from "../src/domain/referenceRegistry";
import { portRelations } from "../src/domain/portRelationRegistry";

// V7-S1 / W10-A3 — registry parity guard. referenceRegistry is the FULL reference cascade (every tag
// pointer, used for rename/remove) AND now declares each path's canvas surface on the model via
// INSPECTOR_ONLY_REFERENCE_PATHS; portRelationRegistry is the subset connectable as canvas edges. Two
// hand-maintained registries drift silently — a new reference path can be added to one and forgotten in
// the other. This test verifies the canvas view matches the model: every writable referenceRegistry path
// is EITHER edged (a portRelation canonicalPath) OR declared Inspector-only on the model, with no
// stale/redundant allowlist entries. (The allowlist + reasons now live in the domain, not this test, so a
// path's surface classification is single-sourced with the reference model it describes.)
const INSPECTOR_ONLY = INSPECTOR_ONLY_REFERENCE_PATHS;

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
