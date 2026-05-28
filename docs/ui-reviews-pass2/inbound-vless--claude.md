# inbound-vless — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The node is now broadly usable: it is present and correctly categorized in the palette, the canvas ports/links exactly match sing-box semantics, and the `users` repeater (name / uuid+Generate / `flow` enum) plus listen/multiplex/transport cards all render with a required-users diagnostic. Pass-1's two headline P0s ("users invisible", "Reality has no UI") are now STALE/RESOLVED. The real remaining problems are direction confusion in the shared TLS card (it is outbound-shaped, so it leaks ~7 client-only fields into the inbound and exposes the wrong-shape Reality `short_id`), an over-eager `tls.enabled:true` default that contradicts upstream (VLESS TLS is optional), the still-flat V2Ray Transport editor, and inbound-side semantic gaps (no flow↔TLS / flow↔multiplex checks that the outbound path already has).

## 1. Left Palette
- Present in **Inbounds** group: `{ label: "VLESS", kind: "inbound-vless", icon: Shield, docsUrl: docs("inbound/vless/"), status: "setup" }` — `src/components/Palette.tsx:140`. Label, category, icon, and docs URL all correct.
- `kind: "inbound-vless"` → type `vless` via `INBOUND_PALETTE_TYPES` (`src/domain/protocols.ts:58`); `vless` is in `CREATABLE_INBOUND_TYPES` (`src/domain/protocols.ts:79`); preferred tag `vless-in` (`src/domain/protocols.ts:180`). Consistent.
- `status:"setup"` is honest: clicking seeds a draft inbound and opens the Inspector for UUID setup (`canActivate` allows `setup`, `Palette.tsx:279`). Not target-gated — correct (VLESS has no build-tag/channel restriction). No palette issues.

## 2. Canvas Node
- Card title = tag, subtitle = `vless inbound` (`src/canvas/graph.ts:224-225`). Status is semantic via `diagnosticStatus("/inbounds/<i>")` (`graph.ts:226`), so an empty `users[]` or bad UUID turns the node red through diagnostics — matches pass-1's "fail locally when users empty" ask.
- Ports for `kind=inbound` (from `portRelationRegistry`, rendered `SbcNode.tsx:346`): outputs `route` (decorative "Route hub"), `route-rule-match` (`/route/rules/*/inbound`), `dns-rule-match` (`/dns/rules/*/inbound`). The `service` (SSM-API managed) output is gated to `nodeType:"shadowsocks"` (`portRelationRegistry.ts:113`) so VLESS correctly does NOT get it. No input ports (inbounds are sources) — correct.
- Two cosmetic gaps (both also present on outbound, not vless-specific): titlebar shows internal `inbound / vless` (`SbcNode.tsx:291`) instead of name-first; and the subtitle is a static `vless inbound` — it does NOT summarize user count / TLS-enabled / transport type as pass-1 recommended (`graph.ts:225`).

## 3. Upstream/Downstream Links
Compared `portRelationRegistry.ts` + `referenceRegistry.ts` against the official model (an inbound is *referenced by* route rules and DNS rules via their `inbound[]`; it never references outbounds except the optional listen-field `detour`). Result: correct, nothing extra/wrong.
- `route-rule-inbound` writable, `/route/rules/*/inbound` (`portRelationRegistry.ts:94`). Present.
- `dns-rule-inbound` writable, `/dns/rules/*/inbound` (`portRelationRegistry.ts:99`); plus decorative `dns-inbound-query` (`:100`). Present.
- `inbound` decorative → Route hub (`:91`) — visual only, fine.
- `service-ssm-inbound` (`:113`) is `nodeType:"shadowsocks"`-only, so it never attaches to vless. Correct.
- Reference propagation: `referenceRegistry` `inbound` entry covers `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` (`referenceRegistry.ts:327-331`) — rename/delete stays consistent.
- Missing link (minor, by design): listen-field `detour` (inbound→inbound, `shared/listen.md:144`) has NO port/edge — it is Inspector-only (a `select` of inbound tags, `Inspector.tsx:1449`). No upstream "injectable inbound" relation exists in the registry. Acceptable as an Inspector affordance; flag as P2 only if canvas parity is desired.

## 4. Right Inspector (fields)
Official writable fields (testing 1.14: `inbound/vless.md` + `shared/listen.md` + `shared/tls.md#inbound` + `shared/multiplex.md#inbound` + `shared/v2ray-transport.md`) vs UI. Inbound block `Inspector.tsx:2583`; shared cards `Inspector.tsx:5343`.

| Official field | Req | Type | UI state |
|---|---|---|---|
| `type` | yes | const | type `<select>` of CREATABLE_INBOUND_TYPES (`Inspector.tsx:2113`). OK |
| `tag` | — | string | tag input w/ rename (`Inspector.tsx:2094`). OK |
| Listen: `listen` | yes | string | listen card text (`Inspector.tsx:1436`). OK |
| Listen: `listen_port` | — | int | number (`:1437`). OK |
| Listen: `bind_interface`/`routing_mark`/`reuse_addr`/`netns`/`tcp_fast_open`/`tcp_multi_path`/`disable_tcp_keep_alive`/`tcp_keep_alive`/`tcp_keep_alive_interval`/`udp_fragment`/`udp_timeout` | — | mixed | all in listen card (`:1438-1448`). OK — pass-1 "listenSharedFields incomplete" now STALE/FIXED |
| Listen: `detour` | — | inbound tag | `select` of inbound tags (`:1449`). OK |
| `users[]` | **yes** | array | repeater, `inbound-users-required` error (`diagnostics.ts:1613`). OK — pass-1 P0 STALE/FIXED |
| `users[].name` | — | string | text (`Inspector.tsx:574-588`, render `:3211`). OK |
| `users[].uuid` | **yes** | string | `SensitiveTextField` + Generate-UUID button (`:3146-3168`); `user-missing-uuid` error + format warn via `validateVmessLikeUsers` (`diagnostics.ts:928-935,647-666`). OK — pass-1 P0 STALE/FIXED |
| `users[].flow` | — | enum (`""`/`xtls-rprx-vision`) | `<select>` enum (`Inspector.tsx:578-585`). OK — pass-1 P1 STALE/FIXED. But no diagnostic if an imported value is off-enum (see findings) |
| `tls` | — | obj (inbound) | TLS card (`Inspector.tsx:1502-1547`) — **direction-wrong**, see findings |
| `tls.enabled`/`server_name`/`alpn`/`min_version`/`max_version`/`cipher_suites`/`curve_preferences` | — | mixed | present (`:1510-1518`). OK |
| `tls.certificate`/`certificate_path` | — | PEM | present (`:1519-1520`). OK |
| `tls.key`/`key_path` (server) | — | PEM | present (`:1521-1522`). OK — pass-1 "key_path missing" now STALE/FIXED |
| `tls.client_authentication` (server,1.13) | — | enum | present, but options omit `no` and mislabel `require` (should be `require-any`) (`:1524`). Partial |
| `tls.client_certificate`/`client_certificate_path`/`client_certificate_public_key_sha256` (server,1.13 mTLS) | — | PEM/list | **MISSING** |
| `tls.certificate_provider` (server,1.14) | — | tag/obj | `select` of provider tags (`:1525-1530`). OK |
| `tls.handshake_timeout` (1.14) | — | dur | **MISSING** |
| `tls.kernel_tx`/`kernel_rx` (1.13) | — | bool | **MISSING** (fall to Advanced JSON only if already present) |
| `tls.reality.enabled` | yes* | bool | present (`:1536`). OK |
| `tls.reality.handshake.server`/`server_port` (server, **required**) | yes* | str/int | present, gated on reality.enabled (`:1543-1544`); `reality-handshake-server-missing` error (`diagnostics.ts:991`). OK |
| `tls.reality.private_key` (server, **required**) | yes* | string | present (`:1545`); `reality-private-key-missing` error (`diagnostics.ts:981`). OK |
| `tls.reality.short_id` (server, **required**, `string[]`) | yes* | string[] | only the **client** `kind:"text"` row exists (`:1538`); writes a scalar string, not an array, and there is NO inbound short_id diagnostic. WRONG TYPE for server |
| `tls.reality.max_time_difference` (server) | — | dur | present (`:1546`). OK |
| `tls.ech.enabled`/`key`/`key_path` (inbound) | — | mixed | only **client** ECH shown: `config`/`config_path`/`query_server_name` (`:1540-1542`); inbound `key`/`key_path` MISSING. WRONG direction |
| `multiplex.enabled` | — | bool | present (`:1561`). OK |
| `multiplex.padding` | — | bool | present (`:1566`). OK |
| `multiplex.brutal.{enabled,up_mbps,down_mbps}` | — | obj | tcp-brutal card (`:1572-1574`). OK |
| `transport.type` | — | enum | `select` http/ws/quic/grpc/httpupgrade (`:1580`). OK |
| `transport.host`/`path`/`service_name`/`idle_timeout`/`ping_timeout` | — | mixed | flat rows (`:1581-1585`). Partial — not type-gated |
| `transport.method` (http) | — | string | **MISSING — no editor, no JSON fallback** |
| `transport.headers` (http/ws/httpupgrade) | — | map | **MISSING — no editor, no JSON fallback** |
| `transport.max_early_data`/`early_data_header_name` (ws) | — | int/str | **MISSING — no editor, no JSON fallback** |
| `transport.permit_without_stream` (grpc) | — | bool | **MISSING — no editor, no JSON fallback** |

Notes on writes/round-trip: `transport`, `tls`, `multiplex`, `users` are all in `inboundHandledFields` (`Inspector.tsx:140-177`), so `AdvancedNonScalarFields` (`:831`) deliberately skips them — there is no raw-JSON escape hatch for the missing transport sub-fields. Nested writes use `nestedPatch` (`:1394`) so structured edits round-trip cleanly. Sensitive masking: uuid is masked (`:1146`). Type-switch reseeds from `commands.ts:207` default.

## Findings (prioritized)
- [P0] Over-eager TLS default contradicts upstream. `createInbound("vless")` seeds `tls:{ enabled:true }` (`src/domain/commands.ts:214`), and the canvas/inspector therefore present a TLS-on node by default — but per `inbound/vless.md` TLS is **optional** (standard VLESS runs over plain TCP). Unlike trojan/naive/tuic, vless is correctly NOT in `tlsRequiredInboundTypes` (`src/domain/diagnostics.ts:523-530`), so the default produces a needless TLS block with empty `server_name` that the user must either complete or delete. Seed vless without `tls` (compare `vmess` at `commands.ts:155` which has none).
- [P0] Shared TLS card is outbound-shaped and leaks client-only fields into the inbound. For `ref.kind==="inbound"` the same field list renders `disable_sni`, `insecure`, `certificate_public_key_sha256`, `fragment`, `fragment_fallback_delay`, `record_fragment`, `utls.*`, and Reality **client** `public_key`/`short_id` — all `==Client only==` per `shared/tls.md` and invalid on a server inbound. `src/components/Inspector.tsx:1502-1547` (no direction branch). This is the broader, still-open form of pass-1's narrower "`insecure` shown" P1. Split TLS field specs by `ref.kind`.
- [P1] Reality inbound `short_id` is the wrong shape and unvalidated. Only the client text row exists (`Inspector.tsx:1538`), so the server inbound writes a scalar string while upstream requires `string[]` (`shared/tls.md:818`, "Reality Fields"), and there is no inbound `short_id` diagnostic (the outbound has one at `diagnostics.ts:888-904`). Add a server `short_id` **list** row gated on inbound+reality and a matching diagnostic.
- [P1] Inbound ECH exposes client fields, not server fields. Card shows `ech.config`/`config_path`/`query_server_name` (client-only) but not the inbound `ech.key`/`ech.key_path` (`shared/tls.md:597-611`). `src/components/Inspector.tsx:1540-1542`.
- [P1] V2Ray Transport sub-fields have no control and no JSON fallback: `transport.method`, `transport.headers`, `transport.max_early_data`, `transport.early_data_header_name`, `transport.permit_without_stream`. ws/grpc/http transports cannot be fully configured. Card `src/components/Inspector.tsx:1578-1586`; `transport` in handled set `src/components/Inspector.tsx:155`; fallback skip `src/components/Inspector.tsx:831`. (Same gap as outbound pass2.)
- [P1] Inbound vless is missing the flow semantic checks the outbound already has. Outbound flags `flow=xtls-rprx-vision` + multiplex (`vless-flow-multiplex-conflict`, `diagnostics.ts:724`) and flow-without-TLS (`vless-flow-requires-tls`, `:738`); the inbound path (`diagnostics.ts:928-935`) validates only UUIDs. Add the same two checks for inbound users[].flow, plus an off-enum `flow` warning (UI restricts it, but imported configs bypass the select).
- [P1] `tls.client_authentication` select is wrong. Options are `["", "request", "require", "verify-if-given", "require-and-verify"]` (`Inspector.tsx:1524`) but upstream values are `no`/`request`/`require-any`/`verify-if-given`/`require-and-verify` (`shared/tls.md:416-422`); `require` is not a valid value and `no` (default) is missing.
- [P2] Inbound multiplex card still shows outbound-only fields `protocol`/`max_connections`/`min_streams`/`max_streams` (`Inspector.tsx:1562-1565`); inbound multiplex supports only `enabled`/`padding`/`brutal` (`shared/multiplex.md:26-38`). Pass-1 P1 STILL VALID (not split by direction).
- [P2] V2Ray Transport card renders all rows for every `transport.type` (e.g. `service_name` for `ws`); no per-type gating. `src/components/Inspector.tsx:1578-1586`.
- [P2] TLS card has no `handshake_timeout` (1.14) or `kernel_tx`/`kernel_rx` (1.13) rows for inbound. `src/components/Inspector.tsx:1502-1547`.
- [P2] Canvas: titlebar shows `inbound / vless` not name-first (`SbcNode.tsx:291`), and node subtitle is a static `vless inbound` rather than user-count / TLS / transport summary (`graph.ts:225`).

SUMMARY: 2 P0, 6 P1, 4 P2.
