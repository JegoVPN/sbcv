# Rule Set Remote - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C1-16 | P1 | HTTP Client | HTTP Client tag references are renamed/deleted by registry, but stale imported refs are not diagnosed for `route.default_http_client`, `route.rule_set[].http_client`, or `certificate_providers[].http_client`. | Add HTTP Client tag-index diagnostics for route default, remote rule-sets, and certificate providers. |
| C1-17 | P1 | Inbound TUN / Rule Set | TUN `route_address_set` and `route_exclude_address_set` are rule-set tag references, but they are raw text fields with no rule-set registry rename/delete, graph edges, or stale-ref diagnostics. | Add rule-set reference lifecycle for TUN address-set fields; optionally visualize TUN to Rule Set edges. |
| C1-19 | P1 | HTTP Client | HTTP Client nodes are isolated in the graph: there are no port relations or edges for `route.default_http_client`, `route.rule_set[].http_client`, `certificate_providers[].http_client`, or HTTP Client Dial/TLS refs such as `detour` and `domain_resolver`. Users cannot create/disconnect these canonical references from the canvas. | Add typed HTTP Client relations for route default, remote rule-set, ACME/Cloudflare provider, and HTTP Client detour/resolver where we choose to visualize them. |
| C2-5 | P2 | Rule Set | In testing/1.14, `download_detour` is deprecated in favor of `http_client`, but the main Rule Set Inspector still foregrounds `download_detour` while `http_client` is only in shared fields. | Make Rule Set Inspector channel-aware: stable foregrounds `download_detour`; testing promotes `http_client` and demotes deprecated `download_detour`. |

## Icon/SVG Findings

No node-specific `IC-*` finding was mapped. Global icon-registry findings still apply through `icon-semantics-audit.md`.

SUMMARY: 0 P0, 3 P1, 1 P2; icons 0 P1, 0 P2.
