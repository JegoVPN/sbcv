# Rule DNS Rule - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-1 | P0 | DNS Rule | `route` and `evaluate` require `server`, but diagnostics only check stale server refs when a value is already present. Missing required targets can pass SBC semantic validation. | Add action-specific required-target diagnostics for DNS rules; test `route` and `evaluate` without server. |
| C0-2 | P0 | DNS Rule | Inspector clears and hides `server` for `evaluate`, although upstream requires it and domain/graph already allow it. | Treat `route` and `evaluate` as server-bearing DNS actions in Inspector and store tests. |
| C0-3 | P0 | Route/DNS Rule | Action switches only clear one target field and leave stale action-scoped fields, for example route `resolve.server` after switching to `route`, or DNS `predefined.rcode` after switching to `route`. | Introduce central route/DNS action-schema normalizers and make Inspector call them. |
| C0-4 | P0 | DNS Rule | `evaluate` / `respond` ordering and response-match preconditions are not modeled. Upstream requires response matching after a top-level `evaluate`, and `respond` only works after that preceding evaluation. | Add ordered DNS rule scan diagnostics for `respond`, `match_response`, and response fields. |
| C1-3 | P1 | DNS Rule | Hover compatible chip can create a DNS server but does not connect it to the DNS rule; drag/picker create-connect already works. | Add `source.kind === "dns-rule"` branch to compatible creation and test the chip path. |
| C1-8 | P1 | DNS Server / Canvas | DNS-server port disconnect has the same first-edge problem when multiple DNS rules target one server. | Replace single `edgeByPort` lookup with multi-edge handling or edge-specific disconnect UI. |
| C1-23 | P1 | Inbound / Canvas | The Inbound `route-rule-match` and `dns-rule-match` port trash controls use a single first-edge lookup. If multiple route or DNS rules reference the same inbound, the port action disconnects only the first edge instead of a specific chosen rule reference. | Replace aggregate port disconnect with edge-specific remove controls or a multi-reference chooser; add tests for two route rules and two DNS rules sharing one inbound. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 4 P0, 3 P1, 0 P2; icons 0 P1, 0 P2.
