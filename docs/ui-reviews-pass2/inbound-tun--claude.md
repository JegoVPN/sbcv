# inbound-tun — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
TUN has been substantially built out since pass-1: a dedicated `entityType === "tun"` Inspector block (Inspector.tsx:2609-2868) now ships `stack` as a select, the four `route_address*`/`route_*_set` arrays, `loopback_address`, six include/exclude filter arrays, `auto_redirect`, gvisor-gated `endpoint_independent_nat`, and a structured `platform.http_proxy` editor. Most pass-1 P0/P1 claims (stack-as-text, missing route arrays, missing platform proxy, IPv4-only default) are now STALE and fixed. Remaining real gaps are the un-typed scalars that fall through to "Advanced fields" (`mtu`, `interface_name`, `strict_route`, the `iproute2_*` and `auto_redirect_*` marks, `dns_mode`) and the array fields that land in the raw JSON editor (`include_uid`/`exclude_uid`, `include_android_user`, `dns_address`, `include_mac_address`/`exclude_mac_address`).

## 1. Left Palette
Present and correct. `Palette.tsx:144` — `{ label: "TUN", kind: "inbound-tun", icon: RadioTower, docsUrl: docs("inbound/tun/"), ready: true }`. Sits in the "Inbounds" group, maps to type `tun` via `protocols.ts:62`, docs URL correct. `ready: true` → status resolves to `add` (`Palette.tsx:263`), so a single click adds the node (`createFromPalette("inbound-tun")`). Pass-1 docs/claude said `kind: "tun"` / expected-action `SETUP` — both are STALE; the kind is `inbound-tun` and the action is `add`. No category/gating issues.

## 2. Canvas Node
Title bar renders `inbound / tun` (SbcNode.tsx:291). Card title = tag, subtitle = `tun inbound` (graph.ts:224-225). `compatible: ["Route"]` (graph.ts:227) drives the single quick-add chip. Status comes from `/inbounds/{index}` diagnostics (graph.ts:226).
Ports (verified via `portEndpointsForNode` + `endpointMatchesNode`, portRelationRegistry.ts:90-116, 198-208): for `kind=inbound, type=tun` the OUTPUT ports are **Route hub** (decorative, id `route`), **Route rule matcher** (id `route-rule-match`), **DNS rule matcher** (id `dns-rule-match`). The `service`/SSM port is correctly excluded because its endpoint is nodeType-gated to `shadowsocks` (line 113). No input ports. This matches sing-box semantics: a tun inbound is a pure traffic source referenced by route/dns rules by tag.
Gaps: (a) subtitle is generic `tun inbound` — does not surface `stack`, `auto_route`, or route-set usage, as both pass-1 reviews requested; still valid. (b) No badge/affordance distinguishes the heavy platform hazards. (c) No canvas port for `route_address_set`/`route_exclude_address_set` rule-set references (handled in Inspector only) — acceptable but architecturally inconsistent with how route-rule→rule-set is an edge.

## 3. Upstream/Downstream Links
Official relationship model: a tun inbound is referenced by route rules (`/route/rules/*/inbound`) and dns rules (`/dns/rules/*/inbound`) by tag; `route_address_set`/`route_exclude_address_set` reference rule-set tags (NOT route-rule nodes); tun is never an outbound/detour target.
- `portRelationRegistry.ts:94` `route-rule-inbound` (writable, `/route/rules/*/inbound`) — correct.
- `portRelationRegistry.ts:99` `dns-rule-inbound` (writable, `/dns/rules/*/inbound`) — correct.
- `portRelationRegistry.ts:91` `inbound`→route (decorative Route hub) and `:100` `dns-inbound-query` (decorative) — correct, non-writable.
- `referenceRegistry.ts:327-328` `kind: "inbound"` paths include `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` — correct for rename/remove; tun can legitimately appear in v2ray stats. The `/services/*/servers` path is shadowsocks-managed-only, harmless for tun.
- MISSING (matches sing-box, but worth noting): there is NO reference edge/registry entry tying `route_address_set`/`route_exclude_address_set` (canonical paths `/inbounds/*/route_address_set`, `.../route_exclude_address_set`) to rule-set tags. So renaming or deleting a rule-set does NOT update/clean these tun arrays. This is a real referential-integrity gap (P1). No extra/wrong links found.

## 4. Right Inspector (fields) — one row per official field
Legend: Typed = purpose-built control; Adv-scalar = falls through `AdvancedScalarFields` (Inspector.tsx:3237) as raw text/number/checkbox; Adv-JSON = falls through `AdvancedNonScalarFields` (:3238) as a JSON textarea; Listen = rendered inside the shared "Listen Fields" ModuleCard.

| Official field | UI state | Control | Notes / correctness |
|---|---|---|---|
| `interface_name` | Adv-scalar | text | works; buried under "Advanced fields", no placeholder |
| `address` | Typed (2611) | CSV→`fromList` | OK; label just "Address", no CIDR hint/validation |
| `inet4_address`/`inet6_address` (dep) | Adv-JSON if present | JSON | import-only; diagnostics warns (diagnostics.ts:490) |
| `mtu` | Adv-scalar | number | works but un-grouped; no default shown |
| `dns_mode` (1.14) | Adv-scalar | **text (WRONG)** | enum `disabled`/`native`/`hijack` rendered as free text |
| `dns_address` (1.14) | Adv-JSON | JSON textarea | array; no typed CSV input |
| `gso` (dep) | Adv-scalar | checkbox | deprecated/no-op; no deprecation hint |
| `auto_route` | Typed (2618) | checkbox | OK |
| `iproute2_table_index` | Adv-scalar | number | works; no default (2022)/Linux hint |
| `iproute2_rule_index` | Adv-scalar | number | works; no default (9000)/Linux hint |
| `auto_redirect` | Typed (2774) | checkbox | OK, Linux label |
| `auto_redirect_input_mark` | Adv-scalar | text | works; no hex validation/default `0x2023` |
| `auto_redirect_output_mark` | Adv-scalar | text | works; default `0x2024` |
| `auto_redirect_reset_mark` (1.13) | Adv-scalar | text | works; default `0x2025` |
| `auto_redirect_nfqueue` (1.13) | Adv-scalar | number | works; default 100 |
| `auto_redirect_iproute2_fallback_rule_index` | Adv-scalar | number | works; default 32768 |
| `exclude_mptcp` (1.13) | Adv-scalar | checkbox | works; no gate hint |
| `loopback_address` (1.12) | Typed (2697) | CSV | OK |
| `strict_route` | Adv-scalar | checkbox | works; no cross-platform tooltip |
| `route_address` | Typed (2653) | CSV | OK, good placeholder |
| `route_exclude_address` | Typed (2664) | CSV | OK |
| `route_address_set` | Typed (2675) | CSV | OK; should be a rule-set-tag multiselect |
| `route_exclude_address_set` | Typed (2686) | CSV | OK; same multiselect gap |
| `endpoint_independent_nat` | Typed (2784) | checkbox | correctly gated to `stack==="gvisor"`; cleared on stack change (2638-2644) |
| `udp_timeout` | Listen | text | rendered in Listen Fields card (:1448), generic label |
| `stack` | Typed (2630) | **select** | options (default)/system/gvisor/mixed — fixed since pass-1 |
| `include_interface` | Typed (2730) | CSV | OK |
| `exclude_interface` | Typed (2741) | CSV | OK |
| `include_uid` | Adv-JSON | JSON | number[]; no typed input |
| `include_uid_range` | Typed (2708) | CSV | OK |
| `exclude_uid` | Adv-JSON | JSON | number[]; no typed input |
| `exclude_uid_range` | Typed (2719) | CSV | OK |
| `include_android_user` | Adv-JSON | JSON | number[]; no typed input |
| `include_package` | Typed (2752) | CSV | OK |
| `exclude_package` | Typed (2763) | CSV | OK |
| `include_mac_address` (1.14) | Adv-JSON | JSON | string[]; no typed input |
| `exclude_mac_address` (1.14) | Adv-JSON | JSON | string[]; no typed input |
| `platform.http_proxy.enabled` | Typed (2814) | checkbox | structured fieldset; clean-on-empty (2799-2810) |
| `platform.http_proxy.server` | Typed (2824) | text | **required not marked** when enabled |
| `platform.http_proxy.server_port` | Typed (2832) | number | **required not marked** when enabled |
| `platform.http_proxy.bypass_domain` | Typed (2844) | CSV | OK |
| `platform.http_proxy.match_domain` | Typed (2855) | CSV | OK, Apple-only label |
| Listen Fields (shared) | Listen card | mixed | `listen` group still pushed for tun (sharedFieldRegistry.ts:170) |

No invalid-JSON writes in the typed block (CSV helpers + numeric guards are correct). The Adv-JSON fallback `JsonField` (Inspector.tsx:794-818) writes the raw string on parse failure — a pre-existing footgun for the array fields routed there.

## Findings (prioritized)
- **[P1]** `dns_mode` (enum `disabled`/`native`/`hijack`) renders as a free-text Advanced field, not a select — invalid strings silently break DNS handling. Add a typed select in the tun block. (Inspector.tsx:3237 fallthrough; should join the block at ~2652.)
- **[P1]** `route_address_set` / `route_exclude_address_set` have NO referential integrity: no entry in `referenceRegistry.ts:325` for `/inbounds/*/route_address_set` or `/inbounds/*/route_exclude_address_set`, so rule-set rename/delete leaves dangling tags in tun. Also no diagnostic flags a tag that is not a defined rule-set. (referenceRegistry.ts:357-358 only covers route/dns rules.)
- **[P1]** UID/Android/MAC arrays drop to the raw JSON editor: `include_uid`, `exclude_uid`, `include_android_user`, `dns_address`, `include_mac_address`, `exclude_mac_address` are absent from the typed block and from `inboundHandledFields` (Inspector.tsx:140-177), so they land in "Advanced JSON fields" (:3238). They need CSV/number-list inputs like their `_range` siblings, with platform/version labels. (1.14 MAC fields + `dns_address` especially.)
- **[P1]** `platform.http_proxy.server` and `.server_port` are `==Required==` upstream (tun.md:660,665) but the UI shows no required marker and no diagnostic when `enabled: true` with empty server/port. (Inspector.tsx:2824, 2832.)
- **[P2]** No "address must not be empty" diagnostic for tun. `address` is the operationally critical interface CIDR; clearing it produces a silent runtime hazard. diagnostics.ts:476-497 only warns on legacy address fields, nothing on empty `address`. Both pass-1 reviews asked for this; still valid.
- **[P2]** `mtu`, `interface_name`, `strict_route`, the five `auto_redirect_*` mark/queue values, and the two `iproute2_*` indexes all fall through to generic "Advanced fields" (Inspector.tsx:3237). They work and round-trip, but there is no grouping, no defaults shown (2022/9000/0x2023/0x2024/0x2025/100/32768), no hex validation on marks, and no "only when auto_redirect/auto_route" gating. Consider a typed "Linux auto_route/auto_redirect" sub-card. (tun.md:302-385.)
- **[P2]** `strict_route` has no cross-platform tooltip (Linux unreachable + SO_BINDTODEVICE vs Windows DNS-leak/VirtualBox, changed in 1.13.3). Auto-label only. (tun.md:411-429.)
- **[P2]** Listen Fields card is still injected for tun (sharedFieldRegistry.ts:170 via `CREATABLE_INBOUND_TYPES`). tun's only meaningful listen field is `udp_timeout`; surfacing `listen`/`listen_port`/`bind_interface` etc. invites users to set socket-bind fields that do not apply to a virtual NIC. Consider suppressing or demoting for tun. (Pass-1 P0-1 — downgrading to P2 since it is a UX clarity issue, not a correctness/JSON bug; the fields are technically schema-valid.)
- **[P2]** Canvas subtitle is generic `tun inbound` (graph.ts:225); does not summarize `stack`/`auto_route`/route-set usage as both pass-1 reviews requested.

SUMMARY: 0 P0, 4 P1, 5 P2.
