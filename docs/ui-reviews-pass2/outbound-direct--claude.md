# outbound-direct — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The `outbound:direct` node is in good shape end-to-end: palette entry is correct, the canvas node and all 8 input ports + 1 dial-detour output port are accurate, the relationship registries are complete, and the Inspector now renders the full Dial Fields set (20 active + deprecated `domain_strategy`) with deprecation diagnostics for `override_address`/`override_port` and `domain_strategy`. Almost every P0/P1 from pass-1 is now STALE/RESOLVED — `dialSharedFields` was expanded from 8 to 21 fields and `diagnostics.ts` gained the missing deprecation checks. The only remaining gaps are minor: `domain_resolver` object-form is not editable (string-only select), and the deprecated `override_*` fields land in the generic "Advanced fields" accordion with no inline deprecation banner (the diagnostic fires, but the Inspector control itself is unlabeled).

Upstream enumeration (docs/upstream/.../outbound/direct.md): `type`, `tag`, `override_address` (deprecated 1.11), `override_port` (deprecated 1.11), + Dial Fields. There is NO `proxy_protocol` field anywhere in the direct or shared/dial docs — correctly absent from the UI.

## 1. Left Palette
- Present and correct. `Palette.tsx:153` — `{ label: "Direct", kind: "direct", icon: Cable, docsUrl: docs("outbound/direct/"), ready: true }`.
- Category "Outbounds" (`Palette.tsx:151`); label "Direct"; `docsUrl` resolves to `outbound/direct/` (correct page).
- `ready: true` -> `itemStatus()` returns `"add"` (`Palette.tsx:263`); `canActivate()` true (`Palette.tsx:280`); click -> `createFromPalette("direct")`.
- `OUTBOUND_PALETTE_TYPES.direct = "direct"` (`protocols.ts:2`); `preferredOutboundTag("direct")` not in `preferredOutboundTags` map so falls to `${type}-out` = `"direct-out"` (`protocols.ts:234`). Cosmetic only; tag is editable and uniqued.
- Not target-gated (correct — direct exists on all channels). No deprecation marker (correct — the node type itself is not deprecated; only two of its fields are).

## 2. Canvas Node
- Title bar: `"outbound / direct"` (`SbcNode.tsx:291`); icon `CheckCircle2` via `outboundIcon("direct")` (`SbcNode.tsx:53`). Distinct, correct.
- Title = tag, subtitle = `"direct outbound"` (`graph.ts:395,403`); status from `/outbounds/{index}` diagnostics (`graph.ts:404`). Correct.
- `compatible: []` for non-group outbounds (`graph.ts:428`) -> no large `+` button (`SbcNode.tsx:392` guards on `compatible.length > 0`) and no "+ chip" hover row. Correct: direct has no obvious "next object" to spawn.
- Ports are data-driven from `portRelationRegistry.ts` via `portEndpointsForNode` (`SbcNode.tsx:94-108`), NOT hard-coded in SbcNode (pass-1's "SbcNode.tsx lines 104-117" claim is STALE).
- Input ports (8), all matching outbound target endpoints, none excluding direct: `route` (route-final), `route-rule`, `selector-group`, `urltest-group`, `dns-detour`, `detour-target`, `service-detour`, `rule-set-download` (`portRelationRegistry.ts:93,95,103,104,105,106,109,111`). Connectivity wired in `SbcNode.tsx:162-202`.
- Output port (1): `dial-detour` from `outbound-detour` relation source, whose `nodeTypeExcludes` = `["block","selector","urltest","dns"]` (`portRelationRegistry.ts:106`) — direct NOT excluded, so the port renders. Connectivity check `SbcNode.tsx:258-260`. Correct.
- No server/TLS/transport ports for direct (correct — not in schema).

## 3. Upstream/Downstream Links
Official relationship model for a direct outbound tag — incoming refs (referenced-by) and one outgoing (its own dial detour):

| Relationship | Official JSON path | Registry coverage | Status |
| --- | --- | --- | --- |
| Route final | `route.final` | refReg `outbound` paths `/route/final` (`referenceRegistry.ts:334`); portReg `route-final` (`portRelationRegistry.ts:93`) | OK |
| Route rule outbound | `route.rules[].outbound` | `/route/rules/*/outbound` (`:334`); portReg `route-rule` (`:95`) | OK |
| Selector members | `outbounds[selector].outbounds[]` | `/outbounds/*/outbounds` (`:334`); portReg `selector` (`:103`) | OK |
| URLTest members | `outbounds[urltest].outbounds[]` | `/outbounds/*/outbounds` (`:334`); portReg `urltest` (`:104`) | OK |
| Selector/urltest `default` | `outbounds[].default` | `/outbounds/*/default` (`:334`) | OK (refReg-only; no port, acceptable) |
| DNS server detour | `dns.servers[].detour` | `/dns/servers/*/detour` (`:334`); portReg `dns-server-detour` (`:105`) | OK |
| Dial detour (incoming) | `outbounds[].detour`, `endpoints[].detour` | `/outbounds/*/detour`, `/endpoints/*/detour` (`:334`); portReg `outbound-detour`/`endpoint-detour` (`:106,108`) | OK |
| Service detour | `services[].detour` | `/services/*/detour` (`:334`); portReg `service-detour-ccm/-ocm` (`:109,110`) | OK |
| Rule-set download detour | `route.rule_set[].download_detour` | `/route/rule_set/*/download_detour` (`:334`); portReg `rule-set-download` (`:111`) | OK |
| NTP detour | `ntp.detour` | `/ntp/detour` (`:334`); portReg `settings-ntp-detour` readonly (`:115`) -> reuses `detour-target` input | OK |
| Clash external_ui detour | `experimental.clash_api.external_ui_download_detour` | `/experimental/clash_api/external_ui_download_detour` (`:334`) | OK (refReg-only; no canvas port — acceptable, settings node) |
| v2ray stats outbounds | `experimental.v2ray_api.stats.outbounds` | `/.../stats/outbounds` (`:334`) | OK (refReg-only) |
| Own dial detour (outgoing) | `outbounds[direct].detour` | edge emitted `graph.ts:450-452`; port `dial-detour` output | OK |

No missing/extra/wrong links for direct. The `detour-target` input port is shared across three relations (outbound/endpoint/NTP detour) and correctly deduped by `portEndpointsForNode` (`portRelationRegistry.ts:196-205`). Pass-1's separate `service-detour`/`rule-set-download` port-key list matches reality.

## 4. Right Inspector (fields)
Newly-created direct = `{ type, tag }` only (`commands.ts:282`). Inspector renders: Tag (`Inspector.tsx:2094`), Type select from `CREATABLE_OUTBOUND_TYPES` (`:2120-2127`), then the Dial Fields shared card (via `outboundDialTypes` including direct, `sharedFieldRegistry.ts:150,179`), then `AdvancedScalarFields`/`AdvancedNonScalarFields` fallback (`:4210-4211`). One row per official field:

| Official field | Type | Req | UI control | File:line | Status |
| --- | --- | --- | --- | --- | --- |
| `type` | literal `direct` | yes | select (CREATABLE_OUTBOUND_TYPES) | `Inspector.tsx:2121` | OK; type-switch preserves `detour` (`commands.ts:917`) |
| `tag` | string | opt | text (debounced rename) | `Inspector.tsx:2094-2106` | OK |
| `override_address` | string | opt (DEPRECATED 1.11) | not a dedicated control; surfaced via AdvancedScalarFields if imported (not in `outboundHandledFields`) | `Inspector.tsx:4210`; diag `diagnostics.ts:754` | Acceptable; see P2-1 |
| `override_port` | int (DEPRECATED 1.11) | opt | same as above (number input via AdvancedScalarFields) | `Inspector.tsx:4210`; diag `diagnostics.ts:754` | Acceptable; see P2-1 |
| dial `detour` | string (outbound tag) | opt | select of outbound tags (excludes self) | `Inspector.tsx:1478` | OK (not raw text — pass-1 P0 RESOLVED) |
| dial `bind_interface` | string | opt | text | `Inspector.tsx:1479` | OK |
| dial `inet4_bind_address` | string | opt | text | `Inspector.tsx:1480` | OK (pass-1 "missing" STALE) |
| dial `inet6_bind_address` | string | opt | text | `Inspector.tsx:1481` | OK (STALE) |
| dial `bind_address_no_port` | bool (1.13) | opt | boolean (labeled "Linux, 1.13+") | `Inspector.tsx:1482` | OK (STALE) |
| dial `routing_mark` | int/hex | opt | text (labeled Linux) | `Inspector.tsx:1483` | OK (STALE). Text accepts hex `"0x.."`; numeric coercion not forced — fine per spec |
| dial `reuse_addr` | bool | opt | boolean | `Inspector.tsx:1484` | OK (STALE) |
| dial `netns` | string (1.12) | opt | text (Linux,1.12+) | `Inspector.tsx:1485` | OK (STALE) |
| dial `connect_timeout` | duration | opt | text | `Inspector.tsx:1486` | OK |
| dial `tcp_fast_open` | bool | opt | boolean | `Inspector.tsx:1487` | OK (STALE) |
| dial `tcp_multi_path` | bool | opt | boolean | `Inspector.tsx:1488` | OK (STALE) |
| dial `disable_tcp_keep_alive` | bool (1.13) | opt | boolean (1.13+) | `Inspector.tsx:1489` | OK (STALE) |
| dial `tcp_keep_alive` | duration (1.13) | opt | text (1.13+) | `Inspector.tsx:1490` | OK (STALE) |
| dial `tcp_keep_alive_interval` | duration (1.13) | opt | text (1.13+) | `Inspector.tsx:1491` | OK (STALE) |
| dial `udp_fragment` | bool | opt | boolean | `Inspector.tsx:1492` | OK (STALE) |
| dial `domain_resolver` | string \| object | opt (req 1.14 if domain server) | select of DNS server tags | `Inspector.tsx:1493` | Partial — string-only; object form not editable (P1-1). Pass-1 "plain text" STALE (now a select) |
| dial `network_strategy` | enum | opt (1.11) | select default/hybrid/fallback | `Inspector.tsx:1494` | OK |
| dial `network_type` | string[] | opt (1.11) | list (CSV) | `Inspector.tsx:1495` | OK |
| dial `fallback_network_type` | string[] | opt (1.11) | list (CSV) | `Inspector.tsx:1496` | OK |
| dial `fallback_delay` | duration | opt (1.11) | text | `Inspector.tsx:1497` | OK |
| dial `domain_strategy` | enum (DEPRECATED 1.12, removed 1.14) | opt | text (labeled "deprecated 1.12+") | `Inspector.tsx:1498`; diag `diagnostics.ts:1510` | OK round-trip; text not select but value-set is small — see P2-2 |

Fields NOT in the official model and correctly NOT exposed for outbound direct: `server`/`server_port` (none), `proxy_protocol` (does not exist upstream — confirmed absent from both docs and from any direct UI branch). The `override_address`/`override_port` controls at `Inspector.tsx:2994-3015` belong to the INBOUND direct node (`ref.kind === "inbound" && entityType === "direct"`), not this outbound — no leakage.

Invalid-JSON write risk: none specific to direct. `domain_resolver` as a select cannot produce malformed JSON; the only object-capable fields would route through `AdvancedNonScalarFields` -> `JsonField` (`Inspector.tsx:794-818`) which falls back to storing the raw string on parse failure (a generic concern, not direct-specific).

## Findings (prioritized)

- [P1] `domain_resolver` object form not editable. `Inspector.tsx:1493` renders it as a select of DNS-server tags (string shorthand only). Upstream (`shared/dial.md:170-189`) types it `string | object` (route DNS rule action minus `action`), and for `direct` it governs how the request domain resolves — advanced users need the object form (`server`, `client_subnet`, `rewrite_ttl`, `strategy`). Today an imported object value would be coerced/lost by the select (value becomes `String(value ?? "")` -> `[object Object]` display, and any edit writes a plain string). Recommend a string/object toggle or JsonField fallback. (Pass-1 listed this as text-only P1; the control changed to a select but the object-form gap remains.)

- [P2] Deprecated `override_address`/`override_port` have no dedicated/labeled control or inline banner for outbound direct. They are absent from `outboundHandledFields` (`Inspector.tsx:178-240`), so an imported config surfaces them inside the generic "Advanced fields" accordion (`Inspector.tsx:4210`) with auto-generated labels and no deprecation hint. The semantic diagnostic does fire (`diagnostics.ts:748-758`, `direct-override-deprecated`), so data is safe and the user is warned in the diagnostics panel — but a `PlatformBanner kind="deprecated"` near the field (like the inbound side / `tls.acme` at `Inspector.tsx:5337`) would be more discoverable. Pass-1's P1 "deprecation not communicated" is largely RESOLVED by the diagnostic.

- [P2] `domain_strategy` rendered as free text rather than a select. `Inspector.tsx:1498` is `kind: "text"`; upstream enumerates exactly `prefer_ipv4|prefer_ipv6|ipv4_only|ipv6_only` (`shared/dial.md:266`). A select would prevent typos. Low priority since the field is deprecated (removed 1.14) and the deprecation diagnostic already fires (`diagnostics.ts:1504-1514`).

### Where pass-1 is now stale
- Pass-1 (docs/ui-reviews/outbound-direct.md) P0 "Dial detour must use a select not raw tag text" — RESOLVED (`Inspector.tsx:1478` is a select).
- Pass-1 deep-review (docs/claude/outbound-direct.md) P0 "13 dial fields missing from `dialSharedFields`/Inspector" — RESOLVED: `dialSharedFields` now lists all 21 (`Inspector.tsx:116-138`) and the `group === "dial"` branch renders them all (`:1476-1499`).
- Pass-1 P0 "outboundHandledFields missing dial fields" — RESOLVED (`Inspector.tsx:238` spreads `dialSharedFields`).
- Pass-1 P1 "override_* deprecation not communicated" and "domain_strategy deprecation not communicated" — RESOLVED via `diagnostics.ts:748-758` and `:1497-1514`.
- Pass-1 claim "8 input ports defined in SbcNode.tsx lines 104-117" — STALE: ports are now sourced from `portRelationRegistry.ts`, not hard-coded in SbcNode.

SUMMARY: 0 P0, 1 P1, 2 P2.
