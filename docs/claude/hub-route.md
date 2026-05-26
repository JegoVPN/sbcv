# Route Hub UI Review

## Scope

- Node ID: `route:main` (singleton)
- Palette kind: `route` (label "Route Hub", `ready: true`)
- Canvas node kind: `"route"`, type: `"route"`
- Entity ref shape: `{ kind: "route", id: "main" }`
- Official stable doc: `route/index.md`
- Official testing doc: `route/index.md` (1.14.0 additions)
- This review covers the top-level `route` object only. The `rules[]` table content belongs to the `rule-route-rule` review.

---

## Official Model

### Writable Fields (stable — sing-box up to 1.12.x)

| Field | Type | Since | Platform scope | Conflict / note |
|---|---|---|---|---|
| `rules` | ordered array | 1.0 | all | Table-owned; order is canonical JSON order |
| `rule_set` | array | 1.8.0 | all | Resource list; referenced by rules via tag |
| `final` | string (outbound tag) | 1.0 | all | Default outbound; first outbound used if empty |
| `auto_detect_interface` | boolean | 1.0 | Linux / Windows / macOS | Ineffective if `outbound.bind_interface` set |
| `override_android_vpn` | boolean | 1.0 | Android only | Only meaningful when `auto_detect_interface` true |
| `default_interface` | string | 1.0 | Linux / Windows / macOS | Conflicts with `default_network_strategy`; ineffective if `auto_detect_interface` set |
| `default_mark` | integer | 1.0 | Linux only | Ineffective if `outbound.routing_mark` set |
| `default_domain_resolver` | string or object | 1.12.0 | all | Dial Fields `domain_resolver` shape; overridden by `outbound.domain_resolver` |
| `default_network_strategy` | string | 1.11.0 | all | Conflicts with `default_interface`; overridden by `outbound.network_strategy` |
| `default_network_type` | string[] | 1.11.0 | all | Dial Fields `network_type` |
| `default_fallback_network_type` | string[] | 1.11.0 | all | Dial Fields `fallback_network_type` |
| `default_fallback_delay` | duration string | 1.11.0 | all | Dial Fields `fallback_delay` |

Removed / migration-only fields (must not appear in normal creation UI):

| Field | Removed in | Note |
|---|---|---|
| `geoip` | 1.12.0 | Deprecated since 1.8.0; removed in 1.12.0 |
| `geosite` | 1.12.0 | Same |

### Cross-Version Diff (testing — sing-box 1.14.0 additions)

Three new fields added in testing/1.14.0 only:

| Field | Type | Platform scope | Note |
|---|---|---|---|
| `find_neighbor` | boolean | Linux / macOS | Enables neighbor resolution for logging; requires `source_mac_address` / `source_hostname` rules |
| `dhcp_lease_files` | string[] | Linux / macOS | Custom DHCP lease file paths; auto-detected if empty |
| `default_http_client` | string (http_client tag) | all | Tag reference to HTTP client used by remote rule-sets; first defined client used if empty |

The stable doc also contains `find_process` (Linux / Windows / macOS) which is not listed in the 1.14.0 changelog block but appears in the testing structure. It was already present in earlier versions and is carried forward.

### Relationship Model

#### `final` -> outbound tag

`route.final` is a scalar tag reference. It names one outbound. If the named tag does not exist, sing-box falls back to the first declared outbound. The canvas draws a dedicated bold edge from `route:main` to `outbound:{tag}` using port key `outbound` / handle `route`. This edge is the only mechanism for writing `route.final`; the Inspector does not expose a `final` select field at all — the field is set exclusively via canvas edge connection and disconnection.

#### `rules[]` -> rule-route-rule nodes

`route.rules` is an ordered array. Rule evaluation is first-match in JSON array order. The canvas draws `route-rule:N` nodes linked to `route:main` via `edge:route-rule-order:N`. Edges visualize references; they do not define order. Array index is the canonical order. The ordered table in the Inspector (via `RouteRulesTable`) is the authoritative edit surface for rule position.

#### `rule_set[]` -> rule-set nodes

`route.rule_set` is an unordered resource list. Each entry is a tagged rule-set object (remote / local / inline). Rule-set nodes are identified by their `tag` and are referenced from `route.rules[].rule_set`. The route hub does not draw direct edges to rule-set nodes; edges originate from route-rule nodes.

#### Inbound references to route hub

All inbound nodes draw an edge to `route:main` via handle `route` / `inbound` when `config.route` exists. This is a visualization-only edge; no field on the `route` object names inbounds.

### Compat / Target Gate

- `find_neighbor`, `dhcp_lease_files`, `default_http_client` are testing-channel (1.14.0) only. They should be hidden or clearly gated behind a testing channel indicator in the Inspector.
- `auto_detect_interface`, `default_interface`, `default_mark`, `override_android_vpn` have platform constraints. These do not change the JSON schema, but the UI must communicate platform applicability.

---

## Left: Add Library — Palette Current State and Issues

### Current State

```
kind:       "route"
label:      "Route Hub"
icon:       GitBranch
docsUrl:    docs("route/")
ready:      true         // yields status "add"
```

`itemStatus` resolves to `"add"`. `canActivate` returns true. Clicking calls `createFromPalette("route")`, which calls `ensureRoute(config)`. `ensureRoute` is idempotent — if `config.route` already exists, it is preserved unchanged; only `rules` is normalized to an array. After creation, `selectedId` is not explicitly set to `"route:main"`, so the Inspector does not automatically open on the route node.

### Issues

**P1 — Palette action label mismatch for repeat clicks.** `statusLabel["add"]` is "ADD". After the route node already exists, clicking "ADD" calls `ensureRoute` again (no-op) but the button label still says "ADD" as if the object does not exist. For a singleton hub, the label should switch to "OPEN" or "EDIT" once the node exists, consistent with the DNS hub behavior.

**P1 — `selectedId` not set after creation.** `createFromPalette("route")` does not set `selectedId = "route:main"`, so the canvas does not scroll to or select the new node. DNS hub (`kind === "dns-hub"`) has the same gap. Compare with inbound creation which does set `selectedId`.

**P0 — Icon is `GitBranch`, not a routing symbol.** The route hub uses `GitBranch` while the canvas and port specs use the `Route` icon from lucide-react. The Palette entry should match the canvas icon.

---

## Middle: Canvas Node

### Current Node Data (graph.ts)

```ts
makeNode("route:main", {
  ref: { kind: "route", id: "main" },
  kind: "route",
  type: "route",
  title: "Route",
  subtitle: `${routeRules.length} ordered rules`,
  status: diagnosticStatus("/route", diagnostics),
  compatible: ["Direct", "Block", "Selector", "URLTest", "SOCKS"],
})
```

### Input Ports (getPortSpecs, direction = "input")

| Port key | Label | Connects from |
|---|---|---|
| `inbound` | "Inbound traffic" | `inbound` nodes |

### Output Ports (getPortSpecs, direction = "output")

| Port key | Label | Connects to |
|---|---|---|
| `route-rule` | "Route rule" | `route-rule` nodes |
| `outbound` | "Outbound" | `outbound` nodes (writes `route.final`) |

### Edge semantics (graph.ts)

| Edge ID pattern | From | To | Handle out | Handle in | Meaning |
|---|---|---|---|---|---|
| `edge:inbound:{tag}:route` | `inbound:{tag}` | `route:main` | `route` | `inbound` | Visualization only |
| `edge:route-rule-order:{N}` | `route:main` | `route-rule:{N}` | `route-rule` | `route` | Visualization; order from array |
| `edge:route-final:{tag}` | `route:main` | `outbound:{tag}` | `outbound` | `route` | Writes `route.final` |

### Issues

**P0 — Rule order implied by edge order.** Edges from `route:main` to `route-rule:N` nodes use the port key `route-rule`. A user unfamiliar with the system may attempt to drag or reorder edges to change rule priority. The UI gives no affordance that this is disallowed and does nothing. Rule order must be communicated as table-owned. The canvas subtitle "N ordered rules" is correct but insufficient.

**P1 — `compatible` list is stale / incomplete.** The node data sets `compatible: ["Direct", "Block", "Selector", "URLTest", "SOCKS"]`. This is not a real runtime constraint — any outbound type can be the `final` outbound. The field misleads about valid `final` targets.

**P1 — The `outbound` output port doubles as both `final` and a placeholder for rule outbounds.** From the canvas node, the `outbound` port connects to outbounds and writes `route.final`. Route-rule outbound references are drawn from rule nodes, not from the route hub directly. The port label "Outbound" does not distinguish "final fallback" semantics from rule references.

**P1 — No missing-tag diagnostic on canvas.** If `route.final` references a tag that does not exist in `config.outbounds`, the canvas draws no edge but shows no warning on the route hub node either. The `diagnosticStatus("/route", diagnostics)` call would surface this only if the diagnostics pipeline emits a `/route` error for a missing final tag.

---

## Right: Inspector

### Current Coverage for `ref.kind === "route"`

The Inspector renders the following when `ref.kind === "route"`:

1. **`RouteRulesTable`** — ordered rule add/move/delete table. Shown first, before any scalar fields.
2. **No delete button** — `route` and `dns` are excluded from the delete affordance (`ref.kind !== "route"` guard).
3. **No tag / type fields** — route has neither a `tag` nor a selectable `type`.
4. **No inline scalar controls** for: `final`, `auto_detect_interface`, `override_android_vpn`, `default_interface`, `default_mark`, `find_process`. These fields are absent from the Inspector entirely except where covered by shared groups.
5. **Shared groups rendered via `SharedFieldCards`**:
   - `dial` group (always present for `ref.kind === "route"`): renders `default_domain_resolver` (text), `default_network_strategy` (select), `default_network_type` (list), `default_fallback_network_type` (list), `default_fallback_delay` (text).
   - `http-client` group (always present for `ref.kind === "route"`): renders `default_http_client` (select over `httpClientOptions`). This is a testing-1.14.0 field but appears unconditionally.
   - `neighbor` group (always present for `ref.kind === "route"`): renders `find_neighbor` (boolean), `dhcp_lease_files` (list). Both are testing-1.14.0 fields but appear unconditionally.

### Missing Inspector Controls

| Field | Current UI | Required |
|---|---|---|
| `final` | No Inspector control; only writable via canvas edge | Select over current outbound tags with missing-tag warning |
| `auto_detect_interface` | Not present | Toggle (checkbox), Linux/Win/macOS label |
| `override_android_vpn` | Not present | Toggle, shown only when `auto_detect_interface` true, Android-only label |
| `default_interface` | Not present | Text input, disabled / warned when `auto_detect_interface` or `default_network_strategy` set |
| `default_mark` | Not present | Number input, Linux-only label |
| `find_process` | Not present | Toggle, Linux/Win/macOS label |

### Inspector Issues

**P0 — `final` has no Inspector surface.** The only way to set `route.final` is to draw a canvas edge from `route:main` to an outbound node. There is no fallback if the user works in the Inspector panel, and there is no way to see or validate what the current `final` value is without inspecting the outbound node or the raw JSON. A `final` select field must be added to the route Inspector.

**P1 — Platform-scoped fields are entirely absent.** `auto_detect_interface`, `override_android_vpn`, `default_interface`, `default_mark`, and `find_process` are not rendered anywhere in the Inspector. They are present in templates (e.g., `auto_detect_interface: true`), so imported configs will carry these values silently. Users cannot set them through the UI.

**P1 — Testing-channel fields rendered unconditionally.** `find_neighbor`, `dhcp_lease_files` (neighbor group), and `default_http_client` (http-client group) are 1.14.0-only fields. They appear in the Inspector regardless of the project channel. They should be hidden on stable channel or carry an explicit testing gate indicator.

**P1 — `default_domain_resolver` rendered as plain text input.** The field accepts either a string or an object (Dial Fields shape). The current `{ kind: "text" }` control only supports the string form. The object form (inline domain resolver config) cannot be entered and will be discarded if the user types a string over an existing object value.

**P1 — `RouteRulesTable` exposed in Inspector but does not provide a `rule_set` management surface.** The table shows `rule_set` per-rule via a text datalist input, but there is no UI to add, remove, or configure `route.rule_set[]` entries (the resource objects). Rule-set nodes are added through the Palette "Rule Set" entry, not through the route Inspector.

**P1 — Conflict labels missing.** `default_interface` conflicts with `default_network_strategy`. Neither field has a label or guard communicating this. An admin could set both, producing a silently ignored configuration.

---

## Tag Reference Surfaces

### `route.final` (outbound tag)

| Surface | Current behavior | Required |
|---|---|---|
| Canvas edge | Drawing edge from `route:main` port `outbound` to `outbound:{tag}` calls `setRouteFinal` | Working |
| Canvas edge removal | Disconnecting edge calls `disconnectEdge` which clears `route.final` | Working |
| Inspector select | Not present | Must be added |
| Tag rename | `renameTag` updates `route.final` if it matched the old tag | Working (`commands.ts:1008`) |
| Tag delete | `deleteEntity` clears `route.final` if it matched the deleted tag | Working (`commands.ts:1065`) |

### `route.rule_set[]` (tag list resource)

| Surface | Current behavior | Required |
|---|---|---|
| Palette "Rule Set" entry | `createFromPalette("rule-set")` adds to `config.route.rule_set` | Working |
| Rule Inspector datalist | Each route rule has a text+datalist input for `rule_set` per-rule | Partial (string only, no structured add) |
| Route Inspector | No `rule_set[]` management surface | Missing |

---

## Priority Findings

### P0

1. **`final` has no Inspector field.** Route's most critical routing field is invisible in the Inspector. Only canvas edge dragging writes it. Users who do not know to draw an edge cannot configure the default outbound from the Inspector.

2. **Rule order implied by canvas edges.** The `route-rule-order` edges from `route:main` to rule nodes look interactive. There is no UI communication that edge order is irrelevant to rule evaluation; the table index is authoritative. A user may drag edges expecting to reorder rules.

3. **Palette icon mismatch.** Route Hub uses `GitBranch` in Palette, `Route` on canvas. Inconsistent iconography undermines discoverability.

### P1

4. **Platform-scoped fields (`auto_detect_interface`, `override_android_vpn`, `default_interface`, `default_mark`, `find_process`) absent from Inspector.** Templates use these fields, so imported configs carry them silently. No Inspector surface exists to set or view them.

5. **Testing-channel fields (`find_neighbor`, `dhcp_lease_files`, `default_http_client`) rendered unconditionally.** These 1.14.0 fields should be hidden on stable channel or carry explicit gating.

6. **`default_domain_resolver` text-only.** The field accepts a string or an object. Text input loses object-form values on edit.

7. **`default_interface` / `default_network_strategy` conflict not communicated.** Setting both produces a silently ignored field with no diagnostic.

8. **Palette action label does not switch to "OPEN" after route exists.** The "ADD" label persists even when `config.route` is already populated, misleading users into thinking another click will add a second instance.

9. **`selectedId` not set after palette creation.** Opening the route node via Palette does not scroll or select the canvas node.

10. **`RouteConfig` type is missing most typed fields.** Only `rules`, `rule_set`, `final`, `auto_detect_interface`, and `default_domain_resolver` are typed in `types.ts`. All other fields fall through to `[key: string]: unknown`. This is a domain type coverage gap affecting type-safe field access.

---

## Implementation Tasks

1. Add `final` select field to the route Inspector section. Populate with `outboundTags(config)`. Show a diagnostic badge if the value is set but the tag is missing.
2. Add toggling + text controls for `auto_detect_interface`, `override_android_vpn`, `default_interface`, `default_mark`, `find_process` to the route Inspector. Include platform-scope labels (e.g., "Linux / Windows / macOS only") and conflict guards.
3. Gate `find_neighbor`, `dhcp_lease_files`, `default_http_client` on `channel === "testing"` in `sharedGroupsForEntity` or `sharedFieldDefinitions`.
4. Upgrade `default_domain_resolver` control from `kind: "text"` to a two-mode control: string input or object editor (structured or JSON), guarded on whether the current value is a string or object.
5. Add conflict indicator to `default_interface` field: disabled / warned when `auto_detect_interface` or `default_network_strategy` is set.
6. In `Palette.tsx`, add logic to detect if `config.route` already exists and render "OPEN" instead of "ADD" with `canActivate` pointing to `selectedId = "route:main"`.
7. In `createFromPalette` / `ensureRoute` flow, set `selectedId = "route:main"` after idempotent creation.
8. Change the Palette `route` entry icon from `GitBranch` to `Route` (lucide-react import already used in SbcNode and SbcNode portSpecs).
9. Extend `RouteConfig` in `types.ts` to type `override_android_vpn`, `default_interface`, `default_mark`, `find_process`, `find_neighbor`, `dhcp_lease_files`, `default_network_strategy`, `default_network_type`, `default_fallback_network_type`, `default_fallback_delay`.
10. Add a canvas tooltip or indicator on `route-rule-order` edges communicating that visual edge position does not affect rule evaluation order.

---

## Done Criteria

- Inspector for `ref.kind === "route"` includes a working `final` outbound select with missing-tag diagnostic.
- All stable platform-scoped fields (`auto_detect_interface`, `override_android_vpn`, `default_interface`, `default_mark`, `find_process`) are visible and editable in the Inspector with platform labels.
- Testing-only fields (`find_neighbor`, `dhcp_lease_files`, `default_http_client`) are hidden on stable channel.
- `default_domain_resolver` control handles both string and object forms without data loss.
- Palette route entry uses `Route` icon and shows "OPEN" when `config.route` already exists.
- Creating route from Palette sets `selectedId = "route:main"`.
- `RouteConfig` type covers all 13 writable stable fields explicitly.
- Round-trip smoke test: import a config with `final`, `auto_detect_interface: true`, `default_mark`, and all 1.11 network fields; inspect the route node; confirm all values are visible and editable; export and verify JSON matches original.
