# inbound-trojan — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The trojan inbound is now in solid shape: palette entry, canvas ports, the full Listen/TLS/Multiplex/V2Ray-Transport shared cards, a structured `users[]` repeater with masked passwords, a structured `fallback` editor, and `inbound-users-required` + `inbound-missing-tls` diagnostics all exist and verify against the upstream doc. The remaining real gaps are: `fallback_for_alpn` has no structured editor and relies on a raw `JsonField` that writes invalid JSON as a string into the config (P1), and trojan `users[]` get no per-user name/password content validation unlike vmess/vless/tuic (P1). Pass-1 docs are now substantially stale — their two headline P0s (uneditable users/fallback; scaffold has no TLS / no diagnostic) are both fixed in current code.

## 1. Left Palette
- Present and correct. `Palette.tsx:136` — `{ label: "Trojan", kind: "inbound-trojan", icon: Shield, docsUrl: docs("inbound/trojan/"), status: "setup" }`.
- Category `Inbounds` is correct per upstream taxonomy; label "Trojan" is human-readable; docs URL resolves to the right page.
- Default action resolves to `setup` → button label "Setup", title "Add Trojan setup draft to canvas" (`Palette.tsx:241,272`), and `canActivate` allows the click (`Palette.tsx:281`). Action is functional and explicit. Type mapping `inbound-trojan → trojan` is correct (`protocols.ts:54`, and in `CREATABLE_INBOUND_TYPES` line 75).
- No gating issues. Pass-1's "status label wording" nit is cosmetic and effectively addressed by the `statusLabel`/`statusTitle` maps.

## 2. Canvas Node
- Icon: palette uses `Shield`; canvas uses the generic inbound `RadioTower` (`SbcNode.tsx:37`, `getNodeIcon` line 85 returns `iconMap[kind]` for non-outbound). Minor visual inconsistency, not a blocker.
- Title/summary: titlebar shows `inbound / trojan` (`SbcNode.tsx:291`); the human tag/title is the secondary `data.title`. Acceptable.
- Ports (output, via `portRelationRegistry`): `route` (decorative, "Route hub"), `route-rule-match` ("Route rule matcher"), `dns-rule-match` ("DNS rule matcher"). No input ports. This matches sing-box semantics: an inbound is a source matched by route/DNS rules via `inbound[]`. Correct.
- No TLS-missing badge on the node. TLS-required is enforced via a diagnostic (see §3), so this is a nice-to-have, not a defect.
- `fallback`/`fallback_for_alpn` correctly have NO port — they are nested server objects, not tag references. Correct.

## 3. Upstream/Downstream Links
Official relationship model: an inbound is referenced by `route.rules[].inbound` and `dns.rules[].inbound`; `tls`/`multiplex`/`transport` are embedded sections (no nodes); `fallback`/`fallback_for_alpn` are nested literal server objects (no tag refs).
- `route-rule-inbound` writable, path `/route/rules/*/inbound` (`portRelationRegistry.ts:94`). Correct.
- `dns-rule-inbound` writable, path `/dns/rules/*/inbound` (`portRelationRegistry.ts:99`). Correct.
- `inbound` decorative → route hub, and `dns-inbound-query` decorative (`:91`, `:100`). Cosmetic only; fine.
- `referenceRegistry.ts:327-328` registers inbound reference paths `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` — rename/delete propagation covers trojan correctly.
- Missing/extra/wrong links: none. `tls`/`fallback`/`fallback_for_alpn`/`multiplex`/`transport` are correctly NOT modeled as links. No spurious outbound/detour link for trojan.

## 4. Right Inspector (fields)
`entityType === "trojan"` renders: tag, type selector, the `users[]` repeater (`Inspector.tsx:3125-3236`), the `fallback` fieldset (`:3018-3070`), then `AdvancedScalar`/`AdvancedNonScalar` (`:3237-3238`). Shared cards (Listen, TLS, Multiplex, TCP-Brutal, V2Ray-Transport) render at `:5343` via `sharedGroupsForEntity` (`sharedFieldRegistry.ts:169-176` adds listen+tls+multiplex+tcp-brutal+v2ray-transport for trojan). Correct group set.

| Official field | UI state |
|---|---|
| `type` (=trojan) | Select over `CREATABLE_INBOUND_TYPES`; `changeEntityType` rebuilds scaffold (`commands.ts:908`). OK |
| `tag` | Text input w/ rename propagation. OK |
| Listen Fields (all 14 incl. `detour`, `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`) | Full `listen` card `Inspector.tsx:1435-1450`; `detour` is a `select` over inbound tags. `listen` REQUIRED but no empty-listen validation (scaffold sets `127.0.0.1`). OK |
| `users[]` (REQUIRED) `{name,password}` | Structured repeater; schema `INBOUND_USER_SCHEMAS.trojan` = name + password(sensitive) (`:559-565`); Add/Remove rows; password masked via `SensitiveTextField`. `inbound-users-required` error if empty (`diagnostics.ts:1621`). No per-user empty-name/empty-password validation (unlike vmess/vless/tuic at `:920-942`). OK w/ gap |
| `tls` (TLS-by-design) | Full inbound TLS card incl. enabled, server_name, alpn, min/max_version, cipher_suites, certificate/_path, key/_path, client_authentication, reality, ech, utls (`:1502-1547`). Scaffold `tls:{enabled:true,server_name:""}` (`commands.ts:171`). `inbound-missing-tls` error if `enabled!==true` (`diagnostics.ts:585`). OK |
| `fallback` `{server,server_port}` | Structured fieldset, server(text)+server_port(number), auto-clears to disabled when both empty (`:3018-3070`). `fallback` is in `inboundHandledFields` (`:164`) so not duplicated. OK |
| `fallback_for_alpn` (map ALPN→{server,server_port}) | NO structured editor. NOT in `inboundHandledFields`, so it falls to `AdvancedNonScalarFields`→`JsonField` (`:820-848`,`:794`). Hint at `:3065` points users there. Editable but raw, and JsonField has an invalid-write bug (see Findings). GAP |
| `multiplex` | Multiplex + TCP-Brutal cards (`:1559-1576`). OK |
| `transport` | V2Ray Transport card: type/host/path/service_name/idle_timeout/ping_timeout (`:1578-1587`). OK (transport-type-specific subfields like ws `headers`, `max_early_data` not surfaced, but core present.) |

UI fields absent from official model for trojan: none spurious. `address`/`auto_route`/`stack` etc. are gated behind `entityType === "tun"` (`:2609`,`:2628`), so they do not render for trojan.

## Findings (prioritized)
- [P1] `fallback_for_alpn` has no structured editor — only raw `JsonField` via AdvancedNonScalar (`Inspector.tsx:820-848`, hint `:3065`). It is a documented field; users cannot discover/validate per-ALPN routing. Add a key→{server,server_port} repeater, and add `"fallback_for_alpn"` to `inboundHandledFields` (`:140`) once a real control exists.
- [P1] `JsonField` writes invalid JSON as a raw string into canonical config: on `JSON.parse` failure the `catch` calls `onChange(event.target.value)` (`Inspector.tsx:809-814`), so a half-typed `fallback_for_alpn` becomes a string where sing-box expects an object — silently corrupts export. Should retain last-valid value + show an error (the `InlineRuleSetEditor`/Logical-rules pattern at `:733-784` does this correctly; JsonField does not).
- [P1] Trojan `users[]` get no per-user content validation. `usersRequiredInboundTypes` covers count (`diagnostics.ts:1603-1625`) but only vmess/vless/tuic get name/uuid checks via `validateVmessLikeUsers` (`:920-942`). A trojan user with empty `password` or duplicate `name` exports clean yet is misconfigured. Add a name/password presence + duplicate-name check for trojan.
- [P2] TLS "required" is enforced only on `tls.enabled`; a trojan inbound with `tls.enabled=true` but no `certificate`/`certificate_path`/`key` (scaffold default) passes diagnostics yet cannot serve. Consider a warning when enabled-but-no-cert-material and no `acme`/`certificate_provider`.
- [P2] Canvas node uses generic `RadioTower` icon for trojan while palette uses `Shield` (`SbcNode.tsx:85` vs `Palette.tsx:136`); minor inconsistency.
- [P2] Pass-1 docs are stale and should be retired/annotated: `docs/claude/inbound-trojan.md` P0 "users/fallback uneditable" (now built, `:3018`,`:3125`), P0 "scaffold has no TLS / no diagnostic" (now `tls:{enabled:true}` `commands.ts:171` + `inbound-missing-tls` `diagnostics.ts:585`), and "Listen panel missing 5 fields" (now all 14 present `:1435-1450`) are all resolved. Its remaining-valid item is only the `fallback_for_alpn` structured editor.

SUMMARY: 0 P0, 3 P1, 3 P2.
