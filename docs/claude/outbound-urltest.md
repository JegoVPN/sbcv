<!-- Status: ui-verified + partially implemented (2026-05-27). Candidate checklist now renders, `default` is hidden for urltest type, interrupt_exist_connections toggle landed. `url` / `interval` / `tolerance` / `idle_timeout` still fall through to AdvancedScalarFields — promote to first-class in a later atomic. Outstanding: P1 fixture / E2E gate; tag rename / delete already cascades `outbounds[]`. -->
# Outbound / urltest Deep Review

## Official Field Inventory (stable == testing, 6 writable fields)

| Field | Type | Required | Default if empty |
|---|---|---|---|
| `outbounds` | `string[]` | yes | — |
| `url` | `string` | no | `https://www.gstatic.com/generate_204` |
| `interval` | `duration string` | no | `3m` |
| `tolerance` | `number` (ms) | no | `50` |
| `idle_timeout` | `duration string` | no | `30m` |
| `interrupt_exist_connections` | `boolean` | no | `false` |

No `default` field exists in the official URLTest schema.
The stable and testing docs are identical for this outbound type.

---

## Priority Findings

### P0 — `idle_timeout` is silently suppressed in the Inspector

`outboundHandledFields` in `Inspector.tsx` includes `...quicSharedFields` (line 140), and `quicSharedFields` contains `"idle_timeout"` (line 115). This marks `idle_timeout` as handled for ALL outbound kinds, including urltest. However, the quic shared-group panel only renders when the entity type is in `outboundQuicTypes` (`hysteria | hysteria2 | tuic`) — urltest is not in that set. The result: `idle_timeout` on a urltest object is listed in `outboundHandledFields`, so `AdvancedScalarFields` skips it, yet no dedicated control renders it. The field is completely invisible and uneditable in the UI even though it is a first-class official urltest field.

Files:
- `src/components/Inspector.tsx` lines 115, 128–141, 1544
- `src/domain/sharedFieldRegistry.ts` line 150–153

### P0 — `outbounds[]` uses a raw comma-joined text input instead of a multiselect

The `{"outbounds" in entity}` branch at lines 1526–1534 of `Inspector.tsx` renders a plain `<input>` backed by `toList`/`fromList` helpers. Users must know existing outbound tags and type them comma-separated. There is no structured multiselect that lists available outbound tags (excluding self). The `outboundTags(config, excludeTag)` helper already exists (lines 217–221) and is used for detour selects elsewhere; it is not used here.

File: `src/components/Inspector.tsx` lines 1526–1534

### P0 — `default` field renders for urltest when the loaded config happens to contain it

The `{"default" in entity}` check at lines 1535–1543 is structural, not type-gated. If an imported config has a `default` key on a urltest outbound (e.g. an extra/erroneous field), the Inspector will silently show and allow editing a `default` field that does not exist in the URLTest official schema. The `createOutbound("urltest")` initializer does not add `default`, but round-trip import has no guard. The check should be `{"default" in entity && entityType !== "urltest"}` to match the spec.

File: `src/components/Inspector.tsx` lines 1535–1543

### P0 — `url` and `interval` are not first-class controls in the outbound Inspector section

The `ref.kind === "outbound"` block (lines 1505–1546) only renders: server, server_port, outbounds, default, and AdvancedScalarFields. `url`, `interval`, and `tolerance` are not in `outboundHandledFields`, so they DO surface in `AdvancedScalarFields` if present on the entity — but only as a collapsed "Advanced fields N" disclosure widget with auto-generated labels. For URLTest these three fields are equally important to `outbounds[]` and should be first-class form rows in the main Inspector body.

`createOutbound("urltest")` (commands.ts line 425–433) seeds `url` and `interval` on new nodes, so they will appear in AdvancedScalarFields as long as the node was created here. Imported configs that omit them will show no control at all since AdvancedScalarFields only iterates existing keys.

File: `src/components/Inspector.tsx` lines 1505–1546  
File: `src/domain/commands.ts` lines 425–433

---

### P1 — `tolerance` is not seeded by `createOutbound("urltest")`

`createOutbound` for urltest (commands.ts lines 425–433) seeds `url` and `interval` but omits `tolerance` and `idle_timeout`. Since AdvancedScalarFields only renders existing keys, a freshly added URLTest node will have no editable `tolerance` or `idle_timeout` control (and idle_timeout is additionally suppressed, see P0 above). Users cannot set these fields without manually knowing they exist.

File: `src/domain/commands.ts` lines 425–433

### P1 — `interrupt_exist_connections` has no dedicated toggle

`interrupt_exist_connections` is an official boolean field. It is not seeded by `createOutbound` and not in `outboundHandledFields`, so if an imported config includes it, it will appear in AdvancedScalarFields as a checkbox (since `typeof value === "boolean"` path exists there). But for a freshly created URLTest, there is no way to set it from the UI at all. It should be seeded as `false` in `createOutbound` so the control appears in AdvancedScalarFields, or ideally promoted to a first-class toggle row alongside the other urltest-specific fields.

File: `src/domain/commands.ts` lines 425–433

### P1 — Canvas node titlebar shows `outbound / urltest` rather than tag-first display

`SbcNode.tsx` line 382 renders `${data.kind} / ${data.type}` as the titlebar text. For URLTest this shows `outbound / urltest`. The tag (human name) is in `data.title` and renders in `sbc-node__title` inside the card body, which is lower-prominence. The type label in the toolbar pill (line 493–496) already duplicates the type. The titlebar should show the tag name first with type as a secondary label.

File: `src/components/SbcNode.tsx` line 382

### P1 — Canvas `+` button for URLTest group offers protocol outbounds only

`graph.ts` line 418–420 sets `compatible: ["SOCKS", "Direct", "Block"]` for any `isOutboundGroup` node. The `+` button on the canvas creates the first entry from this list (SOCKS by default). URLTest groups typically aggregate proxy outbounds, but the affordance should at minimum also include other proxy types or allow choosing from an existing pool rather than always adding a new SOCKS stub.

File: `src/canvas/graph.ts` lines 418–420

### P1 — Node subtitle truncates member list without count

`graph.ts` lines 409–412 renders subtitle as `urltest: tag1, tag2, ...` by joining all `outbound.outbounds`. With many members this becomes a very long substring in the canvas card. A `${n} candidates` count would scale better for large URLTest groups.

File: `src/canvas/graph.ts` lines 409–412

---

## Current Behavior Summary

| Feature | Status |
|---|---|
| Palette entry | present, `ready: true`, action label "Add", correct docs URL |
| Create from Palette | functional via `createFromPalette` → `addOutbound(config, "urltest", "auto")` |
| Canvas node ports (left) | correct: route-final, route-rule, selector-group, urltest-group, dns-detour, detour-target, service-detour, rule-set-download |
| Canvas node ports (right) | correct: outbound-member for adding candidates |
| Edge wiring | correct: `urltest-group` handle on child nodes, `outbound-member` on urltest node |
| Diagnostics | correct: missing candidate tag emits `error / missing-outbound-candidate` |
| Inspector: tag edit | present |
| Inspector: type switch | present (CREATABLE_OUTBOUND_TYPES select) |
| Inspector: outbounds[] | raw text input — NOT a multiselect |
| Inspector: url | in AdvancedScalarFields (only if key exists on entity) |
| Inspector: interval | in AdvancedScalarFields (only if key exists on entity) |
| Inspector: tolerance | NOT present (not seeded, not in handled set, not shown) |
| Inspector: idle_timeout | silently suppressed (in handledFields via quicSharedFields, no UI rendered) |
| Inspector: interrupt_exist_connections | NOT present (not seeded; only appears if imported config has the key) |
| Inspector: default | shows if key exists on entity — schema violation for urltest |
| sharedGroups for urltest | none (no dial, no tls, no quic, no multiplex) — correct per spec |

---

## Implementation Tasks

### Fix P0-A: Remove `idle_timeout` collision for urltest

In `outboundHandledFields`, `idle_timeout` is included via `quicSharedFields`. Either:
- Extract urltest-specific fields into a dedicated handled-fields set that does NOT include `idle_timeout`, or
- Keep `outboundHandledFields` as-is but in the outbound Inspector section add an explicit `idle_timeout` text input gated on `entityType === "urltest"` and mark it handled.

The latter approach is lower risk. Add a labeled text input for `idle_timeout` inside the `ref.kind === "outbound"` block, guarded by `entityType === "urltest"`.

### Fix P0-B: Gate `default` field on `entityType !== "urltest"`

Change line 1535 from:
```tsx
{"default" in entity ? (
```
to:
```tsx
{"default" in entity && entityType !== "urltest" ? (
```

### Fix P0-C: Replace `outbounds[]` text input with a multiselect for urltest

Gate the current raw text input on non-urltest/selector types OR replace for group types with a structured list using `outboundTags(config, ref.tag)`. A checkbox list or `<select multiple>` backed by the existing `outboundTags` helper is sufficient. The `outboundTags(config, excludeTag)` helper at line 217 already excludes the node's own tag.

### Fix P0-D: Add first-class controls for url, interval, tolerance in the outbound Inspector block

Inside the `ref.kind === "outbound"` block, add dedicated labeled inputs for url, interval (text), and tolerance (number) gated on `entityType === "urltest"`. Add these fields to `outboundHandledFields` so AdvancedScalarFields does not also show them.

### Fix P1-A: Seed all urltest fields in `createOutbound`

Update `commands.ts` lines 425–433 to include `tolerance`, `idle_timeout`, and `interrupt_exist_connections`:

```ts
if (type === "urltest") {
  return {
    type,
    tag,
    outbounds: [],
    url: "https://www.gstatic.com/generate_204",
    interval: "3m",
    tolerance: 50,
    idle_timeout: "30m",
    interrupt_exist_connections: false,
  };
}
```

### Fix P1-B: Promote `interrupt_exist_connections` to a first-class toggle

After seeding (P1-A), add a `<label className="toggle-row">` for `interrupt_exist_connections` in the urltest block alongside the other first-class urltest controls. Add to `outboundHandledFields`.

### Fix P1-C (optional UX): Show candidate count in subtitle

Replace the full tag list join in `graph.ts` subtitle with `${outbound.type}: ${outbound.outbounds.length} candidates` or `${outbound.type}: ${outbound.outbounds.slice(0, 2).join(", ")}${outbound.outbounds.length > 2 ? " +" + (outbound.outbounds.length - 2) : ""}`.
