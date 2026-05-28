# outbound-trojan — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The trojan outbound is in strong shape: all three required fields (server, server_port, password) are now first-class controls, password is sensitive-masked with a reveal toggle, `network` is a proper select, the default scaffold ships `tls.enabled=true`, and the TLS/multiplex/transport/dial shared cards are wired with correct gating. Pass-1's headline P0/P1s (password buried in Advanced, no sensitive masking, raw `network` text, TLS absent from scaffold, Reality/uTLS/ECH/fragment missing) are all STALE — every one has been implemented. Remaining gaps are minor: the V2Ray Transport card is a flat field list that is not gated by `transport.type` (shows host for gRPC, service_name for WebSocket, omits method/headers/max_early_data/permit_without_stream), and there is no empty/placeholder-password diagnostic.

## 1. Left Palette
Present and correct. `src/components/Palette.tsx:159` — `{ label: "Trojan", kind: "trojan-out", icon: Shield, docsUrl: docs("outbound/trojan/"), status: "setup" }`, under the Outbounds category. Maps `trojan-out → trojan` at `src/domain/protocols.ts:8`; reverse map `trojan → "trojan-out"` at `:153`. Trojan is in `CREATABLE_OUTBOUND_TYPES` (`protocols.ts:31`). docsUrl points at the official outbound/trojan doc. Action `setup` → `createFromPalette("trojan-out")`. No gating issues; label is human ("Trojan"), not the internal kind. Distinct from the inbound entry at `Palette.tsx:136`. No findings.

## 2. Canvas Node
Correct. `src/canvas/graph.ts:383-433`: title = tag, subtitle = `trojan {server}:{server_port}` (e.g. `trojan 127.0.0.1:1080`) via `:401-403`; status from `diagnosticStatus("/outbounds/{index}", …)` `:404`. `compatible` is `[]` for non-group outbounds (`:405-428`), so trojan shows NO spurious "+" companion affordance (pass-1's "+ shows 1 but creates nothing" is STALE). Icon = `Shield` (default branch, `SbcNode.tsx:52-58` returns the kind icon for anything not direct/block/selector/urltest). Ports are derived from `portEndpointsForNode` over the registry (`SbcNode.tsx:94-105`), so handle set is exactly the relationship model below. Output: one `dial-detour` handle (trojan can itself dial through another outbound). Input: route-final, route-rule, selector, urltest, dns-detour, detour-target, service-detour, rule-set-download. TLS/multiplex/transport correctly are NOT ports — they are Inspector cards. No findings.

## 3. Upstream/Downstream Links
Matches the official relationship model exactly. As a referenced target (input handles), trojan is reachable from every legal referrer:
- route `final` → `portRelationRegistry.ts:93` (writable, `/route/final`).
- route rule `outbound` → `:95` (`/route/rules/*/outbound`).
- selector candidate → `:103`; urltest candidate → `:104` (`/outbounds/*/outbounds`).
- DNS server `detour` → `:105` (`/dns/servers/*/detour`).
- another outbound's dial `detour` → `:106`; endpoint dial `detour` → `:108`; NTP `detour` → `:115` (`detour-target` input).
- service `detour` (ccm/ocm) → `:109-110`; rule-set `download_detour` → `:111`.

As a source (output handle), trojan exposes its own dial `detour` via `:106` (`outbound-detour`, source portKey `dial-detour`), correctly EXCLUDING block/selector/urltest/dns from being a detour source (`nodeTypeExcludes`). referenceRegistry rename/remove covers route.final, route.rules[].outbound, outbounds[].outbounds, outbounds[].default, all `detour` fields, endpoints, services, rule_set download_detour, ntp, clash external_ui_download_detour, v2ray stats (`referenceRegistry.ts:158-174` / `179-195`). No missing, extra, or wrong links.

## 4. Right Inspector (fields)
One row per official field → UI state. Outbound render block `src/components/Inspector.tsx:3376-3473`; shared cards via `sharedGroupsForEntity` (`sharedFieldRegistry.ts:178-185`) emit `dial, tls, multiplex, tcp-brutal, v2ray-transport` for trojan.

| Official field | Required | UI control | State |
|---|---|---|---|
| `server` | yes | text input, `Inspector.tsx:3376-3384` | OK; in `outboundHandledFields:181`; diagnostic on empty (`diagnostics.ts:535-543`) |
| `server_port` | yes | number input, default 443 placeholder `:3385-3414` | OK; range diag `diagnostics.ts:545-552`; handled `:182` |
| `password` | yes | SensitiveTextField (mask + reveal) `:3467-3473` | OK; handled `:199`; sensitive in user schema `:562`. No empty/placeholder diagnostic (see P2) |
| `network` | no | select `tcp+udp(both)` / `tcp` / `udp` `:3415-3427` | OK; empty → omitted (matches "both default"); handled `:190` |
| `tls` | no* | TLS shared card `sharedFieldDefinitions("tls")` `:1500-1548` | OK; enabled/server_name/insecure/alpn/versions/cert/disable_sni/cipher_suites/curve_preferences/fragment×3/uTLS/Reality/ECH all present. Scaffold ships `tls.enabled=true` (`commands.ts:330`); `outbound-missing-tls` ERROR `diagnostics.ts:555-570` |
| `multiplex` | no | multiplex card `:1559-1567` + tcp-brutal `:1570-1576` | OK; enabled/protocol/max_connections/min_streams/max_streams/padding + brutal up/down. Missing nothing material |
| `transport` | no | v2ray-transport card `:1578-1587` | PARTIAL: Type select present, but card is flat (not gated by type) and omits `method`,`headers`,`max_early_data`,`early_data_header_name`,`permit_without_stream`; shows host/service_name for all types (see P1) |
| dial fields | no | dial card `:1432-?` (detour/bind_interface/connect_timeout/domain_resolver/network_strategy/fallback_*) | OK; `detour` is also a canvas port |

`*` The testing SOT (`trojan.md:48-50`) does NOT mark `tls` `==Required==`; the app treats it as required via `tlsRequiredOutboundTypes` (`diagnostics.ts:514-522`) and emits a hard ERROR when `tls.enabled !== true`. This matches the task brief ("tls REQUIRED") and real sing-box runtime behavior (trojan refuses to start without TLS), so it is defensible — but it is stricter than the literal doc. Flag as P2 (potential false-positive ERROR for users who terminate TLS at a fronting proxy / use plaintext trojan behind another tunnel).

No invalid-JSON writes observed: scalar fields write coerced primitives, list fields go through `fromList`/`toList`, nested paths via `nestedPatch` (`Inspector.tsx:1646-1648`). No UI-only fields absent from the official model. All controls write canonical keys.

## Findings (prioritized)
- **[P1]** V2Ray Transport card is not type-aware. `src/components/Inspector.tsx:1578-1587` renders a single flat field list (`host`, `path`, `service_name`, `idle_timeout`, `ping_timeout`) for every `transport.type`. Per `shared/v2ray-transport.md`, fields are per-type: http=host/path/method/headers, ws=path/headers/max_early_data/early_data_header_name, grpc=service_name/permit_without_stream, httpupgrade=host/path/headers, quic=none. Result: `host` shows for gRPC (invalid), `service_name` shows for WebSocket (invalid), and `method`/`headers`/`max_early_data`/`early_data_header_name`/`permit_without_stream` are not exposable except via raw JSON. Add `gatedBy: ["transport","type", …]`-style filtering and the missing per-type fields. (Pass-1's P0 "transport type must drive nested fields" is PARTIALLY addressed — Type is now a select and core fields exist — so downgrade to P1, not P0.)
- **[P2]** No empty/placeholder password diagnostic for outbound trojan. `src/domain/diagnostics.ts:532-554` (proxyOutboundTypes loop) validates `server` and `server_port` but not `password`; the scaffold seeds `password: "change-me"` (`commands.ts:329`) and nothing flags it. Add: when `proxyOutboundTypes` requires a credential and `password` is empty/`"change-me"`, push an error/warning at `/outbounds/{index}/password`.
- **[P2]** `outbound-missing-tls` is a hard ERROR for trojan (`diagnostics.ts:514-522`, `555-570`) although the testing doc (`trojan.md:48-50`) does not mark `tls` required. Defensible (matches runtime), but consider downgrading to a warning, or document the deviation, to avoid a false-positive error for plaintext-trojan-behind-tunnel setups.
- **[P2]** Multiplex card omits `brutal` from the main multiplex card but exposes it as a separate `tcp-brutal` card (`Inspector.tsx:1570-1576`); functionally complete but the two-card split is non-obvious vs the single nested `multiplex.brutal` object in `shared/multiplex.md`. Cosmetic; no data loss.

SUMMARY: 0 P0, 1 P1, 3 P2.
