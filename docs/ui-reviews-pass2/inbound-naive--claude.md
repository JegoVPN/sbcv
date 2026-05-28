# inbound-naive — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The `inbound-naive` node is now in good shape across all four surfaces: the Palette entry is correct, the canvas ports match sing-box semantics, the reference model captures route+DNS rule matching, and the Inspector exposes every official field (listen group, `network`, `users[]` with masked password, `quic_congestion_control`, and the inbound TLS group) with correct control types plus diagnostics enforcing the required `users[]` and `tls`. Pass-1 (`docs/ui-reviews/inbound-naive.md`) is almost entirely stale — every P0/P1 it raised (no users editor, no TLS seed, plain-text network/qcc, leaking address/auto_route, truncated listen fields) has since been fixed. Only minor polish remains (no per-user empty-field validation, `quic_congestion_control` not version-gated to 1.13+, no naive row in the users-editor test table).

## 1. Left Palette
- Present and correct: `Palette.tsx:137` — `{ label: "Naive", kind: "inbound-naive", icon: Globe2, docsUrl: docs("inbound/naive/"), status: "setup" }`. Category "Inbounds" is correct; `docsUrl` resolves to the official path; `Globe2` is reasonable (NaiveProxy is HTTP/2/HTTPS-based).
- Default action `setup` → label "Setup", and `canActivate` (`Palette.tsx:279`) makes it clickable, calling `createFromPalette("inbound-naive")`. Mapping `inbound-naive → naive` is wired in `protocols.ts:55` and `naive` is in `CREATABLE_INBOUND_TYPES` (`protocols.ts:76`).
- No gating mismatch. No findings.

## 2. Canvas Node
- Built in `graph.ts:214-241`. Title = tag (`naive-in`), subtitle = `"naive inbound"` (generic `${type} inbound`, `graph.ts:225`), status derives from diagnostics at `/inbounds/{index}`, `compatible: ["Route"]`.
- Ports derive from `portRelations` via `portEndpointsForNode` (`portRelationRegistry.ts:196`, consumed in `SbcNode.tsx:95`). For naive the output ports are exactly: Route hub (decorative, `portRelationRegistry.ts:91`), Route rule matcher (`route-rule-match`, `portRelationRegistry.ts:94`), DNS rule matcher (`dns-rule-match`, `portRelationRegistry.ts:99`). No input/upstream port — correct, naive is an entry point.
- The `service` output port is correctly NOT emitted: `service-ssm-inbound` is `nodeType: "shadowsocks"`-gated (`portRelationRegistry.ts:113`), so it never appears for naive. Matches sing-box semantics.
- No findings.

## 3. Upstream/Downstream Links
- `referenceRegistry.ts:327-328`: inbound is referenced by `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds`. This matches the official model (inbound referenced by route rules + DNS rules by tag); rename/remove propagation handled at `referenceRegistry.ts:125-154`.
- TLS is correctly modeled as an embedded inbound TLS section (`sharedFieldRegistry.ts:144` includes naive in `inboundTlsTypes`), not a standalone node/link — matches upstream.
- No missing/extra/wrong links. The "tls inbound REQUIRED" relationship is enforced via diagnostics (see §4), not via a port, which is the right call.

## 4. Right Inspector (fields)
Renders via the `ref.kind === "inbound"` block (`Inspector.tsx:2583`), the `entityType === "naive"` branch (`Inspector.tsx:3093`), the schema-driven users editor (`Inspector.tsx:3125`), and the shared `ModuleCard` groups (`Inspector.tsx:5343` → `sharedGroupsForEntity` = `["listen","tls"]`).

| Official field | UI state |
|---|---|
| `type` (fixed `naive`) | Type switch dropdown (`Inspector.tsx` header). OK. |
| `tag` | Rename field (header). OK. |
| Listen Fields (all 14) | Full `listenSharedFields` (`Inspector.tsx:100-115`) + Listen `ModuleCard` defs (`Inspector.tsx:1435-1450`): listen, listen_port, bind_interface, routing_mark, reuse_addr, netns, tcp_fast_open, tcp_multi_path, disable_tcp_keep_alive, tcp_keep_alive, tcp_keep_alive_interval, udp_fragment, udp_timeout, detour(select of inbound tags). All present, correct types. `listen` not marked Required (minor). |
| `network` (`tcp`/`udp`, both if empty) | Dedicated `<select>` with `(both)`/`tcp`/`udp` (`Inspector.tsx:3095-3105`). Correct enum, no invalid free-text. |
| `users` (==Required==) | Structured repeater via `INBOUND_USER_SCHEMAS.naive` (`Inspector.tsx:538-544`); rows render Username (text) + Password (masked `SensitiveTextField`), Add/Remove (`Inspector.tsx:3136-3234`). Required-ness enforced by `inbound-users-required` error diagnostic (`diagnostics.ts:1603-1625`, naive in set). Correct nested-array handling; writes round-trip. |
| `users[].username` | Text input. OK. |
| `users[].password` | Masked input with reveal toggle (`sensitive: true`). OK. |
| `quic_congestion_control` (since 1.13.0; enum) | Dedicated `<select>` with `(default — bbr)` + all 6 values bbr/bbr_standard/bbr2/bbr2_variant/cubic/reno (`Inspector.tsx:3106-3122`). Enum correct. NOT version-gated to 1.13+ (P2). |
| `tls` (inbound TLS; required for function) | Rendered as TLS `ModuleCard` (always for naive). Fields incl. enabled, server_name, alpn, min/max_version, cipher_suites, curve_preferences, certificate(+path), key(+path), client_authentication, certificate_provider (`Inspector.tsx:1502-1527+`). `tls.enabled` required for naive enforced by `inbound-missing-tls` error diagnostic (`diagnostics.ts:523-590`). Seeded by initializer (`commands.ts:174-183`, `tls:{enabled:true,server_name:""}`). |

Leaks/extra UI fields: none for naive. `address` + `auto_route` are now gated to `entityType === "tun"` only (`Inspector.tsx:2609-2627`) — pass-1's leak is fixed. Unknown imported scalars fall to `AdvancedScalarFields` and objects to `AdvancedNonScalarFields` (`Inspector.tsx:3237-3238`); `network`/`quic_congestion_control`/`users`/`tls`/listen fields are all in `inboundHandledFields` (`Inspector.tsx:140-177`) so none double-render.

## Findings (prioritized)
- [P2] `quic_congestion_control` is not version-gated; it is a 1.13.0+ field but the select renders unconditionally regardless of channel/target. A `testing`/1.13+ gate (or hint) would prevent writing it for 1.12 targets. `src/components/Inspector.tsx:3106`.
- [P2] No per-user field validation for naive: empty `username`/`password` rows are not flagged. Only vmess/vless/tuic call `validateVmessLikeUsers` (`diagnostics.ts:920-943`); naive only gets the array-non-empty check (`diagnostics.ts:1613-1625`). Consider a non-empty username/password diagnostic. `src/domain/diagnostics.ts:1613`.
- [P2] Test gap: the schema-table users-editor test omits a naive row (`tests/app.test.tsx:354-364` covers trojan/vmess/vless/tuic/shadowsocks/hysteria/hysteria2/anytls). naive shares the identical code path and its network/qcc selects ARE covered (`tests/app.test.tsx:491-524`), so this is coverage-only. `tests/app.test.tsx:354`.

Pass-1 staleness note: `docs/ui-reviews/inbound-naive.md` P0 "users[] has no Inspector UI", P0 "TLS not seeded", P1 "network plain text", P1 "quic_congestion_control plain text", P1 "auto_route/address leak", and P1 "listenSharedFields missing fields" are ALL resolved in current code (`Inspector.tsx:3093-3234`, `commands.ts:174-183`, `Inspector.tsx:100-115`, `diagnostics.ts:523-590/1603-1625`). The pass-1 doc should be marked superseded.

SUMMARY: 0 P0, 0 P1, 3 P2.
