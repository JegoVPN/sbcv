# sbc-ui pass-2 — phased remediation plan

## Overview
Pass 2 produced ~38 P0s (21 node-conformance + 17 feature-UX, minus de-dup), ~232 P1s, and ~315 P2s
across 66 node reviews, the relationship audit, and 6 feature reports. **Leverage thesis:** ~20 of the
21 node P0s and a large share of P1s collapse into ~8 structural root causes (T1 shared-card role split,
T3 type-switch confirm, T4 JsonField, T5 required+gate, T6 blank rows, T7 icon-from-relation, T8 dead
chips, T9 warning glyph, T10 version gating, T11 ref-registry, T13 detour guards, T14 endpoint outbound
half). Phases are ordered **guardrails (P0) → structural root-cause (P1) → residual node P0/P1 (P2) →
UX comprehension (P3) → polish (P4)**: land cheap regression tests first so each structural fix has a
failing-then-green target and its blast radius is visible.

---

## Phase 0 — Guardrail tests (land first; cheap; prevent regression + surface blast radius)

**W1: referenceRegistry-completeness test**
- Root cause: T11
- Closes: surfaces all of _RELATIONSHIPS (b) — inbound `detour`, shadowtls `handshake.detour`, tun `route_address_set`/`route_exclude_address_set`, route-rule `resolve.server`, derp `mesh_with`/`verify_client_url` detours; rule-set-remote P0 #1.
- Files: `tests/reference-registry-completeness.test.ts` (new); asserts against `src/domain/referenceRegistry.ts:325-371`.
- Change: encode the upstream tag-reference list (matrix "Ref" col, _RELATIONSHIPS.md:22-58) as a fixture of `{kind, path}` pairs; assert every expected path appears in the matching `REFERENCE_KINDS[].paths`. Mark currently-missing paths as `.fails`/`todo` so the list is explicit and W12 flips them green.
- Test: this IS the test.
- Effort: S  Risk: low  Depends on: none

**W2: compatible-chip ↔ createCompatible coverage test**
- Root cause: T8
- Closes: dead chips on selector/urltest (16), derp "Tailscale Endpoint", ssm-api "Shadowsocks Inbound".
- Files: `tests/compatible-chip-coverage.test.ts` (new); reads chip strings `src/canvas/graph.ts:227,257,293,405-428,524,594,641,669` and branches `src/state/useProjectStore.ts:801-808`.
- Change: collect the union of all `compatible:[...]` string literals; assert each has a handled branch in `createCompatible`. Handled today: Route/Direct/Block/Selector/URLTest/SOCKS/DNS Server/DNS Tailscale Server.
- Test: this IS the test.
- Effort: S  Risk: low  Depends on: none

**W3: shared-card role-correctness test**
- Root cause: T1/T2
- Closes: guards W6; locks in that inbound TLS never emits client-only fields and vice-versa.
- Files: `tests/shared-field-role.test.ts` (new); drives `sharedFieldDefinitions`/`SharedFieldCards` in `src/components/Inspector.tsx:1502-1625`, sets `src/domain/sharedFieldRegistry.ts:144-159`.
- Change: for `group="tls"` assert the field spec for `ref.kind="inbound"` excludes `insecure/disable_sni/utls.*/fragment*/record_fragment/certificate_public_key_sha256/reality.public_key/reality.short_id/ech.config*` and includes server fields `client_certificate*/ech.key*`; the inverse for `ref.kind="outbound"`. Same shape assertions for `multiplex` (4 outbound-only fields) and `v2ray-transport` (per-type). Mark `.fails` until W6.
- Test: this IS the test.
- Effort: M  Risk: low  Depends on: none

**W4: no-invalid-JSON-write test for JsonField**
- Root cause: T4
- Closes: guards W8; JsonField, ssm-api servers/endpoint-mapping, logical-rules editors.
- Files: `tests/json-field-parse.test.ts` (new); `src/components/Inspector.tsx:794-818`.
- Change: render JsonField, type unparseable text, assert `onChange` is NOT called with a raw string (or that last-valid value is retained + a `role="alert"` shows). Mark `.fails` until W8.
- Effort: S  Risk: low  Depends on: none

**W5: port-guard + node-status-glyph snapshot tests**
- Root cause: T13/T9
- Closes: guards W14 (detour guards) + W10 (warning glyph).
- Files: extend `tests/sbc-node-ports.test.ts:12-40` (add `dns-server` types fakeip/hosts/resolved/tailscale → outputKeys must NOT include `outbound`; `block` outbound → inputKeys must NOT include `detour-target`); new `tests/node-status-icon.test.ts` asserting `status="warning"` renders a distinct (non-`CheckCircle2`) glyph (`src/components/SbcNode.tsx:386,413`).
- Effort: S  Risk: low  Depends on: none

---

## Phase 1 — Structural root-cause fixes (each closes many findings)

**W6: Split shared TLS/multiplex/transport cards by `ref.kind`/role (T1+T2)**
- Root cause: T1, T2
- Closes: inbound-vmess P0, inbound-vless P0 #2; CCM/OCM/ssm-api/derp/hysteria-realm inbound-TLS P1s; multiplex-on-inbound P1 (shadowsocks/vmess/vless/trojan); naive TLS-narrowing P1; ~20 client/server TLS P1s; wrong `client_authentication` enum P1 (all inbound TLS nodes); transport-not-type-aware P1 (vmess/vless/trojan in+out). ~6 P0s, ~30 P1s.
- Files: `src/components/Inspector.tsx:1502-1547` (tls), `:1559-1567` (multiplex), `:1578-1610` (transport), field-def builder `:1420-1625`; `src/domain/sharedFieldRegistry.ts:144-159`.
- Change: thread `ref.kind` (+`type`) into `sharedFieldDefinitions`. For tls: branch field list — inbound/server set vs outbound/client set; add server-only `client_certificate`/`client_certificate_path`/`client_certificate_public_key_sha256`/`kernel_tx`/`kernel_rx`/`handshake_timeout`/`ech.key`/`ech.key_path`; drop client-only fields from inbound. Fix `client_authentication` options to `no/request/require-any/verify-if-given/require-and-verify` (`:1524`). For multiplex gate `protocol/max_connections/min_streams/max_streams` to `ref.kind==="outbound"`. For transport gate visible sub-fields on `transport.type` and add http `method`/`headers`, ws `max_early_data`/`early_data_header_name`/`headers`, grpc `permit_without_stream`, httpupgrade `headers` (+`host` single-string for httpupgrade). Narrow naive TLS to `server_name/certificate/certificate_path/ech` (+`enabled`). Remove `tuic` from `outboundUdpOverTcpTypes` (`:155`).
- Test: W3 (flip to passing); add transport per-type case.
- Effort: L  Risk: med  Depends on: W3

**W7: Type-switch confirm + field preservation (T3)**
- Root cause: T3
- Closes: inspector-feature P0 (type-switch data loss); rule-set inline→remote rules-drop P1; vless type-switch-away note.
- Files: `src/domain/commands.ts:902-968`; `src/components/Inspector.tsx:2109-2164` (the `<select>` at `:2113`).
- Change: before `changeEntityType` replaces the entity, show a confirm ("changing type resets fields not shared by both types — continue?") listing fields that will be dropped; preserve common fields where types overlap (server/server_port/tls already partially done — broaden). For rule-set inline→remote/local warn that `rules[]` will be discarded (`commands.ts:958-966`).
- Test: new `tests/type-switch-confirm.test.ts` — switching type with a confirm-decline leaves entity unchanged; accept drops only non-shared keys.
- Effort: M  Risk: med  Depends on: none

**W8: JsonField parse feedback — never write unparseable text (T4)**
- Root cause: T4
- Closes: inspector P0; ssm-api servers-corruption P1; outbound/inbound `fallback_for_alpn` P1; shadowtls `handshake_for_server_name` P1; rule-set duplicate-rules-editor P1; dns-rule logical-rules P1; route-rule logical-rules P1.
- Files: `src/components/Inspector.tsx:794-818` (mirror `InlineRuleSetEditor` `:733-783`).
- Change: on parse failure, keep last-valid value and show `role="alert"` hint; do NOT call `onChange(rawString)`. Then add `"rules"` to `ruleSetHandledFields` (`:305`) and route the dns/route logical-rules editors (`:1234-1242`) through the safe field.
- Test: W4 (flip to passing).
- Effort: S  Risk: low  Depends on: W4

**W9: Required-field markers + pre-export validation gate (T5)**
- Root cause: T5
- Closes: every "listen not marked/validated" P1 (inbound socks/http/mixed/redirect/tproxy/hysteria/hysteria2/ssh/ccm/ocm/hysteria-realm); server/uuid/password/method "no required marker" P1s (outbound vmess/vless/tuic/anytls/shadowsocks/ssh/naive, dns-server `server`); export P0/P1s in io-topbar + diagnostics.
- Files: `src/components/Inspector.tsx` field builders (add `required` to `SharedFieldDefinition` `:1354-1361` and to per-node controls e.g. `:1436` listen, `:3376/3385/3428` outbound, `:4278` dns-server); `src/components/TopBar.tsx:98-107,199-202` (export); `src/domain/diagnostics.ts` (add `inbound-listen-required`, `outbound-missing-password` for anytls, tuic uuid, ssh port-optional fix `:544-553`, shadowsocks method/password).
- Change: render `*` + `aria-required` on required fields; add the missing presence diagnostics; on Export, if `diagnostics` has any `error`, show a confirm/warn before download (or disable + tooltip).
- Test: new `tests/required-and-export-gate.test.ts` — empty `listen`/`server`/`uuid` yields an error diagnostic; export with errors triggers the gate.
- Effort: L  Risk: med  Depends on: none

**W10: Warning iconography + "✓ N" relabel (T9)**
- Root cause: T9
- Closes: canvas P1 (warning shows green check), diagnostics P0 (warning looks valid) + P1 (✓N chip), settings/multiple "meaningless primary count" P2s.
- Files: `src/components/SbcNode.tsx:386,413,436`; CSS `src/styles.css:1037,1241,1318`.
- Change: status glyph ternary → 3-way (`error`→CircleAlert, `warning`→amber TriangleAlert, else CheckCircle2) at both `:386` and `:413`; relabel/remove the footer `compatible.length||1` chip (`:436`) — it is a create-count, not a validity count; either drop it or label "+N add".
- Test: W5 node-status-icon test (flip to passing).
- Effort: S  Risk: low  Depends on: W5

**W11: Wire `version` into validateConfig (T10)**
- Root cause: T10
- Closes: diagnostics P0 (version never validated); OCM/CCM version-gate P0s; endpoint-tailscale `system_interface`/`advertise_tags` false-positives; settings-certificate `store=chrome` false-positive; dns-server-tailscale `accept_search_domain` gate.
- Files: `src/state/useProjectStore.ts:134-135` (`computeDiagnostics`), `src/domain/diagnostics.ts:18-21` (`validateConfig` signature), `src/domain/targets.ts:11-14`; existing version-conditional rules `diagnostics.ts:1060,1180-1202`.
- Change: pass the full target (or `version`) into `validateConfig`; change `*-1-13-only`/`*-testing-only` rules to compare actual `version`/`channel` (warn on 1.12 target, not on 1.13). Add 1.12-target errors for CCM/OCM (1.13.0+) mirroring hysteria-realm `:228-236`.
- Test: extend `tests/singbox-check-policy.test.ts` — 1.12 vs 1.13 produce different diagnostics; 1.13-only field clean on 1.13, warns on 1.12.
- Effort: M  Risk: med  Depends on: none

**W12: referenceRegistry completeness — add missing paths (T11)**
- Root cause: T11
- Closes: rule-set-remote P0 #1; route-rule `resolve.server` P1; inbound `detour` P1; shadowtls `handshake.detour` P1; tun `route_*_set` P1 (inbound-tun/rule-set-*); derp mesh/verify detours P2.
- Files: `src/domain/referenceRegistry.ts:327-358` + replace/remove helpers `:123-188`.
- Change: add `/inbounds/*/detour` to inbound kind; `/route/rules/*/server` to dns-server kind; `route_address_set`/`route_exclude_address_set` (inbound-scoped) to rule-set kind; nested-detour scanning for shadowtls `handshake.detour`/`handshake_for_server_name.*.detour` and derp `mesh_with[].detour`/`verify_client_url[].detour` under outbound kind; ensure `replaceRuleSetRefs`/`removeRuleSetRefs` handle list-valued fields.
- Test: W1 (flip the marked paths to passing).
- Effort: M  Risk: med  Depends on: W1

**W13: Blank-row seeding — kv repeaters seed valid placeholder / drop empty keys (T6)**
- Root cause: T6
- Closes: inspector P0 (`{"":""}` rows); headers/naive extra_headers/DoH headers/torrc P1s; ssm-api/rule-set headers empty-key P1s.
- Files: `src/components/Inspector.tsx:3797,3857,4519,3355` (and torrc rename guard `:3318`); align with the correct hosts `addRow` `:4413-4424` / ccm `addHeader` `:5150-5157`.
- Change: seed a real placeholder key (or use a draft-row committed on key-blur); on write, filter out entries whose key is empty/whitespace so `{"":""}` never exports.
- Test: new `tests/kv-repeater-no-empty-key.test.ts` — adding then leaving a row blank exports no empty-key entry.
- Effort: S  Risk: low  Depends on: none

**W14: Dial-detour type guards on canvas ports (T13)**
- Root cause: T13
- Closes: dns-server-detour spurious port (fakeip/hosts/resolved/tailscale) — _RELATIONSHIPS P1-a, dns-server-tailscale P1-1, dns-server-resolved P1; `block` as detour-target input P2-f.
- Files: `src/domain/portRelationRegistry.ts:105` (dns-server-detour), `:106/108/115` (detour-target targets).
- Change: add `nodeTypeExcludes:["fakeip","hosts","resolved","tailscale"]` to both endpoints of `dns-server-detour`; add `nodeTypeExcludes:["block","selector","urltest","dns"]` to the `detour-target` target endpoints. Aligns canvas with `sharedFieldRegistry` dnsServerDialTypes/outboundDialTypes.
- Test: W5 port-guard cases (flip to passing).
- Effort: S  Risk: low  Depends on: W5

**W15: Port icon derived from relation/target-kind (T7)**
- Root cause: T7
- Closes: canvas P0 (icon inconsistency), palette/relationships icon P2s.
- Files: `src/components/SbcNode.tsx:104` (`portIconMap[endpoint.icon]`), `src/domain/portRelationRegistry.ts:90-116` (icon literals).
- Change: stop reading per-endpoint `icon` literals; derive the handle glyph from the relation's target-kind (one icon per referenced kind) so both ends of an edge match and all "→ outbound" inputs share a glyph.
- Test: new `tests/port-icon-by-kind.test.ts` — all input ports targeting `outbound` resolve to one icon; an edge's two ends share a relation icon.
- Effort: M  Risk: low  Depends on: none

**W16: Dead "+"/chip + blind mid-card "+" affordance (T8)**
- Root cause: T8
- Closes: canvas P0 (16 dead chips + blind `+`); derp/ssm-api dead-chip P1s; hub-route/outbound-urltest "fictional compatible list" P1s; readonly-handle dead `+` P1 (ssm-api/derp service input).
- Files: `src/canvas/graph.ts:257,293,405-428,669` (chip lists), `src/state/useProjectStore.ts:798-836` (`createCompatible`), `src/components/SbcNode.tsx:340,378,392-405` (mid-card `+` + readonly handle `+`).
- Change: either implement the missing `createCompatible` branches (add proxy/endpoint creators for the advertised kinds) OR prune chip lists to only handled kinds and correct the "fictional" selector/urltest/final lists; suppress the `+`/drag badge for `mode:"readonly"` relations; the mid-card "+" should preview/label what it creates (or be removed in favor of the chip rail).
- Test: W2 (flip to passing).
- Effort: M  Risk: med  Depends on: W2

**W17: Endpoint outbound-half — input ports + outbound-kind awareness (T14)**
- Root cause: T14
- Closes: _RELATIONSHIPS P1-b (endpoint not wireable as route/selector/dns target), P2-c (route.final endpoint); endpoint-wireguard/endpoint-tailscale link findings.
- Files: `src/domain/referenceRegistry.ts:157-176` (make outbound kind endpoint-aware), `src/state/useProjectStore.ts:544,608` (connect resolves only `config.outbounds`), `src/domain/portRelationRegistry.ts` (add endpoint input ports for route/selector/urltest/dns-detour).
- Change: treat endpoint tags as valid referents in `route.final`/`route.rules[].outbound`/selector-urltest `outbounds[]`/`dns.servers[].detour`; give endpoints the matching input ports + connect handlers; validate endpoint-as-target.
- Test: extend `tests/sbc-node-ports.test.ts` endpoint cases + a connect test wiring route.final→endpoint.
- Effort: L  Risk: high  Depends on: W12

---

## Phase 2 — Residual node P0/P1 NOT covered by Phase 1

**W18: dns-rule `evaluate.server` unsettable + action-blind port (rule-dns-rule P0×2)**
- Root cause: node-specific
- Closes: rule-dns-rule P0 (server gated to route-only + wiped for evaluate; `Inspector.tsx:1267,1279`), P0 (DNS-server output handle drawn for every action vs gated edge `graph.ts:604-608`).
- Files: `src/components/Inspector.tsx:1267,1279`; `src/components/SbcNode.tsx:94`; `src/domain/portRelationRegistry.ts:101`.
- Change: gate server select on `route||evaluate`; only clear `rule.server` when next action ∉ {route,evaluate}; make the dns-server port action-aware (suppress for reject/predefined/respond/route-options).
- Test: extend `tests/domain.test.ts` rule-action handling.
- Effort: M  Risk: low  Depends on: none

**W19: rule-set-inline `rules[]` structured editor (rule-set-inline P0)**
- Root cause: node-specific
- Closes: rule-set-inline P0 (only freeform JSON for the required payload).
- Files: `src/components/Inspector.tsx:733-784,5320-5325`; reuse route/dns rule editors `:872+`, `src/components/RuleTables.tsx:111-153`.
- Change: render per-rule add/remove + headless match-field controls + and/or builder for inline `rules[]`.
- Test: extend RuleTables tests.
- Effort: L  Risk: med  Depends on: W8

**W20: rule-set-remote `http_client` object-form destroyed by select (rule-set-remote P0 #2)**
- Root cause: node-specific
- Closes: rule-set-remote P0 #2.
- Files: `src/components/Inspector.tsx:1596-1600,1669`.
- Change: detect `typeof http_client === "object"` → render read-only/JSON fallback instead of overwriting with a bare string.
- Test: extend shared-field test.
- Effort: S  Risk: low  Depends on: none

**W21: ccm/ocm duplicate detour control (service-ccm P0, service-ocm P0-1)**
- Root cause: node-specific (relationships P1-e)
- Closes: service-ccm P0, service-ocm P0-1 (two controls write `/services/*/detour`, wrong "Inbound Detour" label).
- Files: `src/components/Inspector.tsx:114,1449` (listen-group detour), `:5072-5085` (API detour).
- Change: skip the listen-group `detour` for ccm/ocm (type redefines `detour` as outbound); keep only the API-outbound select. Also gate `graph.ts:676-678` so the outbound `service-detour` edge fires only for ccm/ocm, and stop rendering listen-group detour for hysteria-realm/derp (relationships rec 5).
- Test: shared-field/Inspector render test for ccm/ocm.
- Effort: S  Risk: low  Depends on: none

**W22: endpoint-tailscale `system_interface` bool/string (endpoint-tailscale P0×2)**
- Root cause: node-specific
- Closes: endpoint-tailscale P0 (string control for a boolean field, `system_interface_name` has no control), P0 (1.13 gate never fires for boolean).
- Files: `src/components/Inspector.tsx:4718-4727`; `src/domain/commands.ts:589`; `src/domain/diagnostics.ts:1193-1201`; `endpointHandledFields`.
- Change: make `system_interface` a checkbox; add a separate `system_interface_name` text input (1.13-gated); add `system_interface_name` to `endpointHandledFields`; gate the diagnostic on `system_interface === true`.
- Test: extend domain test for endpoint seed + diagnostic.
- Effort: S  Risk: low  Depends on: W11

**W23: dns-server-tailscale `accept_search_domain` control (dns-server-tailscale P0-1)**
- Root cause: node-specific
- Closes: dns-server-tailscale P0-1 (1.14 field unreachable).
- Files: `src/components/Inspector.tsx:4352-4378`; `src/domain/commands.ts:669-675`; `dnsServerHandledFields` `:241-260`.
- Change: render a testing-channel-gated `accept_search_domain` toggle beside `accept_default_resolvers`; add to handled fields.
- Test: Inspector render test (tailscale, testing channel).
- Effort: S  Risk: low  Depends on: W11

**W24: hub-route `default_network_type` string-into-array + duplicate controls (hub-route P0)**
- Root cause: node-specific
- Closes: hub-route P0 (string written to array field), plus the duplicate `default_network_strategy`/`default_network_type` P1s.
- Files: `src/components/Inspector.tsx:1896-1922` (hardcoded controls) vs dial-group `:1460-1461`; `src/domain/types.ts:95`.
- Change: delete the hardcoded text/select pair; rely on the dial-group `list` control; fix `types.ts:95` to `string[]`; reconcile option sets (`networkStrategyOptions` `:1363`).
- Test: extend domain test for route default_network_type shape.
- Effort: S  Risk: low  Depends on: none

**W25: inbound-redirect platform banner (inbound-redirect P0×2)**
- Root cause: node-specific
- Closes: inbound-redirect P0 (banner says Linux-only, upstream is Linux+macOS), P0 (duplicate banner).
- Files: `src/components/Inspector.tsx:2591-2595,2962-2967`.
- Change: fix redirect copy to "Linux / macOS only (iptables REDIRECT / pf)"; remove the duplicate; once split, the shared `tproxy||redirect` banner becomes tproxy-only.
- Test: Inspector render test (redirect banner text).
- Effort: S  Risk: low  Depends on: none

**W26: inbound-vless over-eager TLS default (inbound-vless P0 #1)**
- Root cause: node-specific
- Closes: inbound-vless P0 #1 (seeds `tls:{enabled:true}` though TLS is optional).
- Files: `src/domain/commands.ts:214`.
- Change: seed vless inbound without `tls` (match vmess `:155`).
- Test: extend domain test for createInbound("vless").
- Effort: S  Risk: low  Depends on: none

**W27: settings-experimental v2ray build-tag label (settings-experimental P0)**
- Root cause: node-specific
- Closes: settings-experimental P0 (banner says `v2rayapi`, upstream is `with_v2ray_api`).
- Files: `src/components/Inspector.tsx:2513`.
- Change: fix banner text to `with_v2ray_api`.
- Test: Inspector render assertion (cheap; optional).
- Effort: S  Risk: low  Depends on: none

**W28: Residual node P1 batch — DNS-server / inbound / outbound / rule / service**
- Root cause: node-specific (grouped P1s not closed by Phase 1)
- Closes (by category): **dns-server**: inet4/inet6 CIDR-shape + fakeip 1.12 gate + `optimistic` object form + dns-server domain-resolver warning (`diagnostics.ts:441-452`→servers) + missing-tag diagnostic; **inbound**: per-type bandwidth/obfs/users version-gating + congestion/zero_rtt/auth_timeout controls (hysteria/hysteria2/tuic/shadowtls/anytls/shadowsocks), `set_system_proxy` socks-leak + privilege caveat, `network` rendered-twice (tproxy/direct), tun `dns_mode`/UID-array/`platform.http_proxy` required, masquerade object mode, tproxy/redirect platform diagnostic; **outbound**: ssh `private_key` multi-line + `data_directory` recommended, tor build-tag diagnostic, hysteria v1 `server_ports`/exclusivity, shadowsocks udp_over_tcp⇔multiplex, certificate empty-array export noise; **rule**: route-rule bypass-outbound select + geo deprecation + resolve/route-options sub-fields + port/CIDR structured repeaters; **service**: derp verify-client-endpoint wipe (`useProjectStore.ts:1367-1382`), ssm-api `/` key collision + orphan `managed`, hysteria-realm section order.
- Files: see each cited node review (`docs/ui-reviews-pass2/<node>--claude.md` Findings) for exact `file:line`.
- Change: implement per the node review's stated fix; many are "add control + add to handledFields + add diagnostic".
- Test: extend `tests/domain.test.ts` / per-node render tests as touched.
- Effort: L (split into per-category PRs)  Risk: med  Depends on: W6, W8, W9

---

## Phase 3 — UX comprehension (P1/P0 from _FEATURE-*)

**W29: Palette empty-state / jargon / dead "Docs" rows / search (palette P0×3 + P1×5)**
- Root cause: node-specific (feature)
- Closes: palette P0 (empty first-run), P0 (~10 dead `docs` rows), P0 (permanently-gated rows no path), P1 (jargon badges), P1 (Add vs Setup), P1 (search ignores Templates), P1 (no template docs), P1 (no add affordance).
- Files: `src/components/Palette.tsx:291-293,240-265,279-287,310-321,458-487`.
- Change: expand one populated section (or Templates) by default; visually separate/disable-clearly the `docs`-only rows; humanize status badges + add "click to add" affordance; include Templates in search; add template descriptions/docs links.
- Test: extend Palette render test.
- Effort: M  Risk: low  Depends on: none

**W30: Canvas connect/disconnect discoverability + edge legend (canvas P1×3)**
- Root cause: node-specific (feature)
- Closes: canvas P1 (drag undiscoverable + silent invalid-drop), P1 (no edge legend), P1 (disconnect hidden behind Delete).
- Files: `src/components/SbcNode.tsx:322-337,360-378`; `src/components/CanvasWorkspace.tsx:69-79`; `src/styles.css:1191-1215,1409-1412`.
- Change: add a visible "drag to connect" affordance on handles; toast on invalid drop; add an edge legend explaining animated=primary path; add hover-x/right-click disconnect.
- Test: CanvasWorkspace interaction test.
- Effort: M  Risk: med  Depends on: none

**W31: Mobile add/connect path + parity disclosure (mobile P0×3)**
- Root cause: node-specific (feature)
- Closes: mobile P0 (no add path), P0 (connect undiscoverable on touch), P0 (no first-run state), mobile P1 (sheet scroll-trap), P1 (template choice basis).
- Files: `src/App.tsx:13-22`; `src/components/CanvasWorkspace.tsx:130-178`; `src/components/SbcNode.tsx:392-465`; `src/styles.css:2123-2133`.
- Change: render an add surface on mobile (palette sheet or tap→inline chips); a touch connect mode; default menu/templates sheets to `full` or give scrollable body; surface template docs.
- Test: extend `tests/mobile-layout.test.tsx`.
- Effort: L  Risk: med  Depends on: none

**W32: Onboarding / empty state + Import/Templates confirm + undo + feedback (io-topbar P0×2 + mobile)**
- Root cause: node-specific (feature)
- Closes: io-topbar P0 (import destroys work no confirm), P0 (import success/failure invisible), io-topbar P1 (no onboarding, no New/Clear); templates destructive-on-tap P1; aligns with T3 confirm-on-destructive thesis.
- Files: `src/state/useProjectStore.ts:1532-1550,684-697`; `src/components/TopBar.tsx:109-120`; `src/components/MobileMenuSheet.tsx`/`MobileTemplatesSheet.tsx`; add a toast/`aria-live` surface (none exists in `src/`).
- Change: confirm before Import/Template-load replaces config; add an undo (snapshot) for the replace; add a toast/aria-live for success/failure; add an empty/welcome state + "New/Clear".
- Test: store test for import-confirm/undo; render test for toast.
- Effort: L  Risk: med  Depends on: none

**W33: Template REPLACE_ME secrets + diagnostic (mobile/templates P2 → elevated)**
- Root cause: node-specific (feature)
- Closes: templates ship `REPLACE_ME_PASSWORD`/dummy secrets with no guidance (mobile P2, io-topbar data-safety).
- Files: `src/domain/templates.ts:108,116,128,...`; `src/domain/diagnostics.ts:267-275` (existing change-me pattern).
- Change: strip/clearly mark placeholder secrets in shipped templates; emit a warning diagnostic when a known placeholder secret remains before export.
- Test: extend diagnostics test for placeholder-secret warning.
- Effort: S  Risk: low  Depends on: none

---

## Phase 4 — P2 polish (batched, one-liners)

**W34: Diagnostics/labels polish batch**
- Root cause: node-specific
- Closes: target glossary tooltip (diagnostics P2), message-over-code hierarchy (P2), official-check focus path "" (diagnostics P1), mobile diagnostics focus (P1), goHome "return to home" mislabel (io-topbar P2), `Selected {id}` raw-id pill (canvas/mobile P2), titlebar machine-jargon `kind/type` (canvas P1), mobile 36px touch targets (P2), round-trip-fidelity reassurance copy (P2).
- Files: `src/components/DiagnosticsPopover.tsx`, `MobileTopBar.tsx:108-113`, `useProjectStore.ts:1599+,653-658`, `CanvasWorkspace.tsx:181`, `SbcNode.tsx:291`, `src/styles.css:2016-2047`.
- Change: per each one-liner in the cited reports.
- Effort: M (batched)  Risk: low  Depends on: none

**W35: Per-node P2 cleanup batch (~285 node P2s)**
- Root cause: node-specific
- Closes: icon mismatches, subtitle genericism, export empty-string/empty-array noise, deprecated-field migration hints, copy accuracy — harvested from each `<node>--claude.md` `## Findings` P2 lines.
- Files: as cited per node review.
- Change: address opportunistically alongside the matching phase-1/2 work item touching the same file.
- Effort: L (incremental)  Risk: low  Depends on: none

---

## Sequencing
1. **W1–W5 (Phase 0)** first — cheap tests that turn every structural fix into a red→green target and print the full blast radius. Land as one PR.
2. **W6 (shared-card split)** — single biggest conformance lever (~6 P0 + ~30 P1).
3. **W8 + W9 + W13** — the "silent invalid export" class (JsonField, required+gate, blank rows): broad P0/P1 coverage, low risk.
4. **W11 + W12** — version gating and reference-registry completeness unblock W22/W23 and the residual ref P1s.
5. **W7, W10, W14, W16** — destructive-confirm, warning glyph, port guards, dead chips: high comprehension payoff, mostly small.
6. Then **W17, W15** (endpoint outbound-half is the riskiest; do after refs land), Phase 2 node P0s, Phase 3 UX, Phase 4 polish.

## Traceability
Every P0 maps to a work item:
- Shared TLS/multiplex/transport (T1/T2) inbound-vmess, inbound-vless#2, ccm/ocm/ssm-api/derp/hysteria-realm TLS → **W6**.
- Type-switch (inspector) → **W7**. JsonField (inspector) → **W8**. Required+export gate (inspector, io-topbar, diagnostics) → **W9**.
- Blank `{"":""}` rows (inspector) → **W13**. Warning glyph (canvas, diagnostics) → **W10**. Version (diagnostics) → **W11**.
- Icon inconsistency (canvas) → **W15**. Dead chips + blind "+" (canvas) → **W16**.
- rule-dns-rule ×2 → **W18**; rule-set-inline → **W19**; rule-set-remote ×2 → **W12 (route_*_set) + W20 (http_client)**.
- service-ccm + service-ocm P0-1 → **W21**; service-ocm P0-2 (version) → **W11**.
- endpoint-tailscale ×2 → **W22**; dns-server-tailscale P0-1 → **W23**; hub-route → **W24**; inbound-redirect ×2 → **W25**; inbound-vless#1 → **W26**; settings-experimental → **W27**.
- Palette ×3 → **W29**; canvas-feature covered by W10/W15/W16/W30; mobile ×3 → **W31**; io-topbar ×2 → **W32**.
- outbound-naive "P0"s are all FIXED/STALE per its review — no action (noted, not mapped to a fix WI).
**Unmapped P0s: none.**

## Effort roll-up
- Work items: Phase 0 = 5, Phase 1 = 12 (W6–W17), Phase 2 = 11 (W18–W28), Phase 3 = 5 (W29–W33), Phase 4 = 2 (W34–W35). **Total 35.**
- Rough size tally: **S ≈ 16**, **M ≈ 12**, **L ≈ 7** (W6, W9, W17, W19, W28, W31, W32; plus W35 incremental).
- Risk: high = W17 only; med = W6/W7/W9/W11/W12/W16/W19/W28/W30/W31/W32; rest low.
