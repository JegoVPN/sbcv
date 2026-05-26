<!-- Status: official-read. Source: stable inbound/tproxy.md + stable shared/listen.md + testing diff + Palette/SbcNode/Inspector/sharedFieldRegistry grep. UI verification + implementation fixes still pending. -->
# Inbound / tproxy UI Review (Claude Deep Review)

## Scope

- Editable node: `inbound:tproxy`
- Palette kind: `inbound-tproxy`
- Official doc (stable): `.tmp/sing-box-docs/stable/docs/configuration/inbound/tproxy.md`
- Official doc (testing): `.tmp/sing-box-docs/testing/docs/configuration/inbound/tproxy.md`
- Shared listen fields (stable): `.tmp/sing-box-docs/stable/docs/configuration/shared/listen.md`
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Platform Gate

**TProxy is Linux only.** The official doc opens with:

> Only supported on Linux.

This means:
- The node is functionally useless on Windows, macOS, Android, and iOS targets.
- No platform-gate exists anywhere in the current UI code. Neither the Palette entry nor the Inspector nor diagnostics emit a warning or disables the node for non-Linux contexts.
- The Palette entry (`status: "setup"`) will happily add the node on any target without any indication of the constraint.

This is the highest-priority gap for this node.

---

## Official Model

### Protocol-specific fields (tproxy.md)

| Field | Type | Required | Default | Semantic |
| --- | --- | --- | --- | --- |
| `network` | enum string | optional | both (empty) | Accept network: `"tcp"`, `"udp"`, or absent (both) |

Total protocol-specific fields: **1**.

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
| `tcp_keep_alive` | string (duration) | optional | `"5m"` | TCP keep-alive initial period | Since 1.13.0 |
| `tcp_keep_alive_interval` | string (duration) | optional | `"75s"` | TCP keep-alive interval | Stable |
| `udp_fragment` | bool | optional | false | Enable UDP fragmentation | Stable |
| `udp_timeout` | string (duration) | optional | `"5m"` | UDP NAT expiration time | Stable |
| `detour` | string | optional | — | Forward connections to specified inbound (must be Injectable) | Stable |

### Deprecated listen fields (removed in 1.13.0)

| Field | Deprecated since | Notes |
| --- | --- | --- |
| `sniff` | 1.11.0 | Enable protocol sniffing — use rule action instead |
| `sniff_override_destination` | 1.11.0 | Override destination with sniffed domain |
| `sniff_timeout` | 1.11.0 | Sniff timeout (default `300ms`) |
| `domain_strategy` | 1.11.0 | Resolve domain to IP before routing |
| `udp_disable_domain_unmapping` | 1.11.0 | Compatibility option for domain UDP responses |

Total official writable fields (stable, non-deprecated): **1 protocol-specific + 14 listen common = 15**.

---

## Cross-version diff (testing)

The testing doc (`testing/docs/configuration/inbound/tproxy.md`) is **byte-for-byte identical** to the stable doc. No new fields, no changed defaults, no new deprecations. The `tproxy` inbound is stable across versions.

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

---

## Compat / Target gate

- **Linux only** — entire inbound is unsupported on non-Linux platforms. UI currently has no gate.
- Several listen fields carry their own Linux-only sub-gates: `routing_mark` (Linux only), `netns` (Linux only). For a Linux-only inbound these sub-gates are moot, but the UI still renders them without any label.
- Version-gated listen fields: `bind_interface`, `routing_mark`, `reuse_addr`, `netns` since 1.12.0; `disable_tcp_keep_alive`, `tcp_keep_alive` (default change) since 1.13.0.
- The deprecated sniff/domain fields should not be shown for targets >= 1.13.0.

---

## Left: Add Library

### Current state (Palette.tsx line 147)

```ts
{ label: "TProxy", kind: "inbound-tproxy", icon: GitBranch, docsUrl: docs("inbound/tproxy/"), status: "setup" }
```

- `itemStatus()` returns `"setup"` (explicit `status` override).
- The button label resolves to `"Setup TProxy"`.
- `canActivate()` returns `true` for `"setup"` — clicking calls `createFromPalette("inbound-tproxy")`.
- `createFromPalette` → `inboundTypeForPaletteKind("inbound-tproxy")` → `"tproxy"` → `addInbound(config, "tproxy", "tproxy-in")`.
- The `docsUrl` points to the correct official documentation URL.
- Template stub (`commands.ts` lines 251–259): sets `listen: "127.0.0.1"`, `listen_port: 2080`, `network: "tcp"`.

### Gap analysis

- **No platform gate**: The entry is shown and clickable on all platforms. There is no `disabled` prop, no `status: "gated"` (as used for `cloudflared`), and no diagnostic for non-Linux usage.
- The icon `GitBranch` is acceptable for a transparent proxy inbound, but it is shared with `inbound-redirect`. A distinct icon would differentiate the two.
- Template default sets `network: "tcp"` but tproxy is most commonly used for UDP too. Defaulting to `"tcp"` is defensible as a stub but should be documented or left absent (empty = both).

### Recommendations

1. **P0 — Add Linux-only platform gate**: Either add `status: "gated"` with a platform check (mirroring `cloudflared`), or add a warning diagnostic in `diagnostics.ts` when a `tproxy` inbound is present and the target context is not Linux. At minimum, a warning badge in the Palette label noting "Linux only" is required.

---

## Middle: Canvas Node

### Current state (SbcNode.tsx lines 136–144)

The `kind === "inbound"` branch of `getPortSpecs` is shared across all inbound types and returns:

```ts
[
  { key: "route",            label: "Route hub",          nodeKind: "route",      icon: Route },
  { key: "route-rule-match", label: "Route rule matcher", nodeKind: "route-rule", icon: GitBranch },
  { key: "dns-rule-match",   label: "DNS rule matcher",   nodeKind: "dns-rule",   icon: GitBranch },
]
```

No `type === "tproxy"` branching in `getPortSpecs`. Port-active checks (lines 297–303) are correct for these three ports.

### Gap analysis

- **No `detour` canvas port**: The listen field `detour` (inbound-to-inbound forwarding) has no canvas edge. This is a silent relationship gap shared with all inbounds (same as `inbound:direct` finding).
- **Platform visual**: The canvas node gives no hint that this inbound requires Linux. A status badge or warning overlay would help users who deploy across mixed targets.

### Recommendations

1. **P1 — Missing `detour` canvas port**: Same recommendation as `inbound:direct` — add a conditional output port `{ key: "detour-inbound", label: "Detour inbound", nodeKind: "inbound" }` when `entity.detour` is set. (Shared gap across all inbounds.)
2. **P2 — Platform warning on canvas node**: When `type === "tproxy"` (or `type === "redirect"`), display a "Linux only" badge or overlay on the canvas node to alert users about the platform constraint.

---

## Right: Inspector

### Current state for inbound rendering

The Inspector renders a shared inbound block for all inbound types (lines 1484–1502):

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

`inboundHandledFields` (lines 116–127) includes `listenSharedFields` which covers: `listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout`.

`sharedGroupsForEntity` (sharedFieldRegistry.ts line 166) pushes `"listen"` for all `CREATABLE_INBOUND_TYPES`, which includes `"tproxy"`. So the listen panel is shown.

### Field-by-field audit (official vs rendered)

**Protocol-specific fields:**

| Official field | Inspector rendering | Assessment |
| --- | --- | --- |
| `network` | NOT in `inboundHandledFields`; falls through to `AdvancedScalarFields` if present in entity | **P1 gap**: `network` is not explicitly rendered. If imported config has `"network": "udp"` it appears in Advanced fields as a raw text input. Should be a `<select>` with options `""` (both), `"tcp"`, `"udp"`. |

**Listen common fields:**

| Official field | Rendered in "Listen Fields" panel | Assessment |
| --- | --- | --- |
| `listen` | text | Correct |
| `listen_port` | number | Correct |
| `bind_interface` | text | Correct |
| `routing_mark` | number | Partially correct: official doc also accepts hex strings (`"0x1234"`). Should be `kind: "text"`. |
| `reuse_addr` | boolean | Correct |
| `netns` | text | Correct |
| `tcp_fast_open` | boolean | Correct |
| `tcp_multi_path` | **NOT in `listenSharedFields`** | **P1 gap**: Absent from listen panel. Falls to `AdvancedScalarFields` only if already present in entity. |
| `disable_tcp_keep_alive` | **NOT in `listenSharedFields`** | **P1 gap**: Since 1.13.0. Absent entirely. |
| `tcp_keep_alive` | **NOT in `listenSharedFields`** | **P1 gap**: Since 1.13.0. Duration string. Absent. |
| `tcp_keep_alive_interval` | **NOT in `listenSharedFields`** | **P1 gap**: Duration string. Absent. |
| `udp_fragment` | **NOT in `listenSharedFields`** | **P1 gap**: Boolean. Absent from listen panel. |
| `udp_timeout` | text | Correct |
| `detour` | **NOT in `listenSharedFields`, NOT in `inboundHandledFields`** | **P0 gap**: `detour` references another inbound by tag. Completely absent from all inbound rendering paths. Should be a `<select>` populated with existing inbound tags (excluding self). |

**`address` / `auto_route` rendering (lines 1486–1500):**

These are shown for **all** inbounds. For `tproxy`, neither `address` nor `auto_route` is a documented field. This is a pre-existing shared gap (same as `inbound:direct`).

**Deprecated sniff/domain fields:**

If an imported config has `"sniff": true`, it falls through to `AdvancedScalarFields` as an unlabelled Advanced checkbox. No suppression or version warning. Low severity since these fields are ignored or cause an error when used with >= 1.13.0 targets.

### `network` field and template interaction

The template stub (`commands.ts` line 257) sets `"network": "tcp"`. Because `"network"` is NOT in `inboundHandledFields`, it will surface in the `AdvancedScalarFields` panel as a raw text input. There is no first-class `<select>` for the common case of switching between `"tcp"`, `"udp"`, or both.

For `tproxy` this is particularly important because the canonical use case is UDP (DNS interception, QUIC). A user creating a fresh node via Palette will get `"network": "tcp"` only and must manually clear or change it via the Advanced panel.

### Recommendations

1. **P0 — Add `detour` select for inbound-to-inbound forwarding**: In `sharedFieldDefinitions("listen")` or in a tproxy-specific Inspector section, add a `<select>` for `detour` populated with all inbound tags (excluding self). Add `"detour"` to `listenSharedFields`. [Shared with all inbounds.]

2. **P0 — Add Linux-only platform gate**: Add a diagnostic warning in `diagnostics.ts` when `type === "tproxy"` is present in the config. The warning should cite the Linux-only constraint. Optionally, disable the Palette entry or add a `"gated"` / warning status for non-Linux target contexts.

3. **P1 — Add `network` select for `tproxy`**: In a type-specific Inspector section (or a shared `redirect`+`tproxy` block), render a `<select>` with options `""` (both), `"tcp"`, `"udp"`. Add `"network"` to `inboundHandledFields`. Update the template default to either `""` (both) or document why `"tcp"` is the preferred stub value.

4. **P1 — Add missing listen fields to `listenSharedFields` and `sharedFieldDefinitions("listen")`**: [Shared with all inbounds]
   - `tcp_multi_path` (boolean)
   - `disable_tcp_keep_alive` (boolean, since 1.13.0)
   - `tcp_keep_alive` (duration text, since 1.13.0)
   - `tcp_keep_alive_interval` (duration text)
   - `udp_fragment` (boolean)
   Append to `listenSharedFields` array (Inspector.tsx line 95). Add corresponding `sharedFieldDefinitions("listen")` entries.

5. **P1 — Fix `routing_mark` control**: Change from `kind: "number"` to `kind: "text"` in `sharedFieldDefinitions("listen")` so hex strings like `"0x1234"` are accepted. [Shared with all inbounds.]

6. **P2 — Suppress `address` and `auto_route` for non-tun inbounds**: The shared inbound block (lines 1486–1500) shows these fields for `tproxy` where they are not documented. Gate them with `entityType === "tun"`. [Shared with all inbounds.]

7. **P2 — Canvas platform badge**: Show a "Linux only" visual indicator on the canvas node when `type === "tproxy"` (and `type === "redirect"`).

---

## Tag Reference Surfaces

The `tag` of this node is referenced by:

| Surface | Field | Where edited |
| --- | --- | --- |
| Route rules | `route.rules[].inbound` | `RouteRuleInspector` → `RuleListField` (Inspector.tsx line 603) |
| DNS rules | `dns.rules[].inbound` | `DnsRuleInspector` → `RuleListField` (Inspector.tsx line 707) |
| Listen `detour` of another inbound | `inbounds[].detour` | Currently no dedicated surface — falls to Advanced fields |

Tag rename (`renameTag`) correctly propagates to `route.rules[].inbound` and `dns.rules[].inbound` string and array forms.

---

## Priority Findings

- **P0** — No Linux-only platform gate exists anywhere (Palette, Inspector, diagnostics). `tproxy` is silently creatable and shows no warning on non-Linux targets. This is the most critical gap because TProxy requires kernel-level iptables TPROXY support that is entirely absent outside Linux.
- **P0** — `detour` (listen field, inbound-to-inbound forwarding) is completely absent from the Inspector. Any config with `"detour": "some-inbound"` imports but the field cannot be set or cleared from the UI. [Shared gap with all inbounds.]
- **P1** — `network` (sole tproxy protocol field) falls through to `AdvancedScalarFields` raw text input instead of a dedicated `<select>` with `""` / `"tcp"` / `"udp"` options. The template stub hard-codes `"tcp"`, which is wrong for common UDP transparent proxy use cases.
- **P1** — `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment` — five listen fields present in stable docs are absent from `listenSharedFields` and the listen panel. [Shared gap.]
- **P1** — `routing_mark` rendered as `kind: "number"` but the official doc also accepts hex strings. [Shared gap.]
- **P2** — `address` and `auto_route` are displayed in the Inspector for `tproxy` where they are not documented fields. Should be gated to `tun` only. [Shared gap.]
- **P2** — Canvas node has no visual indicator of the Linux-only platform requirement.
- **P2** — Canvas has no port or edge for the listen `detour` inbound-to-inbound reference. [Shared gap.]

---

## Implementation Tasks

1. **Add Linux-only diagnostic** — `src/domain/diagnostics.ts`. Add a warning push when `inbound.type === "tproxy"` (and `inbound.type === "redirect"` for symmetry): code `"tproxy-linux-only"`, message `"TProxy inbound is only supported on Linux; it will not function on other platforms."`. [P0]

2. **Add Palette platform warning** — `src/components/Palette.tsx` line 147. Consider changing `status: "setup"` to `status: "gated"` or adding a platform annotation. At minimum, append `" (Linux only)"` to the label or add a subtitle. The `cloudflared` entry at line 148 already uses `status: "gated"` as a model. [P0 / P2]

3. **Add `detour` select to listen group** — `src/components/Inspector.tsx`. Add `"detour"` to `listenSharedFields` (line 95) and add `{ label: "Detour Inbound", path: ["detour"], kind: "select", options: inboundOptions }` to `sharedFieldDefinitions("listen")` (around line 858). [P0, shared with all inbounds]

4. **Add `tproxy`-specific Inspector section** — `src/components/Inspector.tsx` after the shared inbound block (around line 1501). Add:
   ```tsx
   {ref.kind === "inbound" && entityType === "tproxy" ? (
     <label className="field">
       <span>Network</span>
       <select value={String(entity.network ?? "")} onChange={(e) => updateField(ref, "network", e.target.value || undefined)}>
         <option value="">Both (tcp + udp)</option>
         <option value="tcp">TCP only</option>
         <option value="udp">UDP only</option>
       </select>
     </label>
   ) : null}
   ```
   Add `"network"` to `inboundHandledFields`. [P1]

5. **Fix template default for `network`** — `src/domain/commands.ts` line 257. Change `network: "tcp"` to either omit the field (defaulting to both) or set `network: ""`. If a non-empty default is preferred, document the rationale. [P1]

6. **Add missing listen fields to `listenSharedFields`** — `src/components/Inspector.tsx` line 95. Append: `"tcp_multi_path"`, `"disable_tcp_keep_alive"`, `"tcp_keep_alive"`, `"tcp_keep_alive_interval"`, `"udp_fragment"`. Add corresponding `sharedFieldDefinitions("listen")` entries:
   - `{ label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" }`
   - `{ label: "Disable TCP Keep-alive", path: ["disable_tcp_keep_alive"], kind: "boolean" }`
   - `{ label: "TCP Keep-alive", path: ["tcp_keep_alive"], kind: "text" }`
   - `{ label: "TCP Keep-alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" }`
   - `{ label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" }` [P1, shared]

7. **Fix `routing_mark` control type** — `src/components/Inspector.tsx` `sharedFieldDefinitions("listen")`. Change `kind: "number"` to `kind: "text"` for the `routing_mark` row. [P1, shared]

8. **Guard `address` and `auto_route` to tun** — `src/components/Inspector.tsx` lines 1486–1500. Wrap both controls with `entityType === "tun"` guards. [P2, shared]

9. **Add canvas platform badge** — `src/components/SbcNode.tsx`. When `type === "tproxy"`, add a visual badge or subtitle "Linux only" to the canvas node label. [P2]

10. **Add `detour-inbound` canvas port** — `src/components/SbcNode.tsx` around line 136. Conditional port when `entity?.detour` is set. [P2, shared with all inbounds]

---

## Done Criteria

- [ ] A warning diagnostic fires when `tproxy` inbound is present (code `"tproxy-linux-only"`).
- [ ] Palette entry has a visible "Linux only" indicator or gated state.
- [ ] `detour` (listen field) is rendered as a select populated with inbound tags; setting it round-trips to JSON.
- [ ] `network` has a dedicated first-class `<select>` in the tproxy Inspector section with options: both / tcp / udp.
- [ ] All 14 listen common fields appear in the "Listen Fields" panel for `inbound:tproxy`.
- [ ] `routing_mark` accepts both integer and hex string inputs.
- [ ] `address` and `auto_route` do not appear in the Inspector when `type` is `tproxy`.
- [ ] Importing a config with `"network": "udp"` round-trips without silent field loss.
- [ ] Canvas node shows a "Linux only" visual indicator.
- [ ] Stable and testing docs are identical — confirmed; no version-specific delta beyond the shared 1.12/1.13 listen field guards.
