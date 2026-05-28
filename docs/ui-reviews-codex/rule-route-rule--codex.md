# Rule Route Rule - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-3 | P0 | Route/DNS Rule | Action switches only clear one target field and leave stale action-scoped fields, for example route `resolve.server` after switching to `route`, or DNS `predefined.rcode` after switching to `route`. | Introduce central route/DNS action-schema normalizers and make Inspector call them. |
| C0-11 | P0 | Endpoint / Route | Endpoints have inbound/outbound behavior upstream, but route target modeling only accepts `outbounds[]` for `route.final` and `route.rules[].outbound`. Valid endpoint route targets are rejected or unmodeled. | Add a route-target abstraction for outbound + endpoint tags; update diagnostics, references, graph/ports, and route tests. |
| C1-1 | P1 | Route Rule | `bypass` supports optional `outbound` and route-options, but Inspector only exposes outbound for `route` and route-options for `route` / `route-options`. | Show outbound and route-options for `bypass`; add component coverage. |
| C1-2 | P1 | Route Rule | `resolve.server` is a DNS server tag reference, but it is missing from DNS-server reference registry, rename/delete lifecycle, graph, and stale-ref diagnostics. | Add `/route/rules/*/server` DNS-server reference handling, graph edge, diagnostics, and tests. |
| C1-23 | P1 | Inbound / Canvas | The Inbound `route-rule-match` and `dns-rule-match` port trash controls use a single first-edge lookup. If multiple route or DNS rules reference the same inbound, the port action disconnects only the first edge instead of a specific chosen rule reference. | Replace aggregate port disconnect with edge-specific remove controls or a multi-reference chooser; add tests for two route rules and two DNS rules sharing one inbound. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 2 P0, 3 P1, 0 P2; icons 0 P1, 0 P2.
