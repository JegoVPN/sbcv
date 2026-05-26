<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / direct UI Review (Claude Deep Review)

## Scope

- Editable node: `inbound:direct`
- Palette kind: `inbound-direct`
- Official doc (stable): `.tmp/sing-box-docs/stable/docs/configuration/inbound/direct.md`
- Shared listen fields (stable): `.tmp/sing-box-docs/stable/docs/configuration/shared/listen.md`
- Official doc (testing): `.tmp/sing-box-docs/testing/docs/configuration/inbound/direct.md`
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Official Model

### Protocol-specific fields (direct.md)

| Field | Type | Required | Default | Semantic |
| --- | --- | --- | --- | --- |
| `network` | enum string | optional | both | Accept network: `"tcp"`, `"udp"`, or absent (both) |
| `override_address` | string | optional | — | Override destination address for every accepted connection |
| `override_port` | number (uint16) | optional | — | Override destination port for every accepted connection |

### Listen common fields (shared/listen.md — applies to all inbounds)

| Field | Type | Required | Default | Semantic | Version note |
| --- | --- | --- | --- | --- | --- |
| `listen` | string | **required** | — | Bind address | Stable |
| `listen_port` | number | optional | — | Bind port | Stable |
| `bind_interface` | string | optional | — | Network interface to bind to | Since 1.12.0 |
| `routing_mark` | number/string | optional | — | Linux netfilter mark; integers or hex string | Since 1.12.0; Linux only |
| `reuse_addr` | bool | optional | false | Reuse listener address | Since 1.12.0 |
| `netns` | string | optional | — | Network namespace name or path | Since 1.12.0; Linux only |
| `tcp_fast_open` | bool | optional | false | Enable TCP Fast Open | Stable |
| `tcp_multi_path` | bool | optional | false | Enable TCP Multi Path (requires Go 1.21) | Stable |
| `disable_tcp_keep_alive` | bool | optional | false | Disable TCP keep-alive | Since 1.13.0 |
| `tcp_keep_alive` | string (duration) | optional | `"5m"` | TCP keep-alive initial period (default changed in 1.13.0) | Since 1.13.0 |
| `tcp_keep_alive_interval` | string (duration) | optional | `"75s"` | TCP keep-alive interval | Stable |
| `udp_fragment` | bool | optional | false | Enable UDP fragmentation | Stable |
| `udp_timeout` | string (duration) | optional | `"5m"` | UDP NAT expiration time | Stable |
| `detour` | string | optional | — | Forward connections to specified inbound (requires target to support Injectable) | Stable |

### Deprecated fields (removed in sing-box 1.13.0)

The following fields were deprecated in 1.11.0 and removed in 1.13.0. They should be migrated to rule actions.

| Field | Deprecated since | Notes |
| --- | --- | --- |
| `sniff` | 1.11.0 | Enable protocol sniffing — use rule action instead |
| `sniff_override_destination` | 1.11.0 | Override destination with sniffed domain |
| `sniff_timeout` | 1.11.0 | Sniff timeout (default `300ms`) |
| `domain_strategy` | 1.11.0 | Resolve domain to IP before routing |
| `udp_disable_domain_unmapping` | 1.11.0 | Compatibility option for clients not supporting domain UDP responses |

Total official writable fields (stable, non-deprecated): **3 protocol-specific + 15 listen common = 18**.

---

## Cross-version diff (testing)

The testing doc (`testing/docs/configuration/inbound/direct.md`) is **byte-for-byte identical** to the stable doc. No new fields, no changed defaults, no new deprecations. The `direct` inbound is stable across versions.

---

## Relationship model

### Outgoing references from this node

| Reference | Field | Direction |
| --- | --- | --- |
| `detour` (listen field) | `detour` → target inbound `tag` | This inbound forwards connections to another inbound. Target must be Injectable. **Not an outbound reference.** |

### Incoming references to this node

| Reference surface | Field | Where set |
| --- | --- | --- |
| Route rule `inbound` | `route.rules[].inbound` | `RouteRuleInspector`, Inspector.tsx line 603 |
| DNS rule `inbound` | `dns.rules[].inbound` | `DnsRuleInspector`, Inspector.tsx line 707 |
| Route hub (implicit) | all inbounds → route | Canvas edge; no JSON field |

The `detour` field on this node references **another inbound by tag** (not an outbound). This is unique among listen fields and distinct from the `dial.detour` field used by outbounds. The UI currently has no dedicated select widget for this inbound-to-inbound reference.

---

## Compat / Target gate

No target gate applies to `inbound:direct` in stable. All three protocol-specific fields (`network`, `override_address`, `override_port`) are unconditionally available.

Several listen fields are version-gated:
- `bind_interface`, `routing_mark`, `reuse_addr`, `netns` — since 1.12.0.
- `disable_tcp_keep_alive`, `tcp_keep_alive` (default change) — since 1.13.0.
- `routing_mark`, `netns` — Linux only.

The deprecated sniff/domain fields should not be shown for targets >= 1.13.0.

---

## Left: Add Library

### Current state (Palette.tsx line 131)

```ts
{ label: "Direct", kind: "inbound-direct", icon: Cable, docsUrl: docs("inbound/direct/"), status: "setup" }
```

- `itemStatus()` returns `"setup"` (explicit `status` override).
- The button label resolves to `"Setup Direct"` (tooltip: `"Add Direct setup draft to canvas"`).
- `canActivate()` returns `true` for `"setup"` → clicking calls `createFromPalette("inbound-direct")`.
- `createFromPalette` dispatches `inboundTypeForPaletteKind("inbound-direct")` → `"direct"`, then calls `addInbound(config, "direct", preferredInboundTag("direct"))` which sets `tag = "direct-in"`.
- The `docsUrl` points to `https://sing-box.sagernet.org/configuration/inbound/direct/` — correct.

### Gap analysis

- The `"setup"` status is acceptable. It creates a minimal stub entry in the config with the preferred tag and no listen fields set. The user then fills in `listen` (required) and the protocol fields via the Inspector.
- **No misleading label**: "Setup" is distinguishable from "Add" (which is reserved for `ready: true` fully-implemented nodes), so `"setup"` correctly signals that the node will be created as a draft and requires further Inspector work.
- No duplicate-add guard for inbounds: unlike singleton `settings:*` nodes, inbound nodes are repeatable (multiple `direct` inbounds can coexist), so no guard is needed.

### Recommendations

1. **P2 — Status is correct as-is.** No change needed on the Library entry. The `"setup"` label already explains that the node requires follow-up configuration.

---

## Middle: Canvas Node

### Current state (SbcNode.tsx lines 136–144)

The `kind === "inbound"` branch of `getPortSpecs` (output direction) always returns:

```ts
[
  { key: "route",            label: "Route hub",        nodeKind: "route",      icon: Route },
  { key: "route-rule-match", label: "Route rule matcher", nodeKind: "route-rule", icon: GitBranch },
  { key: "dns-rule-match",   label: "DNS rule matcher",  nodeKind: "dns-rule",   icon: GitBranch },
]
```

This is shared across all inbound types. No `type === "direct"` branching exists in `getPortSpecs`. The `shadowsocks`-only `service` port at line 142 is the only type-specific port override in this block.

The inbound icon for all inbound kinds is `RadioTower` (iconMap line 29). No type-specific icon for `direct`.

Port-active checks (lines 297–303):
- `"route"` active when `config.route` exists — correct.
- `"route-rule-match"` active when any route rule references this tag — correct.
- `"dns-rule-match"` active when any DNS rule references this tag — correct.

### Gap analysis

- **Port accuracy**: The three ports (`route`, `route-rule-match`, `dns-rule-match`) are appropriate for a `direct` inbound. `direct` inbound has no outbound `detour` port on the canvas. The listen-field `detour` (inbound-to-inbound forwarding) has no canvas edge representation at all — this is a silent gap.
- **Missing port: `detour` → target inbound**: The listen field `detour` references another inbound by tag. There is no canvas port for this, and no active-check for it. This is a legitimate relationship that could be represented as an input port on the target inbound or as an output port here labeled "Forward detour". Currently the relationship only lives in JSON; the canvas gives no visual indication.
- **Icon**: `Cable` is used in the Palette for `inbound-direct` (line 131), but the canvas node uses the generic `RadioTower` for all inbounds. This is a minor inconsistency.

### Recommendations

1. **P1 — Missing `detour` port**: Add an output port `{ key: "detour-inbound", label: "Detour inbound", nodeKind: "inbound" }` to the inbound port spec when `entity.detour` is set. The active-check should return true when the entity's `detour` field is a non-empty string. This makes the inbound-to-inbound forwarding relationship visible on the canvas.
2. **P2 — Canvas icon**: Consider giving `direct` inbound a distinct icon (e.g. `Cable` matches the Palette entry) instead of the shared `RadioTower`, to help users tell it apart from protocol-based inbounds at a glance.

---

## Right: Inspector

### Current state for inbound rendering

The Inspector renders a **shared inbound block** for all inbound types (lines 1484–1502):

```tsx
{ref.kind === "inbound" ? (
  <>
    <label className="field">
      <span>Address</span>
      <input value={toList(entity.address)} onChange={...} />
    </label>
    <label className="toggle-row">
      <input type="checkbox" checked={Boolean(entity.auto_route)} onChange={...} />
      <span>Auto route</span>
    </label>
    <AdvancedScalarFields entity={entity} handledFields={inboundHandledFields} ... />
  </>
) : null}
```

`inboundHandledFields` (lines 116–127) includes:
- `tag`, `type`, `address`, `auto_route`, `tls`, `multiplex`, `transport`, `handshake`
- All of `listenSharedFields`: `listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout`
- All of `quicSharedFields`: `initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period`

Shared `"listen"` group is rendered via `sharedGroupsForEntity` → `sharedFieldDefinitions` (Inspector.tsx lines 849–859) whenever `(CREATABLE_INBOUND_TYPES).includes(entityType)`. This includes `"direct"`, so the listen panel is shown.

The `sharedFieldDefinitions("listen")` renders (lines 851–858):

| Label | Path | Control kind |
| --- | --- | --- |
| Listen | `["listen"]` | text |
| Listen Port | `["listen_port"]` | number |
| Bind Interface | `["bind_interface"]` | text |
| Routing Mark | `["routing_mark"]` | number |
| Reuse Address | `["reuse_addr"]` | boolean |
| Network Namespace | `["netns"]` | text |
| TCP Fast Open | `["tcp_fast_open"]` | boolean |
| UDP Timeout | `["udp_timeout"]` | text |

### Field-by-field audit (official vs rendered)

**Protocol-specific fields:**

| Official field | Inspector rendering | Assessment |
| --- | --- | --- |
| `network` | NOT in `inboundHandledFields`; falls through to `AdvancedScalarFields` if present in entity | **P1 gap**: `network` is not in `inboundHandledFields` and is not explicitly rendered. If the imported config has `"network": "tcp"` it will appear in Advanced fields as a raw text input. A `"direct"` inbound should expose `network` as a `<select>` with options `""` (both), `"tcp"`, `"udp"`. |
| `override_address` | NOT in `inboundHandledFields`; falls through to `AdvancedScalarFields` | **P1 gap**: Falls to Advanced fields (plain text input). Should be a first-class text field in the direct-specific Inspector block. |
| `override_port` | NOT in `inboundHandledFields`; falls through to `AdvancedScalarFields` | **P1 gap**: Falls to Advanced fields (number input, but only if the field is already present in the entity object). If absent it is not shown at all. Should be a first-class number field. |

**Listen common fields:**

| Official field | Rendered in "Listen Fields" panel | Assessment |
| --- | --- | --- |
| `listen` | text — line 851 | Correct |
| `listen_port` | number — line 852 | Correct |
| `bind_interface` | text — line 853 | Correct |
| `routing_mark` | number — line 854 | Partially correct: the official doc accepts both integers and hex strings. A number input rejects `"0x1234"`. Should be text or accept both forms. |
| `reuse_addr` | boolean — line 855 | Correct |
| `netns` | text — line 856 | Correct |
| `tcp_fast_open` | boolean — line 857 | Correct |
| `tcp_multi_path` | **NOT in listenSharedFields, NOT in inboundHandledFields** | **P1 gap**: Absent from the listen panel. Falls through to `AdvancedScalarFields` only if already present in the entity. New configs cannot set it from the UI. |
| `disable_tcp_keep_alive` | **NOT in listenSharedFields, NOT in inboundHandledFields** | **P1 gap**: New field (since 1.13.0), absent from listen panel and from handled fields. |
| `tcp_keep_alive` | **NOT in listenSharedFields, NOT in inboundHandledFields** | **P1 gap**: Since 1.13.0, absent. Duration string field. |
| `tcp_keep_alive_interval` | **NOT in listenSharedFields, NOT in inboundHandledFields** | **P1 gap**: Duration string, absent. |
| `udp_fragment` | **NOT in listenSharedFields, NOT in inboundHandledFields** | **P1 gap**: Boolean, absent from listen panel. |
| `udp_timeout` | text — line 858 | Correct |
| `detour` | **NOT in listenSharedFields, NOT in inboundHandledFields** | **P0 gap**: `detour` (listen field) references **another inbound by tag**. It is completely absent from all inbound rendering paths. This is distinct from the `dial.detour` outbound field. A `<select>` populated with existing inbound tags (excluding self) is the correct control. |

**Deprecated fields (sniff/domain — removed 1.13.0):**

These fall through to `AdvancedScalarFields` if present in an imported config. They are not explicitly suppressed or labelled deprecated. A config importing with `"sniff": true` will show it as an unlabelled Advanced checkbox. No harm from this behaviour, but a version warning would improve UX.

### `address` / `auto_route` rendering (lines 1486–1500)

These fields are rendered for **all** inbounds via the shared inbound block. For `direct` inbound, neither `address` nor `auto_route` is a documented field. This means:
- `address` is displayed as an editable text field even though `direct` inbound does not define it.
- `auto_route` is shown as a checkbox even though it is only meaningful for `tun` inbound.

Both fields will be silently ignored by sing-box when set on a `direct` inbound (or may cause a validation error). This is a pre-existing issue shared with all non-tun inbounds.

### Recommendations

1. **P0 — Add `detour` select for inbound-to-inbound forwarding**: In `sharedFieldDefinitions("listen")` or in a `direct`-specific Inspector section, add a `<select>` for `detour` populated with all inbound tags (excluding self). Listen `detour` is documented and meaningful.

2. **P1 — Add `network` select for `direct`**: In a type-specific branch (`entityType === "direct"`), render a `<select>` with options `""` (both), `"tcp"`, `"udp"`. Add `"network"` to `inboundHandledFields`.

3. **P1 — Add `override_address` text field for `direct`**: Explicit `<input type="text">` in the direct-specific section. Add `"override_address"` to `inboundHandledFields`.

4. **P1 — Add `override_port` number field for `direct`**: Explicit `<input type="number">` in the direct-specific section. Add `"override_port"` to `inboundHandledFields`.

5. **P1 — Add missing listen fields to `listenSharedFields` and `sharedFieldDefinitions("listen")`**:
   - `tcp_multi_path` (boolean)
   - `disable_tcp_keep_alive` (boolean, since 1.13.0)
   - `tcp_keep_alive` (duration text, since 1.13.0)
   - `tcp_keep_alive_interval` (duration text)
   - `udp_fragment` (boolean)
   All five should be added to `listenSharedFields` array (Inspector.tsx line 95) so they are included in `inboundHandledFields` and not left for `AdvancedScalarFields`.

6. **P1 — Fix `routing_mark` control**: Change from `kind: "number"` to `kind: "text"` in `sharedFieldDefinitions("listen")` (line 854) so hex strings like `"0x1234"` are accepted.

7. **P2 — Suppress `address` and `auto_route` for non-tun inbounds**: The shared inbound rendering block (lines 1484–1502) shows `address` and `auto_route` for all inbound types. These fields are only meaningful for `tun`. Guard these with `entityType === "tun"`.

8. **P2 — Version badge for 1.12+ and 1.13+ listen fields**: `bind_interface`, `routing_mark`, `reuse_addr`, `netns` (1.12.0+) and `disable_tcp_keep_alive`, `tcp_keep_alive` (1.13.0+) should display a version indicator to guide users on compatibility.

---

## Tag Reference Surfaces

The `tag` of this node is referenced by:

| Surface | Field | Where edited |
| --- | --- | --- |
| Route rules | `route.rules[].inbound` | `RouteRuleInspector` → `RuleListField` (Inspector.tsx line 603) |
| DNS rules | `dns.rules[].inbound` | `DnsRuleInspector` → `RuleListField` (Inspector.tsx line 707) |
| Listen `detour` of another inbound | `inbounds[].detour` | Currently no dedicated surface — falls to Advanced fields |

The `tag` rename (`renameTag` via Inspector.tsx line 1186) correctly updates `route.rules[].inbound` and `dns.rules[].inbound` references if the renaming logic covers string and array forms.

---

## Priority Findings

- **P0** — `detour` (listen field, inbound-to-inbound forwarding) is completely absent from the Inspector and canvas. Any config with `"detour": "some-inbound"` imports fine but the field cannot be set or cleared from the UI.
- **P1** — `network` (direct protocol field) falls through to `AdvancedScalarFields` raw text input instead of a dedicated `<select>` with `""` / `"tcp"` / `"udp"` options.
- **P1** — `override_address` (direct protocol field) falls through to Advanced fields only if already present; a user cannot add it from a clean stub.
- **P1** — `override_port` (direct protocol field) same problem as `override_address`.
- **P1** — `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment` — five listen fields present in stable docs are absent from the listen panel and from `listenSharedFields`.
- **P1** — `routing_mark` rendered as `kind: "number"` but the official doc also accepts hex strings — this silently rejects valid configs like `"routing_mark": "0x1234"`.
- **P2** — `address` and `auto_route` fields are displayed for all inbounds including `direct` where they are not documented fields; should be gated to `tun` only.
- **P2** — Canvas has no port or edge for the listen `detour` inbound-to-inbound reference (linked to the P0 above).

---

## Implementation Tasks

1. **Add `detour` select to listen group** — `src/components/Inspector.tsx` lines 849–859 (`sharedFieldDefinitions("listen")`). Add `{ label: "Detour Inbound", path: ["detour"], kind: "select", options: inboundOptions }` where `inboundOptions` is populated from `(config.inbounds ?? []).map(i => i.tag).filter(Boolean)`. Also add `"detour"` to `listenSharedFields` (line 95) so `inboundHandledFields` covers it. [P0]

2. **Add `direct`-specific Inspector section** — `src/components/Inspector.tsx` after the shared inbound block (around line 1501). Add a branch `{ref.kind === "inbound" && entityType === "direct" ? (...) : null}` rendering:
   - `network` as `<select>` with options `["", "tcp", "udp"]`, empty string meaning "both".
   - `override_address` as `<input type="text">`.
   - `override_port` as `<input type="number">`.
   Add `"network"`, `"override_address"`, `"override_port"` to `inboundHandledFields`. [P1]

3. **Add missing listen fields to `listenSharedFields`** — `src/components/Inspector.tsx` line 95. Append: `"tcp_multi_path"`, `"disable_tcp_keep_alive"`, `"tcp_keep_alive"`, `"tcp_keep_alive_interval"`, `"udp_fragment"`. Also add corresponding entries to `sharedFieldDefinitions("listen")` (around line 858):
   - `{ label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" }`
   - `{ label: "Disable TCP Keep-alive", path: ["disable_tcp_keep_alive"], kind: "boolean" }`
   - `{ label: "TCP Keep-alive", path: ["tcp_keep_alive"], kind: "text" }`
   - `{ label: "TCP Keep-alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" }`
   - `{ label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" }` [P1]

4. **Fix `routing_mark` control type** — `src/components/Inspector.tsx` line 854. Change `kind: "number"` to `kind: "text"`. [P1]

5. **Guard `address` and `auto_route` to `tun` only** — `src/components/Inspector.tsx` lines 1486–1500. Wrap the `address` field with `{"address" in entity && entityType === "tun" ? (...) : null}` and the `auto_route` toggle with `{entityType === "tun" ? (...) : null}`. [P2]

6. **Add `detour-inbound` canvas port** — `src/components/SbcNode.tsx` around line 136. After the three base ports, add a conditional port: `if (entity?.detour) ports.push({ key: "detour-inbound", label: "Detour inbound", nodeKind: "inbound", icon: RadioTower })`. Add an active-check in the port-active logic (around line 297): `if (kind === "inbound" && portKey === "detour-inbound") return Boolean(entity?.detour)`. Requires passing entity to `getPortSpecs`. [P2 linked to P0]

---

## Done Criteria

- [ ] `detour` (listen field) is rendered as a select populated with inbound tags; setting it round-trips to JSON.
- [ ] `network`, `override_address`, `override_port` have dedicated first-class controls in the `direct`-type Inspector section.
- [ ] All 15 listen common fields (including the 5 previously missing ones) appear in the "Listen Fields" panel for `inbound:direct`.
- [ ] `routing_mark` accepts both integer and hex string inputs.
- [ ] `address` and `auto_route` do not appear in the Inspector when `type` is `direct`.
- [ ] Importing a config with `"network": "udp"`, `"override_address": "1.0.0.1"`, `"override_port": 53` round-trips without silent field loss.
- [ ] Canvas edge appears when the listen `detour` field references another inbound.
- [ ] Semantic diagnostics catch: `listen` field absent (required by official doc), invalid `network` value.
- [ ] Stable and testing docs are identical — confirmed above; no version-specific delta needed beyond the 1.12/1.13 field guards already noted.
