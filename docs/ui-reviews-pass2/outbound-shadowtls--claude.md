# outbound-shadowtls — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Single source of truth: `docs/upstream/sing-box/testing/configuration/outbound/shadowtls.md` (+ shared `dial.md`, `tls.md#outbound`). Official writable fields for `type:"shadowtls"`: `server` (req), `server_port` (req), `version` (1/2/3, **default 1**), `password` (v2/v3 only), `tls` (req), plus Dial Fields. No multiplex/transport/QUIC/udp-over-tcp.

## Verdict (2-3 sentences)
The node is solid across all four surfaces and most of pass-1's complaints are now fixed: the default object includes `tls`, `version` is a real `<select>`, `password` is masked, and TLS/Dial shared groups + detour ports are wired correctly. Remaining issues are minor: required-field markers are absent on `server`/`server_port`, the version `<select>` defaults to "3" while upstream's default is "1", and `password` is shown unconditionally (no v1 no-op hint, no empty-password warning for v2/v3). No P0s; this node is shippable.

## 1. Left Palette
Present and correct. `{ label: "ShadowTLS", kind: "shadowtls-out", icon: Shield, docsUrl: docs("outbound/shadowtls/"), status: "setup" }` (`Palette.tsx:163`). Kind maps to type `shadowtls` via `OUTBOUND_PALETTE_TYPES` (`protocols.ts:12`). Outbounds category, correct docs URL, `SETUP` action — appropriate for a proxy outbound that opens the Inspector. Pass-1 was correct here and remains accurate.

## 2. Canvas Node
Correct. Title = tag; subtitle/summary = `${type} ${server}:${server_port}` (`canvas/graph.ts:401-402`); status derives from diagnostics at `/outbounds/${index}` (`graph.ts:404`). Node icon = Shield (`SbcNode.tsx:84-85`). Bottom toolbar shows type + status pills (`SbcNode.tsx:407-415`) — consistent with peers. The detour chain renders: when this outbound has `detour` (or is referenced via another outbound's `detour`), `graph.ts:119-120,198-199,346-364` create the edge and walk the chain, so the canonical "shadowsocks --detour--> shadowtls" front-chain is drawn correctly.

## 3. Upstream/Downstream Links
Relationship model is complete and correct. `portRelationRegistry.ts` treats shadowtls as a generic `outbound`, so it exposes (via `portEndpointsForNode` honoring `nodeTypeExcludes`, `portRelationRegistry.ts:157-161,196-205`):
- INPUT (left, referenced-by): route final `route` (`:93`), route rule `route-rule` (`:95`), selector candidate `selector-group` (`:103`), urltest candidate `urltest-group` (`:104`), DNS detour `dns-detour` (`:105`), Dial detour target `detour-target` (`:106`), endpoint detour (`:108`), service detour (`:109-110`), rule-set download (`:111`), NTP detour readonly (`:115`).
- OUTPUT (right, this node's own Dial `detour`): `dial-detour` (`portRelationRegistry.ts:106`), whose `nodeTypeExcludes:["block","selector","urltest","dns"]` does **not** exclude shadowtls → port present. Correct: shadowtls has Dial Fields, so it can chain downstream.
- The selector/urltest `outbound-member` output ports are `nodeType`-gated to selector/urltest and correctly absent on shadowtls.
- TLS is an Inspector section, not a port — correct (no TLS port exists).
- Reference propagation on rename/delete covers `/outbounds/*/detour` and all detour paths (`referenceRegistry.ts:91,98,163,184,333-334`), and `isPortConnected` resolves the detour-target lit state excluding self-reference (`SbcNode.tsx:175-180`). No missing/extra/wrong links found. Pass-1's relationship prose was directional but never verified against code; this section is now confirmed.

## 4. Right Inspector (fields)
Outbound branch at `Inspector.tsx:3242`. Shared groups: `outboundDialTypes` + `outboundTlsTypes` both include shadowtls (`sharedFieldRegistry.ts:150-151,178-180`) → Dial + TLS sections offered; no multiplex/transport/quic/uot (correct, `:153-155`).

| Official field | Req | UI state | Verdict |
|---|---|---|---|
| `server` | yes | first-class text, `"server" in entity` (`Inspector.tsx:3376-3384`); diag `outbound-missing-server` (`diagnostics.ts:534-543`) | OK; **no required marker on the control** |
| `server_port` | yes | first-class number, default placeholder 443 (`Inspector.tsx:3385-3414`, `:3393`); diag `outbound-invalid-server-port` 1–65535 (`diagnostics.ts:544-552`) | OK; **no required marker on the control** |
| `version` | no (def 1) | `<select>` 1/2/3 with semantic labels, writes number, clears to undefined (`Inspector.tsx:3244-3265`); v3 label "single user, server-side hash" (correct for outbound vs inbound's users[]) | OK; **placeholder says "(default — 3)" but upstream default is 1** |
| `password` | no (v2/v3) | `SensitiveTextField` masked w/ reveal (`Inspector.tsx:3467-3473`, `:639-668`) | OK masking; **shown unconditionally — no v1 no-op hint, no empty-password warning for v2/v3** |
| `tls` | yes | shared TLS group, `tls.enabled` required diag `outbound-missing-tls` (`diagnostics.ts:514-522,555-570`); default `tls:{enabled:true,server_name:""}` (`commands.ts:356-365`) | OK |
| Dial Fields | no | shared dial group incl `detour` (`sharedFieldRegistry.ts:179`, `dialSharedFields` in `outboundHandledFields` `Inspector.tsx:238`) | OK |

`version`/`password`/`tls` are all in `outboundHandledFields` (`Inspector.tsx:186,192,196,199`) → none leak into "Advanced fields". No invalid-JSON writes observed (version parses via `Number.isFinite`; port guarded `>0`). No UI fields absent from the official model. Default object is complete and valid (`commands.ts:356-365`) — superset is fine (`version:3`+`password` is a working v3 combo).

## Findings (prioritized)
- **[P1] Version select default mislabeled.** `Inspector.tsx:3259` shows `(default — 3)`, but upstream marks `version: 1 (default)` (`shadowtls.md:38`). The create-default uses 3 (`commands.ts:362`), so the label is internally consistent with the seed but contradicts the protocol default and could mislead users editing an imported config that omits `version`. Either change the placeholder to `(default — 1)` or keep 3 but relabel as `(unset → sing-box uses 1)`.
- **[P1] `password` has no version-conditional UX.** `Inspector.tsx:3467-3473` renders password for shadowtls regardless of `version`. Per `shadowtls.md:46` password is "Only available in v2/v3". When `version===1` it is silently ignored; when `version` is 2/3 and empty, the handshake auth is unset. Add a "(ignored for v1)" hint when `version===1`, and a diagnostic warning when `version∈{2,3}` and `password` is empty. No such diagnostic exists (`diagnostics.ts` has no version/password rule for shadowtls).
- **[P2] No required marker on `server`/`server_port` controls.** `Inspector.tsx:3376-3414` render plain labels; required-ness is only enforced via diagnostics, not surfaced inline on the field (e.g. asterisk / `aria-required`). Cosmetic but inconsistent with the "required first" intent.

STALE in pass-1 (`docs/ui-reviews/outbound-shadowtls.md` + `docs/claude/outbound-shadowtls.md`):
- P0-1 "default omits required `tls`" — FIXED: `commands.ts:356-365` now emits `tls:{enabled:true,server_name:""}`.
- P1-1 "version has no dedicated select" — FIXED: `<select>` at `Inspector.tsx:3244-3265`.
- P1-3 "version/password double-exposed in Advanced" — FIXED: both in `outboundHandledFields` (`Inspector.tsx:192,196,199`).
- P0 "password not sensitive" / "Dial detour raw text" — FIXED: masked via `SensitiveTextField`; detour is a shared-group/port reference, not free text.

SUMMARY: 0 P0, 2 P1, 1 P2.
