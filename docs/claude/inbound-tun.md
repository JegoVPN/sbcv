<!-- Deep review. Source: official stable + testing tun.md, Palette.tsx:145, Inspector.tsx, sharedFieldRegistry.ts, commands.ts, templates.ts. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / tun — Deep UI Review

## Official Field Inventory

### Core identity fields
| Field | Type | Notes |
|---|---|---|
| `type` | fixed `"tun"` | |
| `tag` | string | |

### Interface / addressing
| Field | Type | Platform gate | Status in stable |
|---|---|---|---|
| `interface_name` | string | Linux/macOS/Windows | optional, auto-selected if empty |
| `address` | string[] (CIDR) | all | since 1.10.0; replaces `inet4_address`/`inet6_address` |
| `mtu` | number | all | default 9000 in examples |
| `inet4_address` | string[] | — | deprecated since 1.10.0 |
| `inet6_address` | string[] | — | deprecated since 1.10.0 |

### DNS (testing / 1.14.0 only)
| Field | Type | Notes |
|---|---|---|
| `dns_mode` | select: `disabled` \| `native` \| `hijack` | new in 1.14.0 testing |
| `dns_address` | string[] | new in 1.14.0 testing; addresses for dns_mode |

### Routing
| Field | Type | Platform gate |
|---|---|---|
| `auto_route` | boolean | all; sets default route |
| `iproute2_table_index` | number | Linux; default 2022; since 1.10.0 |
| `iproute2_rule_index` | number | Linux; default 9000; since 1.10.0 |
| `auto_redirect` | boolean | Linux only (also Android limited); since 1.10.0 |
| `auto_redirect_input_mark` | string (hex) | Linux; default `"0x2023"`; since 1.10.0 |
| `auto_redirect_output_mark` | string (hex) | Linux; default `"0x2024"`; since 1.10.0 |
| `auto_redirect_reset_mark` | string (hex) | Linux; default `"0x2025"`; since 1.13.0 |
| `auto_redirect_nfqueue` | number | Linux; default 100; since 1.13.0 |
| `auto_redirect_iproute2_fallback_rule_index` | number | Linux; default 32768; since 1.12.18 |
| `strict_route` | boolean | Linux + Windows (different semantics); behavior changed in 1.13.3 |
| `loopback_address` | string[] | Linux + macOS; since 1.12.0 |
| `exclude_mptcp` | boolean | Linux nftables only, requires auto_route + auto_redirect; since 1.13.0 |

### Route address overrides
| Field | Type | Notes |
|---|---|---|
| `route_address` | string[] (CIDR) | replaces inet4/inet6_route_address since 1.10.0 |
| `route_exclude_address` | string[] (CIDR) | replaces inet4/inet6_route_exclude_address since 1.10.0 |
| `route_address_set` | string[] (rule-set tags) | Linux nftables (with auto_redirect) or all platforms without; since 1.10.0/1.11.0 |
| `route_exclude_address_set` | string[] (rule-set tags) | same dual behavior; does NOT work on Android graphical client |
| `inet4_route_address` | string[] | deprecated 1.10.0 |
| `inet6_route_address` | string[] | deprecated 1.10.0 |
| `inet4_route_exclude_address` | string[] | deprecated 1.10.0 |
| `inet6_route_exclude_address` | string[] | deprecated 1.10.0 |

### Stack / NAT
| Field | Type | Notes |
|---|---|---|
| `stack` | select: `system` \| `gvisor` \| `mixed` | default: `mixed` if gVisor build tag enabled, else `system` |
| `endpoint_independent_nat` | boolean | gvisor stack only |
| `udp_timeout` | string (duration) | default `"5m"` |
| `gso` | boolean | deprecated since 1.11.0; Linux auto_route only |

### Interface filtering (Linux, requires auto_route)
| Field | Type | Platform gate |
|---|---|---|
| `include_interface` | string[] | Linux only; conflicts with `exclude_interface` |
| `exclude_interface` | string[] | Linux only; conflicts with `include_interface` |

### UID filtering (Linux, requires auto_route)
| Field | Type |
|---|---|
| `include_uid` | number[] |
| `include_uid_range` | string[] (format `"1000:99999"`) |
| `exclude_uid` | number[] |
| `exclude_uid_range` | string[] |

### Android filtering (Android, requires auto_route)
| Field | Type |
|---|---|
| `include_android_user` | number[] |
| `include_package` | string[] |
| `exclude_package` | string[] |

### MAC address filtering (Linux, auto_route + auto_redirect, since 1.14.0)
| Field | Type |
|---|---|
| `include_mac_address` | string[] |
| `exclude_mac_address` | string[] |

### Platform / HTTP proxy (nested object)
| Field | Type | Platform gate |
|---|---|---|
| `platform.http_proxy.enabled` | boolean | |
| `platform.http_proxy.server` | string | required when enabled |
| `platform.http_proxy.server_port` | number | required when enabled |
| `platform.http_proxy.bypass_domain` | string[] | on Apple: suffix matching |
| `platform.http_proxy.match_domain` | string[] | Apple graphical clients only (since 1.9.0) |

### Shared listen fields (present in JSON structure, referenced at bottom of doc)
TUN officially includes the shared listen fields block. However, the semantically meaningful listen fields for TUN are `udp_timeout` (overrides the listen-shared one with the same name). Fields like `listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open` are present in the schema but have minimal practical relevance for TUN's virtual-interface model.

Total official fields (non-deprecated, stable): 39  
Total official fields (testing additions in 1.14.0): 4 additional (`dns_mode`, `dns_address`, `include_mac_address`, `exclude_mac_address`)

---

## Current UI State

### Palette (Palette.tsx:145)
```
{ label: "TUN", kind: "tun", icon: RadioTower, docsUrl: docs("inbound/tun/"), ready: true }
```
- `ready: true` — the item is fully clickable and adds a node.
- `kind` is `"tun"` (not `"inbound-tun"`). All other inbounds use `"inbound-*"` prefix; TUN uses bare `"tun"`. This is the correct mapped kind per `protocols.ts`.
- Action on click: calls `addInbound(config, "tun")` which creates `{ type: "tun", tag: "tun-in", address: ["172.19.0.1/30"], auto_route: true }`.

### Canvas node (SbcNode.tsx)
- Output ports for `kind === "inbound"`: Route hub, Route rule matcher, DNS rule matcher. All three apply to TUN — correct.
- No TUN-specific port is added (e.g., no rule-set link for `route_address_set`). This is a gap.

### Inspector (Inspector.tsx)

**What is rendered for `ref.kind === "inbound"` (applies to ALL inbounds including tun):**
1. Listen Fields module card (from `sharedGroupsForEntity` — tun is in `CREATABLE_INBOUND_TYPES` so it always gets `"listen"`).
2. `Address` — single `<input>` with comma-joined list (`toList` / `fromList`).
3. `Auto route` — checkbox.
4. `AdvancedScalarFields` — catches any remaining scalar fields (string/number/boolean) not in `inboundHandledFields`.

**What `inboundHandledFields` covers:**
`tag`, `type`, `address`, `auto_route`, `tls`, `multiplex`, `transport`, `handshake`, plus `listenSharedFields` and `quicSharedFields`.

**What falls through to `AdvancedScalarFields` for a tun entity with typical fields:**
- `interface_name` (string) — auto text input
- `mtu` (number) — auto number input
- `strict_route` (boolean) — auto checkbox
- `iproute2_table_index` (number) — auto number input
- `iproute2_rule_index` (number) — auto number input
- `auto_redirect` (boolean) — auto checkbox
- `auto_redirect_input_mark` (string) — auto text input
- `auto_redirect_output_mark` (string) — auto text input
- `auto_redirect_reset_mark` (string) — auto text input
- `auto_redirect_nfqueue` (number) — auto number input
- `auto_redirect_iproute2_fallback_rule_index` (number) — auto number input
- `endpoint_independent_nat` (boolean) — auto checkbox
- `stack` (string) — auto text input (WRONG: needs select)
- `exclude_mptcp` (boolean) — auto checkbox
- `loopback_address` — MISSING: it is an array, `editableScalarFields` filters out non-scalar values

**What is completely absent from Inspector for tun:**
- `stack` appears as raw text input — must be a select with three options.
- `udp_timeout` — in `listenSharedFields`, so captured in listen group but labeled generically as "UDP Timeout" with no tun-specific context; functionally present but mixed into wrong group.
- `route_address` — array, filtered out by `editableScalarFields` — no UI.
- `route_exclude_address` — array, no UI.
- `route_address_set` — array, no UI.
- `route_exclude_address_set` — array, no UI.
- `include_interface` — array, no UI.
- `exclude_interface` — array, no UI.
- `include_uid` — array, no UI.
- `include_uid_range` — array, no UI.
- `exclude_uid` — array, no UI.
- `exclude_uid_range` — array, no UI.
- `include_android_user` — array, no UI.
- `include_package` — array, no UI.
- `exclude_package` — array, no UI.
- `loopback_address` — array, no UI.
- `platform` — nested object, completely absent.
- `dns_mode` (testing 1.14.0) — no UI.
- `dns_address` (testing 1.14.0) — array, no UI.
- `include_mac_address` (testing 1.14.0) — array, no UI.
- `exclude_mac_address` (testing 1.14.0) — array, no UI.

**Spurious Listen Fields group shown for TUN:**
The `listen` group is injected for all `CREATABLE_INBOUND_TYPES` including `tun`. This presents: Listen (address), Listen Port, Bind Interface, Routing Mark, Reuse Address, Network Namespace, TCP Fast Open, UDP Timeout. For TUN these fields are not the primary operational model — TUN captures traffic at the virtual NIC level, not by binding a TCP/UDP socket. Showing this module prominently as the first card is misleading and may prompt users to set `listen` / `listen_port` on a TUN node thinking those are the operating addresses.

---

## Priority Findings

### P0 — Critical (config correctness / user confusion)

**P0-1: Listen Fields group must not lead the TUN inspector.**  
`sharedFieldRegistry.ts:166` unconditionally assigns the `"listen"` group to every inbound type in `CREATABLE_INBOUND_TYPES`, including `tun`. The TUN inbound has a listen fields section in the schema for technical completeness but its core operational model is virtual interface addressing (`address`, `auto_route`), not socket binding. Showing the Listen Fields card first trains users to set `listen`/`listen_port` on a TUN node. The listen group should either be suppressed for `tun` or moved to a collapsed / advanced section with a clear label that these are not the interface address fields.  
File: `src/domain/sharedFieldRegistry.ts` line 166.

**P0-2: `stack` is a raw text input — must be a select.**  
`stack` is a three-value enum (`system` / `gvisor` / `mixed`). It currently falls through `AdvancedScalarFields` as a plain text input with no validation. An invalid stack string silently produces a broken config. This field is commonly set by users and must be a `<select>` with the three options.  
File: `src/components/Inspector.tsx` — `inboundHandledFields` does not include `stack`; it must be added and rendered as a select specifically for `entityType === "tun"`.

**P0-3: `address` field uses comma-join pattern — correct for the field but needs tun-specific framing.**  
The inbound-wide `address` input uses `toList`/`fromList` (comma-separated). For TUN, `address` is the virtual interface CIDR (e.g., `172.18.0.1/30`, not a hostname). A user editing this without context may enter a bare IP or hostname. The label or placeholder should say "IPv4/IPv6 CIDR" to prevent malformed addresses that crash the TUN interface. This is not a code bug but a missing UX signal for a dangerous field.

**P0-4: `route_address`, `route_exclude_address`, `route_address_set`, `route_exclude_address_set` — completely absent.**  
These four array fields are the core route-splitting controls in a TUN config. They determine which traffic enters the tunnel. With no UI, users must export JSON, edit manually, and re-import. `route_address_set` and `route_exclude_address_set` also link to rule-set tags — the canvas already has rule-set nodes but no edge or input allows connecting them to TUN. These fields need repeater inputs or tag-multiselect pickers at minimum.

### P1 — High (missing feature coverage)

**P1-1: Platform gate `include_*` / `exclude_*` filter arrays have zero UI.**  
Fourteen array fields control which interfaces (Linux), UIDs (Linux), Android users/packages (Android), and MAC addresses (Linux 1.14.0) are included in or excluded from TUN routing. None have any UI. For advanced users this is the main reason to use TUN over mixed. They all need at least a raw repeater or textarea-JSON input, with a platform badge indicating Linux-only or Android-only constraints.

**P1-2: `platform.http_proxy` nested object is entirely absent.**  
This nested section is the primary mechanism for graphical Apple/iOS clients to route system HTTP traffic through the TUN. It requires `enabled`, `server`, `server_port`, `bypass_domain` (list), and `match_domain` (Apple-only list). There is no JsonField, no nested section, nothing. The `platform` key is a plain object so `editableScalarFields` skips it; it does not appear in `AdvancedScalarFields` either.

**P1-3: `loopback_address` (array since 1.12.0) has no UI.**  
The field is an array, so `editableScalarFields` ignores it. The SideStore/StosVPN use-case depends on this field. Needs a repeater input.

**P1-4: `strict_route` semantics differ by platform — UI provides no guidance.**  
`strict_route` behaves differently on Linux vs Windows and had a behavior change in 1.13.3. The current auto-generated checkbox label "Strict Route" from `labelForField` gives no hint of the cross-platform implications. A tooltip or inline help text should flag: "Linux: makes unsupported networks unreachable + affects SO_BINDTODEVICE with auto_redirect. Windows: prevents DNS leak but may break VirtualBox."

**P1-5: `auto_redirect` and its six sub-fields have no dedicated section.**  
`auto_redirect` falls through to `AdvancedScalarFields` as a checkbox. Its five companion fields (`auto_redirect_input_mark`, `auto_redirect_output_mark`, `auto_redirect_reset_mark`, `auto_redirect_nfqueue`, `auto_redirect_iproute2_fallback_rule_index`) also fall through as individual inputs. The logical coupling between `auto_redirect` and these mark/queue values is invisible — there is no grouping, no "only relevant when auto_redirect is enabled" gate, no hex-string validation on the mark fields.

**P1-6: `dns_mode` / `dns_address` (testing 1.14.0) — no plan for versioned display.**  
These two fields exist only in testing. The UI has no mechanism to show/hide fields based on target version. At minimum, the review should note that when testing fields are added, these need a version badge and should default to hidden unless the user has opted into testing.

**P1-7: `endpoint_independent_nat` must be gated behind `stack === "gvisor"` check.**  
The official doc says "only available on the gvisor stack." The current UI (auto-checkbox in AdvancedScalarFields) shows it regardless of `stack` value. Setting it when `stack` is `system` or `mixed` has no effect but creates confusing configs.

**P1-8: Default scaffold in `createInbound` is IPv4-only.**  
`commands.ts:99` creates `address: ["172.19.0.1/30"]` (single IPv4). The official template and docs recommend both IPv4 and IPv6: `["172.18.0.1/30", "fdfe:dcba:9876::1/126"]`. A dual-stack default prevents surprises on IPv6-capable systems.

---

## Platform Gate Summary (required for UI labels / tooltips)

| Feature group | Linux | Windows | macOS | Android | iOS/Apple |
|---|---|---|---|---|---|
| TUN itself | yes | yes | yes | yes (via VpnService) | yes (via NetworkExtension) |
| `auto_redirect` | yes (nftables) | no | no | limited (IPv4 TCP only) | no |
| `iproute2_*` fields | yes | no | no | no | no |
| `include_interface` / `exclude_interface` | yes (+ auto_route) | no | no | no | no |
| `include_uid` / `exclude_uid` | yes (+ auto_route) | no | no | no | no |
| `include_android_user` / packages | no | no | no | yes (+ auto_route) | no |
| `include_mac_address` / `exclude_mac_address` | yes (+ auto_route + auto_redirect) | no | no | no | no |
| `exclude_mptcp` | yes (nftables + auto_route + auto_redirect) | no | no | no | no |
| `strict_route` | yes | yes (different) | no | no | no |
| `platform.http_proxy.match_domain` | no | no | yes (graphical) | no | yes (graphical) |
| `route_address_set` (without auto_redirect) | yes | yes | yes | no (graphical crash) | yes |

---

## Implementation Tasks

### Must-fix before TUN can be called production-ready

1. **Suppress or demote Listen Fields group for `tun`** — add a special-case exclusion in `sharedGroupsForEntity` (sharedFieldRegistry.ts:166) so `tun` does not receive the `"listen"` group, or at minimum reposition it after TUN-specific fields with a "socket binding (rarely needed)" label.

2. **Add `stack` as a controlled select** — add `stack` to `inboundHandledFields`, then in the `ref.kind === "inbound" && entityType === "tun"` block render `<select>` with options `system`, `gvisor`, `mixed`.

3. **Add `route_address` and `route_exclude_address` repeater inputs** — these are the most commonly edited TUN fields after `address` and `auto_route`. A comma-separated textarea or a tag-list input is acceptable as v1.

4. **Add `route_address_set` and `route_exclude_address_set` multiselect** — pick from existing rule-set tags in config, similar to how `outboundTags` and `inboundTags` helpers are used elsewhere.

5. **Add `platform.http_proxy` as a JsonField or structured section** — minimum viable: `JsonField label="HTTP Proxy (platform)" value={entity.platform?.http_proxy ?? {}} ...`. Better: a structured card with enabled/server/port/bypass_domain/match_domain fields.

### Strongly recommended

6. **Gate `endpoint_independent_nat` behind `stack === "gvisor"`** — only render the checkbox when `entity.stack === "gvisor"`.

7. **Add platform badge to `include_uid`/`exclude_uid`, `include_interface`/`exclude_interface`, `include_android_user`/`include_package`/`exclude_package`** — repeater inputs with a "(Linux only)" or "(Android only)" annotation.

8. **Add `loopback_address` repeater** — string array, no platform restriction, since 1.12.0.

9. **Dual-stack default in `createInbound`** — change `commands.ts:99` to `address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"]`.

10. **Group `auto_redirect` with its companion mark/queue fields** — add them to `inboundHandledFields` and render as a collapsible section labeled "Auto Redirect (Linux)" visible only when `auto_redirect` is true or being set.

11. **Address field placeholder / label** — change label from generic "Address" to "TUN Address (CIDR)" and add placeholder `172.18.0.1/30`.

### Future / testing track

12. **`dns_mode` and `dns_address`** — add to a version-gated section when testing fields are surfaced. `dns_mode` needs a select, `dns_address` needs a repeater.

13. **`include_mac_address` / `exclude_mac_address`** — add when 1.14.0 fields are surfaced; Linux auto_route + auto_redirect only.

14. **Rule-set canvas edge for `route_address_set`** — a canvas port on the TUN node linking to rule-set nodes would make the routing intent visible. Low priority but architecturally consistent with how other set-reference fields work.
