# inbound-shadowsocks — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The node is in much better shape than pass-1 claimed: there is now a real Shadowsocks-specific Inspector block (method `<select>`, structured `users[]` editor) and `managed` is auto-set both when the SSM canvas edge is drawn (`useProjectStore.ts:541`) and via the SSM service checklist (`Inspector.tsx:4767`), so most of the pass-1 P0/P1 list is stale. Remaining real gaps: the inbound Shadowsocks block has **no `network` select** and **no dedicated `password` field** (both leak into "Advanced fields"), the `method` enum lists ~12 ciphers that are **not in the official 9-method table** and carries no required marker, `destinations[]` (relay mode) has no structured editor, and there are **no diagnostics** for missing `method`/`password`. Links are correct.

## 1. Left Palette

`Palette.tsx:134` — `{ label: "Shadowsocks", kind: "inbound-shadowsocks", icon: Shield, docsUrl: docs("inbound/shadowsocks/"), status: "setup" }`.

- Present, correct category (Inbounds), correct label, correct docs URL.
- `status: "setup"` → label "Setup", `canActivate` true (`Palette.tsx:279-287`), title "Add Shadowsocks setup draft to canvas" (`statusTitle`, 271). Clicking calls `createFromPalette("inbound-shadowsocks")` → `addInbound(..., "shadowsocks")`. Action is correct and explicit.
- No target-gating — appropriate; a Shadowsocks inbound has no prerequisite. Not singleton-gated — correct (multiple allowed).
- Verdict: correct. (Pass-1's generic "status badge is non-actionable" critique is wrong here — `setup` IS actionable.)

## 2. Canvas Node

`graph.ts:224-227` — `title = tag`, `subtitle = "${inbound.type} inbound"` ("shadowsocks inbound"), `status = diagnosticStatus("/inbounds/${index}")`, `compatible = ["Route"]`.

- Titlebar shows `inbound / shadowsocks` (`SbcNode.tsx:291`); card shows tag as title, "shadowsocks inbound" as subtitle, plus type/status pills (`SbcNode.tsx:388-415`). Acceptable.
- Output ports (right) per `portEndpointsForNode` over `portRelations`: `route` (decorative hub), `route-rule-match`, `dns-rule-match`, and `service` ("SSM API service", **only when type==="shadowsocks"** via `nodeType: "shadowsocks"` on the endpoint — `portRelationRegistry.ts:113`). No input ports for inbound. Correct per sing-box semantics (an inbound is referenced by route/dns rules and by SSM API).
- No badge/affordance distinguishes single-user vs multi-user (`users[]`) vs relay (`destinations[]`) mode, and no indicator that `managed:true` is set. Minor UX gap (P2); the canvas SSM port already encodes the managed relationship and drawing it sets `managed` (`useProjectStore.ts:541`).
- `compatible: ["Route"]` drives the big `+` button and `createCompatible` — reasonable.

## 3. Upstream/Downstream Links

Official relationship model for an inbound: referenced by `route.rules[].inbound`, `dns.rules[].inbound`, and (when `managed`) by `services[ssm-api].servers`; listen-field `detour` may target another injectable inbound.

`portRelationRegistry.ts`:
- `route-rule-inbound` (94, writable, `/route/rules/*/inbound`) — correct.
- `dns-rule-inbound` (99, writable, `/dns/rules/*/inbound`) — correct.
- `dns-inbound-query` (100, decorative) + `inbound`→route hub (91, decorative) — informational only; fine.
- `service-ssm-inbound` (113, writable, `/services/*/servers`, source gated to `nodeType:"shadowsocks"`) — correct; this is the only inbound→service link and it is Shadowsocks-only, matching the SSM API doc.

`referenceRegistry.ts:327-331` — inbound paths `["/route/rules/*/inbound", "/dns/rules/*/inbound", "/services/*/servers", "/experimental/v2ray_api/stats/inbounds"]`; rename/delete cascade correct (`replaceInboundRefs`/`removeInboundRefs`, 123-155).

Missing/extra/wrong:
- [minor] Listen-field `detour` (inbound→inbound injection, `shared/listen.md` #detour) is **not** modeled as a port or reference path. It is editable as a `<select>` of inbound tags in the listen group (`Inspector.tsx:1449`) but is not in `referenceRegistry`, so renaming/deleting the target inbound will not fix up a `detour` pointing at it. Cross-cutting (all inbounds), not Shadowsocks-specific.
- `destinations[].server` / `server_port` are literal relay endpoints, **not** tag references, so correctly NOT modeled as links. No extra/wrong links found.

## 4. Right Inspector (fields)

Inbound block: `Inspector.tsx:2583-3240`. Shared `listen`/`multiplex`/`tcp-brutal` groups render via `SharedFieldCards` (5343) because `sharedGroupsForEntity` pushes `listen` for all creatable inbounds and `multiplex,tcp-brutal` for shadowsocks (`sharedFieldRegistry.ts:170,173`). `inboundHandledFields` (`Inspector.tsx:140-177`) now includes `users` and `method` (pass-1 said it did not — **stale**) but NOT `password`, `managed`, `network`, `destinations`.

| Official field | Required | Expected control | UI state | Verdict |
|---|---|---|---|---|
| Listen fields (`listen`, `listen_port`, `detour`, tcp/udp opts…) | `listen` req | shared listen card | Rendered via `SharedFieldCards`→`sharedFieldDefinitions("listen")` (`Inspector.tsx:1431-1451`). `listen`/`listen_port` text+number; `detour` select. | OK (no required marker on `listen`) |
| `network` | No (both if empty) | select both/tcp/udp | **MISSING in inbound block.** Selects exist only for `tproxy` (2968), `direct` (2983), `naive` (3095). The shadowsocks `network` select at 3415 is inside the **outbound** block. Falls through to `AdvancedScalarFields` (3237) as plain text. | **P1** |
| `method` | **Yes** | select of 9 values + key-length hint | `<select>` present (2915-2948) with optgroups. But lists ~12 extra ciphers (`aes-128-ctr`, `aes-192-ctr`, `aes-256-ctr`, `aes-*-cfb`, `rc4-md5`, `chacha20-ietf`, `xchacha20`) **not in the official table**; also a `(none)`/"" option that writes `undefined`. No required marker, no key-length guidance. | **P1** |
| `password` | **Yes** (except `method:none`) | dedicated masked field w/ format hint | **No dedicated control in inbound block.** Leaks to `AdvancedScalarFields`; rendered as `SensitiveTextField` only because the name matches `isSensitiveFieldName` (705-713), buried under collapsed "Advanced fields". No base64 hint for 2022 methods. (Outbound SS gets a first-class `Password` field at 3467 — inbound does not.) | **P1** |
| `managed` | No (default false) | named toggle "Managed by SSM API" | **No control in inbound block.** Leaks to `AdvancedScalarFields` as a generic "Managed" checkbox. Auto-set true on SSM canvas-edge connect (`useProjectStore.ts:541`) and via SSM service checklist (`Inspector.tsx:4756-4768`). Functional but not discoverable from the inbound's own Inspector. | **P2** (pass-1 rated P0; auto-set now exists → downgrade) |
| `users[]` (`name`,`password`) | No (multi-user) | repeater, password masked | Structured editor present (`Inspector.tsx:3125-3236`) via `INBOUND_USER_SCHEMAS.shadowsocks` (545-551: `name` + masked `password`). Add/remove rows. (Pass-1 "not reachable / JSON-only" — **stale**.) | OK |
| `destinations[]` (`name`,`server`,`server_port`,`password`) | No (relay) | repeater | **No structured editor.** Not in `inboundHandledFields`, so caught by `AdvancedNonScalarFields` (3238) as a raw `JsonField` textarea. Relay mode is editable only as raw JSON; `password` not masked, `server_port` not validated. | **P1** |
| `multiplex` | No | shared multiplex card | Rendered (group pushed at `sharedFieldRegistry.ts:173`). | OK |
| `type` | yes | type select | `<select>` of `CREATABLE_INBOUND_TYPES` (2112-2118); `changeEntityType` rebuilds from `createInbound` (`commands.ts:909`) — note this **drops** method/password/users on type change since the SS branch only seeds `method:"aes-128-gcm"`,`password:"change-me"`. | OK (lossy, expected) |
| `tag` | — | text | Rendered (2095) with `renameTag`. | OK |

Invalid-JSON write risk: `JsonField` (`Inspector.tsx:794-818`) and `AdvancedNonScalarFields` write the **raw string** back into the entity on parse failure (`onChange(event.target.value)` in the catch), so a malformed `destinations`/advanced object silently stores a string — bad value reaches export. Affects relay editing here. (P2, shared component.)

Default seeding (`commands.ts:145-154`): `createInbound("shadowsocks")` → `method:"aes-128-gcm"`, `password:"change-me"`, `listen:127.0.0.1`, `listen_port:2080`. Valid single-user default. SSM path seeds a `2022-blake3-aes-128-gcm` + base64 password managed inbound (`commands.ts:471-486`) — good.

## Findings (prioritized)

- **[P1]** No `network` select for Shadowsocks inbound — field leaks to Advanced as free text. `src/components/Inspector.tsx:2915` block has no network control; add one like the `direct`/`naive` selects (`Inspector.tsx:2983`, `3095`) and add `"network"` to `inboundHandledFields` (`Inspector.tsx:140`).
- **[P1]** `method` select offers ~12 ciphers absent from the official 9-value table and has no required marker / key-length hint. `src/components/Inspector.tsx:2937-2945` (the "Legacy / Stream cipher" optgroup) — drop or clearly mark as non-1.14; mark the field required.
- **[P1]** `password` has no dedicated masked field for the Shadowsocks **inbound** (only the outbound gets one at `src/components/Inspector.tsx:3467`); it renders only via the Advanced fallback. Add a primary `SensitiveTextField` with a 2022/base64 placeholder, add `"password"` to `inboundHandledFields` (`Inspector.tsx:140`).
- **[P1]** `destinations[]` (relay mode) has no structured editor — raw `JsonField` only (`src/components/Inspector.tsx:3238`), password unmasked, port unvalidated. Add a repeater (`name`,`server`,`server_port`,`password`) and add `"destinations"` to `inboundHandledFields`.
- **[P1]** No semantic diagnostics for the Shadowsocks inbound: missing `method`, missing `password` (when `method!=="none"`), or 2022-method password not base64. `src/domain/diagnostics.ts:573-590` only checks `inbound-missing-tls`; add a `method`/`password` check alongside.
- **[P2]** `managed` is not surfaced as a named toggle in the inbound's own Inspector (only generic Advanced checkbox + SSM-side checklist). `src/components/Inspector.tsx:2915` block — add a "Managed by SSM API" toggle and `"managed"` to `inboundHandledFields`. (Auto-set on edge connect already works: `src/state/useProjectStore.ts:541`.)
- **[P2]** Canvas node shows no single-user/multi-user/relay/managed badge. `src/canvas/graph.ts:224-227` — consider a mode chip in `subtitle`.
- **[P2]** `JsonField`/`AdvancedNonScalarFields` store the raw invalid string on JSON parse failure, so malformed relay/advanced objects reach export. `src/components/Inspector.tsx:808-813`.

Stale pass-1 claims (now false): "method rendered as free-text" (it's a select, 2915), "users[]/destinations[] not rendered at all" (users has a structured editor, 3125), "managed not auto-set on SSM edge" (set at `useProjectStore.ts:541`), and "`users`/`method` not in `inboundHandledFields`" (both now present, `Inspector.tsx:146`,`159`... `users` at 145). The pass-1 P0 "managed not surfaced" is now at most P2.

SUMMARY: 0 P0, 5 P1, 3 P2.
