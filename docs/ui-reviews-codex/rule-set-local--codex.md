# Rule Set Local - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-19 | P0 | Rule Set | Local Rule Set `format` is required unless `path` ends with `.json` or `.srs`, but diagnostics only enforce missing/inferable `format` for remote URLs. Imported or advanced-edited local rule sets with non-inferable paths can miss `format` silently. | Share remote/local format inference diagnostics and add tests for local non-inferable paths. |
| C1-17 | P1 | Inbound TUN / Rule Set | TUN `route_address_set` and `route_exclude_address_set` are rule-set tag references, but they are raw text fields with no rule-set registry rename/delete, graph edges, or stale-ref diagnostics. | Add rule-set reference lifecycle for TUN address-set fields; optionally visualize TUN to Rule Set edges. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 1 P0, 1 P1, 0 P2; icons 0 P1, 0 P2.
