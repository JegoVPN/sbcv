# inbound-socks — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Single source of truth: `docs/upstream/sing-box/testing/configuration/inbound/socks.md` + `docs/upstream/sing-box/testing/configuration/shared/listen.md`.
Official writable surface for `socks` inbound: `type` (fixed `socks`), `tag`, all Listen Fields (`listen` ==Required==, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `udp_timeout`, `detour`), `users[]` (each `username`, `password`). Deprecated import-only listen fields: `sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping`. There is NO `set_system_proxy` on socks (that field belongs only to `http` and `mixed`).

## Verdict (2-3 sentences)
The SOCKS node is in good shape and most of pass-1's blockers are now fixed: `users[]` has a structured, password-masked repeater; the listen group is complete and `detour` is a self-excluding inbound select; TLS/multiplex/transport correctly do NOT appear. The one real correctness bug is a `set_system_proxy` checkbox leaking into the SOCKS inspector (it is not a SOCKS field), which writes a field the upstream schema does not define. Remaining gaps are polish: no `listen` required-marker / no empty-`listen` or missing-`tag` diagnostic, and deprecated listen fields have no surfacing path at all (acceptable, but undocumented).

## 1. Left Palette
- Present: `Palette.tsx:132` — `{ label: "SOCKS", kind: "inbound-socks", icon: Network, docsUrl: docs("inbound/socks/"), status: "setup" }`. Category "Inbounds" (`Palette.tsx:128`). Correct.
- Mapping: `inbound-socks` -> type `socks` (`protocols.ts:49`); default tag `socks-in` (`protocols.ts:172`); `socks` ∈ `CREATABLE_INBOUND_TYPES` (`protocols.ts:71`). Correct.
- Action/gating: `status:"setup"` renders label "Setup" and is actionable (`Palette.tsx:280`, `canActivate`), creating the node via `createFromPalette`. Icon `Network` and docsUrl are correct.
- No findings. (Pass-1 "No findings" remains accurate, but note pass-1's claim that label should drop internal status text is a global palette opinion, not socks-specific.)

## 2. Canvas Node
- Title = tag (`graph.ts:224`); subtitle = `"socks inbound"` (`graph.ts:225`); titlebar text = `"inbound / socks"` (`SbcNode.tsx:291`); `compatible: ["Route"]` (`graph.ts:227`); status from diagnostics (`graph.ts:226`).
- Ports for socks (output only): `route` decorative "Route hub" (`portRelationRegistry.ts:91`), `route-rule-match` writable (`:94`), `dns-rule-match` writable (`:99`). No input ports. No `service` port (that endpoint is `nodeType:"shadowsocks"` only, `:113`). Correct per sing-box semantics.
- Listen `detour` (inbound→inbound) is intentionally NOT a port; it is an Inspector select instead (see §4). Acceptable; pass-1 floated an "advanced detour port" but the select is a reasonable equivalent.
- Pass-1 STALE: pass-1 worried about a generic `+`/deprecated badge; the deprecated badge is now gated to `outbound/block` only (`SbcNode.tsx:279`), so it never shows on socks. The bottom toolbar still duplicates type/status pills + Inspector buttons (`SbcNode.tsx:407-438`) — minor density nit only.
- No correctness findings.

## 3. Upstream/Downstream Links
Official model: an inbound is referenced *by* route rules and DNS rules through their `inbound[]`; it references nothing downstream except optional listen `detour` -> another (injectable) inbound.
- `referenceRegistry` inbound entry (`referenceRegistry.ts:327-331`) paths = `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds`. Rename/remove cascade implemented (`replaceInboundRefs`/`removeInboundRefs` `:123-155`). Correct and complete.
- `portRelations`: `route-rule-inbound` (`:94`) and `dns-rule-inbound` (`:99`) are writable inbound→rule matchers; `dns-inbound-query` decorative (`:100`). Matches the official "referenced by route/dns rules" model.
- Missing/extra/wrong links: none material. Listen `detour` (inbound→inbound) has no `portRelation` and is not in `referenceRegistry` — so renaming/deleting the target inbound will NOT rewrite a `detour` that points at it (orphan risk). Low severity for socks; noted as P2.

## 4. Right Inspector (fields)
Rendered in the `ref.kind === "inbound"` block (`Inspector.tsx:2583+`); listen group via `SharedFieldCards` (`:5343`, groups from `sharedGroupsForEntity` = `["listen"]` for socks, `sharedFieldRegistry.ts:170`); users via `INBOUND_USER_SCHEMAS.socks` (`:516-523`, render `:3125-3236`).

| Official field | UI state | Control / notes |
|---|---|---|
| `type` (=`socks`) | EXPOSED | Type `<select>` of `CREATABLE_INBOUND_TYPES` (`:2113`). OK. |
| `tag` | EXPOSED | Text input, rename-on-blur (`:2094-2107`). No required marker; rename cascades via `renameTag`. |
| `listen` ==Required== | EXPOSED | `kind:"text"` (`:1436`). NOT marked required; no validation if empty (P1). |
| `listen_port` | EXPOSED | `kind:"number"`, empty→undefined (`:1437`,`coerceSharedFieldValue :1629`). OK. |
| `bind_interface` | EXPOSED | text, "(1.12+)" (`:1438`). OK. |
| `routing_mark` | EXPOSED | text — upstream allows int or `"0x..."`, text is acceptable (`:1439`). OK. |
| `reuse_addr` | EXPOSED | boolean (`:1440`). OK. |
| `netns` | EXPOSED | text, Linux note (`:1441`). OK. |
| `tcp_fast_open` | EXPOSED | boolean (`:1442`). OK. |
| `tcp_multi_path` | EXPOSED | boolean (`:1443`). OK. |
| `disable_tcp_keep_alive` | EXPOSED | boolean, "(1.13+)" (`:1444`). OK. |
| `tcp_keep_alive` | EXPOSED | text (`:1445`). OK (default `5m` not shown as placeholder; minor). |
| `tcp_keep_alive_interval` | EXPOSED | text (`:1446`). OK (default `75s` not shown; minor). |
| `udp_fragment` | EXPOSED | boolean (`:1447`). OK. |
| `udp_timeout` | EXPOSED | text (`:1448`). OK (default `5m` not shown; minor). |
| `detour` (listen) | EXPOSED | `kind:"select"` of other inbound tags, self-excluded (`:1449`,`:1432-1434`). Good — matches pass-1 recommendation. Not ref-tracked on rename/delete (P2). |
| `users[]` | EXPOSED | Structured repeater, add/remove (`:3125-3236`). |
| `users[].username` | EXPOSED | text (`:519`). OK. |
| `users[].password` | EXPOSED | `SensitiveTextField`, masked+reveal (`:520`,`:639`). Correct sensitive handling. |
| `sniff` / `sniff_override_destination` / `sniff_timeout` / `domain_strategy` / `udp_disable_domain_unmapping` (deprecated) | NOT shown | Correctly excluded from listen group. If present on an imported config they fall to `AdvancedScalarFields` (`:3237`) as raw inputs with no deprecation/migration copy (P2). |
| `set_system_proxy` (NOT a socks field) | WRONGLY EXPOSED | Checkbox rendered for `socks` (`:2950`). Writes a field absent from the canonical SOCKS schema (P1). |

Nested-object handling: users patch is immutable per-row (`patchUser :3131`), no raw-JSON textarea, no invalid-JSON write path. Empty arrays normalize to `undefined` (`writeUsers :3129`). Good.

## Findings (prioritized)
- [P1] `set_system_proxy` checkbox leaks into SOCKS inspector — `Inspector.tsx:2950` includes `entityType === "socks"`. Upstream `socks.md` has no such field (it exists only in `http.md`/`mixed.md`). Remove `socks` from this condition so the toggle shows only for `mixed`/`http`; otherwise the UI writes a non-canonical field on SOCKS.
- [P1] `listen` has no required marker and no diagnostic — `Inspector.tsx:1436` (no required flag; `SharedFieldDefinition` has no `required` concept, `:1354-1361`) and `diagnostics.ts` has no empty/missing-`listen` or missing-`tag` check for inbounds (the only inbound loop, `:571-590`, fires solely for TLS-required types). `listen` is the one ==Required== listen field; surface a required marker and/or a warning when empty.
- [P2] Listen `detour` target is not reference-tracked — `referenceRegistry.ts:325-374` has no inbound `detour` path and `portRelationRegistry.ts` has no inbound→inbound relation. Renaming or deleting the referenced inbound will not update/clear a `detour` pointing at it (orphan). Add `/inbounds/*/detour` to the inbound reference entry (or a dedicated handler).
- [P2] Deprecated listen fields have no surfacing/migration path — `sniff*`/`domain_strategy`/`udp_disable_domain_unmapping` on an imported socks inbound fall through to `AdvancedScalarFields` (`Inspector.tsx:3237`) as plain inputs with no deprecation banner or migration-to-route-action copy. Add an import-only notice/diagnostic.
- [P2] Default-value hints missing for `tcp_keep_alive` (`5m`), `tcp_keep_alive_interval` (`75s`), `udp_timeout` (`5m`) — `Inspector.tsx:1445-1448`. Add placeholders so empty ≠ "no default".

Pass-1 is now STALE on its three headline items: P0 "users[] has no Inspector UI" is FIXED (`Inspector.tsx:3125-3236`); P1 "auto_route/address leak into all inbounds" is FIXED (now gated to `entityType === "tun"`, `:2603-2628`); P1 "listenSharedFields missing fields" is FIXED (all 14 listen fields present, `Inspector.tsx:100-115`, rendered `:1435-1450`). Pass-1's "must not inherit TLS/multiplex/transport" is satisfied (`sharedFieldRegistry.ts:170-176`).

SUMMARY: 0 P0, 2 P1, 3 P2.
