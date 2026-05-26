<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / block UI Review

<!-- Source: official stable + testing docs, Palette.tsx, SbcNode.tsx, Inspector.tsx, commands.ts, templates.ts, protocols.ts, sharedFieldRegistry.ts -->

## Deprecation Status

`outbound` `type: "block"` is a **deprecated pattern** as of sing-box 1.11.0. The recommended replacement is a route rule with `action: "reject"` (no outbound node needed at all). Both stable and testing official docs are identical and minimal:

```json
{
  "type": "block",
  "tag": "block"
}
```

**Official fields: 2** (`type` and `tag`). No other fields exist or are documented. The page explicitly says "No fields."

Migration path: replace `outbound: "block"` route rules with `action: "reject"` in the route rules inspector. The `reject` action is already supported in the Inspector route rule Action dropdown (Inspector.tsx line 618, 725).

## Official Model

| Field | Type   | Notes                       |
|-------|--------|-----------------------------|
| type  | string | Always `"block"` — fixed    |
| tag   | string | User-defined reference tag  |

No `server`, `server_port`, `dial`, `TLS`, `transport`, or `multiplex` fields exist or are valid.

## Left: Add Library (Palette)

**Current state:** `Palette.tsx` line 155:
```
{ label: "Block", kind: "block", icon: Ban, docsUrl: docs("outbound/block/"), ready: true }
```

The item has `ready: true`, resolving to `status: "add"` — meaning it shows as a first-class addable item with label "ADD" in the palette, identical treatment to non-deprecated outbounds.

**Problem (P0):** The palette entry does not communicate deprecation. Users discovering this UI will add a block outbound and use `outbound: "block"` in route rules, unaware that since 1.11.0 the correct pattern is `action: "reject"` with no outbound node required. The palette entry should be demoted or annotated.

**Recommendation:**
- Change `ready: true` to `status: "pending"` or introduce a new `status: "deprecated"` variant (not currently in `PaletteStatus` union).
- Alternatively, keep the entry for import compatibility but display a deprecation tooltip: "Deprecated since 1.11. Use route rule action=reject instead."
- The palette `PaletteStatus` type (`"add" | "setup" | "table" | "inspector" | "docs" | "gated" | "pending"`) has no `"deprecated"` variant — adding one would enable proper visual treatment across all deprecated nodes.

## Middle: Canvas Node

**Current state:**
- `SbcNode.tsx` line 44: block type maps to `Ban` icon — visually appropriate.
- `SbcNode.tsx` line 63: block is excluded from `supportsDialDetour` — correct, no dial fields.
- Port specs (`getPortSpecs`, lines 104–117): block receives the full generic outbound input port set: route final, rule outbound, selector candidate, URLTest candidate, DNS detour, dial detour, service detour, rule-set download. All routing-input ports are semantically correct since block is a valid routing target (for import compatibility). Output ports: none (correct).

**Problem (P1):** No visual deprecation badge or warning on the canvas node. A block node sitting on a canvas looks identical in weight to direct/socks. Users cannot see at a glance that it is legacy.

**Recommendation:**
- Add a subtle deprecation indicator (e.g., a strikethrough, warning badge, or muted color) to the canvas node when `type === "block"`.
- The canvas node body should show a migration hint: "Use route rule action=reject."

## Right: Inspector

**Current state:**
- `Inspector.tsx` outbound section (lines 1505–1546) renders fields conditionally via `"server" in entity`, `"server_port" in entity`, `"outbounds" in entity`, `"default" in entity`. Since block has none of those keys, the inspector body will be empty aside from the AdvancedScalarFields fallback.
- `outboundHandledFields` (lines 128–141) includes `tag` and `type`, which are suppressed from the advanced fallback.
- `AdvancedScalarFields` will find nothing to render — correct behavior since the schema has no extra fields.
- `createOutbound` in `commands.ts` line 273 correctly returns `{ type, tag }` only for block — no accidental fields injected.

**Problem (P1):** Inspector opens for block and shows nothing beyond tag/type. There is no deprecation notice, no hint that the user should delete this node and switch to route rule `action: "reject"`, and no migration affordance.

**Recommendation:**
- Render a deprecation callout at the top of the Inspector panel when `ref.kind === "outbound" && entity.type === "block"`:
  > "Block outbound is deprecated since sing-box 1.11. For new configurations, use a Route Rule with action = reject instead. This node is preserved for import compatibility."
- Optionally provide a "Migrate" button that: removes this outbound node, updates any route rules referencing this tag to `action: "reject"` (clearing the `outbound` field), and removes from selector/urltest candidate lists if present.

## Templates

`templates.ts` includes `type: "block"` in both `STABLE_TUN_SPLIT_CONFIG` (line 60) and `LEGACY_112_SPLIT_CONFIG` (line 147), each with `outbound: "block"` in a route rule (lines 96–98, 176–178). The newer `TESTING_114_SPLIT_CONFIG` uses `action: "reject"` (line 525) with no block outbound — this is the correct modern pattern.

**Problem (P1):** The two legacy templates still ship a block outbound and a `domain_keyword: ["ads"]` / `outbound: "block"` route rule. While these may be intentionally legacy, they will be imported by users who treat the 1.12 template as a baseline, propagating the deprecated pattern.

**Recommendation:**
- Update `STABLE_TUN_SPLIT_CONFIG` and `LEGACY_112_SPLIT_CONFIG` to remove the block outbound and replace the `outbound: "block"` route rule with `action: "reject"`. Label them clearly as legacy if that is their purpose.
- If the templates are intentionally preserved for 1.12 compat, add a comment and ensure the UI does not promote them as recommended starting points.

## Compatibility

Import of existing configs containing `type: "block"` must continue to work. The current code path — `createOutbound` returning `{ type, tag }`, the canvas node rendering with Ban icon, the inspector showing nothing extra — is correct for import round-trip. **Do not remove block support from the parser or store.** The fix is UI-layer only: deprecation labeling and migration guidance.

## Priority Findings

### P0

- **Palette promotes deprecated node as first-class ADD**: `ready: true` gives block the same palette status as actively recommended outbounds. The `PaletteStatus` union lacks a `"deprecated"` variant. Users have no signal that this node is legacy.

### P1

- **Inspector shows no deprecation notice**: Inspector panel for a block outbound is effectively empty (no renderable fields) with no contextual guidance. A callout explaining deprecation and pointing to `action: "reject"` is missing.
- **Canvas node has no deprecation indicator**: The node is visually indistinguishable from active outbounds except for the Ban icon, which is not semantically understood as "deprecated."
- **Legacy templates still ship block outbound**: `STABLE_TUN_SPLIT_CONFIG` and `LEGACY_112_SPLIT_CONFIG` include `type: "block"` and a route rule using it, contradicting the modern pattern shown in `TESTING_114_SPLIT_CONFIG`.

## Implementation Tasks

1. **Add `"deprecated"` to `PaletteStatus`** in `Palette.tsx` and define its `statusLabel` entry (e.g., "Deprecated") and `statusTitle` (e.g., "Block outbound is deprecated since 1.11; use route rule action=reject"). Update `canActivate` so `"deprecated"` is still activatable for import/add compatibility but visually distinct.

2. **Mark block palette item** as `status: "deprecated"` (after task 1) rather than `ready: true`.

3. **Add deprecation callout to Inspector** when `ref.kind === "outbound" && entity.type === "block"`, above the AdvancedScalarFields block. No migration button is required in v1, but the text notice is.

4. **Add deprecation badge to SbcNode canvas node** when `kind === "outbound" && type === "block"`. A small "deprecated" label or warning icon on the node body is sufficient.

5. **Update or annotate legacy templates**: Either migrate `STABLE_TUN_SPLIT_CONFIG` / `LEGACY_112_SPLIT_CONFIG` to use `action: "reject"`, or add code comments marking them as intentional 1.12-era preserved examples and ensure they are not surfaced as recommended starting points for new users.

6. **Add a diagnostic warning** in `diagnostics.ts` for any outbound with `type === "block"`: level `"warning"`, code `"deprecated-block-outbound"`, message `"outbound type 'block' is deprecated since sing-box 1.11. Replace with a route rule action: reject."` This surfaces in the semantic validation panel without blocking export.

## Done Criteria

- Palette entry visually communicates deprecation status.
- Inspector shows an actionable deprecation notice for block outbounds.
- Canvas node has a deprecation indicator.
- Diagnostic warning fires for any config containing a block outbound.
- Import round-trip of existing block outbound configs still works (no regression).
- Legacy templates either migrated or clearly annotated.
- `action: "reject"` route rule is reachable without needing a block outbound node.
