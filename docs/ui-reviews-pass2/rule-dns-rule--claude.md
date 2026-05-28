# rule-dns-rule — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Node id: `dns-rule` (one object in ordered `dns.rules[]`). Verified against `docs/upstream/sing-box/testing/configuration/dns/rule.md` + `rule_action.md`. Code paths cited below are absolute-file:line.

## Verdict (2-3 sentences)
The DNS rule node is in much better shape than pass-1 claimed: the phantom `dns-rule-action` Palette kind does not exist, `source_mac_address`/`source_hostname` are exposed, reject+predefined sub-forms render, the canvas server *edge* is action-gated, and a real bank of migration/testing diagnostics exists. The two true P0s now are (1) the `server` control is gated to `route` only while sing-box requires it for `evaluate` too — and switching to `evaluate` actively *clears* the server (`src/components/Inspector.tsx:1267`, `:1279`), and (2) the canvas still draws an always-on "DNS server" output *handle* regardless of action even though the edge is suppressed (`src/components/SbcNode.tsx:94`, `src/domain/portRelationRegistry.ts:101`). Beyond that, a large set of object/array fields (`interface_address` family, `predefined.answer/ns/extra`, Response Match Fields) is completely unreachable in the Inspector — neither authorable nor visible on import — because `DnsRuleInspector` never renders `AdvancedNonScalarFields` (`src/components/Inspector.tsx:1327`).

## 1. Left Palette
- `src/components/Palette.tsx:81` — single entry `{ label: "DNS Rule", kind: "dns-rule", status: "table" }`, GitBranch icon, docsUrl `dns/rule/`. Correct category (DNS), correct table semantics (rule order is owned by `DnsRulesTable`), docsUrl resolves.
- `src/components/Palette.tsx:285` — `dns-rule` activates under the same `status === "table"` gate as `route-rule`. Correct.
- **pass-1 STALE:** pass-1 (and `docs/claude/rule-dns-rule.md`) call out a separate `dns-rule-action` Palette kind / phantom node to be removed. It does **not** exist anywhere in `src/` (grep for `dns-rule-action` is empty). That whole P0 is obsolete — do not re-file it.
- [P2] `status: "table"` surfaces no user-facing affordance copy (e.g. "Edit DNS rules"); a raw internal keyword. Same nit as pass-1, still open.

## 2. Canvas Node
- Node built in `src/canvas/graph.ts:578` — title `DNS Rule {n}`, subtitle falls back domain_suffix→domain_keyword→domain→rule_set→action→"dns match" (`:586`). Reasonable. `compatible: ["DNS Server"]` hardcoded (`:594`) regardless of action.
- Ports come from `portRelationRegistry` via `getPortSpecs` (`src/components/SbcNode.tsx:94`), which filters **only** by nodeKind/type — there is no action awareness. dns-rule ports: `dns` (order), `inbound` (matcher), `dns-server` (`/dns/rules/*/server`), `rule-set` (`src/domain/portRelationRegistry.ts:97,99,101,102`). Matches sing-box semantics (rule lives in dns hub; action.server→dns server; rule_set→rule-set).
- **pass-1 PARTLY STALE / refined:** the server *edge* IS action-gated now — `src/canvas/graph.ts:604-608` only emits the dns-server edge when action ∈ {"", route, evaluate}. **But the server output *handle/port* is still drawn unconditionally** for every action because port specs ignore action. So a `reject`/`predefined`/`respond`/`route-options` rule shows a clickable "DNS server" port that can never produce a valid edge, and dragging it writes a `server` that those actions ignore. → [P0].
- [P1] graph edge gate (`graph.ts:605`) allows `evaluate`, but the Inspector hides+clears server for `evaluate` (Inspector.tsx:1267). The two surfaces disagree about whether evaluate has a server. Upstream says evaluate REQUIRES server (`rule_action.md:110-113`), so graph.ts is right and Inspector is wrong.

## 3. Upstream/Downstream Links
Official relationship model: rule → dns hub (order); `inbound[]`→inbound tags; `rule_set[]`→rule-set tags; `action:route|evaluate` `server`→a **dns server** tag (never an outbound).

| Link | Registry | Status |
|---|---|---|
| dns hub order | `portRelationRegistry.ts:97` `dns-rule-order` order-only | OK |
| inbound matcher | `portRelationRegistry.ts:99` `dns-rule-inbound` → `/dns/rules/*/inbound` | OK |
| action server → dns-server | `portRelationRegistry.ts:101` `dns-rule` → `/dns/rules/*/server`, createTarget `[dns-server]` | Points at dns-server (correct, NOT outbound). But path is the **rule-level** `server`, i.e. the 1.11-deprecated flat shape, not `action.server`. |
| rule_set → rule-set | `portRelationRegistry.ts:102` `dns-rule-set` → `/dns/rules/*/rule_set`, createTarget `[rule-set]` | OK |
| referenceRegistry dns-server kind | `referenceRegistry.ts:340` includes `/dns/rules/*/server` | OK (rename/delete of a dns-server retargets/clears rule server — `referenceRegistry.ts:227,242`) |
| referenceRegistry rule-set kind | `referenceRegistry.ts:358` includes `/dns/rules/*/rule_set` | OK |

- Missing: none of the deprecated `outbound` matcher (correctly NOT modeled as a link — it is flagged as a diagnostic instead, `diagnostics.ts:362`). Good.
- [P1] **Model uses deprecated flat `server`.** sing-box 1.11 moved `server` into the action object (`rule_action.md:37`). The whole stack (registry path `/dns/rules/*/server`, Inspector `patch({server})`, graph edge, diagnostics `rule.server`) stores `server` flat on the rule. This round-trips and validates today, but it is the deprecated 1.11 shape; a config authored by hand with `action:{server:...}` would not be picked up by any of these surfaces.
- [P2] No `evaluate`-specific server path exists; because the model is flat-`server`, evaluate would reuse `/dns/rules/*/server` — but the Inspector clears it (see §4), so evaluate cannot get a server through any surface.

## 4. Right Inspector (fields)
`DnsRuleInspector` at `src/components/Inspector.tsx:1190`. Primary set `dnsRulePrimaryFields` `:419`; advanced match list `dnsRuleAdvancedFields` `:469`; shared block `SharedRuleFields` `:926`; scalar fallback `AdvancedScalarFields` `:675` (string/number/boolean ONLY — `:314`). `AdvancedNonScalarFields` (`:820`, JSON editor for object/array fields) is **NOT** rendered here.

Control legend: RLF=RuleListField (comma text→array, `:850`), num=number input, chk=checkbox, sel=select, JSON=raw textarea, scalar=AdvancedScalarFields catch-all, none=unreachable.

| Official field | Since | UI state |
|---|---|---|
| inbound | — | RLF primary `:1249` OK |
| ip_version | — | num/RLF advanced `:470` (works) |
| query_type | — | RLF primary `:1250` OK |
| network | — | RLF advanced `:471` OK |
| auth_user | — | RLF advanced `:472` OK |
| protocol | — | RLF advanced `:473` OK |
| domain / domain_suffix / domain_keyword / domain_regex | — | RLF primary `:1251-1254` OK |
| source_ip_cidr / source_ip_is_private | 1.8 | RLF/chk advanced `:477-478` OK |
| source_port / source_port_range / port / port_range | — | RLF advanced `:482-485` OK |
| process_name / process_path / process_path_regex | 1.10 | RLF advanced `:486-488` OK |
| package_name | — | RLF advanced `:489` OK |
| **package_name_regex** | 1.14 | **none** — not in any list; array→scalar fallback can't show it. [P1] |
| user / user_id | — | RLF advanced `:490-491` OK |
| clash_mode | — | RLF advanced `:492` OK |
| network_type / network_is_expensive / network_is_constrained | 1.11 | RLF/chk advanced `:493-495` OK |
| **interface_address** | 1.13 | **none** — object field; not listed and `AdvancedNonScalarFields` not rendered → silently dropped from editor on import. [P1] |
| **network_interface_address** | 1.13 | **none** — same as above. [P1] |
| **default_interface_address** | 1.13 | **none** — array field; same. [P1] |
| source_mac_address / source_hostname | 1.14 | RLF SharedRuleFields `:940-948` OK (**pass-1 STALE** — claimed missing) |
| **preferred_by** | 1.14 | **none** in dnsRuleAdvancedFields (present only in `routeRuleAdvancedFields:465`). array→no fallback. [P1] |
| wifi_ssid / wifi_bssid | — | RLF SharedRuleFields `:937-938` OK |
| rule_set | 1.8 | RLF primary `:1255` OK |
| rule_set_ip_cidr_match_source | 1.10 | chk advanced `:496` OK |
| **match_response** | 1.14 | **none** authoring control (diagnostics read it `:373`, but no field to set it). [P1] |
| ip_accept_any | 1.12 | chk advanced `:481` OK (legacy AF, fine) |
| ip_cidr / ip_is_private | 1.9 (legacy 1.14) | RLF/chk advanced `:479-480`; deprecation handled via diagnostic `:374`. OK-ish [P2: no inline label] |
| rule_set_ip_cidr_accept_empty | 1.10 (depr 1.14) | chk advanced `:497` OK |
| invert | — | chk primary `:1320` OK |
| outbound (depr/removed 1.14) | — | not authorable; diagnostic warns on import `diagnostics.ts:362`. Correct. |
| geosite / source_geoip / geoip (removed) | — | RLF advanced `:474-476` — authorable with NO deprecation label. [P2] |
| **response_rcode / response_answer / response_ns / response_extra** | 1.14 | **none** — string + 3 arrays; not listed; arrays invisible to scalar fallback. [P1] |
| type (logical) | — | sel primary `:1208` OK |
| mode | — | sel (logical) `:1227` OK |
| rules (logical) | — | **raw JSON textarea `:1234`; on parse failure writes the raw STRING into `rules`** (`:1240`) → invalid-JSON write into canonical state. Note the safer `InlineRuleSetEditor` (`:733`) exists but isn't used here. [P1] |

Action fields (`rule_action.md`):

| Action field | Action | UI state |
|---|---|---|
| action (required) | all | sel `:1262` w/ route/evaluate/respond/route-options/reject/predefined. OK |
| server (required) | route, **evaluate** | sel gated `=== "route"` only `:1279`; **evaluate hides it and the action-change handler clears `rule.server` for any non-route action `:1267`**. evaluate server is unsettable + auto-wiped. [P0] |
| strategy (depr 1.14) | route | **none** (string→scalar fallback only on import). [P2] |
| disable_cache | route/route-options/evaluate | chk, but lives in `dnsRuleAdvancedFields:498` ("Advanced match fields") — shown for ALL actions incl reject/predefined where invalid; category error. [P1] |
| rewrite_ttl | route/route-options/evaluate | num advanced `:499` — same misplacement. [P1] |
| client_subnet | route/route-options/evaluate | RLF advanced `:500` — same misplacement (and RLF coerces to array; client_subnet is a string/prefix → wrong type write). [P1] |
| disable_optimistic_cache | 1.14 route/options/eval | **none**. [P1] |
| timeout | 1.14 route/options/eval | **none** (string→scalar fallback only on import). [P2] |
| method | reject | sel default/drop `:1296` OK |
| no_drop | reject | chk `:1302` OK |
| rcode | predefined | sel 6 codes `:1310` OK |
| answer / ns / extra | predefined | **none** — arrays; no repeater, no JSON editor here. predefined records cannot be authored. [P1] |
| (respond — no fields) | respond | sel option exists `:1273`; renders nothing (correct) but no "requires preceding evaluate" hint. [P2] |
| evaluate gating note | — | evaluate/respond selectable on any channel; only matcher fields get a testing-only diagnostic (`diagnostics.ts:1274`), evaluate/respond actions do NOT. [P1] |

Round-trip/validation notes:
- Action-change handler `:1264-1268` only clears `server`; it leaves `method`/`no_drop`/`rcode`/`rewrite_ttl`/etc. behind when switching action, so e.g. route→reject keeps a stale `rewrite_ttl` and reject→route keeps `method`/`no_drop` in exported JSON. [P1]
- testing-only matcher diagnostics correctly cover source_mac_address/source_hostname/preferred_by/match_response/package_name_regex (`diagnostics.ts:1274-1294`). **pass-1 STALE** (claimed "no version gate").
- legacy-address-filter + mixed-legacy/modern conflict diagnostics exist (`diagnostics.ts:374,388`). **pass-1 STALE** (claimed absent).

## Findings (prioritized)
- [P0] `server` unsettable for `evaluate`: control gated to `route` only and the action-change handler wipes `rule.server` for non-route actions. sing-box requires `server` for `evaluate`. `src/components/Inspector.tsx:1267`, `:1279`. (Fix: gate select on `route||evaluate`; only clear server when next action ∉ {route,evaluate}.)
- [P0] Canvas always draws the "DNS server" output handle regardless of action (port specs ignore action), even though the edge is correctly suppressed for reject/predefined/respond/route-options. Misleading + lets users write a no-op `server`. `src/components/SbcNode.tsx:94`, `src/domain/portRelationRegistry.ts:101` (vs the gated edge at `src/canvas/graph.ts:604-608`).
- [P1] Inspector never renders object/array fields: `interface_address`, `network_interface_address`, `default_interface_address`, `preferred_by`, `package_name_regex`, `match_response`, Response Match Fields (`response_rcode/answer/ns/extra`), and predefined `answer/ns/extra` are all unauthorable AND dropped from view on import — `AdvancedNonScalarFields` (`src/components/Inspector.tsx:820`) is defined but not used in `DnsRuleInspector` (`:1327` renders only `AdvancedScalarFields`).
- [P1] Action options (`disable_cache`, `rewrite_ttl`, `client_subnet`) are mis-categorized as "Advanced match fields" and shown for every action incl reject/predefined; `client_subnet` is also written as an array via RLF (should be string/prefix). `src/components/Inspector.tsx:498-500`.
- [P1] No version gate on `evaluate`/`respond` actions or on `disable_optimistic_cache`/`timeout`/response_* — selectable on stable channel → invalid config. `src/components/Inspector.tsx:1272-1273`; testing diag only covers matchers `src/domain/diagnostics.ts:1274`.
- [P1] Logical `rules` raw-JSON editor writes the raw string into `rules` on parse failure (invalid-JSON write into canonical state); safer `InlineRuleSetEditor` exists but is unused. `src/components/Inspector.tsx:1234-1242`.
- [P1] Action-change does not clear now-invalid sibling action fields (stale `method`/`no_drop`/`rcode`/`rewrite_ttl` survive switches). `src/components/Inspector.tsx:1264-1268`.
- [P1] Relationship model stores `server` at deprecated rule level (`/dns/rules/*/server`) rather than `action.server` (1.11+). `src/domain/portRelationRegistry.ts:101`, `src/domain/referenceRegistry.ts:340`, `src/domain/diagnostics.ts:340`.
- [P1] No diagnostic for `action:"route"`/`"evaluate"` with empty `server` (required). Existing check only fires when a non-empty server is missing from the server set. `src/domain/diagnostics.ts:340`.
- [P2] Removed `geosite`/`source_geoip`/`geoip` authorable with no deprecation label. `src/components/Inspector.tsx:474-476`.
- [P2] `strategy` (deprecated 1.14) and `timeout` (1.14) have no dedicated control (scalar fallback only on import). `src/components/Inspector.tsx` (absent from `dnsRuleAdvancedFields:469`).
- [P2] `respond` shows no "requires preceding evaluate rule" hint; `predefined`/legacy `ip_cidr` lack inline deprecation/required affordances. `src/components/Inspector.tsx:1307`,`:1279`.
- [P2] Palette entry exposes raw `status:"table"` keyword instead of user-facing copy. `src/components/Palette.tsx:81`.

SUMMARY: 2 P0, 8 P1, 4 P2.
