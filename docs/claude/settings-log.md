<!-- Status: official-read. Source: stable log/index.md + testing diff + Palette/SbcNode/Inspector grep. UI verification + implementation fixes still pending. -->
# Settings / Log UI Review (Claude Deep Review)

## Scope

- Editable node: `settings:log`
- Official doc (stable): `log/index.md`
- Official doc (testing): `log/index.md` — no testing diff
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Official Model

### Writable fields (stable)

| Field | Type | Required | Default | Semantic | Notes |
| --- | --- | --- | --- | --- | --- |
| `disabled` | bool | optional | `false` | Disable all logging; no output produced after start | When `true` the other fields are moot but must still survive round-trip |
| `level` | enum string | optional | `"info"` | Log verbosity: `trace`, `debug`, `info`, `warn`, `error`, `fatal`, `panic` | Seven distinct values — a select is the correct control |
| `output` | string | optional | (console) | Path to a log file; omitting writes to console | Doc says "Will not write log to console after enable" — empty string must be treated as absent |
| `timestamp` | bool | optional | (unset/false) | Prefix each log line with a timestamp | **Missing from current Inspector** — P0 |

Total official writable fields: **4**.

### Cross-version diff (testing)

No testing diff. The testing doc is byte-for-byte identical to the stable doc.

### Relationship model

`settings:log` has no `tag` of its own. It does not reference any other node by tag, and no other node type references it by tag. It is a singleton global-settings object placed at `config.log`.

The canvas node should carry **zero** connectable ports (no inbound/outbound handles).

### Compat / Target gate

No build-tag or platform restriction is documented. All four fields are unconditionally available in stable and testing. There is no mutual exclusion between fields stated in the official docs, though `disabled: true` makes `level`, `output`, and `timestamp` semantically inert at runtime.

---

## Left: Add Library

### Current state (Palette.tsx line 75)

```
{ label: "Log Settings", kind: "settings-log", icon: Braces, docsUrl: docs("log/"), ready: true }
```

- `itemStatus()` resolves to `"add"` because `ready: true` is set and no `status` override exists.
- The displayed label in the button is `"Add Log Settings to canvas"` (tooltip from `statusTitle`).
- `canActivate()` returns `true` → clicking the item triggers the add action.
- `docsUrl` points to `https://sing-box.sagernet.org/configuration/log/` — correct.

### Gap analysis

- The `"add"` status is semantically correct: a settings node represents a singleton sub-object that is added to the canvas once; clicking "Add" places it.
- There is no visible affordance distinguishing "this is a singleton" from "this creates a repeatable node". Once `settings:log` is already on the canvas a second click would attempt to add it again. The graph code (`graph.ts` line 184–205) guards visibility via `layout.positions[id]` — a node not in the layout is not shown — but the Palette does not reflect whether the node is already placed. Duplicate-add is therefore silently a no-op from the graph perspective, but visually confusing.
- No `status: "setup"` is used, which is appropriate because there is no multi-step draft workflow for this node.

### Recommendations

1. **P1 — Singleton guard**: After `settings:log` is placed on the canvas the Palette entry should show as disabled or toggled (similar to `"added"` state used for template presets, line 426). Re-using the `templateAdded` pattern (already implemented for presets) for singleton settings nodes would prevent user confusion.
2. **P2 — Section clarification**: The section title is `"Log"` (line 74). This is minimal but acceptable; no change required unless other log-related items are added to the section.

---

## Middle: Canvas Node

### Current state (SbcNode.tsx / graph.ts)

- `getPortSpecs` for kind `"settings"` falls through to the final `return []` at line 198 — both `direction === "input"` and `direction === "output"` return empty arrays.
- The canvas node is placed in column `COLUMNS.settings = -300` (graph.ts line 45), visually isolated to the left of all inbound nodes.
- Node `title` is computed as `"Log"` (capitalised `path[0]`), `subtitle` is `"global settings"` (graph.ts line 197).
- `status` is driven by `diagnosticStatus("/log", diagnostics)` — picks up any diagnostic messages keyed to the `/log` JSON path.

### Gap analysis

- **No chainable ports** — correct. `settings:log` has no upstream or downstream references in the official model.
- The zero-port implementation matches the expected "isolated settings slab" shape.
- The `subtitle: "global settings"` is generic — it is the same for `settings:ntp`, `settings:certificate`, `settings:experimental`. This is acceptable for a first pass but reduces differentiation in a dense canvas.

### Recommendations

1. **P2 — Specific subtitle**: Change subtitle to `"log settings"` (or the section heading "Logging") so the node reads as `Log / log settings` rather than `Log / global settings`. This is a pure label change in graph.ts line 197 (the title capitalisation template).
2. No structural port changes needed.

---

## Right: Inspector

### Current state (Inspector.tsx lines 1248–1281)

The `settings:log` branch renders:

| Rendered field | Control | Inspector line |
| --- | --- | --- |
| `level` | `<select>` with 7 options (`trace`…`panic`) | 1252–1263 |
| `output` | `<input type="text">` with placeholder `"stdout or file path"` | 1266–1271 |
| `disabled` | `<input type="checkbox">` toggle | 1273–1280 |

The `timestamp` field (**official field 4**) is **not rendered** at any line in Inspector.tsx or InspectorPanels.tsx.

### Field-by-field audit

| Official field | Inspector rendering | Assessment |
| --- | --- | --- |
| `disabled` | checkbox toggle, `checked={Boolean(entity.disabled)}`, writes `true` or `undefined` | Correct: boolean toggle. Writing `undefined` on uncheck cleanly removes the key from JSON. |
| `level` | select, default fallback `"info"`, all 7 values present | Correct: enum select. |
| `output` | text input, writes `event.target.value \|\| undefined` | Mostly correct: empty string is correctly coerced to `undefined`, removing the key. Placeholder text says "stdout or file path" — "stdout" is misleading because console is the implicit default when `output` is absent; there is no literal `"stdout"` value. |
| `timestamp` | **NOT RENDERED** | **P0 gap**: official boolean field, completely absent from the UI. |

### `disabled` toggle ordering concern

The `disabled` toggle is placed **after** `level` and `output`. When `disabled` is checked the other fields become semantically inert. A better UX puts `disabled` first so users understand they are disabling an already-configured block, or uses it to collapse/grey the other fields. This is a P2 UX polish issue, not a correctness bug.

### `output` placeholder text

"stdout or file path" implies `stdout` is a valid string value. The official doc says the field is a file path; omitting it writes to console. The placeholder should read `(console)` or `file path (omit for console)` to avoid implying `stdout` is a valid literal.

### Recommendations

1. **P0 — Add `timestamp` toggle**: Add a checkbox toggle for `timestamp` immediately after `output`. Control shape: `<input type="checkbox">`, `checked={Boolean(entity.timestamp)}`, writes `true` or `undefined` (same pattern as `disabled`). Label: "Add timestamp to each line".
2. **P1 — Fix `output` placeholder**: Change from `"stdout or file path"` to `"(omit to write to console)"` or `"file path"`.
3. **P2 — Reorder fields**: Move `disabled` above `level` and `output`, or make it visually separate (e.g. a warning-style toggle at top). When `disabled` is true, grey/disable the other three fields.

---

## Tag Reference Surfaces

N/A. `settings:log` defines no `tag` and no other node type references it by tag. There are no tag reference dropdowns or multi-selects to audit.

---

## Priority Findings

- **P0** — `timestamp` (official bool field) is completely absent from the Inspector. Any config that sets `"timestamp": true` will import and display the node but silently drop the field on export.
- **P1** — `output` placeholder text `"stdout or file path"` is factually wrong; no literal `"stdout"` value is documented. This can cause user misconfiguration.
- **P1** — Palette has no singleton guard: clicking "Log Settings" after the node is already on canvas produces a confusing no-op with no feedback.
- **P2** — `disabled` toggle is positioned last; should come first or be visually separated to convey that it disables the whole block.
- **P2** — Canvas node subtitle is the generic `"global settings"` string shared with all settings nodes; should be `"log settings"` for differentiation.

---

## Implementation Tasks

1. **Add `timestamp` toggle to Inspector** — `src/components/Inspector.tsx` lines 1273–1281 (after the `output` field, before or after `disabled`). Add `<label className="toggle-row"><input type="checkbox" checked={Boolean(entity.timestamp)} onChange={(event) => updateField(ref, "timestamp", event.target.checked || undefined)} /><span>Add timestamp to each line</span></label>`. In scope.

2. **Fix `output` placeholder** — `src/components/Inspector.tsx` line 1269. Change `placeholder="stdout or file path"` to `placeholder="file path (omit to use console)"`. In scope.

3. **Palette singleton guard** — `src/components/Palette.tsx`. Detect whether `settings:log` node already has a position in the current layout and if so render the button as disabled/added. Requires reading layout state in Palette or passing a `placed` flag. In scope but requires Palette/store wiring.

4. **Reorder `disabled` toggle to top of log block** — `src/components/Inspector.tsx` lines 1248–1281. Move the `toggle-row` label above the `level` select. Optional: grey sibling fields when `disabled` is true. In scope.

5. **Canvas node subtitle label** — `src/canvas/graph.ts` line 197. Change `subtitle: "global settings"` to `subtitle: path + " settings"` (yields `"log settings"`, `"ntp settings"`, etc.) or use a lookup table. In scope; no functional change.

---

## Done Criteria

- [ ] Library -> Inspector -> JSON round-trip includes `timestamp` field.
- [ ] All four official fields (`disabled`, `level`, `output`, `timestamp`) render and persist correctly.
- [ ] Exporting a config with `"timestamp": true` and re-importing produces the same node state (no silent field drop).
- [ ] `output: ""` is coerced to absent on export (already working; verify with fixture).
- [ ] Palette singleton guard: placing `settings:log` a second time is either prevented or gives visible feedback.
- [ ] Semantic diagnostics fire when `level` contains an unknown value (e.g., from a hand-edited config).
- [ ] At least one fixture or e2e smoke test covers import → render → edit (`timestamp` toggle) → export round-trip.
- [ ] Stable and testing docs both read (done; no diff found).
