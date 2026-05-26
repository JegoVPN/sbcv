<!-- Status: implementation-reviewed. Source: stable + testing docs/configuration/outbound/selector.md, Inspector.tsx, SbcNode.tsx, graph.ts, commands.ts, diagnostics.ts, useProjectStore.ts, sharedFieldRegistry.ts. -->
# Outbound / selector — Implementation Review

## Scope

- Node ID: `outbound:selector`
- Palette kind: `selector` (resolves to `outbound-selector` via Palette.tsx line 172)
- Official writable fields: 5 total
- Review depth: implementation-level; baseline official-read already confirmed

## Official Model

Stable and testing docs are identical. One entry in `outbounds[]` with `type: "selector"`.

| Field | Required | Type | Rule |
|---|---|---|---|
| `type` | yes | `"selector"` | fixed |
| `tag` | yes | string | unique per config |
| `outbounds` | yes | string[] | tag-reference list to other outbounds |
| `default` | no | string | must be empty or one of `outbounds[]`; sing-box uses first candidate when empty |
| `interrupt_exist_connections` | no | boolean | if true, kills existing inbound connections when selected outbound changes; internal connections always interrupted |

Runtime note: candidate selection is controlled at runtime only via Clash API. Config authoring owns the candidate list and default; the UI cannot switch which candidate is active.

## Implementation Audit

### Palette entry (Palette.tsx:172)

```
{ label: "Selector", kind: "selector", icon: Shuffle, docsUrl: docs("outbound/selector/"), ready: true }
```

- `ready: true` — node is active.
- `kind: "selector"` — resolved to type `"selector"` by `outboundTypeForPaletteKind` in domain.
- `docsUrl` — correct.
- `ADD` action: `addOutbound(config, "selector", "proxy")` — creates `{ type: "selector", tag: "proxy", outbounds: [], default: undefined }`.

Gap: template skeleton ships with `outbounds: []` (empty). No guidance in the Library entry that the user must populate candidates before the selector is useful. An empty `outbounds[]` is never caught by a diagnostic (see Diagnostics section below).

### Canvas Node (graph.ts + SbcNode.tsx)

**Node subtitle** (graph.ts:408-415):

```ts
outbound.outbounds.length && isOutboundGroup(outbound)
  ? `${outbound.type}: ${outbound.outbounds.join(", ")}`
  : `${outbound.type} outbound`
```

When non-empty, subtitle lists candidate tags comma-separated. When empty the subtitle reads `"selector outbound"` — no visual cue that candidates are missing.

**Compatible quick-add** (graph.ts:417-420):

```ts
compatible: isOutboundGroup(outbound) ? ["SOCKS", "Direct", "Block"] : []
```

A selector node exposes a `+` affordance for SOCKS, Direct, and Block only. URLTest and other proxy outbounds are absent from the quick-add list even though they are valid candidates.

**Port spec** (SbcNode.tsx:176-178):

```ts
if (kind === "outbound" && (type === "selector" || type === "urltest")) {
  return [{ key: "outbound-member", label: "Downstream candidate", nodeKind: "outbound", icon: Network }];
}
```

Output port `outbound-member` on the selector node represents the right-side candidate connection.

Input port `selector-group` (SbcNode.tsx:111) on any outbound node represents membership in an upstream selector. Self-exclusion is implemented: `outboundTags(config, ref.tag)` excludes the selector's own tag from candidate options.

**Candidate edge construction** (graph.ts:427-440):

```ts
outbound.outbounds.forEach((candidateTag, candidateIndex) => {
  if (visualCandidateEdges >= MAX_VISUAL_CANDIDATE_EDGES) return;
  visualCandidateEdges += 1;
  edges.push(makeEdge(
    `edge:${outbound.type}:${tag}:${candidateIndex}:${candidateTag}`,
    id,
    `outbound:${candidateTag}`,
    "outbound-member",
    outbound.type === "selector" ? "selector-group" : "urltest-group",
  ));
});
```

Edge IDs include both candidate index and tag. Canvas clips at `MAX_VISUAL_CANDIDATE_EDGES = 96` globally (shared with urltest). Missing candidate tags are caught by diagnostics but dangling edges to missing nodes are silently skipped by graph layout.

**Port toggle (outbound-member)** (useProjectStore.ts:1065-1076):

Clicking the `outbound-member` port on a selector node toggles the last candidate off, or adds a new SOCKS outbound if the list is empty. This is a blunt toggle — it removes only the last item and adds a fixed SOCKS type. It does not present a selection UI.

**Port toggle (selector-group)** (useProjectStore.ts:817-828):

Clicking the `selector-group` port on any outbound either disconnects from the first found parent selector, or creates a new selector and adds this outbound to it. No UI prompt for which parent selector to use when multiple selectors exist.

### Inspector (Inspector.tsx)

**outbounds field** (Inspector.tsx:1526-1533):

```tsx
{"outbounds" in entity ? (
  <label className="field">
    <span>Candidates</span>
    <input
      value={toList(entity.outbounds)}
      onChange={(event) => updateField(ref, "outbounds", fromList(event.target.value))}
    />
  </label>
) : null}
```

`toList` joins with `", "`. `fromList` splits on `,` and trims. The user must type or edit raw tag names separated by commas. No dropdown or multiselect. Self-exclusion is not enforced here — the user could type the selector's own tag as a candidate.

**default field** (Inspector.tsx:1535-1543):

```tsx
{"default" in entity ? (
  <label className="field">
    <span>Default</span>
    <input
      value={String(entity.default ?? "")}
      onChange={(event) => updateField(ref, "default", event.target.value || undefined)}
    />
  </label>
) : null}
```

Free text input. No constraint to current candidates. Setting `default` to a tag not in `outbounds[]` is not caught by any diagnostic. If the user renames a candidate outbound, `default` is not updated (tag rename in commands.ts:984-987 does update `outbounds[]` entries but does not update `default`).

**interrupt_exist_connections** (not in outboundHandledFields):

`outboundHandledFields` (Inspector.tsx:128-141) does not include `interrupt_exist_connections`. This means the field falls through to `AdvancedScalarFields`, which renders boolean fields as checkboxes. The field will appear in the "Advanced fields" collapsible section if and only if the JSON already contains the field set to `false` or `true`. If the field is absent (as it is in the template skeleton), no toggle appears. The user cannot discover or set `interrupt_exist_connections` from a freshly created selector node.

### Domain: commands.ts

`connectSelectorCandidate` (commands.ts:813-826): idempotent; skips if tag already in list.

`disconnectEdge` relation `"selector"` (commands.ts:1144-1151): parses edge ID to extract parent and child tags, filters child from parent's `outbounds[]`. Correct.

`changeEntityType` for outbound (commands.ts:893-899): on type switch, replaces with a fresh object from `createOutbound`, preserving only `detour`. For a selector → other type switch, `outbounds[]`, `default`, and `interrupt_exist_connections` are all discarded. For other type → selector switch, same replacement with fresh skeleton. This is intentional but undocumented.

Tag rename (commands.ts:984-987): updates `outbounds[]` entries in all selector/urltest parents, but does not update `default`.

Outbound deletion (commands.ts:1064-1071): removes the deleted tag from all `outbounds[]` lists in selector/urltest parents. Does not clear `default` if it matches the deleted tag.

### Domain: diagnostics.ts

Existing check (diagnostics.ts:95-108): walks all selector/urltest outbounds, errors on each candidate tag not present in the known outbound tag set. Correct.

Missing checks:

1. Empty `outbounds[]` on a selector is not flagged. A selector with zero candidates is a config-level error in practice (sing-box will fail at runtime with no candidates to select from).
2. `default` pointing to a tag not in the selector's own `outbounds[]` is not checked. Stale `default` after deletion or rename goes undetected.
3. Circular membership (selector A has selector B as candidate, selector B has selector A as candidate) is not checked.

### Domain: sharedFieldRegistry.ts

`outboundDialTypes` (sharedFieldRegistry.ts:150) excludes `selector` — correct, selectors do not use dial fields.

### Tests

`tests/sbc-node-ports.test.ts` references `selector-group` — port spec tests exist.

## Priority Findings

### P0

**P0-A — Inspector `outbounds[]` is a raw text field, not a multiselect.**
Users must know and type exact outbound tags. Errors in tag names are not caught until save. The correct control is a multiselect or checklist of existing outbound tags excluding the selector itself.

Implementation target:
- Replace `<input value={toList(entity.outbounds)} ...>` at Inspector.tsx:1529-1532 with a `<select multiple>` or checkbox list.
- Populate options from `outboundTags(config, ref.tag)` (self-excluded list already exists at line 844).
- `onChange` converts selected options array to string[].

**P0-B — Inspector `default` is a free text field, not a select constrained to candidates.**
Setting `default` to a non-candidate tag is silently invalid. The correct control is a `<select>` with options: empty (first candidate used) + each tag currently in `entity.outbounds`.

Implementation target:
- Replace `<input value={String(entity.default ?? "")} ...>` at Inspector.tsx:1538-1541 with a `<select>` whose options derive from `["", ...(entity.outbounds ?? [])]`.
- `onChange` converts empty string to `undefined`.

**P0-C — Tag rename and outbound deletion do not update `default`.**
`commands.ts` rename path (line 984-987) updates `outbounds[]` entries but not `default`. Delete path (lines 1064-1071) removes from `outbounds[]` but does not clear `default`. Both leave a stale `default`.

Implementation target:
- In the rename block (commands.ts:984-987), also update `default` when `item.default === oldTag`.
- In the delete block (commands.ts:1064-1071), also clear `default` when `item.default === ref.tag`.

**P0-D — Empty `outbounds[]` is not diagnosed.**
A newly created selector has `outbounds: []` and will fail at sing-box runtime with no candidates.

Implementation target:
- In diagnostics.ts outbounds loop (around line 95), add: if `outbound.type === "selector"` and `(!outbound.outbounds || outbound.outbounds.length === 0)`, push a `warning` or `error` with key `"selector-no-candidates"` at path `/outbounds/${index}/outbounds`.

### P1

**P1-A — `interrupt_exist_connections` is buried in Advanced fields and only appears if the field is already set.**
The field is not in `outboundHandledFields`, so it is handled by `AdvancedScalarFields`. A fresh selector node without this field set never shows a toggle.

Implementation target:
- Add `"interrupt_exist_connections"` to `outboundHandledFields` in Inspector.tsx:128-141.
- Add a named boolean toggle in the outbound inspector section, rendered only when `entity.type === "selector"` (or `entity.type === "urltest"`):
  ```tsx
  {"interrupt_exist_connections" in entity || entity.type === "selector" ? (
    <label className="toggle-row">
      <input type="checkbox"
        checked={Boolean(entity.interrupt_exist_connections ?? false)}
        onChange={(e) => updateField(ref, "interrupt_exist_connections", e.target.checked || undefined)}
      />
      <span>Interrupt existing connections on switch</span>
    </label>
  ) : null}
  ```
- When unchecked and value becomes `false`, emit `undefined` rather than `false` to keep JSON clean.

**P1-B — `default` staleness is not diagnosed.**
After a rename or deletion, `default` may reference a tag not in `outbounds[]`.

Implementation target:
- In diagnostics.ts outbounds loop, add: if `outbound.type === "selector"` and `outbound.default` is set and `!outbound.outbounds?.includes(outbound.default)`, push `error` with key `"selector-invalid-default"` at path `/outbounds/${index}/default`.

**P1-C — Compatible quick-add list is incomplete.**
`graph.ts:417-420` offers only `["SOCKS", "Direct", "Block"]` for selector group membership. Other proxy types (VMess, VLESS, Trojan, Shadowsocks, Hysteria2, TUIC, etc.) are not listed, even though they are valid candidates.

Implementation target:
- Expand `compatible` for `isOutboundGroup(outbound)` to include all proxy outbound types, or replace with a generic "Add member" that opens the full outbound type picker.
- Alternatively, ensure the `outbound-member` port click creates a reasonable default proxy type rather than only SOCKS.

**P1-D — `outbound-member` port toggle removes only the last candidate.**
Clicking `outbound-member` on the selector canvas node removes `parent.outbounds[parent.outbounds.length - 1]` blindly. With multiple candidates, this is unpredictable.

Implementation target:
- Port toggle for `outbound-member` should open a picker showing current members with per-item remove, or at minimum remove via explicit selection, not positional last.

**P1-E — Clash API relationship is not surfaced in the UI.**
The selector's runtime behavior (candidate switching via Clash API) is not visible in Inspector or canvas. Users building configs without Clash API enabled have no indication that the selector is non-functional without it.

Implementation target:
- Add a read-only advisory notice in the Inspector for selector nodes: "Candidate selection requires Clash API at runtime." Link to experimental settings if Clash API is not configured in the current project config.

## Implementation Tasks

Tasks are ordered by priority. Each task references the exact file and line range.

### T1 — Inspector: replace `outbounds` text input with multiselect (P0-A)

File: `src/components/Inspector.tsx`
Lines: 1526-1533
Action: Replace the `<input>` with a `<select multiple>` or a checkbox list using `outboundTags(config, ref.tag)` as options. Wire `onChange` to produce a `string[]` from selected values.
Note: The `outboundTags` helper with self-exclusion is already available at line 217 and used at line 844 for the dial detour field.

### T2 — Inspector: replace `default` text input with constrained select (P0-B)

File: `src/components/Inspector.tsx`
Lines: 1535-1543
Action: Replace the `<input>` with a `<select>`. Options: `[{ value: "", label: "(first candidate)" }, ...entity.outbounds.map(t => ({ value: t, label: t }))]`. `onChange` converts `""` to `undefined`.
Dependency: Requires current `entity.outbounds` to be populated; if empty, select shows only the empty option.

### T3 — commands: update `default` on outbound tag rename (P0-C, part 1)

File: `src/domain/commands.ts`
Lines: 984-987
Action: In the `.map` callback that updates `item.outbounds`, also update `item.default`:
```ts
const nextDefault = item.default === oldTag ? newTag : item.default;
return item.tag === oldTag
  ? { ...item, tag: newTag, outbounds: ..., default: nextDefault }
  : { ...item, outbounds: ..., default: nextDefault };
```

### T4 — commands: clear `default` on outbound deletion (P0-C, part 2)

File: `src/domain/commands.ts`
Lines: 1064-1071
Action: In the `map` callback that removes the deleted tag from `item.outbounds`, also clear `item.default` when equal:
```ts
outbounds: item.outbounds?.filter((tag) => tag !== ref.tag),
default: item.default === ref.tag ? undefined : item.default,
```

### T5 — diagnostics: warn on empty `outbounds[]` for selector (P0-D)

File: `src/domain/diagnostics.ts`
Lines: 95-108 (in the `outbounds.forEach` loop)
Action: Before or after the existing candidate tag loop, add:
```ts
if (outbound.type === "selector" && (!Array.isArray(outbound.outbounds) || outbound.outbounds.length === 0)) {
  push(diagnostics, "error", "selector-no-candidates", `/outbounds/${index}/outbounds`,
    `Selector "${outbound.tag}" has no candidates. Add at least one outbound.`);
}
```

### T6 — Inspector: promote `interrupt_exist_connections` to named toggle (P1-A)

File: `src/components/Inspector.tsx`
Lines: 128-141 (outboundHandledFields), 1526-1544 (outbound inspector section)
Action:
1. Add `"interrupt_exist_connections"` to `outboundHandledFields`.
2. In the outbound inspector block, render a named checkbox when `entity.type === "selector"` (or `=== "urltest"`), defaulting to unchecked. Emit `undefined` when unchecked (omit from JSON).

### T7 — diagnostics: error on `default` not in candidates (P1-B)

File: `src/domain/diagnostics.ts`
Lines: 95-108
Action: In the same `outbounds.forEach` loop, add:
```ts
if (outbound.type === "selector" && outbound.default && Array.isArray(outbound.outbounds)
    && !outbound.outbounds.includes(outbound.default)) {
  push(diagnostics, "error", "selector-invalid-default", `/outbounds/${index}/default`,
    `Selector "${outbound.tag}" default "${outbound.default}" is not in its candidate list.`);
}
```

### T8 — graph: expand compatible quick-add types for selector (P1-C)

File: `src/canvas/graph.ts`
Lines: 417-420
Action: Replace `["SOCKS", "Direct", "Block"]` with a broader list, e.g. `["SOCKS", "VMess", "VLESS", "Trojan", "Shadowsocks", "Hysteria2", "TUIC", "Direct", "Block"]`, or drive the list from `CREATABLE_OUTBOUND_TYPES` minus selector/urltest/dns.

### T9 — Inspector: add Clash API advisory notice for selector (P1-E)

File: `src/components/Inspector.tsx`
Lines: around 1544 (after outbound section for selector type)
Action: When `entity.type === "selector"`, render a small informational note:
```tsx
{entity.type === "selector" ? (
  <p className="field-note">
    Candidate switching requires Clash API at runtime.
  </p>
) : null}
```
Optionally link to the experimental settings node if Clash API is not enabled.

## Relationship Model

```
outbound:selector
  ← outbound-member port → [candidate outbound nodes]
  ← selector-group input port → [upstream selector or urltest that lists this selector as a candidate]
  ← route input port → route hub (route.final)
  ← route-rule input port → route rules (rule.outbound)
  ← dns-detour input port → DNS servers using this as detour
  ← detour-target input port → other outbounds using this as dial detour
  ← service-detour input port → services using this as detour
  ← rule-set-download input port → remote rule sets downloading through this
```

The selector itself can be a candidate inside another selector or urltest (nesting is valid and common in real configs).

## Done Criteria

- [ ] Inspector `outbounds` renders a multiselect; raw text input is removed.
- [ ] Inspector `default` renders a select; options derive from current candidates.
- [ ] Tag rename updates `default` in all selector parents.
- [ ] Outbound deletion clears `default` in all selector parents.
- [ ] Diagnostic fires for empty `outbounds[]` on selector nodes.
- [ ] Diagnostic fires for `default` not in candidates.
- [ ] `interrupt_exist_connections` appears as a named toggle for all fresh selector nodes.
- [ ] Canvas compatible quick-add includes common proxy types beyond SOCKS.
- [ ] Clash API advisory is visible in Inspector for selector nodes.
- [ ] Existing port round-trip tests pass; new multiselect renders correctly in isolation.
