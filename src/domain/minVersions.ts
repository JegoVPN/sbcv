// The minimum sing-box version a node TYPE needs (upstream "Since sing-box X" notes), keyed
// `${kind}:${type}`. Single source of truth shared by the canvas badge (nodeLabels.nodeBadge) and the
// diagnostics TYPE gates (naive / ccm / ocm), so the "needs X" badge and the linter can never disagree.
// Lives in domain (not canvas) to preserve the no-domain→canvas import layering. (C7)
//
// W10/A1 — DERIVED from SCHEMA_ROWS[].minVersion so the version-per-type lives ON the schema row (the
// single declarative table), not in a parallel hand-maintained map. The 1.12 types are dormant today
// (the lowest selectable target is 1.12, so atLeast is always true); the 1.13/1.14 entries drive the
// real badges + gates. (The naive INBOUND predates 1.13, so only the naive OUTBOUND row carries 1.13.)
//
// Field-level "Since 1.13.0" gates (kTLS / curve_preferences / route bypass / …) stay as literal
// `atLeast` calls in diagnostics — this table is TYPE-keyed; those features are type-agnostic.
import { SCHEMA_ROWS } from "./schemaRegistry";

export const TYPE_MIN_VERSION: Record<string, string> = Object.fromEntries(
  SCHEMA_ROWS.filter((row) => row.minVersion).map((row) => [`${row.kind}:${row.type}`, row.minVersion!]),
);

export function typeMinVersion(kind: string, type: string): string | undefined {
  return TYPE_MIN_VERSION[`${kind}:${type}`];
}

// The sing-box version that INTRODUCED the testing-only resource families (http_clients[],
// certificate_providers[]) — collection-level palette gates that have no per-type node in TYPE_MIN_VERSION.
// This is an introduction version — a permanent fact, not "the latest release": `atLeast(target,
// INTRODUCED)` keeps working as 1.15/1.16 ship. Single source so the value isn't duplicated as a magic
// string across the palette/diagnostics. (mDNS, once a member here, now has a real TYPE_MIN_VERSION entry.)
export const TESTING_RESOURCE_MIN_VERSION = "1.14";
