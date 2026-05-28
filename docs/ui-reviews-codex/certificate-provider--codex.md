# Certificate Provider - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-15 | P0 | Certificate Provider | Required certificate-provider fields are not semantically validated: Tailscale provider requires a Tailscale endpoint, ACME/Cloudflare require `domain`, and Cloudflare credential conflicts are unchecked. | Add provider-type diagnostics and endpoint type checks; cover imported providers and provider nodes. |
| C1-14 | P1 | Certificate Provider / Endpoint | Tailscale certificate-provider endpoint missing/type diagnostics are absent, although upstream requires a Tailscale endpoint reference. | Add certificate-provider endpoint diagnostics, diagnostic-target tests, and graph edge type guard. |
| C1-15 | P1 | Certificate Provider / Canvas | Tailscale certificate-provider nodes advertise a “Tailscale Endpoint” compatible chip, but `createCompatible` does not implement that label, so the hover Add path is a no-op. | Use a typed compatible registry shared by graph, picker, and store; test the certificate-provider chip path. |
| C1-16 | P1 | HTTP Client | HTTP Client tag references are renamed/deleted by registry, but stale imported refs are not diagnosed for `route.default_http_client`, `route.rule_set[].http_client`, or `certificate_providers[].http_client`. | Add HTTP Client tag-index diagnostics for route default, remote rule-sets, and certificate providers. |
| C1-19 | P1 | HTTP Client | HTTP Client nodes are isolated in the graph: there are no port relations or edges for `route.default_http_client`, `route.rule_set[].http_client`, `certificate_providers[].http_client`, or HTTP Client Dial/TLS refs such as `detour` and `domain_resolver`. Users cannot create/disconnect these canonical references from the canvas. | Add typed HTTP Client relations for route default, remote rule-set, ACME/Cloudflare provider, and HTTP Client detour/resolver where we choose to visualize them. |
| C1-20 | P1 | HTTP Client | Nested references inside `http_clients[]` are renamed/deleted by registry but not diagnosed when stale, and `tls.certificate_provider` is treated as a certificate-provider ref even though HTTP Client TLS is outbound/client TLS and upstream marks `certificate_provider` server-only. | Add diagnostics for `http_clients[].detour`, `http_clients[].domain_resolver`, and invalid `http_clients[].tls.certificate_provider`; remove or guard certificate-provider registry behavior for HTTP Client TLS. |
| C2-3 | P2 | Endpoint | Endpoint compatible chips only advertise DNS Tailscale Server, while ports support DNS server, DERP service, and certificate-provider relations. | Make endpoint compatible labels match relation registry and cover chip creation. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-3 | P2 | Certificate Provider looks like security, JSON, or key depending on surface. | Standardize certificate-provider identity on one certificate/key icon. |

SUMMARY: 1 P0, 5 P1, 1 P2; icons 0 P1, 1 P2.
