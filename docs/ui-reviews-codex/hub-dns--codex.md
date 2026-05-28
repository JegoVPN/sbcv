# Hub DNS - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-4 | P0 | DNS Rule | `evaluate` / `respond` ordering and response-match preconditions are not modeled. Upstream requires response matching after a top-level `evaluate`, and `respond` only works after that preceding evaluation. | Add ordered DNS rule scan diagnostics for `respond`, `match_response`, and response fields. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 1 P0, 0 P1, 0 P2; icons 0 P1, 0 P2.
