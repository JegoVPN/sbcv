<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Settings / Certificate UI Review (Claude Deep Review)

## Scope

- Editable node: `settings:certificate`
- Palette kind: `settings-certificate`
- Official doc (stable): `certificate/index.md`
- Official doc (testing): `certificate/index.md` — no testing diff
- Source-of-truth: canonical sing-box JSON / domain state.
- This review covers only the top-level `certificate` settings object (`config.certificate`). It does NOT cover `certificate_providers[]`, ACME, Tailscale, or Cloudflare Origin CA — those are separate `shared/certificate-provider/*` nodes.

---

## Official Model

### Writable fields (stable + testing)

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `store` | enum string | optional | `"system"` | Default X.509 trusted CA certificate list | Four values: `system`, `mozilla`, `chrome`, `none` |
| `certificate` | string\[\] | optional | `[]` | Inline PEM certificate lines to trust | JSON array; single item may be bare string (doc note) |
| `certificate_path` | string\[\] | optional | `[]` | File paths to PEM certificates to trust | Auto-reloaded on file modification |
| `certificate_directory_path` | string\[\] | optional | `[]` | Directory paths to search for PEM certificates | Auto-reloaded on file modification |

Total official writable fields: **4**.

### Cross-version diff (testing)

The testing doc is byte-for-byte identical to the stable doc. No new fields, no removed fields, no changed defaults.

### `store` enum values

| Value | Description |
| --- | --- |
| `system` (default) | System trusted CA certificates |
| `mozilla` | Mozilla Included List with China CA certs removed |
| `chrome` | Chrome Root Store with China CA certs removed (**Since 1.13.0**) |
| `none` | Empty list — trust only explicitly added certificates |

### Relationship model

`settings:certificate` is a singleton global-settings object placed at `config.certificate`. It defines no `tag` field of its own. No other node type references it by tag. It is a trust-store configuration object — it augments TLS verification globally, but does not form part of the traffic routing graph.

The `certificate_providers[]` array lives alongside it at `config.certificate_providers` (not inside `config.certificate`); that is a separate palette section with its own nodes.

The canvas node carries **zero** connectable ports. It is a pure data object, not a chainable traffic node.

### Compat / Target gate

- The entire `certificate` object is gated since sing-box **1.12.0** (`!!! question "Since sing-box 1.12.0"` in both stable and testing docs).
- The `chrome` store value is further gated since sing-box **1.13.0** (`!!! quote "Changes in sing-box 1.13.0"`).
- There is **no diagnostic** in `src/domain/diagnostics.ts` that warns when `certificate` is used against a pre-1.12.0 target, nor when `store: "chrome"` is used against a pre-1.13.0 target.

---

## Left: Add Library

### Current state (`Palette.tsx` line 106)

```
{ label: "Certificate", kind: "settings-certificate", icon: FileKey2, docsUrl: docs("certificate/"), status: "setup" }
```

- `itemStatus()` resolves to `"setup"` (explicit `status: "setup"` override, line 251).
- The button tooltip reads: `"Add Certificate setup draft to canvas"` (`statusTitle` for `"setup"`, line 258).
- The button aria-label reads: `"Setup Certificate"` (via `statusLabel["setup"] = "Setup"`, line 241).
- `canActivate()` returns `true` for `"setup"` (line 267) → clicking triggers `createFromPalette("settings-certificate")`.
- `docsUrl` points to `https://sing-box.sagernet.org/configuration/certificate/` — correct.

### Certificate Providers section (Palette.tsx lines 109–115)

The "Certificate Providers" group immediately below contains four gated entries:

```
{ label: "Provider",              kind: "certificate-provider",                        status: "gated" }
{ label: "ACME",                  kind: "certificate-provider-acme",                   status: "gated" }
{ label: "Tailscale",             kind: "certificate-provider-tailscale",              status: "gated" }
{ label: "Cloudflare Origin CA",  kind: "certificate-provider-cloudflare-origin-ca",   status: "gated" }
```

- All four are `"gated"`, `canActivate()` returns `false`, buttons are disabled.
- The gated tooltip reads `"Certificate Provider is target-gated and needs matching sing-box validation"` — this mentions target-gating but does not name the minimum version (1.12.0).

### Gap analysis

1. **`"setup"` vs `"add"` status**: `settings-log` uses `ready: true` → `"add"`. `settings-certificate` uses `status: "setup"`. From the user perspective both actions do the same thing (place a singleton node). The use of `"setup"` implies a multi-step draft workflow that does not exist here. Inconsistency between settings nodes may confuse users.

2. **No singleton guard**: Once `settings:certificate` is placed on the canvas, clicking "Certificate" again produces a no-op (graph.ts line 185 guards on `layout.positions[id]`). The Palette gives no visual feedback that the node is already placed. Same issue as `settings:log`.

3. **Gated entry tooltip does not name the version**: The four certificate-provider entries are gated but the tooltip only says "target-gated" — it does not mention `>= 1.12.0`. Users do not know which version unlocks them.

4. **Duplicate "Certificate Provider" in "Shared" section (lines 220–223)**: There is a second block of the same four certificate-provider items in the "Shared" section (`kind: "shared-certificate-provider"`, etc.) also with `status: "gated"`. This duplication may confuse users who encounter both. They have different `kind` strings and presumably different flows, but the labels are nearly identical.

### Recommendations

1. **P1 — Change `status` to match `settings-log`**: Use `ready: true` instead of `status: "setup"` so the button reads `"Add Certificate to canvas"` consistently with other settings nodes — OR — keep `"setup"` and accept the asymmetry; document the choice.
2. **P1 — Singleton guard**: After `settings:certificate` is placed, disable the Palette button or mark it as added (reuse the `templateAdded` pattern from line 404).
3. **P2 — Gated tooltip version**: Extend the `"gated"` tooltip for certificate-provider items to mention `>= 1.12.0 required` so users can take action.
4. **P2 — Deduplicate certificate-provider palette entries**: Clarify whether `"certificate-provider"` and `"shared-certificate-provider"` are the same command or different flows; merge or distinguish visually.

---

## Middle: Canvas Node

### Current state (`graph.ts` / `SbcNode.tsx`)

**graph.ts lines 184–205**: Settings nodes are iterated from `SETTINGS_NODE_IDS` (line 42). For `settings:certificate`:

- Node ID: `"settings:certificate"`
- `data.ref = { kind: "settings", path: "certificate" }`
- `data.kind = "settings"`
- `data.type = "certificate"`
- `data.title = "Certificate"` (capitalised `path[0]`)
- `data.subtitle = "global settings"` (hardcoded for all settings nodes)
- `data.status` driven by `diagnosticStatus("/certificate", diagnostics)`
- `data.compatible = []`
- Layout column: `COLUMNS.settings = -300` (far left)
- Default Y position: `ROUTE_HUB_Y + 2 * NODE_SLOT_Y = 260 + 2 * 330 = 920` (index 2 in the array)

**SbcNode.tsx `getPortSpecs`**: For `kind === "settings"` there is no special case — both `direction === "input"` and `direction === "output"` fall through to the final `return []` at line 198. Result: **zero ports on both sides**. This is correct.

**`data.compatible = []`**: The `+` button on the canvas node (line 480–490) calls `createCompatible(id, data.compatible[0])` where `data.compatible[0]` is `undefined`. The `+` button is always rendered but clicking it produces no action. This is a latent UX issue common to all settings nodes: a visible but non-functional `+` affordance.

**Toolbar pill** (lines 493–510): Renders `{data.type}` = `"certificate"` as the type pill, and `{data.status}` = `"valid"` / `"warning"` / `"error"` as the status pill. The count button (lines 513–522) renders `{data.compatible.length || 1}` = `1` but `compatible` is empty — the `|| 1` fallback makes the count perpetually show `1`, which is meaningless for a singleton settings node.

**Title bar** (line 382): Renders `"settings / certificate"` (the raw `${data.kind} / ${data.type}` template). This exposes an internal kind name to users.

### Gap analysis

1. **Title bar exposes internal kind string**: `"settings / certificate"` is shown as the node header. For nodes like `settings:log` this reads `"settings / log"`. These internal compound names are not meaningful to users and should not be the primary visual label.

2. **`+` button is always visible but always inert**: `data.compatible = []` means the `+` button click does nothing. It should be hidden or disabled when `compatible` is empty.

3. **Count pill shows `1` spuriously**: `data.compatible.length || 1` yields `1` for an empty compatible array. This count appears to mean "1 compatible node to add" but there are none.

4. **`subtitle: "global settings"` is generic**: Shared by all four settings nodes. Subtitles like `"certificate trust store"` would be more descriptive and reduce user confusion when multiple settings nodes are visible simultaneously.

5. **No ports — correct**: The absence of input/output traffic ports is correct per the official model.

### Recommendations

1. **P1 — Fix `+` button visibility**: Conditionally render the `+` button only when `data.compatible.length > 0`. This applies to all settings nodes and several leaf nodes with empty `compatible` arrays.
2. **P1 — Fix count pill**: Hide the count pill (or show `0`) when `data.compatible` is empty instead of falling back to `1`.
3. **P2 — Title bar label**: Replace `"settings / certificate"` with a human-readable title. Separate `data.kind` from `data.type` display, or use a lookup map for friendly names.
4. **P2 — Specific subtitle**: Change subtitle from the generic `"global settings"` to `"certificate trust store"` (computed or via lookup). Impacts `graph.ts` line 197.

---

## Right: Inspector

### Current state (`Inspector.tsx` lines 1319–1356)

The `settings:certificate` branch (`ref.kind === "settings" && ref.path === "certificate"`) renders:

| Rendered field | Control | Inspector lines | Assessment |
| --- | --- | --- | --- |
| `store` | `<select>` with 4 options | 1323–1331 | Correct: enum select, default fallback `"system"` |
| `certificate` | `<textarea>` | 1335–1338 | See note |
| `certificate_path` | `<input>` (single-line) | 1343–1346 | See note |
| `certificate_directory_path` | `<input>` (single-line) | 1350–1353 | See note |

### Field-by-field audit

**`store`** (lines 1323–1331):
- Correct `<select>` with all four official values: `system`, `mozilla`, `chrome`, `none`.
- Default fallback `entity.store ?? "system"` is correct.
- **Gap**: `chrome` is a 1.13.0-only value. There is no version-gate warning or visual hint when `chrome` is selected against a stable/1.12.x target. A `channel === "stable"` guard producing a diagnostic or a tooltip saying "requires 1.13.0" would prevent silent misconfiguration.

**`certificate`** (lines 1335–1338):
- Uses `<textarea>` with `placeholder="PEM entries, comma separated"`.
- Reads via `toList(entity.certificate)` which calls `Array.isArray(value) ? value.join(", ") : ""` (line 84–86).
- Writes via `fromList(event.target.value)` which splits on comma and trims (line 88–93).
- **Gap 1**: PEM certificates cannot be comma-delimited inline PEM — a PEM block contains newlines and is not a comma-separable string. Using comma-split to parse inline PEM data will corrupt multi-line PEM entries. The correct approach for inline PEM is either: (a) treat each textarea line as a separate PEM entry (split on `\n` or `\n---` block boundary), or (b) use a repeater widget where each entry is its own text area.
- **Gap 2**: The placeholder `"PEM entries, comma separated"` reinforces the incorrect comma-separation expectation.
- **Gap 3**: `toList` renders an array as `value1, value2`. If a stored PEM entry itself contains a comma (unlikely but possible in DN fields), the round-trip will corrupt the value.

**`certificate_path`** (lines 1343–1346):
- Uses `<input>` (single-line) with `toList` / `fromList` (comma-separated array).
- File paths rarely contain commas; comma-separated input is acceptable for paths.
- **Gap**: The field is a `string[]` — multiple paths are expected. A single-line input with comma separation is minimally functional but provides poor UX for long or multiple paths. A multi-line textarea or repeater list would be better.
- The official doc notes auto-reload on file modification — there is no UI hint of this behaviour.

**`certificate_directory_path`** (lines 1350–1353):
- Same control shape as `certificate_path`. Same gaps apply.
- Official doc notes auto-reload on modification — no UI hint.

### Missing diagnostic: `chrome` store on stable channel

`diagnostics.ts` has no check for `config.certificate?.store === "chrome"` when `channel === "stable"`. A warning-level diagnostic should be emitted similar to the `stable-version-gated-certificate-providers` pattern (diagnostics.ts line 306–314).

### Missing diagnostic: `certificate` object existence on pre-1.12.0 targets

The entire `certificate` settings object is `>= 1.12.0`. If the user sets any certificate field and has a stable/pre-1.12.x target there is no version-gate diagnostic. (The diagnostics only gate `certificate_providers`, not `certificate` itself.)

### Recommendations

1. **P0 — Fix PEM textarea round-trip**: Comma-separated split of PEM certificate data corrupts multi-line PEM blocks. Change `certificate` field to either: a per-line split (`\n`-split with empty-line collapse) or a dedicated repeater. At minimum fix the placeholder to reflect actual expected input format.
2. **P1 — Add `chrome` store version gate diagnostic**: Emit a `warning` diagnostic at `/certificate/store` when `store === "chrome"` and `channel === "stable"` (Chrome Root Store requires 1.13.0).
3. **P1 — Add `certificate` block version gate diagnostic**: Emit a `warning` at `/certificate` when `config.certificate` is present and `channel === "stable"` (entire block requires 1.12.0).
4. **P2 — Add auto-reload hint text**: Add a helper text or tooltip to `certificate_path` and `certificate_directory_path` fields noting "Automatically reloaded on file modification."
5. **P2 — Improve path input to multiline**: Change `certificate_path` and `certificate_directory_path` from `<input>` to `<textarea>` to better support multiple entries.

---

## Tag Reference Surfaces

`settings:certificate` defines no `tag` and no other node type references it by tag. There are no tag reference dropdowns or multi-selects in this node's Inspector panel.

The related `certificate_providers[]` entries (separate palette section) do carry `tag` fields referenced by `tls.certificate_provider` inside inbound/outbound TLS config. That surface is outside this review scope.

---

## Priority Findings

### P0

- **PEM textarea is semantically broken**: `fromList` splits on comma, but inline PEM certificate data contains newlines and base64 content that must not be comma-split. Any multi-line PEM block stored or entered via the Inspector will be corrupted on round-trip. (`Inspector.tsx` lines 1335–1338; `toList`/`fromList` helpers lines 84–93).

### P1

- **No version-gate diagnostic for `store: "chrome"`**: Using `chrome` against a < 1.13.0 target silently produces an invalid config. A `channel === "stable"` check mirroring the `stable-version-gated-certificate-providers` pattern is missing from `diagnostics.ts`.
- **No version-gate diagnostic for entire `certificate` block**: The block requires sing-box >= 1.12.0 but no diagnostic emits for stable/pre-1.12 targets.
- **`+` button always visible but inert**: `data.compatible = []` makes the canvas `+` button produce no action. Should be conditionally hidden. (`SbcNode.tsx` lines 480–490).
- **Palette `status: "setup"` inconsistency**: `settings-certificate` uses `"setup"` while `settings-log` uses `ready: true` → `"add"`. The two statuses produce different button labels and tooltips for equivalent UX flows.

### P2

- **No singleton guard in Palette**: Clicking the Certificate palette entry a second time gives no feedback and produces a silent no-op. Reuse the `templateAdded` pattern.
- **Canvas count pill shows `1` spuriously** when `data.compatible` is empty (`SbcNode.tsx` line 521).
- **Title bar exposes internal kind string** `"settings / certificate"` (`SbcNode.tsx` line 382).
- **Generic canvas subtitle** `"global settings"` is shared by all settings nodes; `"certificate trust store"` would be more descriptive (`graph.ts` line 197).
- **Auto-reload hint absent** for `certificate_path` / `certificate_directory_path` fields.

---

## Implementation Tasks

1. **Fix PEM certificate textarea** — `src/components/Inspector.tsx` lines 1333–1339. Replace the `toList`/`fromList` (comma-split) helpers with a newline-split approach for the `certificate` field specifically: `value.join("\n")` for display, `value.split("\n").map(s => s.trim()).filter(Boolean)` for write. Update placeholder from `"PEM entries, comma separated"` to `"One PEM certificate per line"`. Priority: P0.

2. **Add `chrome` store version-gate diagnostic** — `src/domain/diagnostics.ts`. After the `stable-version-gated-certificate-providers` block (line 306), add: if `channel === "stable"` and `config.certificate?.store === "chrome"`, emit a `warning` diagnostic at `/certificate/store` with message `"store 'chrome' requires sing-box >= 1.13.0; not available on stable targets."` Priority: P1.

3. **Add `certificate` block version-gate diagnostic** — `src/domain/diagnostics.ts`. Add: if `channel === "stable"` and `config.certificate` is present (object truthy), emit a `warning` at `/certificate` with message `"certificate settings require sing-box >= 1.12.0; verify compatibility with stable targets."` Priority: P1.

4. **Fix `+` button and count pill for empty `compatible`** — `src/components/SbcNode.tsx` lines 480–522. Guard the `+` button with `{data.compatible.length > 0 ? <button...> : null}`. Change count pill from `{data.compatible.length || 1}` to `{data.compatible.length}` (or hide the pill entirely when zero). Priority: P1; applies to all settings nodes and other leaf nodes.

5. **Palette status normalisation** — `src/components/Palette.tsx` line 106. Change `status: "setup"` to `ready: true` (matching `settings-log`) so the button label reads `"Add Certificate to canvas"`. Priority: P1.

6. **Palette singleton guard** — `src/components/Palette.tsx`. Read `layout.positions["settings:certificate"]` from store and pass a `placed` flag to `PaletteSection`/`PaletteEntry`; disable the button and show `"Added"` state when already placed. Priority: P1.

7. **Add auto-reload hint text** — `src/components/Inspector.tsx` lines 1341–1353. Add `<small className="field-hint">Automatically reloaded on file modification.</small>` below the `certificate_path` and `certificate_directory_path` inputs. Priority: P2.

8. **Improve path inputs to textarea** — `src/components/Inspector.tsx` lines 1343–1353. Change both `<input>` controls to `<textarea>` with `rows={3}` to support multiple path entries more legibly. Split on newline for write (as with certificate). Priority: P2.

9. **Specific canvas subtitle** — `src/canvas/graph.ts` line 197. Change `subtitle: "global settings"` to a per-path lookup. Add `"certificate": "certificate trust store"` to the lookup. Priority: P2.

10. **Fix title bar label** — `src/components/SbcNode.tsx` line 382. Replace `"${data.kind} / ${data.type}"` with a human-readable label (e.g. a `kindLabel` map) so `"settings / certificate"` reads as `"Certificate"` or `"Certificate Settings"`. Priority: P2.

---

## Done Criteria

- [ ] `certificate` PEM textarea round-trips a multi-line PEM block without corruption. Import fixture with inline PEM → render → re-export produces byte-identical `certificate` array.
- [ ] Selecting `store: "chrome"` on a stable-channel project emits a visible warning diagnostic.
- [ ] Adding any `certificate` field on a stable-channel project emits a version-gate warning diagnostic.
- [ ] All four official fields (`store`, `certificate`, `certificate_path`, `certificate_directory_path`) render, persist, and export correctly.
- [ ] Canvas `+` button is hidden when `data.compatible` is empty.
- [ ] Canvas count pill does not show a spurious `1` for empty-compatible nodes.
- [ ] Palette singleton guard: placing `settings:certificate` when it is already on canvas is either prevented or gives visible "Added" feedback.
- [ ] Stable and testing docs both read (done; no diff found).
