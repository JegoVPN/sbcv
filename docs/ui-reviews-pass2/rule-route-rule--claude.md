# rule-route-rule — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The route-rule node is materially better than pass-1 reports: the Inspector is now action-aware (outbound select gates on action, and reject/sniff/resolve/route-options sub-forms render), and the canvas *edge* is action-gated in `graph.ts`. The remaining real defects are structural completeness, not stubs: the canvas *port* (not just the edge) is still action-blind and lacks a resolve→DNS-server port; ~40 of ~60 official matcher/action fields are still raw comma-split `RuleListField`/scalar text (data-corrupting for ports/CIDRs/objects); deprecated geo fields are still first-class authoring options with no diagnostic; and `bypass` silently loses its outbound select. Pass-1's "no action sub-forms / always-on outbound select / no resolve.server" P0s are now STALE and must not be re-filed.

## 1. Left Palette

Entry: `{ label: "Route Rule", kind: "route-rule", icon: GitBranch, docsUrl: docs("route/rule/"), status: "table" }` — `Palette.tsx:179`, in the **Route** group (`Palette.tsx:176`).

- Category **correct** (Route). `status:"table"` is **correct** — creation routes through `RouteRulesTable`, not free canvas drop. `canActivate` whitelists `route-rule` for the table action (`Palette.tsx:285`); tooltip "Add or edit … through the ordered table" (`Palette.tsx:270`). Docs link is a real external `docsUrl`, not a dead badge.
- No official "default action" concept for the palette; `addRouteRule` seeds `{ domain_suffix:["example"], outbound: route.final }` (`commands.ts:723`) — implies `action:"route"` by omission, which is **correct** (route is the documented default, `rule_action.md:32`).
- Sibling palette item `route-rule-action` (`Palette.tsx:180`, `status:"inspector"`) correctly defers to the parent rule Inspector — there is no standalone action node, matching upstream (action is a field-set on the rule, not an entity).
- [P2] Label "Route Rule" gives no hint it opens a table inside the Route inspector (carried from pass-1; cosmetic only, the tooltip mitigates).

## 2. Canvas Node

Built in `graph.ts:264-313` (`kind:"route-rule"`, `type:"route-rule"`, one node per `route.rules[]` index). Ports come from `portRelationRegistry` via `getPortSpecs` (`SbcNode.tsx:94`), NOT hardcoded (pass-1's claim of hardcoded port logic in `getPortSpecs` is STALE).

Ports for `route-rule` (`portRelationRegistry.ts:92-96`): inputs `route` (order-only) + `inbound` (writable); outputs `outbound` (writable) + `rule-set` (writable). Semantics correct: rule lives under route hub, matches inbound, targets an outbound, references rule-sets.

- Title `Rule {index+1}` (`graph.ts:290`) + subtitle from first domain/rule_set/action label (`graph.ts:276-282`) — correct positional identity.
- [P1] **Port set is action-blind.** `getPortSpecs` always emits the `outbound` output port for every `route-rule` regardless of `action`, because the route-rule endpoint has no `nodeType`/action discriminator (`portRelationRegistry.ts:95`) and route-rule nodes carry no action-derived `type`. The *edge* is correctly suppressed for non-route/bypass actions (`graph.ts:303-307`), so a `reject` rule shows an `outbound` port stub that can never connect — visually implies a required link that is canonically absent.
- [P1] **`isPortConnected` for the outbound port ignores `action`** (`SbcNode.tsx:225-228`): returns connected whenever `rule.outbound` is truthy, even when `action:"reject"`/`"sniff"` (where outbound is dead data). Port lights up "connected" for a relationship the action does not use; inconsistent with the gated edge.
- [P1] **No `resolve`→DNS-server port.** When `action:"resolve"`, `rule.server` references `dns.servers[].tag`, but there is no port/edge for it (`portRelationRegistry.ts` has no route-rule→dns-server relation; `graph.ts` never emits one). The DNS-server relationship is invisible on canvas (pass-1 raised this; still open).
- [P2] No action label/badge on the node; a `sniff`/`resolve`/`reject` rule is visually identical to a `route` rule unless its subtitle happens to fall through to `rule.action` (`graph.ts:281`).
- The big `+`/hover chips call `createCompatible` → for a route-rule this creates a new **outbound** and sets `rule.outbound` (`useProjectStore.ts:448-451`), NOT a sibling rule — pass-1's "+ creates sibling rule" worry is moot. [P2] but it writes `outbound` unconditionally even when `action` doesn't use it (`useProjectStore.ts:450`).

## 3. Upstream/Downstream Links

Official model: rule → outbound (via action `outbound`), rule → rule_set[] (via `rule_set`), inbound → rule (matcher), rule → DNS server (via action `resolve.server`).

`portRelationRegistry.ts`:
- `route-rule-order` (`:92`) order-only route↔rule — correct.
- `route-rule-inbound` (`:94`) inbound→rule, path `/route/rules/*/inbound` — correct.
- `route-rule` (`:95`) rule→outbound, path `/route/rules/*/outbound` — present; see caveat below.
- `route-rule-set` (`:96`) rule→rule-set, path `/route/rules/*/rule_set` — correct.

`referenceRegistry.ts` (rename/delete propagation):
- inbound `/route/rules/*/inbound` (`:328`), outbound `/route/rules/*/outbound` (`:334`), rule-set `/route/rules/*/rule_set` (`:358`) all wired via `replaceInboundRefs`/`replaceOutboundRefs`/`replaceRuleSetRefs`.

Findings:
- [P1] **MISSING link: resolve `server` → dns-server.** `rule_action.md:320` defines `resolve.server` as a DNS-server-tag reference. It is absent from both registries — no port (§2) and no entry in `referenceRegistry` `dns-server.paths` (`referenceRegistry.ts:340` lists `/dns/rules/*/server` but not `/route/rules/*/server`). Renaming/deleting a DNS server will NOT update/clear a route rule's `resolve.server`, leaving a dangling reference.
- [P2] **`outbound` reference path is the deprecated top-level key.** Both registries track `/route/rules/*/outbound` (top-level), while `rule_action.md:45` makes `outbound` a field of the `route`/`bypass` **action**. The Inspector also writes top-level `outbound` (`Inspector.tsx:1048`). The 1.14 Structure example still emits top-level `outbound` alongside `action` (`rule.md:185-186`), so this round-trips today, but if a rule nests `outbound` inside an `action` object the link tracking misses it. Acceptable for now; note the divergence.
- No extra/wrong links observed. `preferred_by[]` is correctly NOT modeled as a tag reference (it is an enum: `tailscale`/`wireguard`, `rule.md:468`).

## 4. Right Inspector (fields)

`RouteRuleInspector` (`Inspector.tsx:954-1188`). Legend: ✅ correct control · ⚠️ present but wrong type/data-loss · ❌ missing/falls to catch-all.

| Official field | UI state |
|---|---|
| `inbound[]` | ⚠️ `RuleListField` free-text comma-split (`:1013`); should be tag-multiselect from `inbounds[].tag` (diagnostic exists `:66`) |
| `ip_version` (4/6) | ⚠️ advanced text (`:439`); should be enum 4/6 select |
| `network[]` (tcp/udp/icmp) | ⚠️ advanced free-text (`:440`); should be enum multiselect |
| `auth_user[]` | ⚠️ advanced free-text (`:441`) |
| `protocol[]` | ⚠️ advanced free-text (`:442`) |
| `client[]` | ⚠️ advanced free-text (`:443`) |
| `domain[]` | ⚠️ free-text (`:1016`) |
| `domain_suffix[]` | ⚠️ free-text (`:1014`) |
| `domain_keyword[]` | ⚠️ free-text (`:1015`) |
| `domain_regex[]` | ⚠️ free-text (`:1017`) |
| `source_ip_cidr[]` | ⚠️ advanced free-text (`:447`) |
| `source_ip_is_private` | ✅ bool toggle (advanced `:448`) |
| `ip_cidr[]` | ⚠️ advanced free-text (`:449`) |
| `ip_is_private` | ✅ bool toggle (advanced `:450`) |
| `source_port[]` (int) | ⚠️ advanced comma-split (`:451`); colon ranges corrupt |
| `source_port_range[]` | ⚠️ advanced free-text (`:452`); `1000:2000` survives only by luck of split-on-comma |
| `port[]` (int) | ⚠️ advanced comma-split (`:453`) |
| `port_range[]` | ⚠️ advanced free-text (`:454`) |
| `process_name[]` | ⚠️ advanced free-text (`:455`) |
| `process_path[]` | ⚠️ advanced free-text (`:456`) |
| `process_path_regex[]` | ⚠️ advanced free-text (`:457`) |
| `package_name[]` | ⚠️ advanced free-text (`:458`) |
| `package_name_regex[]` (1.14) | ❌ **absent from `routeRuleAdvancedFields`** (`:438-467`); only reachable via scalar catch-all if pre-set, and never as array |
| `user[]` | ⚠️ advanced free-text (`:459`) |
| `user_id[]` (int) | ⚠️ advanced comma-split (`:460`) |
| `clash_mode` (string) | ✅ scalar text acceptable (advanced `:461`) |
| `network_type[]` | ⚠️ advanced free-text (`:462`); should be enum wifi/cellular/ethernet/other |
| `network_is_expensive` | ✅ bool (advanced `:463`) |
| `network_is_constrained` | ✅ bool (advanced `:464`) |
| `interface_address` (object) | ❌ object map → `AdvancedScalarFields` skips non-scalars (`:314-319`), so it is **silently unrenderable/uneditable**; not in advanced list either |
| `network_interface_address` (object) | ❌ same as above — unrenderable |
| `default_interface_address[]` | ❌ absent from advanced list (`:438`); scalar catch-all skips arrays |
| `wifi_ssid[]` | ⚠️ free-text in Shared section (`:937`) |
| `wifi_bssid[]` | ⚠️ free-text (`:938`) |
| `preferred_by[]` (1.13) | ⚠️ advanced free-text (`:465`); should be enum tailscale/wireguard |
| `source_mac_address[]` (1.14) | ⚠️ free-text Shared (`:941`) |
| `source_hostname[]` (1.14) | ⚠️ free-text Shared (`:945`) |
| `rule_set[]` | ⚠️ free-text (`:1018`); should be multiselect from `route.rule_set[].tag` |
| `rule_set_ip_cidr_match_source` | ✅ bool (advanced `:466`) |
| `invert` | ✅ bool toggle (`:1179`) |
| `action` ==Required== | ✅ select, all 7 values (`:1025-1043`); ⚠️ no final/non-final grouping |
| `type:"logical"` | ✅ Rule Type select (`:972`) |
| `mode` ==Required== | ✅ and/or select (`:991`) |
| `rules[]` ==Required== | ⚠️ raw JSON textarea (`:998-1007`); inline `try/parse else write string` can write an **invalid string into `rules`** on bad JSON (`:1004`). Note: the safer `InlineRuleSetEditor` (`:733`) exists but is NOT used here |
| **action `route`.outbound** ==Required== | ✅ select, gated to action==route (`:1045-1056`); ❌ **no diagnostic when empty** (only dangling-ref check `diagnostics.ts:72`) |
| **action `bypass`.outbound** (optional) | ❌ **outbound select does NOT render for bypass** — gate is `action==="route"` only (`:1045`); clear-logic keeps the value for bypass (`:1030`) but it becomes uneditable except via table/advanced |
| **`reject`.method** | ✅ select (`:1062`); ⚠️ missing `reply` option (ICMP, `rule_action.md:120`) |
| **`reject`.no_drop** | ✅ toggle (`:1068`) |
| **`hijack-dns`** | ✅ correctly shows no target fields |
| **`sniff`.sniffer[]** | ⚠️ free-text (`:1075`); should be sniffer enum multiselect |
| **`sniff`.timeout** | ✅ text w/ `300ms` placeholder (`:1078`) |
| **`resolve`.server** | ✅ select from `dns.servers[].tag` (`:1086`) — pass-1 "missing" is STALE |
| **`resolve`.strategy** | ✅ enum select (`:1100`) |
| **`resolve`.disable_cache** (1.12) | ❌ not in resolve block; scalar catch-all only if pre-set bool |
| **`resolve`.disable_optimistic_cache** (1.14) | ❌ absent |
| **`resolve`.rewrite_ttl** (1.12) | ❌ absent (number/null) |
| **`resolve`.timeout** (1.14) | ❌ absent |
| **`resolve`.client_subnet** (1.12) | ❌ absent |
| **route-options `override_address`** | ✅ text (`:1116`) |
| **route-options `override_port`** | ✅ number (`:1123`) |
| **route-options `network_strategy`** | ✅ enum select (`:1137`) |
| **route-options `network_type`** | ❌ absent from sub-form |
| **route-options `fallback_network_type`** | ❌ absent |
| **route-options `fallback_delay`** | ✅ text (`:1152`) |
| **route-options `udp_disable_domain_unmapping`** | ✅ toggle (`:1158`) |
| **route-options `udp_connect`** | ❌ absent |
| **route-options `udp_timeout`** | ❌ absent |
| **route-options `tls_fragment`** | ✅ toggle (`:1168`) |
| **route-options `tls_fragment_fallback_delay`** | ❌ absent |
| **route-options `tls_record_fragment`** | ❌ absent |
| **route-options `tls_spoof`** (1.14) | ❌ absent |
| **route-options `tls_spoof_method`** (1.14) | ❌ absent |
| route-options on `bypass` | ❌ sub-form gated to `route`/`route-options` only (`:1110`); bypass (a route-options carrier per `rule_action.md:85`) shows none |

Deprecated fields still presented as standard authoring (must be import-only):
| `geosite` | ❌ live in advanced list (`:444`), no deprecation gate/diagnostic |
| `source_geoip` | ❌ advanced list (`:445`) |
| `geoip` | ❌ advanced list (`:446`) |

## Findings (prioritized)

- [P1] **Resolve `server` reference is untracked end-to-end.** No canvas port, no edge, and not in `referenceRegistry` dns-server paths (`referenceRegistry.ts:340`; `portRelationRegistry.ts` has no route-rule→dns-server relation). Renaming/deleting a DNS server orphans `resolve.server`. — `referenceRegistry.ts:339-343`, `portRelationRegistry.ts:90-116`
- [P1] **Object-map matchers are unrenderable & lossy.** `interface_address` / `network_interface_address` are `{iface:[cidr]}` objects; `AdvancedScalarFields` only renders scalars (`Inspector.tsx:314-319`) and they are not in `routeRuleAdvancedFields`, so an imported rule's values are invisible in the UI and `RuleAdvancedFields`'s `RuleListField` would stringify-corrupt them if added. — `Inspector.tsx:314-319, 438-467`
- [P1] **Deprecated geo fields are first-class authoring options with no warning.** `geosite`/`source_geoip`/`geoip` (removed upstream by 1.12, `rule.md:273-293`) sit in `routeRuleAdvancedFields` and have NO route-rule diagnostic (DNS-rule deprecations exist `diagnostics.ts:366`, route geo has none). — `Inspector.tsx:444-446`, `diagnostics.ts:59-93`
- [P1] **`bypass` action loses its outbound select.** Outbound gate is `action==="route"` only (`Inspector.tsx:1045`), but `bypass` accepts an optional `outbound` (`rule_action.md:78`) and the clear-logic deliberately preserves it (`Inspector.tsx:1030`). Result: a bypass rule's outbound is uneditable in the action UI. Same gate omission for the route-options sub-form (`Inspector.tsx:1110`). — `Inspector.tsx:1030,1045,1110`
- [P1] **Port/CIDR/port-range matchers use comma-split text.** `source_port`/`port` (int[]) and `*_port_range`/`*_ip_cidr` (string[]) render via `RuleListField` (`Inspector.tsx:451-454,447,449`); `textToRuleList` (`Inspector.tsx:379-386`) splits on comma only and number-coerces — a value like `1000:2000` survives only because it lacks a comma, and any comma inside corrupts. Needs structured repeaters. — `Inspector.tsx:379-386, 451-454`
- [P1] **No "required outbound missing" diagnostic for `action:"route"`.** `diagnostics.ts:72` only flags a *dangling* outbound; an empty outbound on a route action (invalid per `rule_action.md:48` ==Required==) passes clean. — `diagnostics.ts:72-80`
- [P1] **Canvas outbound port is action-blind.** Port always rendered (`SbcNode.tsx:94` via `portRelationRegistry.ts:95`) and `isPortConnected` ignores action (`SbcNode.tsx:225-228`), while the edge is correctly gated (`graph.ts:303-307`) — port and edge disagree for reject/sniff/etc. — `SbcNode.tsx:225-228`, `portRelationRegistry.ts:95`
- [P1] **Missing resolve sub-fields:** `disable_cache`, `disable_optimistic_cache`, `rewrite_ttl`, `timeout`, `client_subnet` not in the resolve block (`Inspector.tsx:1082-1109`; spec `rule_action.md:303-364`).
- [P1] **Missing route-options sub-fields:** `network_type`, `fallback_network_type`, `udp_connect`, `udp_timeout`, `tls_fragment_fallback_delay`, `tls_record_fragment`, `tls_spoof`, `tls_spoof_method` (`Inspector.tsx:1110-1177`; spec `rule_action.md:140-273`).
- [P2] **`rules[]` bad-JSON writes a raw string into a field that must be an array** (`Inspector.tsx:1000-1006`); reuse the existing guarded `InlineRuleSetEditor` (`Inspector.tsx:733`).
- [P2] **`reject.method` missing `reply`** (ICMP echo, `rule_action.md:120`). — `Inspector.tsx:1062-1065`
- [P2] **Enum matchers are free text:** `network`, `network_type`, `preferred_by`, `protocol`, `client`, `sniffer`, `ip_version` should be constrained selects/multiselects, not `RuleListField`. — `Inspector.tsx:440-465,1075`
- [P2] **`package_name_regex` (1.14) & `default_interface_address` absent** from `routeRuleAdvancedFields`; not authorable as arrays. — `Inspector.tsx:438-467`
- [P2] **Tag/enum inputs lack reference validation:** `inbound`/`rule_set` are free text in the Inspector (`Inspector.tsx:1013,1018`); table uses a `datalist` (`RuleTables.tsx:146,158`) but still accepts arbitrary text. No version badges on 1.13/1.14 fields.
- [P2] **Action select has no final vs non-final grouping** (`Inspector.tsx:1036-1042`); mixing semantics is easy to author incorrectly.
- [P2] **`bypass` shown unconditionally** with no Linux/`auto_redirect`/1.13 platform gate note (`Inspector.tsx:1037`; `rule_action.md:57-61`).

Pass-1 items now STALE (do NOT re-file): always-on outbound select (now gated `Inspector.tsx:1045`); missing reject/sniff/resolve sub-forms (now present `:1058-1109`); missing `resolve.server` select (now present `:1086`); missing route-options sub-form (now present `:1110`); hardcoded `getPortSpecs` route-rule logic (now registry-driven `SbcNode.tsx:94`); canvas-edge action-gating (now done `graph.ts:303-307`). Covered by tests `tests/app.test.tsx:1091,1815`.

SUMMARY: 0 P0, 9 P1, 7 P2.
