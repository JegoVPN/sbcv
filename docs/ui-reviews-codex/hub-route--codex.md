# Hub Route - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-11 | P0 | Endpoint / Route | Endpoints have inbound/outbound behavior upstream, but route target modeling only accepts `outbounds[]` for `route.final` and `route.rules[].outbound`. Valid endpoint route targets are rejected or unmodeled. | Add a route-target abstraction for outbound + endpoint tags; update diagnostics, references, graph/ports, and route tests. |
| C1-16 | P1 | HTTP Client | HTTP Client tag references are renamed/deleted by registry, but stale imported refs are not diagnosed for `route.default_http_client`, `route.rule_set[].http_client`, or `certificate_providers[].http_client`. | Add HTTP Client tag-index diagnostics for route default, remote rule-sets, and certificate providers. |
| C1-19 | P1 | HTTP Client | HTTP Client nodes are isolated in the graph: there are no port relations or edges for `route.default_http_client`, `route.rule_set[].http_client`, `certificate_providers[].http_client`, or HTTP Client Dial/TLS refs such as `detour` and `domain_resolver`. Users cannot create/disconnect these canonical references from the canvas. | Add typed HTTP Client relations for route default, remote rule-set, ACME/Cloudflare provider, and HTTP Client detour/resolver where we choose to visualize them. |
| C2-4 | P2 | HTTP Client | `route.default_http_client` import currently tolerates an inline object through generic reference helpers, but the route upstream page describes this field as a tag, unlike remote rule-set/provider `http_client` fields that explicitly allow string or object. | Verify with `sing-box-testing check`; then either add a diagnostic for object-valued route default HTTP Client or document it as intentionally tolerated import compatibility. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 1 P0, 2 P1, 1 P2; icons 0 P1, 0 P2.
