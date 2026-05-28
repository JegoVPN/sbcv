# outbound-shadowsocks — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The outbound Shadowsocks node is in good shape: all official writable fields are now exposed with correct control types — `method` is a full 18-value enum select (3 optgroups), `password` is masked, `plugin`/`plugin_opts` are gated selects, `network` is a both/tcp/udp select, and multiplex / udp-over-tcp / dial render via shared cards. Pass-1's headline P0/P1s (method free-text, visible password, plugin free-text, buried `network`, scaffold `network:"tcp"`, missing legacy methods, `outboundHandledFields` gaps) are ALL now resolved and stale. The remaining real gaps are correctness-of-validation, not missing UI: the doc's `udp_over_tcp` ⇔ `multiplex` conflict is never diagnosed, and `method`/`password` have no required/format validation.

## 1. Left Palette
`Palette.tsx:157` — `{ label: "Shadowsocks", kind: "ss-out", icon: Shield, docsUrl: docs("outbound/shadowsocks/"), status: "setup" }`.
- Present in **Outbounds** group — correct category. Label human-readable; docs URL correct.
- `kind: "ss-out"` is the default tag; maps to outbound `type: "shadowsocks"` via `createFromPalette`. Correct.
- `status: "setup"` → actionable (`canActivate` allows `setup`, `Palette.tsx:279-287`); title "Add Shadowsocks setup draft to canvas" (`Palette.tsx:269`). Reasonable; SS needs post-add editing (password/method), so "setup" over "add" is defensible. No gating issues.
- No P-level issue here.

## 2. Canvas Node
`SbcNode.tsx` (ports derived from `portRelationRegistry.ts`).
- Title bar renders `outbound / shadowsocks` (`SbcNode.tsx:291`); summary subtitle `shadowsocks <server>:<port>` (`graph.ts:401-403`). Correct.
- Output port: single `dial-detour` "Downstream dial detour" (`portRelationRegistry.ts:106`, relation `outbound-detour`, excludes block/selector/urltest/dns — SS is included). Correct.
- Input ports (generic outbound, all correct per semantics): route-final (`:93`), route-rule (`:95`), selector candidate (`:103`), urltest candidate (`:104`), dns-detour (`:105`), dial detour-target (`:106`), service-detour (`:109-110`), rule-set-download (`:111`).
- No SS-specific canvas port (no SSM/managed handle) — correct; that is inbound-only (`:113`).
- Big `+` affordance: `data.compatible` is `[]` for non-group outbounds (`graph.ts:428`), so the "+" is hidden (`SbcNode.tsx:392`). Correct — SS has no obvious child to create.
- Status pill = config-wide diagnostic status for `/outbounds/{i}` (`graph.ts:404`), not per-object semantic validity. Minor PM nit (shared cross-node finding), not SS-specific.

## 3. Upstream/Downstream Links
Official model: an outbound is referenced by route `final`, route `rules[].outbound`, selector/urltest `outbounds[]`, dns `servers[].detour`, service `detour`, rule-set `download_detour`, and other outbounds'/endpoints' dial `detour`; it owns one outgoing dial `detour`.
- All inbound references present and writable in `portRelationRegistry.ts` (see §2) and reconciled in `SbcNode.isPortConnected` (`SbcNode.tsx:162-186`). Disconnect handled in `commands.ts` (`route-final` 1067, `route-rule` 1072, `selector`/`urltest` 1085, `outbound-detour` 1094, `dns-server-detour` 1142, `service-detour-*` 1166, `rule-set-download` 1198, `endpoint-detour` 1157, `settings-ntp-detour` 1209).
- Own dial `detour` output (`outbound-detour`) present and disconnectable (`commands.ts:1094-1100`).
- NTP `detour` → outbound link exists as readonly relation (`portRelationRegistry.ts:115`); fine.
- Missing/extra/wrong: **none found.** Link model matches the official relationship model. No P-level issue.

## 4. Right Inspector (fields)
Outbound branch opens at `Inspector.tsx:3242`; SS-specific block at `:3630-3691`; shared cards rendered at end via `<SharedFieldCards>` (`:5343`). `outboundHandledFields` now includes `method`,`password`,`network`,`plugin`,`plugin_opts` (`:190-217`) so nothing leaks to AdvancedScalarFields.

| Official field | UI state | Verdict |
|---|---|---|
| `server` (req) | text input `:3376-3384`; diagnostic if empty `diagnostics.ts:535` | OK; no required asterisk in label (P2) |
| `server_port` (req) | number input `:3385-3414`; range diag 1-65535 `diagnostics.ts:545` | OK; no SS entry in `portDefaultByType` (`:3387-3395`) so placeholder is "port" not 1080 (P2) |
| `method` (req, enum) | select `:3633-3664`; 2022(3)+AEAD(5)+Legacy/stream(10 incl. `none`) = all 18 official values, in 3 optgroups | Enum complete & correct. But leading `(none)` option writes `undefined` and there is **no required/enum diagnostic** (P1) |
| `password` (req) | `SensitiveTextField` masked w/ show-hide `:3467-3473` | OK — masking correct. No "missing password" diagnostic; placeholder `change-me` ships silently (P1) |
| `plugin` (obfs-local\|v2ray-plugin) | select `(none)`/`obfs-local`/`v2ray-plugin` `:3666-3677` | Correct — constrained to the two supported values |
| `plugin_opts` | text input, shown only when `plugin` set `:3678-3689` | Correct — dependent rendering + helpful placeholder |
| `network` (tcp\|udp, both default) | select `tcp+udp (both)`/`tcp`/`udp`, empty→undefined `:3415-3427` | Correct; default omitted = both (matches doc) |
| `udp_over_tcp` (false\|{}) | shared "UDP over TCP" card: `enabled` bool + `version` select 1/2 (`:1591-1592`); owner gated via `outboundUdpOverTcpTypes` includes shadowsocks (`sharedFieldRegistry.ts:155`) | Present. `version` default is 2 per doc but UI shows no default hint (P2); boolean-shorthand `false` not offered, only object form (acceptable) |
| `multiplex` ({}) | shared "Multiplex" card `:1559-1566` (enabled/protocol/max_connections/min_streams/max_streams/padding) + TCP Brutal child `:1571-1574`; gated via `outboundMultiplexTypes` (`sharedFieldRegistry.ts:153`) | Correct & complete |
| Dial Fields | shared "Dial Fields" card `:1476-1499` (detour select + bind/timeout/keepalive/resolver/strategy…); gated via `outboundDialTypes` (`sharedFieldRegistry.ts:150`) | Correct; `detour` is an outbound-tag select (not raw text) — pass-1 P0 resolved |

No TLS / V2Ray-transport / QUIC cards inject for shadowsocks (`sharedFieldRegistry.ts:151-154,181`). Correct — SS has none of those. No invalid-JSON writes: every SS field uses typed scalar controls; only nested shared paths use `nestedPatch` (safe). No UI fields absent from the official model.

Type-switch away from shadowsocks rebuilds via `createOutbound` and preserves only `tag` + `detour` (`commands.ts:913-919`), so `method`/`password`/`plugin`/`plugin_opts` are cleared — correct.

## Findings (prioritized)
- **[P1]** No `udp_over_tcp` ⇔ `multiplex` mutual-exclusion diagnostic. Doc (`shadowsocks.md:94`) says they conflict; both shared cards render independently and both can be enabled, producing a config sing-box rejects. There are precedents (TUIC `diagnostics.ts:760-771`, VLESS `:724-732`) but none for shadowsocks. Add a check in `src/domain/diagnostics.ts` (outbound loop ~`:532`).
- **[P1]** `method`/`password` lack required + format validation. `proxyOutboundTypes` only validates `server`/`server_port` (`diagnostics.ts:534-553`); `method`/`password` have no "missing/empty" error and no enum check, so the `(none)` method option (`Inspector.tsx:3638`) and the scaffold `password:"change-me"` (`commands.ts:309`) export silently. Add: error if `method` empty/not in the 18 values; error if `password` empty when `method !== "none"`; optional base64-shape warning for `2022-*` methods.
- **[P2]** `method`/`password`/`server`/`server_port` have no required-field marker (asterisk/`aria-required`) in their labels (`Inspector.tsx:3377,3399,3633,3467`). Cosmetic but these are all `==Required==` upstream.
- **[P2]** `server_port` placeholder for shadowsocks falls back to "port" — SS missing from `portDefaultByType` (`Inspector.tsx:3387-3395`); add `shadowsocks: 8388` (or rely on scaffold's 1080) for a sensible hint.
- **[P2]** UDP-over-TCP `version` select offers `1`/`2` with no indication that `2` is the default (`Inspector.tsx:1592`; doc `udp-over-tcp.md:30`). Minor; label the default.

Pass-1 is now STALE on: method-as-free-text (now enum select `:3633`), password-visible-plaintext (now masked `:3467`), plugin-free-text (now select `:3666`), `plugin_opts` orphaned (now gated `:3678`), `network` buried in AdvancedScalarFields + scaffold `network:"tcp"` (scaffold no longer sets it `commands.ts:302-311`; UI is a first-class select `:3415`), legacy methods absent from select (all 9 present `:3653-3661`), and `outboundHandledFields` additions required (already added `:190-217`). The pass-1 doc `docs/ui-reviews/outbound-shadowsocks.md` and the generated `docs/claude/outbound-shadowsocks.md` are pointer-only and out of date for these items.

SUMMARY: 0 P0, 2 P1, 3 P2.
