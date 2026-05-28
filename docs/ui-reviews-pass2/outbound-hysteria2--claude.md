# outbound-hysteria2 — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
Hysteria2 outbound is now in strong shape end-to-end: a dedicated Inspector block exposes server/port/network/password/up_mbps/down_mbps/server_ports/hop_interval plus a structured `obfs` fieldset, password fields are sensitive-masked, TLS/QUIC/Dial shared cards render, and diagnostics enforce server+port, `tls.enabled`, and the `server_port`↔`server_ports` conflict. The pass-1 review (`docs/ui-reviews/outbound-hysteria2.md`) is now almost entirely STALE — every P0 it raised (obfs invisible, server_ports invisible, realm invisible, template missing TLS, no diagnostics) has been fixed in code. Remaining gaps are testing-only fields (`realm{}`, `bbr_profile`, `hop_interval_max`, `obfs.min/max_packet_size`) that are not first-class and only round-trip via the Advanced JSON/scalar fallbacks, plus a missing auth-password diagnostic and a `server_ports`-only subtitle cosmetic.

## 1. Left Palette
- Present: `Palette.tsx:166` — `{ label: "Hysteria2", kind: "hysteria2-out", icon: Plug, docsUrl: docs("outbound/hysteria2/"), status: "setup" }`. Correct group (Outbounds), correct label, correct docs URL.
- Kind→type mapping correct: `protocols.ts:15` `"hysteria2-out": "hysteria2"`; preferred tag `hy2-out` (`protocols.ts:160`). Node id is `outbound:<tag>`, not `outbound-hysteria2` (the task's id is a logical handle, not a code id).
- `status: "setup"` is actionable (`Palette.tsx:279-287` `canActivate` includes `setup`; click → `createFromPalette`). The "Setup" badge correctly signals "adds a setup draft", which is accurate since the scaffold needs a real server/password/SNI. Not gated, not deprecated — correct (only `hysteria-out` v1 is in `deprecatedKinds`, `Palette.tsx:252-256`).
- Icon `Plug` shared with hysteria/tuic (QUIC family) — acceptable. Pass-1 "users cannot click-to-create" is STALE.

## 2. Canvas Node
- Title = tag; titlebar shows `outbound / hysteria2` (`SbcNode.tsx:291`); icon falls through to `Shield` via `outboundIcon` (`SbcNode.tsx:52-58`) — acceptable.
- Subtitle (`graph.ts:396-403`): group-aware, else `"<type> <server>:<server_port>"`, else `"<type> outbound"`. For default node → `hysteria2 127.0.0.1:1080`. Correct.
- Status badge uses `diagnosticStatus("/outbounds/<index>", …)` with `startsWith` (`graph.ts:80-86`, 404), so it DOES surface nested `/outbounds/N/tls`, `/server`, `/server_port` errors. Pass-1 "badge will not catch missing TLS/password" is STALE.
- Ports (`portRelationRegistry.ts`): inputs = route-final, route-rule, selector-group, urltest-group, dns-detour, detour-target (dial), service-detour, rule-set-download; output = `dial-detour` (`outbound-detour`, excludes block/selector/urltest/dns — hysteria2 NOT excluded, line 106). Matches sing-box semantics exactly. No TLS port (correct — TLS is embedded).

## 3. Upstream/Downstream Links
Verified against `portRelationRegistry.ts` + `referenceRegistry.ts` (kind `outbound`, paths line 333-337). All official inbound references to a hysteria2 outbound tag are modelled and round-tripped on rename/delete:
- route.final (`route-final`), route.rules[].outbound (`route-rule`), selector/urltest outbounds[] (`selector`/`urltest`), dns.servers[].detour (`dns-server-detour`), other outbound .detour (`outbound-detour`), endpoint .detour (`endpoint-detour`), service ccm/ocm .detour, rule_set[].download_detour, ntp.detour, clash_api.external_ui_download_detour, v2ray stats.outbounds. Its own outgoing dial `detour` is the `dial-detour` output. 
- No missing/extra/wrong links for this node. `changeEntityType` preserves `detour` across type changes (`commands.ts:914-919`). Pass-1's "Dial detour must use a select not raw text" is satisfied (`Inspector.tsx:1478` Dial card renders `detour` as a select of outbound tags).

## 4. Right Inspector (fields)
Outbound block: `Inspector.tsx:3242`; hysteria2-specific: 3415-3427 (network), 3467-3473 (password), 3865-3915 (mbps/ports/hop), 3955-3991 (obfs). Shared cards via `sharedGroupsForEntity` (dial+tls+quic, `sharedFieldRegistry.ts:178-185`). `outboundHandledFields` (178-240) now includes obfs/server_ports/hop_interval/up_mbps/down_mbps/network/password.

| Official field | UI state |
|---|---|
| `server` (req) | First-class text `Inspector.tsx:3376-3384`; diagnostic if empty `diagnostics.ts:534-543`. OK. No required marker on input. |
| `server_port` (req) | First-class number `3385-3414`; diagnostic 1-65535 `545-553`. OK. Not disabled when `server_ports` set (warns instead). |
| `server_ports` | CSV text `3895-3905` (`toList`/`fromList`). OK. Conflict warn `diagnostics.ts:827-840`. |
| `hop_interval` | Text, placeholder `30s` `3906-3913`. OK. |
| `hop_interval_max` (1.14) | MISSING dedicated input → falls to Advanced scalar; stable-gated warn `diagnostics.ts:861-869`. P2. |
| `up_mbps` / `down_mbps` | Number, placeholder "empty = let BBR pick" `3867-3894`. Good (BBR hint present). |
| `obfs.type` | Select (disabled/salamander/gecko) `3970-3980`; gecko labelled "1.14+ testing". OK. |
| `obfs.password` | Sensitive, shown only when type set `3981-3987`. OK. |
| `obfs.min_packet_size`/`max_packet_size` (1.14, gecko) | MISSING — not surfaced even when type=gecko; survives only via Advanced JSON. P2. |
| `password` | Sensitive masked `3467-3473`. OK. NO diagnostic if empty (spec has no `==Required==`, but server is unusable without it). P1. |
| `network` | Select tcp/udp/both `3415-3427`. OK. (Default template hard-codes `network:"udp"`, see below.) |
| `tls` (req) | Shared TLS card (`outboundTlsTypes` has hysteria2, `sharedFieldRegistry.ts:151`); diagnostic `tls.enabled` `diagnostics.ts:555-570`. OK. |
| QUIC fields | Shared QUIC card (`outboundQuicTypes` `:152`). OK. |
| `bbr_profile` (1.14) | MISSING dedicated control → Advanced scalar; stable-gated warn `diagnostics.ts:852-860`. P2. |
| `brutal_debug` | Not in `outboundHandledFields` → renders as Advanced scalar checkbox (auto-label "Brutal Debug"). Round-trips. P2. |
| `realm{}` (1.14) | NO structured sub-form → object falls to `AdvancedNonScalarFields` JSON textarea (`Inspector.tsx:4211-4212`, handled-set excludes `realm`). Editable as raw JSON; stable-gated warn `diagnostics.ts:841-851`. No conflict diagnostic for realm+server. P1/P2. |
| Dial fields | Shared Dial card incl. `detour` select `1476-1499`. OK. |

## Findings (prioritized)
- [P1] `realm{}` (testing) has no structured editor; only the generic Advanced-JSON textarea surfaces it (`Inspector.tsx:4211-4212`). Its required sub-fields (`server_url`, `realm_id`, `stun_servers`) get no validation, and there is no diagnostic for the `realm` ↔ `server`/`server_port`/`server_ports` mutual-exclusion the upstream doc mandates (hysteria2.md:73, 183). Pass-1 flagged realm as a P0 "silently invisible" — that is now STALE (JSON fallback exists), but a structured form + conflict check is still warranted.
- [P1] No diagnostic for empty `password` on hysteria2. `diagnostics.ts:532-571` covers server/port/TLS but never checks auth password; a node with blank password passes semantic validation yet cannot authenticate. (Spec lists `password` without `==Required==`, so a warning—not error—is appropriate; consider mirroring the realm "change-me placeholder" warning pattern at `diagnostics.ts:267-275`.)
- [P2] Default template hard-codes `network: "udp"` (`commands.ts:390-400`). Upstream default is "both enabled" (hysteria2.md:151); shipping `udp` silently disables TCP. Drop `network` from the scaffold (the select already offers "tcp + udp (both)").
- [P2] Testing-only fields `bbr_profile`, `hop_interval_max`, `obfs.min_packet_size`, `obfs.max_packet_size` have no first-class controls; they only round-trip via Advanced scalar/JSON and are not channel-gated in the UI (only diagnostics warn, and only on `stable`). Add gated inputs in the hysteria2 block (`Inspector.tsx:3865`).
- [P2] `server_ports`-only mode yields a trailing-colon subtitle `"hysteria2 127.0.0.1:"` (`graph.ts:401-402` emits `:${server_port ?? ""}` when `server_port` absent). Cosmetic; handle `server_ports?.length` like the group branch above it. (Pass-1 Task 10 still valid.)
- [P2][pre-existing, not hysteria2-specific] `diagnosticStatus` prefix match (`graph.ts:80-86`) uses bare `startsWith("/outbounds/<index>")`, so outbound #1's badge also absorbs diagnostics from #10–#19. Out of scope here; flag for the canvas-status owner.

SUMMARY: 0 P0, 2 P1, 4 P2.
