# outbound-vless — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; source-of-truth: sing-box official docs (testing 1.14) -->

## Verdict
This node is now broadly faithful and usable: every required field (`server`/`server_port`/`uuid`) has a first-class, validated control; `flow`/`network`/`packet_encoding` are selects; the TLS card covers Reality/uTLS/ECH/fragment/cipher_suites/curve_preferences; and dial + multiplex are fully modeled with strong semantic diagnostics. The pass-1 P0/P1 list is essentially all resolved. The one real remaining gap is the V2Ray Transport card, which models only 6 fields and gives **no editor at all** for `method`, `headers`, `max_early_data`, `early_data_header_name`, and `permit_without_stream` (the whole `transport` object is "handled", so the Advanced-JSON fallback skips it). Minor: the 1.14 outbound TLS additions (`engine`/`spoof`/`spoof_method`/`handshake_timeout`) and per-type transport field gating are absent.

## 1. Left Palette
- Present in **Outbounds** group, label `VLESS`, icon Shield, `status: "setup"`, `docsUrl` → `outbound/vless/` (correct). `src/components/Palette.tsx:164`.
- Palette `kind` is `vless-out`; maps to type `vless` via `OUTBOUND_PALETTE_TYPES` (`src/domain/protocols.ts:13`). Category, label, docs link all correct.
- Action `setup` is honest (it seeds a draft outbound, then opens Inspector). No mislabeling. The small `setup` badge is internal taxonomy, not a hard problem. No gating issues (vless is not target-gated).

## 2. Canvas Node
- Title = tag, subtitle = `vless <server>:<server_port>` (`src/canvas/graph.ts:401`). Status badge is semantic (driven by `diagnosticStatus` over `/outbounds/<i>`), not binary validation — correct.
- `compatible` is empty for non-group outbounds, so the large `+` create affordance is correctly **absent** for vless (`src/canvas/graph.ts:405-428`). Good — addresses pass-1 concern.
- Ports for an `outbound` (from `portRelationRegistry`, rendered in `SbcNode.tsx:277`): inputs `route` (route final), `route-rule`, `selector-group`, `urltest-group`, `dns-detour`, `detour-target` (incoming dial detour), `service-detour`, `rule-set-download`; output `dial-detour` (this outbound's own `detour`). This matches sing-box semantics. TLS/transport/multiplex are Inspector sections, not ports — correct.
- Titlebar shows `outbound / vless` (kind/type) rather than human-name-first; cosmetic only.

## 3. Upstream/Downstream Links
Compared `portRelationRegistry.ts` + `referenceRegistry.ts` against the official relationship model. All correct, none missing/extra for vless:
- Referenced-by (inputs): route `final` (`/route/final`), route rules `outbound` (`/route/rules/*/outbound`), selector/urltest members (`/outbounds/*/outbounds`), DNS server `detour` (`/dns/servers/*/detour`), service `detour` (ccm/ocm), rule-set `download_detour`, and another outbound's dial `detour` (`/outbounds/*/detour`). All present in `portRelations` and in the `outbound` reference entry `referenceRegistry.ts:334`.
- References-out (output): its own Dial `detour` → another outbound (`outbound-detour`, excludes block/selector/urltest/dns as source — correct, vless can be a source).
- NTP `detour` (`/ntp/detour`) is covered by the `outbound` reference entry, so rename/delete propagation is intact even though the canvas port is settings-side.
- No spurious links (e.g. vless is correctly NOT a selector/urltest member *source*, only a candidate *target*).

## 4. Right Inspector (fields)
Official writable fields (testing 1.14) vs UI. Control source: `Inspector.tsx`.

| Field | Req | Official type | UI state |
|---|---|---|---|
| `server` | yes | string | dedicated input + `outbound-missing-server` error (diagnostics.ts:535). OK |
| `server_port` | yes | int | number input + range diag (diagnostics.ts:544). OK |
| `uuid` | yes | string | `SensitiveTextField` + Generate-UUID button (3428-3447); `vless-missing-uuid` error + format warning (diagnostics.ts:711). OK — pass-1 P0 FIXED |
| `flow` | no | enum | `<select>` `(none)`/`xtls-rprx-vision` (3708); +flow-requires-tls & flow-multiplex-conflict diags. OK — pass-1 P1 FIXED |
| `network` | no | enum | `<select>` both/tcp/udp (3415). OK — pass-1 P1 FIXED |
| `packet_encoding` | no | enum | `<select>` disabled/packetaddr/xudp (3992). OK — pass-1 P1 FIXED |
| `tls.enabled/server_name/disable_sni/insecure/alpn/min_version/max_version` | no | mixed | TLS card 1510-1516. OK (disable_sni present — pass-1 FIXED) |
| `tls.cipher_suites/curve_preferences` | no | string[] | list inputs 1517-1518. OK — pass-1 FIXED |
| `tls.certificate(inline)/certificate_path/certificate_public_key_sha256` | no | mixed | 1519-1523. OK — pass-1 FIXED |
| `tls.client_certificate*/client_key*` (mTLS, 1.13) | no | mixed | **MISSING** from card (only server-side key/key_path at 1521-1522). client_certificate/_path/client_key/_path absent |
| `tls.fragment/fragment_fallback_delay/record_fragment` | no | mixed | 1531-1533. OK — pass-1 FIXED |
| `tls.utls.enabled/fingerprint` | no | bool/enum | 1534-1535 (fingerprint gated on enabled). OK — pass-1 FIXED |
| `tls.ech.enabled/config/config_path/query_server_name` | no | mixed | 1539-1542. OK — pass-1 FIXED |
| `tls.reality.enabled/public_key/short_id` | no | mixed | 1536-1538 + reality-public-key/short-id diagnostics (diagnostics.ts:876). OK — pass-1 P0 FIXED |
| `tls.engine` (1.14, client) | no | enum | **MISSING** |
| `tls.spoof / spoof_method` (1.14, client) | no | str/enum | **MISSING** |
| `tls.handshake_timeout` (1.14) | no | string | **MISSING** |
| `multiplex.enabled/protocol/max_connections/min_streams/max_streams/padding` | no | obj | multiplex card 1561-1566 (protocol default per docs is `smux`; options correct). OK |
| `multiplex.brutal.{enabled,up_mbps,down_mbps}` | no | obj | tcp-brutal card 1572-1574. OK |
| `transport.type/host/path/service_name/idle_timeout/ping_timeout` | no | obj | v2ray-transport card 1580-1585. Partial |
| `transport.method` (http) | no | string | **MISSING — no editor anywhere** |
| `transport.headers` (http/ws/grpc/httpupgrade) | no | map | **MISSING — no editor anywhere** |
| `transport.max_early_data / early_data_header_name` (ws) | no | int/str | **MISSING — no editor anywhere** |
| `transport.permit_without_stream` (grpc) | no | bool | **MISSING — no editor anywhere** |
| Dial fields (detour, bind_*, connect_timeout, tcp_*, domain_resolver, network_strategy/type, fallback_*, netns, …) | no | obj | dial card 1476-1499 (detour & domain_resolver are tag-selects). OK |

Type-switch preservation: switching away from vless and back re-seeds via `commands.ts` default (`tls:{enabled:true}`, valid uuid `commands.ts:367`); credentials are not specially preserved but the scaffold always yields a valid uuid, so no silent invalid state. `transport` card renders all 6 rows regardless of `transport.type`, so e.g. `service_name` shows for `ws` (noise, not a bug).

## Findings (prioritized)
- [P1] V2Ray Transport sub-fields `method`, `headers`, `max_early_data`, `early_data_header_name`, `permit_without_stream` have **no Inspector control and no JSON fallback** — `transport` is in `outboundHandledFields` so `AdvancedNonScalarFields` skips it. ws/grpc/http transports cannot be fully configured. `src/components/Inspector.tsx:1578-1586`, set membership `src/components/Inspector.tsx:188`, fallback skip `src/components/Inspector.tsx:831`.
- [P1] mTLS client fields `tls.client_certificate`, `tls.client_certificate_path`, `tls.client_key`, `tls.client_key_path` (since 1.13, client-only) are absent from the TLS card; only server-side `key`/`key_path` exist. `src/components/Inspector.tsx:1519-1523`.
- [P2] 1.14 outbound TLS additions absent: `tls.engine`, `tls.spoof`, `tls.spoof_method`, `tls.handshake_timeout`. Niche/privileged, but doc-current for the testing channel. `src/components/Inspector.tsx:1509-1547`.
- [P2] V2Ray Transport card shows all six rows for every transport type (e.g. `service_name`/`host` for `ws`); no per-type gating, so users can write fields the chosen transport ignores. `src/components/Inspector.tsx:1578-1586`.
- [P2] Canvas titlebar shows internal `outbound / vless` (kind/type) instead of human-name-first; cosmetic. `src/components/SbcNode.tsx:291`.

SUMMARY: 0 P0, 2 P1, 3 P2.
