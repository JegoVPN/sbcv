<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / mixed UI Review (Claude Deep Review)

## Scope

- Editable node: `inbound:mixed`
- Palette kind: `mixed` (anomalous — see P0 below)
- Official doc (stable): `inbound/mixed.md`
- Official doc (testing): `inbound/mixed.md` — no testing diff
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Official Model

### Writable fields (stable)

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `tag` | string | optional | auto-generated | Unique identifier for this inbound | Used in route/DNS rule `inbound` filter |
| `type` | string literal | required | `"mixed"` | Protocol discriminator | Value is always `"mixed"` |
| `users` | array of `{username, password}` | optional | `[]` | SOCKS + HTTP credential pairs | Empty = no authentication required |
| `set_system_proxy` | bool | optional | `false` | Automatically set OS proxy on start, clear on stop | Platform restriction: Linux, Android, Windows, macOS only |
| *(listen fields)* | — | — | — | See shared/listen.md | 15 shared fields via Listen Fields |

Total official writable fields: **4 own + 15 shared listen = 19**.

### Listen Fields (shared/listen.md, stable)

| Field | Type | Since | Notes |
| --- | --- | --- | --- |
| `listen` | string | stable | Required. Listen address |
| `listen_port` | int | stable | Listen port |
| `bind_interface` | string | 1.12.0 | Network interface to bind |
| `routing_mark` | int/hex-string | 1.12.0 | Linux only. netfilter routing mark |
| `reuse_addr` | bool | 1.12.0 | Reuse listener address |
| `netns` | string | 1.12.0 | Linux only. Network namespace name or path |
| `tcp_fast_open` | bool | stable | Enable TCP Fast Open |
| `tcp_multi_path` | bool | stable | Enable TCP Multi Path (Go 1.21+) |
| `disable_tcp_keep_alive` | bool | 1.13.0 | Disable TCP keep-alive |
| `tcp_keep_alive` | duration string | 1.13.0 | Initial keep-alive period (default `5m`) |
| `tcp_keep_alive_interval` | duration string | stable | Keep-alive interval (default `75s`) |
| `udp_fragment` | bool | stable | Enable UDP fragmentation |
| `udp_timeout` | duration string | stable | UDP NAT expiration (default `5m`) |
| `detour` | string | stable | Forward connections to another inbound |
| `sniff` / `sniff_override_destination` / `sniff_timeout` / `domain_strategy` / `udp_disable_domain_unmapping` | — | deprecated 1.11.0 | Will be removed in 1.13.0 |

### Deprecated fields (do not render in Inspector)

`sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping` — deprecated in 1.11.0 and scheduled for removal in 1.13.0. Must not be created by the UI; must survive round-trip in imported configs but should never be offered as editable inputs.

### Cross-version diff (testing)

The testing doc is byte-for-byte identical to the stable doc. No testing-only fields exist for `mixed`.

### Relationship model

`inbound:mixed` writes into `config.inbounds[]` with `"type": "mixed"`. Other nodes reference it by tag:

- `route-rule.inbound[]` — array of inbound tag strings; the canvas draws a `route-rule-match` edge from the inbound node to the rule node.
- `dns-rule.inbound[]` — same pattern.
- `route` references all inbounds collectively via the `route` port.

The inbound node has no *outgoing* tag reference except through those edge ports. `detour` (listen field) references another inbound tag, which would need a separate edge representation if ever exposed.

---

## Priority Findings

### P0 — Palette kind naming inconsistency

**Finding:** `Palette.tsx` line 132 declares:

```
{ label: "Mixed", kind: "mixed", ... }
```

Every other inbound entry uses the `inbound-<type>` prefix pattern (`inbound-direct`, `inbound-socks`, `inbound-http`, …). `mixed` breaks that pattern. `tun` also breaks it, but `tun` is architecturally distinct (it is a kernel-level interface, not a proxy protocol inbound in the same sense). `mixed` is a standard proxy-protocol inbound and has no architectural reason to use an unprefixed kind.

**Impact analysis:**

- `INBOUND_PALETTE_TYPES` in `protocols.ts` maps `mixed: "mixed"` — this mapping works correctly at runtime because `inboundTypeForPaletteKind("mixed")` resolves to `"mixed"`, so node creation succeeds.
- The inconsistency is therefore currently invisible to end users and does not cause a functional bug in isolation.
- However, if any code ever iterates `INBOUND_PALETTE_TYPES` keys to filter for `inbound-*` prefixed entries (e.g., to build a category selector or diagnostic), `mixed` would be silently excluded.
- Any future tooling (search, filter, auto-categorise by prefix) would treat `mixed` as a non-inbound item.
- The inconsistency makes the codebase harder to navigate: a developer searching for all inbound palette kinds by the `inbound-` prefix convention would miss `mixed`.

**Recommendation:** Rename the palette kind from `"mixed"` to `"inbound-mixed"` and update `INBOUND_PALETTE_TYPES` accordingly. The sing-box inbound type value (`"mixed"`) is unchanged — only the Palette/store routing key changes.

---

### P0 — `users[]` rendered as raw JSON textarea, not a structured repeater

**Finding:** The `inbound` Inspector block (`Inspector.tsx` lines 1484–1502) contains only a generic `Address` text input, an `Auto route` toggle, and an `AdvancedScalarFields` fallthrough for any unrecognised scalar fields. `users` is an **array of objects**, which means `editableScalarFields()` skips it (it only collects string/number/boolean scalars). There is no `JsonField` or structured control for `users` anywhere in the `ref.kind === "inbound"` branch.

Searching the whole Inspector confirms: the only `users` renders are at lines 1805 and 1811, both inside `ref.kind === "service"` branches (for `ssm-api` and `hysteria-realm` service types). The `inbound:mixed` node's `users[]` array is **never rendered** in the Inspector at all — it is silently swallowed because it is an array and `AdvancedScalarFields` ignores non-scalar values.

**Impact:** A user who opens an imported `mixed` inbound that already has `users` entries will see them in the exported JSON (round-trip preserved via `updateField` pass-through), but cannot view, add, edit, or remove individual credentials from the UI.

**Recommendation:** Add a dedicated Inspector branch for `entityType === "mixed"` (and analogously for `socks`, `http` inbounds when those are implemented) that renders `users[]` via a structured repeater. Each row should have `username` and `password` text inputs. Until a general-purpose repeater component exists, a `JsonField` fallback (as already used for service types) is acceptable and must be added immediately.

---

### P0 — `set_system_proxy` not rendered in Inspector

**Finding:** `set_system_proxy` is a boolean own-field of `mixed` that does **not** appear in `inboundHandledFields` and is **not** handled by any explicit `entityType === "mixed"` branch. Because it is a boolean, `editableScalarFields()` *would* surface it in `AdvancedScalarFields` — but only if it is already present in the entity object (i.e., it was explicitly set to `false` or `true` in an imported config). If `set_system_proxy` is absent from the entity (the default new-node case), `editableScalarFields()` produces no entry for it, and the user has no way to enable it from the UI.

**Impact:** New `mixed` inbounds created from the Palette cannot enable system-proxy mode without exporting the JSON and manually editing it.

**Recommendation:** Add a named `set_system_proxy` toggle in the dedicated `entityType === "mixed"` Inspector branch. Mark it with the platform caveat (Linux/Android/Windows/macOS only) as a UI hint or disabled state when the platform cannot be determined. The field should default to `false` and write `undefined` (omit) rather than `false` when unchecked, to keep exported JSON clean.

---

### P1 — `inboundHandledFields` does not include `users` or `set_system_proxy`

**Finding:** `inboundHandledFields` (`Inspector.tsx` line 116) does not list `users` or `set_system_proxy`. This means:

- `users` (array): silently dropped by `editableScalarFields` — not exposed at all.
- `set_system_proxy` (bool): surfaces in `AdvancedScalarFields` only when already present in the entity, under an unlabelled "Advanced fields" collapsed section with a generic auto-generated label `"Set System Proxy"`.

The `AdvancedScalarFields` path is a safety net for unknown fields, not the intended presentation for a first-class protocol option like `set_system_proxy`.

**Recommendation:** Once the dedicated `entityType === "mixed"` branch is added:

1. Add `"users"` and `"set_system_proxy"` to `inboundHandledFields` so `AdvancedScalarFields` stops double-rendering them.
2. Render both fields explicitly in the new branch, not via the fallback.

---

### P1 — `address` and `auto_route` rendered for all inbound kinds including `mixed`

**Finding:** The generic `ref.kind === "inbound"` block (lines 1484–1502) unconditionally renders:

- `Address` text input (`entity.address`)
- `Auto route` toggle (`entity.auto_route`)

Both fields are specific to TUN inbounds. `mixed` has neither `address` nor `auto_route` in its official schema. Rendering them for a `mixed` node is incorrect and misleading; writing a value into them would produce invalid exported JSON.

**Recommendation:** Gate the `address` and `auto_route` controls behind `entityType === "tun"` checks, or restructure the inbound block into per-type branches. Until that refactor lands, the `address`/`auto_route` inputs will silently show (and allow editing of) fields that have no meaning for a `mixed` inbound.

---

### P1 — Listen Fields section always rendered but `listen` field is required

**Finding:** `sharedGroupsForEntity` (`sharedFieldRegistry.ts` line 166) correctly pushes `"listen"` for all `CREATABLE_INBOUND_TYPES` including `mixed`. The Listen Fields shared section (containing `listen`, `listen_port`, etc.) is therefore always rendered in the Inspector for `mixed` — this is correct.

However, `listen` is marked **Required** in the official docs. The current Inspector does not visually distinguish required fields from optional ones, and there is no diagnostic or validation hint that `listen` must be non-empty before the config is valid.

**Recommendation (P2 severity for general required-field indication):** Mark `listen` (and other required fields) with a visual required indicator in the Listen Fields section, or add a semantic diagnostic for `mixed` inbounds that have no `listen` address set.

---

## Left: Add Library

### Current state (Palette.tsx line 132)

```
{ label: "Mixed", kind: "mixed", icon: RadioTower, docsUrl: docs("inbound/mixed/"), ready: true }
```

- `itemStatus()` resolves to `"add"` because `ready: true` is set.
- `canActivate()` returns `true` → clicking triggers `createFromPalette("mixed")`.
- `inboundTypeForPaletteKind("mixed")` → `"mixed"` → `addInbound(config, "mixed", "mixed-in")` — node creation succeeds.
- `docsUrl` points to the correct `inbound/mixed/` page.

### Gap analysis

1. The palette kind `"mixed"` breaks the `inbound-*` convention (P0 above).
2. The entry is marked `ready: true` and presents as fully functional, which is accurate for basic creation and export but overstates the Inspector completeness (no `users[]` or `set_system_proxy` editing — P0 findings above).
3. No duplicate-add guard exists (same issue as for other singleton-style nodes): clicking "Add Mixed" a second time creates a second `mixed` inbound with a new generated tag, which is valid per the data model (multiple `mixed` inbounds are legal), so this is not a bug.

### Recommendations

1. **P0 — Rename kind** from `"mixed"` to `"inbound-mixed"` for consistency.
2. **P2 — Status accuracy**: Consider whether `ready: true` should be downgraded to `status: "setup"` until the Inspector gaps (users, set_system_proxy) are resolved, to set accurate user expectations.

---

## Middle: Canvas Node

### Current state (SbcNode.tsx / graph.ts)

- `graph.ts` line 229: all `config.inbounds[]` entries are iterated uniformly; each generates a node with `kind: "inbound"`, `type: inbound.type` (e.g. `"mixed"`), and auto-tagged title/subtitle.
- `getPortSpecs` for `kind === "inbound"` (SbcNode.tsx line 136) returns:
  - **Output ports**: `route` (Route hub), `route-rule-match` (Route Rule matcher), `dns-rule-match` (DNS Rule matcher)
  - **No `shadowsocks`-specific service port** (correct for `mixed`)
- `isPortVisible` for `inbound` kind returns `true` for `route`, `route-rule-match`, `dns-rule-match` ports when the corresponding config sections exist.

### Gap analysis

- Port semantics are correct for `mixed`. No special ports are needed beyond the three standard inbound output ports.
- The canvas node's `type` field is `"mixed"` (the sing-box protocol value), correctly distinct from the canvas `kind` of `"inbound"`.
- No mixed-specific canvas anomalies found.

---

## Right: Inspector

### Current state summary

| Field | Rendered? | How | Quality |
| --- | --- | --- | --- |
| `tag` | Yes | Text input (line 1182) | Correct — rename via `renameTag` |
| `type` | Yes | Select from `CREATABLE_INBOUND_TYPES` (line 1195) | Correct |
| `listen` (shared) | Yes | Via Listen Fields shared section | Correct |
| `listen_port` (shared) | Yes | Via Listen Fields shared section | Correct |
| other listen fields | Yes | Via Listen Fields shared section | Correct |
| `users` | **No** | Not rendered anywhere for `inbound` kind | **P0 gap** |
| `set_system_proxy` | Partial | Only surfaced in AdvancedScalarFields if already present in entity | **P0 gap** |
| `address` | Shown (wrong) | Generic inbound block — TUN-only field shown for mixed | **P1 bug** |
| `auto_route` | Shown (wrong) | Generic inbound block — TUN-only field shown for mixed | **P1 bug** |
| deprecated sniff fields | Not rendered | Correctly excluded by `AdvancedScalarFields` scalar filter (they are bools/strings but not in imported minimal fixtures) | Acceptable |

---

## Implementation Tasks

### Task 1 — Rename palette kind (P0)

**File:** `src/domain/protocols.ts`

Change:
```ts
// INBOUND_PALETTE_TYPES
mixed: "mixed",
```
To:
```ts
"inbound-mixed": "mixed",
```

**File:** `src/components/Palette.tsx` line 132

Change:
```ts
{ label: "Mixed", kind: "mixed", ... }
```
To:
```ts
{ label: "Mixed", kind: "inbound-mixed", ... }
```

No other files reference the palette kind string `"mixed"` as a routing key (confirmed by grep). The sing-box type value `"mixed"` is unchanged everywhere else.

---

### Task 2 — Add `entityType === "mixed"` Inspector branch (P0)

**File:** `src/components/Inspector.tsx`

Inside the `ref.kind === "inbound"` block, add a type-specific sub-block before the closing `AdvancedScalarFields` call:

```tsx
{entityType === "mixed" ? (
  <>
    <UsersRepeaterField
      label="Users"
      value={entity.users ?? []}
      onChange={(value) => updateField(ref, "users", value)}
      hint="Leave empty to allow unauthenticated access"
    />
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={Boolean(entity.set_system_proxy)}
        onChange={(event) =>
          updateField(ref, "set_system_proxy", event.target.checked || undefined)
        }
      />
      <span>Set system proxy</span>
    </label>
  </>
) : null}
```

Until `UsersRepeaterField` is built, substitute a `JsonField`:

```tsx
<JsonField
  label="Users JSON"
  value={entity.users ?? []}
  onChange={(value) => updateField(ref, "users", value)}
/>
```

---

### Task 3 — Add `users` and `set_system_proxy` to `inboundHandledFields` (P1)

**File:** `src/components/Inspector.tsx` line 116

Add to `inboundHandledFields`:
```ts
const inboundHandledFields = new Set([
  "tag",
  "type",
  "address",
  "auto_route",
  "tls",
  "multiplex",
  "transport",
  "handshake",
  "users",           // ADD
  "set_system_proxy", // ADD
  ...listenSharedFields,
  ...quicSharedFields,
]);
```

---

### Task 4 — Gate `address` and `auto_route` to TUN only (P1)

**File:** `src/components/Inspector.tsx` lines 1486–1500

Wrap the `Address` input and `Auto route` toggle:

```tsx
{entityType === "tun" ? (
  <>
    <label className="field">
      <span>Address</span>
      <input
        value={toList(entity.address)}
        onChange={(event) => updateField(ref, "address", fromList(event.target.value))}
      />
    </label>
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={Boolean(entity.auto_route)}
        onChange={(event) => updateField(ref, "auto_route", event.target.checked)}
      />
      <span>Auto route</span>
    </label>
  </>
) : null}
```

---

## Done Criteria

- Palette entry uses `kind: "inbound-mixed"` and creation still works end-to-end.
- Inspector for a `mixed` inbound shows no `Address` or `Auto route` inputs.
- Inspector renders `users[]` (repeater or JSON fallback) and `set_system_proxy` toggle.
- Exporting a `mixed` inbound with `users` populated and `set_system_proxy: true` round-trips correctly to JSON.
- Importing a fixture `mixed` inbound with `users` and `set_system_proxy` shows both fields editable.
- `listen` and `listen_port` remain visible via the shared Listen Fields section.
- Deprecated `sniff*` / `domain_strategy` fields from an imported legacy fixture survive export but are not offered as editable inputs.
