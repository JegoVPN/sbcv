# inbound-direct — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The `direct` inbound is now in good shape and pass-1 is largely stale: all three protocol fields (`network`, `override_address`, `override_port`) have first-class controls, all 14 listen fields are exposed, `routing_mark` is now text, `detour` is a real inbound select, and `address`/`auto_route` are correctly gated to `tun`. The remaining gaps are relationship-graph fidelity (the listen `detour` inbound→inbound link is invisible on the canvas and missing from the tag-rename/delete reference registry) and the absence of a `listen`-required diagnostic. Note: the supplied upstream testing/1.14 `direct.md` and inbound `index.md` do NOT mark the `direct` inbound itself as deprecated — only the legacy `sniff`/`domain_strategy` listen fields are deprecated — so the brief's "direct inbound deprecated since 1.11" premise is not supported by the source of truth and no deprecation badge is warranted.

## 1. Left Palette
Present and correct. `Palette.tsx:130` — `{ label: "Direct", kind: "inbound-direct", icon: Cable, docsUrl: docs("inbound/direct/"), status: "setup" }`. Category "Inbounds" is correct; label "Direct" is correct; `docsUrl` resolves to the right official page. `status: "setup"` → button reads "Setup", tooltip "Add Direct setup draft to canvas" (`Palette.tsx:269`), `canActivate` true (`Palette.tsx:280`), click runs `createFromPalette("inbound-direct")`. Inbounds are repeatable so no singleton guard is needed (correct). Deprecation surfacing: NOT applicable — the upstream `direct.md`/`index.md` do not deprecate the direct inbound, so the absence of a "Legacy" status is correct (the `deprecated` Palette path at `Palette.tsx:252` is reserved for `block`/`hysteria-out`/`dns-fakeip`). No issue here.

## 2. Canvas Node
Title/summary correct and data-driven from `graph.ts:214-242`: `title = tag`, `subtitle = "${type} inbound"` → "direct inbound", `status` from `/inbounds/{i}` diagnostics, `compatible: ["Route"]`. Titlebar shows `inbound / direct` (`SbcNode.tsx:291`). No deprecated badge — and that is correct for direct (the badge at `SbcNode.tsx:279,292` only triggers for `outbound`+`block`).

Ports are no longer the hard-coded switch pass-1 described (that `getPortSpecs` switch is GONE). Ports are derived from `portRelationRegistry` via `portEndpointsForNode` (`SbcNode.tsx:94-108`, `portRelationRegistry.ts:196-205`). For an inbound the output endpoints are: `route` ("Route hub", decorative, `portRelationRegistry.ts:91`), `route-rule-match` ("Route rule matcher", `:94`), `dns-rule-match` ("DNS rule matcher", `:99-100`), plus a `service` ("SSM API service") port that only resolves for `shadowsocks` (`:113`). For `direct` the SSM port collapses out because its compatible endpoint requires `nodeType:"shadowsocks"` (`otherEndpoint` returns null → `SbcNode.tsx:97`), so direct correctly shows exactly Route hub / Route rule matcher / DNS rule matcher. Active-state checks at `SbcNode.tsx:206-212` are correct.

Gap: the listen-field `detour` (inbound→inbound forwarding) has no port and no edge anywhere. `graph.ts` emits edges for inbound→route (`:240`) and rule matchers (`:301,602`) but never for `inbounds[].detour`. This relationship lives only in JSON. [P2]

## 3. Upstream/Downstream Links
Official model: a `direct` inbound is referenced by `route.rules[].inbound` and `dns.rules[].inbound`; its own `override_address`/`override_port` are scalar destination overrides (not tag refs, correctly NOT links); its listen `detour` references another inbound tag (target must be Injectable — and per `index.md:20`, `direct` itself is `Injectable: close`, so a direct inbound is a valid `detour` source but NOT a valid `detour` target).

- Incoming `route.rules[].inbound`: present. `portRelationRegistry.ts:94` (`route-rule-inbound`, writable, `/route/rules/*/inbound`); edge built `graph.ts:301`; rename/remove `referenceRegistry.ts:328` + `replaceInboundRefs`/`removeInboundRefs` (`:123-155`). Correct.
- Incoming `dns.rules[].inbound`: present. `portRelationRegistry.ts:99`; edge `graph.ts:602`; same registry entry. Correct.
- Decorative inbound→route + inbound→dns-query: `portRelationRegistry.ts:91,100`. Cosmetic only. OK.
- MISSING: listen `detour` (`inbounds[].detour` → another inbound tag). No `PortRelation`, no edge, and — more importantly — it is NOT in `referenceRegistry` inbound `paths` (`referenceRegistry.ts:328` lists only `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds`). Consequence: renaming or deleting inbound B does NOT update/clear `inbounds[A].detour === "B"`, leaving a dangling reference. [P1]
- No extra/wrong links for direct.

## 4. Right Inspector (fields)
Direct-specific block at `Inspector.tsx:2981-3017` (gated `entityType === "direct"`); listen group via `sharedGroupsForEntity` (`sharedFieldRegistry.ts:170`) → `sharedFieldDefinitions("listen")` (`Inspector.tsx:1431-1450`). `tag` editable `:2095`; `type` select `:2112`.

| Official field (direct.md / shared/listen.md) | Req | Type | UI control | Default | Assessment |
| --- | --- | --- | --- | --- | --- |
| `listen` | **Required** | string | text `Inspector.tsx:1436` | stub `127.0.0.1` (`commands.ts` createInbound) | Present, but NO required marker and NO missing-`listen` diagnostic. [P1] |
| `listen_port` | opt | number | number `:1437` | stub `2081` | Correct |
| `bind_interface` (1.12+) | opt | string | text `:1438` | — | Correct (version noted in label) |
| `routing_mark` (1.12+, Linux) | opt | int OR hex string | text `:1439` | — | Correct — now text, accepts `"0x1234"` (pass-1 P1 FIXED) |
| `reuse_addr` (1.12+) | opt | bool | boolean `:1440` | false | Correct |
| `netns` (1.12+, Linux) | opt | string | text `:1441` | — | Correct |
| `tcp_fast_open` | opt | bool | boolean `:1442` | false | Correct |
| `tcp_multi_path` | opt | bool | boolean `:1443` | false | Present (pass-1 P1 FIXED) |
| `disable_tcp_keep_alive` (1.13+) | opt | bool | boolean `:1444` | false | Present (pass-1 P1 FIXED) |
| `tcp_keep_alive` (1.13+) | opt | duration | text `:1445` | 5m | Present (pass-1 P1 FIXED) |
| `tcp_keep_alive_interval` | opt | duration | text `:1446` | 75s | Present (pass-1 P1 FIXED) |
| `udp_fragment` | opt | bool | boolean `:1447` | false | Present (pass-1 P1 FIXED) |
| `udp_timeout` | opt | duration | text `:1448` | 5m | Correct |
| `detour` | opt | inbound tag | select of inbound tags (self excluded) `:1449,1432-1434` | — | Present (pass-1 P0 FIXED). Self-exclusion correct; does not exclude non-Injectable targets, minor. [P2] |
| `network` | opt | enum `""`/`tcp`/`udp` | select `:2983-2992` | both | Correct (pass-1 P1 FIXED) |
| `override_address` | opt | string | text `:2994-3000` | — | Correct (pass-1 P1 FIXED) |
| `override_port` | opt | number | number `:3002-3014` | — | Correct (pass-1 P1 FIXED) |
| deprecated `sniff`/`sniff_override_destination`/`sniff_timeout`/`domain_strategy`/`udp_disable_domain_unmapping` | — | — | none; only via AdvancedScalarFields if imported (`:3237`) | — | Acceptable for import-only; not labelled deprecated. [P2] |

Not-in-model UI fields for direct: none surfaced. `address`/`auto_route` are now gated to `entityType === "tun"` (`Inspector.tsx:2609-2622`) so they do NOT leak onto direct (pass-1 P2 FIXED). `address`/`auto_route` remain in `inboundHandledFields` (`:143-144`) only to suppress them from Advanced — harmless for direct. Invalid-JSON writes: the direct block uses typed scalar inputs (no JSON textarea), so no invalid-write path; `override_port` parses via `Number.isFinite` (`:3011-3012`), correct.

Type-switch note: `changeEntityType` for inbound (`commands.ts:908-912`) rebuilds from `createInbound(nextType, tag)` preserving only `tag` — so route/dns `inbound` refs survive (good) but listen config is reset on switch (lossy, undiagnosed). [P2]

## Findings (prioritized)
- [P1] Listen `detour` (`inbounds[].detour`) is absent from `referenceRegistry` inbound paths — `referenceRegistry.ts:328` (+`replaceInboundRefs`/`removeInboundRefs` `:123-155`). Renaming/deleting a referenced inbound leaves a dangling `detour`. Add `/inbounds/*/detour` handling.
- [P1] `listen` is `==Required==` upstream (shared/listen.md:58) but there is no required marker in the Inspector (`Inspector.tsx:1436`) and no missing-`listen` diagnostic in `diagnostics.ts` (only service/clash-api `listen` checks exist, `:292,1411`). A user can clear `listen` with zero feedback; sing-box would refuse to start.
- [P2] Listen `detour` inbound→inbound relationship has no canvas port/edge — `portRelationRegistry.ts` (no relation) and `graph.ts:214-242` (no edge emitted). Relationship is invisible.
- [P2] `detour` select (`Inspector.tsx:1449`) lists all inbound tags but does not exclude non-Injectable targets (e.g. another `direct`/`tun`); upstream requires an Injectable target (index.md:20). Minor mis-guidance.
- [P2] Inbound type-switch is lossy for listen fields — `changeEntityType` (`commands.ts:908-912`) preserves only `tag`; no diagnostic warns that `listen`/port were reset.
- [P2] Deprecated legacy listen fields (`sniff*`, `domain_strategy`, `udp_disable_domain_unmapping`) shown unlabelled via AdvancedScalarFields on import (`Inspector.tsx:3237`); no "deprecated, migrate to rule actions" copy (shared/listen.md:150-202).

Stale pass-1 claims (now resolved in code): the hard-coded `getPortSpecs` inbound switch no longer exists (ports are registry-driven); `network`/`override_address`/`override_port` ARE first-class controls (`Inspector.tsx:2981-3017`); all five "missing" listen fields ARE present (`:1443-1447`); `routing_mark` IS text (`:1439`); `detour` IS an inbound select (`:1449`); `address`/`auto_route` ARE gated to `tun` (`:2609-2622`). Pass-1's claim that sniff/domain fields are "removed in 1.13.0" is also inaccurate vs the testing/1.14 source, which still lists them as deprecated-but-present.

SUMMARY: 0 P0, 2 P1, 4 P2.
