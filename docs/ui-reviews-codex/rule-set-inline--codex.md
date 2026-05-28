# Rule Set Inline - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-18 | P0 | Rule Set | Inline Rule Set `rules` is required to be a Headless Rule list, but `rules` is edited by both the safe inline editor and Advanced JSON because it is missing from `ruleSetHandledFields`. Advanced JSON writes raw invalid text into canonical state on parse failure, so `rules` can become a string and export invalid config. | Add `rules` to handled fields; change shared `JsonField` to preserve the previous canonical value on parse errors; add inline rule-set UI tests. |
| C1-17 | P1 | Inbound TUN / Rule Set | TUN `route_address_set` and `route_exclude_address_set` are rule-set tag references, but they are raw text fields with no rule-set registry rename/delete, graph edges, or stale-ref diagnostics. | Add rule-set reference lifecycle for TUN address-set fields; optionally visualize TUN to Rule Set edges. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 1 P0, 1 P1, 0 P2; icons 0 P1, 0 P2.
