# HTTP Client - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-6 | P0 | Shared TLS | Inspector uses one mixed TLS editor for inbound, outbound, and DNS server TLS. Upstream has distinct inbound/server and outbound/client schemas; `sing-box-stable check` rejects invalid-role fields such as outbound `tls.key_path` and inbound `tls.utls`. | Split TLS fields by role and update UI tests so invalid-role fields are absent. |
| C0-15 | P0 | Certificate Provider | Required certificate-provider fields are not semantically validated: Tailscale provider requires a Tailscale endpoint, ACME/Cloudflare require `domain`, and Cloudflare credential conflicts are unchecked. | Add provider-type diagnostics and endpoint type checks; cover imported providers and provider nodes. |
| C1-16 | P1 | HTTP Client | HTTP Client tag references are renamed/deleted by registry, but stale imported refs are not diagnosed for `route.default_http_client`, `route.rule_set[].http_client`, or `certificate_providers[].http_client`. | Add HTTP Client tag-index diagnostics for route default, remote rule-sets, and certificate providers. |
| C1-18 | P1 | HTTP Client | Testing `http_clients[]` resources are graphable after import/templates but cannot be created from the Palette and cannot be edited beyond tag/delete. The Inspector has no `http-client` branch in `sharedGroupsForEntity`, despite product docs calling for an HTTP Client Inspector and upstream defining engine/version/headers/TLS/Dial fields. | Add testing-gated `addHttpClient` / palette creation and expose HTTP Client shared groups for HTTP Client entities; keep stable creation disabled. |
| C1-19 | P1 | HTTP Client | HTTP Client nodes are isolated in the graph: there are no port relations or edges for `route.default_http_client`, `route.rule_set[].http_client`, `certificate_providers[].http_client`, or HTTP Client Dial/TLS refs such as `detour` and `domain_resolver`. Users cannot create/disconnect these canonical references from the canvas. | Add typed HTTP Client relations for route default, remote rule-set, ACME/Cloudflare provider, and HTTP Client detour/resolver where we choose to visualize them. |
| C1-20 | P1 | HTTP Client | Nested references inside `http_clients[]` are renamed/deleted by registry but not diagnosed when stale, and `tls.certificate_provider` is treated as a certificate-provider ref even though HTTP Client TLS is outbound/client TLS and upstream marks `certificate_provider` server-only. | Add diagnostics for `http_clients[].detour`, `http_clients[].domain_resolver`, and invalid `http_clients[].tls.certificate_provider`; remove or guard certificate-provider registry behavior for HTTP Client TLS. |
| C2-4 | P2 | HTTP Client | `route.default_http_client` import currently tolerates an inline object through generic reference helpers, but the route upstream page describes this field as a tag, unlike remote rule-set/provider `http_client` fields that explicitly allow string or object. | Verify with `sing-box-testing check`; then either add a diagnostic for object-valued route default HTTP Client or document it as intentionally tolerated import compatibility. |
| C2-5 | P2 | Rule Set | In testing/1.14, `download_detour` is deprecated in favor of `http_client`, but the main Rule Set Inspector still foregrounds `download_detour` while `http_client` is only in shared fields. | Make Rule Set Inspector channel-aware: stable foregrounds `download_detour`; testing promotes `http_client` and demotes deprecated `download_detour`. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 2 P0, 4 P1, 2 P2; icons 0 P1, 1 P2.
