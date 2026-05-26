<!-- Reviewed against stable + testing official docs, Palette.tsx, Inspector.tsx, SbcNode.tsx, sharedFieldRegistry.ts, commands.ts, graph.ts, diagnostics.ts -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Rule Set / local UI Review

## Scope

- Editable node: `rule-set:local`
- Official doc: `rule-set/index.md` (stable + testing)
- Source-of-truth: canonical sing-box JSON domain state (`route.rule_set[]` entries with `type: "local"`).
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model (stable)

Local rule-set fields — all required:

| Field    | Type   | Required | Notes |
|----------|--------|----------|-------|
| `type`   | string | yes      | Fixed `"local"` |
| `tag`    | string | yes      | Unique reference name |
| `format` | string | yes      | `"source"` or `"binary"`. Optional when `path` extension is `.json` (source) or `.srs` (binary) |
| `path`   | string | yes      | File path; auto-reloads on change since 1.10.0 |

No testing-channel differences for local type. The testing changes (`http_client`, `download_detour` deprecation) only affect remote type.

## Left: Add Library (Palette)

Current: single `rule-set` entry with `status: "setup"` — clicking `createFromPalette("rule-set")` always creates a **remote** type node (hardcoded in `useProjectStore.ts:573`).

Finding:
- Palette entry labelled "Rule Set" does not distinguish type. The palette action `Setup Rule Set` always creates a remote node. A user who wants a local rule-set must create one and then switch the type via the Inspector type select. This is not discoverable.
- No separate `rule-set-local` palette entry exists. The Palette kind is unified `rule-set`.

## Middle: Canvas Node

### Node titlebar
Rendered as `rule-set / local` — correct kind/type layout.

### Subtitle
`graph.ts:469-471` correctly shows `ruleSet.path` as subtitle for local nodes. Shows `"local rule-set"` fallback when `path` is absent or not a string.

### Status badge
`diagnosticStatus("/route/rule_set/${index}", diagnostics)` — uses the correct JSON path. No local-specific semantic validation exists (see P0 below).

### Output ports (right side)
`SbcNode.tsx:169` returns `[{ key: "download-detour", ... }]` for ALL `rule-set` nodes regardless of `type`. A local rule-set has no `download_detour` field but still shows a right-side "Download detour" output port.

### Input ports (left side)
Two input ports: `route-rule` and `dns-rule`. Correct — a local rule-set can be referenced by both route rules and DNS rules.

### Compatible create button
`compatible: []` — the "+" button on the node does nothing. Acceptable; local rule-sets have no obvious next compatible object.

## Right: Inspector

### Tag field
Standard editable tag with `renameTag` round-trip. Correct.

### Type select
`CREATABLE_RULE_SET_TYPES = ["remote", "local", "inline"]` drives the select. Switching from remote to local calls `changeEntityType`, which replaces the entity using `createRuleSet(nextType, ref.tag)`. This correctly resets to `{ type: "local", tag, format: "source", path: "./rules.json" }` and discards remote-only fields (`url`, `update_interval`, `download_detour`). Correct.

### Format select
`entity.type === "remote" || entity.type === "local"` gates the format select. Shows for local — correct. Default fallback is `"source"`. Both `source` and `binary` options present. Correct.

Known gap: official docs say `format` is optional when `path` extension is `.json` or `.srs`. The Inspector always shows the select and always writes the field. This is safe (redundant but not harmful), but the UI does not hint at the optional-by-extension behavior.

### Path field
`entity.type === "local"` gates a plain `<input>` for the path. No file picker, no path validation, no placeholder guidance beyond the template default `"./rules.json"`.

### Download Detour field
The remote block (`entity.type === "remote"`) includes the `download_detour` select. It does not appear for local type. Correct in Inspector.

### http-client shared group
`sharedFieldRegistry.ts:199` only pushes `"http-client"` group when `entityType === "remote"`. Local nodes do not get the http-client shared card. Correct.

### AdvancedScalarFields fallback
`ruleSetHandledFields` includes `path`, `format`, `tag`, `type`, and remote-only fields. Any unexpected fields on a local entity will surface via `AdvancedScalarFields`. Correct guard.

## Priority Findings

### P0 — download-detour port shown on local nodes

**File:** `src/components/SbcNode.tsx:169`

```ts
if (kind === "rule-set") return [{ key: "download-detour", label: "Download detour", nodeKind: "outbound", icon: Network }];
```

This returns the download-detour output port for all rule-set kinds, including `local` and `inline`. A local rule-set has no `download_detour` field. The port will always show as disconnected and clicking it will write a `download_detour` field onto the local entity, producing an invalid config.

**Fix:** Gate the port on type:
```ts
if (kind === "rule-set" && type === "remote")
  return [{ key: "download-detour", label: "Download detour", nodeKind: "outbound", icon: Network }];
if (kind === "rule-set") return [];
```

Also update `isPortConnected` guard at `SbcNode.tsx:334-335` and `togglePortConnection` in `commands.ts:884+` to be safe if type check is not applied there.

### P0 — no semantic diagnostic for missing or empty path

**File:** `src/domain/diagnostics.ts`

When a local rule-set has an empty or missing `path`, sing-box will reject the config at runtime. No diagnostic is emitted for this. The canvas node shows a `valid` status even with `path: ""`.

**Fix:** Add a diagnostic in `validateConfig`:
```ts
listItems(config.route?.rule_set).forEach((ruleSet, index) => {
  if (ruleSet.type === "local" && !ruleSet.path) {
    push(diagnostics, "error", "local-rule-set-missing-path",
      `/route/rule_set/${index}/path`,
      `Local rule-set "${ruleSet.tag}" is missing a path.`);
  }
});
```

### P1 — Palette always creates remote; no direct route to local type

**File:** `src/state/useProjectStore.ts:573`

```ts
config = addRuleSet(config, "remote", preferredRuleSetTag("remote"));
```

There is no palette path that creates a local rule-set directly. The user must: create a rule-set (remote), open Inspector, change type. This is an ergonomic gap for a common use case (local config files on mobile/embedded deployments).

**Fix (low-effort):** Accept the current single-entry palette but ensure the tooltip (`statusTitle`) clarifies the type can be changed in Inspector after creation.

**Fix (full):** Add a second palette entry `rule-set-local` with its own `createFromPalette` handler, or add a type sub-menu to the setup dialog.

### P1 — format field always written; extension inference not communicated

**File:** `src/components/Inspector.tsx:1820-1830`

The UI always persists `format` even when `path` ends in `.json` or `.srs` where the field is optional. Not harmful, but the Inspector provides no hint. If a user sets `path: "./myrules.srs"` they may incorrectly assume format defaults to binary without setting it — the select UI still shows `source` as the fallback.

**Fix:** Add a small note under the format select that reads: "Optional when path ends in .json (source) or .srs (binary)."

## Implementation Tasks

1. **P0** Gate `download-detour` output port in `SbcNode.getPortSpecs` to `type === "remote"` only.
2. **P0** Add `missing-local-rule-set-path` error diagnostic in `diagnostics.ts` for local entities with empty/missing path.
3. **P1** Document or fix the palette always-remote creation path.
4. **P1** Add a format-field tooltip/hint about optional-by-extension behavior.
5. **Improvement** Path input should show a placeholder like `./rules.json` and accept absolute or relative paths. Consider adding a warning diagnostic if `path` is an absolute path on platforms where portability matters.
6. **Improvement** Canvas subtitle falls back to `"local rule-set"` when path is missing. This could instead show `(no path)` in an error style to make the misconfiguration visible at a glance without opening Inspector.

## Done Criteria

- Local rule-set node does not render a download-detour port.
- Empty `path` triggers an error diagnostic and the canvas node shows error status.
- Adding from Palette and switching type to local round-trips correctly with `path` and `format` preserved.
- Inspector type switch from remote to local removes `url`, `update_interval`, `download_detour` from the exported JSON.
- Smoke/fixture coverage: import a config with `type: local` rule-set, verify canvas renders path as subtitle, edit path, export and confirm JSON correctness.
