# inbound-anytls — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

> Upstream authority: `docs/upstream/sing-box/testing/configuration/inbound/anytls.md` (since 1.12.0).
> Official field set is intentionally tiny: **Listen Fields** (shared) + `users` (Required) + `padding_scheme` (string[]) + `tls` (inbound TLS). Nothing else.

## Verdict (2-3 sentences)
The node is in genuinely good shape: it is creatable from the palette, renders correct ports/links, and the Inspector now exposes `users` (structured, masked), `padding_scheme` (line editor), the full inbound-TLS card, and the listen fields — with `inbound-users-required` and `inbound-missing-tls` diagnostics enforcing the two hard constraints. Pass-1's headline P0s (users/padding silently invisible, no TLS default, address/auto_route leaking) are now ALL fixed and stale. The only remaining defects are two spurious *outbound* controls bleeding into the inbound Inspector: a top-level `password` field and the `idle_session_*` fieldset, both of which write keys that do not exist in the official inbound schema.

## 1. Left Palette
`src/components/Palette.tsx:143` — `{ label: "AnyTLS", kind: "inbound-anytls", icon: Shield, docsUrl: docs("inbound/anytls/"), status: "setup" }`.
- Present, correct category (Inbounds), correct label, correct docs URL.
- `status: "setup"` IS actionable: `canActivate` returns true for `"setup"` (`Palette.tsx:280-287`), and the click handler calls `createFromPalette("inbound-anytls")` → `addInbound(..., "anytls")` (`commands.ts:93-98`). **Pass-1 claim that the node "cannot be dragged or clicked / no add affordance" is STALE/incorrect.**
- Shield icon shared with other TLS protocols — acceptable, not a defect.
- No version gate for the "since 1.12.0" requirement (no `minVersion`, no channel guard). Low-priority because all three shipped channels (1.12/1.13/1.14) support it and the palette is channel-aware elsewhere; flag as P2.

## 2. Canvas Node
Generic inbound node (`graph.ts:214-240`): `title = tag`, `subtitle = "anytls inbound"`, status from diagnostics.
- Output ports derive from `portRelations` where source is `inbound`: route hub (`inbound`, decorative), `route-rule-match`, `dns-rule-match` (`portRelationRegistry.ts:91,94,99-100`). No input ports. Correct for a source node.
- The SSM `service` output port (`portRelationRegistry.ts:113`) is `nodeType:"shadowsocks"`-filtered, so anytls correctly does NOT render it (`endpointMatchesNode`, `portRelationRegistry.ts:157-160`). Good.
- Connection-state probes for `route`/`route-rule-match`/`dns-rule-match` are wired (`SbcNode.tsx:206-212`). Correct.
- Minor: subtitle never summarizes user count or TLS on/off, so multiple anytls inbounds look identical on canvas (P2, cross-node).

## 3. Upstream/Downstream Links
Official model: an inbound is referenced by `route.rules[].inbound` and `dns.rules[].inbound`; its `tls` is an embedded inbound-TLS object (not a node); `listen.detour` may target another injectable inbound.
- `route-rule-inbound` writable, path `/route/rules/*/inbound` (`portRelationRegistry.ts:94`) — correct. Edges built at `graph.ts:301`; missing-ref + disconnect handled (`diagnostics.ts:60-68`, `commands.ts:1078-1084`).
- `dns-rule-inbound` writable, path `/dns/rules/*/inbound` (`portRelationRegistry.ts:99`) — correct. Edges at `graph.ts:602`; `commands.ts:1112-1118`.
- `inbound` route-hub relation decorative (`portRelationRegistry.ts:91`) — correct, non-writable.
- TLS embedded, not a link: `referenceRegistry.ts:115` runs `pushTls` over inbounds so rename/cert-provider refs inside `tls` are tracked. Correct.
- `listen.detour` (inbound→inbound) is exposed only as an Inspector select (`Inspector.tsx:1449`), not a canvas port. Acceptable; matches how all listen-detours are handled. No missing/extra/wrong links found.

## 4. Right Inspector (fields)
Entity block at `Inspector.tsx:2583+` (`ref.kind === "inbound"`); shared cards via `sharedGroupsForEntity` (anytls ∈ `inboundTlsTypes`, `sharedFieldRegistry.ts:144,171` → listen + tls).

| Official field | Required | Expected control | UI state | Verdict |
|---|---|---|---|---|
| `tag` | — | text | tag rename input (shared inbound header) | OK |
| Listen Fields (listen, listen_port, bind_interface, routing_mark, reuse_addr, netns, tcp_fast_open, tcp_multi_path, disable_tcp_keep_alive, tcp_keep_alive, tcp_keep_alive_interval, udp_fragment, udp_timeout, detour) | listen required | Listen card | full 14-field set, incl. inbound-detour select (`Inspector.tsx:1435-1450`) | OK |
| `users[]` (`{name, password}`) | **Required** | repeater, name + masked password | structured editor via `INBOUND_USER_SCHEMAS.anytls` (`Inspector.tsx:611-617`, rendered `3125-3199`); password is `SensitiveTextField`; `inbound-users-required` error (`diagnostics.ts:1603-1625`) | OK — pass-1 "silently invisible" STALE |
| `padding_scheme[]` (string[]) | optional (built-in default) | line editor, empty = default | one-line-per-row `<textarea>`, blank → `undefined` (`Inspector.tsx:2893-2914`); in `inboundHandledFields` (`:148`) | OK — pass-1 "silently invisible" STALE; reset-to-default affordance would be nice (P2) |
| `tls{}` (inbound) | recommended; enforced here | TLS card | full inbound-TLS card incl. enabled, server_name, alpn, min/max_version, cipher_suites, curve_preferences, certificate, certificate_path, **key, key_path**, client_authentication, certificate_provider (`Inspector.tsx:1502-1530+`); `inbound-missing-tls` error (`diagnostics.ts:523-590`); seeded `tls:{enabled:true}` (`commands.ts:251`) | OK — pass-1 "no TLS default" + "key_path missing" both STALE |

UI fields present but ABSENT from the official inbound model (defects):
- **Top-level `password`** (`Inspector.tsx:3467-3473`): the list `["shadowsocks","trojan","naive","tuic","hysteria2","anytls","shadowtls"]` renders a masked `Password` field that writes `entity.password`. AnyTLS inbound has **no** top-level `password` — auth is `users[].password` only. Spurious key + redundant with the users editor. → P1.
- **`idle_session_check_interval` / `idle_session_timeout` / `min_idle_session`** (`Inspector.tsx:3916-3953`, `data-testid="anytls-idle-session"`): these are AnyTLS **outbound** fields (`commands.ts:409-411`, `outboundHandledFields` `Inspector.tsx:235-237`). The inbound doc lists none of them. Renders three controls that write keys sing-box will not recognize on an inbound. → P1.

Fields correctly NOT offered: multiplex, transport/v2ray, QUIC, udp-over-tcp (anytls not in those sets, `sharedFieldRegistry.ts:145-148`). `address`/`auto_route` correctly gated to `entityType === "tun"` (`Inspector.tsx:2609`) — **pass-1 "shown for anytls" STALE.**

## Findings (prioritized)
- **[P1]** Spurious top-level `password` control for anytls inbound — `src/components/Inspector.tsx:3467-3473`. Remove `"anytls"` from that type list (anytls auth is via `users[]` only); pollutes exported JSON and duplicates the users editor.
- **[P1]** `idle_session_*` / `min_idle_session` fieldset rendered for the anytls **inbound** — `src/components/Inspector.tsx:3916-3953`. These are outbound-only fields; gate them to `ref.kind === "outbound"` (the outbound block already handles them) so the inbound writes no phantom keys.
- **[P2]** No version/build gate on the palette entry for the "since 1.12.0" requirement — `src/components/Palette.tsx:143`. Add `minVersion`/channel guard or a tooltip; low impact since all live channels support anytls.
- **[P2]** `padding_scheme` line editor has no "reset to built-in default" affordance and the canvas node shows no users/TLS summary — `src/components/Inspector.tsx:2893-2914`, `src/canvas/graph.ts:225`. Polish only.

SUMMARY: 0 P0, 2 P1, 2 P2.

Pass-1 staleness note: `docs/ui-reviews/inbound-anytls.md` is now substantially stale — its five priority findings (users invisible, padding invisible, no TLS default, no key_path, address/auto_route leaking) are all resolved in current code (`Inspector.tsx:611-617/2609/2893/3125/1521-1522`, `commands.ts:251`, `diagnostics.ts:523/1603`). The earlier `docs/claude/inbound-anytls.md` correctly anticipated the shipped state. Neither pass-1 doc flagged the two real remaining bugs (top-level password, idle-session fieldset).
