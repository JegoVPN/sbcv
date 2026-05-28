# Inbound TUIC - Codex review cross-map

Date: 2026-05-28

This file maps confirmed findings from the Codex aggregate review to this node or feature surface. It is a navigation artifact, not a raw shard transcript. The full finding text remains authoritative in `README.md` and `icon-semantics-audit.md`.

## Confirmed Config/Behavior Findings

| ID | Severity | Family | Finding | Development landing |
| --- | --- | --- | --- | --- |
| C0-6 | P0 | Shared TLS | Inspector uses one mixed TLS editor for inbound, outbound, and DNS server TLS. Upstream has distinct inbound/server and outbound/client schemas; `sing-box-stable check` rejects invalid-role fields such as outbound `tls.key_path` and inbound `tls.utls`. | Split TLS fields by role and update UI tests so invalid-role fields are absent. |
| C0-7 | P0 | Shared Multiplex | Inspector shows outbound-only multiplex fields on inbound multiplex. Upstream inbound multiplex only has `enabled`, `padding`, and `brutal`; `sing-box-stable check` rejects inbound `multiplex.protocol`. | Add role-scoped multiplex schemas; test inbound absence and outbound presence. |
| C0-16 | P0 | Inbound | Required inbound fields are under-diagnosed. Listen Fields mark `listen` required, Shadowsocks requires `method` and `password`, ShadowTLS requires `handshake`, and VMess/VLESS/Trojan/other authenticated inbounds require `users`; several of these can be cleared or imported without a blocking diagnostic. | Add inbound type required-field diagnostics for listen/users/method/password/ShadowTLS handshake; include the `wildcard_sni=all` ShadowTLS server exception and tests for imported or manually-edited invalid inbounds. |
| C1-21 | P1 | Inbound / Listen Fields | `Listen Fields.detour` is an inbound-tag reference, but inbound `detour` is not in inbound reference rename/delete or stale diagnostics. The shared Listen card also writes `detour` for services as an inbound detour, while service diagnostics/reference graph treat `service.detour` as outbound for all services. | Add owner-aware Listen detour handling: inbound/service listen detour references inbound tags, CCM/OCM API detour references outbound tags, and diagnostics/graph must not conflate them. |
| C1-23 | P1 | Inbound / Canvas | The Inbound `route-rule-match` and `dns-rule-match` port trash controls use a single first-edge lookup. If multiple route or DNS rules reference the same inbound, the port action disconnects only the first edge instead of a specific chosen rule reference. | Replace aggregate port disconnect with edge-specific remove controls or a multi-reference chooser; add tests for two route rules and two DNS rules sharing one inbound. |

## Icon/SVG Findings

| ID | Severity | Finding | Development landing |
| --- | --- | --- | --- |
| IC-P2-4 | P2 | Inbound, Service, Settings, and HTTP Client title icons are too generic. | Make high-risk families type-aware where users distinguish protocols visually. |

SUMMARY: 3 P0, 2 P1, 0 P2; icons 0 P1, 1 P2.
