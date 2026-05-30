// The minimum sing-box version a node TYPE needs (upstream "Since sing-box X" notes), keyed
// `${kind}:${type}`. Single source of truth shared by the canvas badge (nodeLabels.nodeBadge) and the
// diagnostics TYPE gates (naive / ccm / ocm), so the "needs X" badge and the linter can never disagree.
// Lives in domain (not canvas) to preserve the no-domain→canvas import layering. (C7)
//
// Field-level "Since 1.13.0" gates (kTLS / curve_preferences / route bypass / …) stay as literal
// `atLeast` calls in diagnostics — this table is TYPE-keyed; those features are type-agnostic.
export const TYPE_MIN_VERSION: Record<string, string> = {
  // 1.12 types — dormant today (the lowest selectable target is 1.12, so atLeast is always true), kept
  // for correctness if a sub-1.12 target is ever added.
  "inbound:anytls": "1.12",
  "outbound:anytls": "1.12",
  "endpoint:tailscale": "1.12",
  // 1.13 types (only the naive OUTBOUND is new in 1.13; the naive INBOUND predates it).
  "outbound:naive": "1.13",
  "service:ccm": "1.13",
  "service:ocm": "1.13",
  // 1.14 types (testing-only) — these actually badge "needs 1.14" on the default 1.13 target.
  "inbound:cloudflared": "1.14",
  "service:hysteria-realm": "1.14",
};

export function typeMinVersion(kind: string, type: string): string | undefined {
  return TYPE_MIN_VERSION[`${kind}:${type}`];
}

// The sing-box version that INTRODUCED the testing-only resource families (http_clients[],
// certificate_providers[]) and other 1.14-gated palette items that have no node TYPE in
// TYPE_MIN_VERSION (e.g. the mDNS DNS server). This is an introduction version — a permanent fact, not
// "the latest release": `atLeast(target, INTRODUCED)` keeps working as 1.15/1.16 ship. Single source so
// the value isn't duplicated as a magic string across the palette/diagnostics.
export const TESTING_RESOURCE_MIN_VERSION = "1.14";
