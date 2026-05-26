# sing-box Visual Config Implementation Bridge

This document converts the completed official-read UI review into implementation gates. It is a docs-only bridge: it does not claim the product is implemented, and it must be read before changing canvas, Inspector, domain commands, validation, fixtures, or E2E tests.

Inputs:

- [sing-box Canvas Configuration Guide](sing-box-canvas-configuration-guide.md)
- [SBC Editable Node UI Reviews](index-ui-reviews.md)
- [sing-box Config Document Inventory](sing-box-config-doc-inventory.md)
- [sing-box Configuration Readthrough Matrix](sing-box-doc-readthrough-matrix.md)
- [sing-box Config Capability Audit](sing-box-config-capability-audit.md)
- `vercel-react-best-practices` for any frontend implementation or frontend review.

## Scope

The immediate product problem is not "draw more nodes". The problem is:

1. A normal user can add or import sing-box objects.
2. The user can understand where each object belongs.
3. The user can attach upstream and downstream references without knowing raw tag strings.
4. The Inspector exposes the official fields for the selected object without dumping confusing raw JSON by default.
5. Exported JSON comes only from canonical `SingBoxConfig`.
6. Target-matched validation separates browser semantic validity from official `sing-box check`.

The 66 per-node UI review documents are the field-level source for editable nodes. This bridge defines the cross-node implementation shape so those reviews do not turn into ad hoc UI patches.

## Non-Negotiable Model

- Canonical sing-box JSON/domain state is the source of truth.
- React Flow nodes, edges, side handles, hover menus, and layout are derived views.
- Canvas edge order never controls `route.rules`, `dns.rules`, or rule-set rule order.
- Tag references are edited through domain commands, not raw text fields in ordinary mode.
- Shared field groups stay embedded inside their official parent Inspectors.
- Library `DOCS` links are secondary help actions, not disabled fake buttons.
- No code path may generate exported `config.json` from React Flow node data.
- No implementation is complete without unit, UI/E2E, fixture, and target validation evidence where applicable.

## Reference Direction Model

The current confusing part is upstream/downstream. In sing-box, a visual line usually means one JSON object stores a tag reference to another JSON object. The line direction is a UI explanation, not a source-of-truth graph edge.

Use this vocabulary everywhere:

| Term | Meaning | JSON owner |
| --- | --- | --- |
| Upstream attachment | Another object references the selected object | The other object owns the field |
| Downstream attachment | The selected object references another object | The selected object owns the field |
| Candidate/member | A group object contains the selected outbound tag in a list | The group object owns the list |
| Detour | A parent object uses an outbound tag for Dial or download routing | The parent object owns `detour` or equivalent field |
| Final/default | A hub or group uses a tag when no rule or explicit value matches | The hub or group owns `final` or `default` |

Canvas side icons must represent these reference types, not repeat the node's own icon. A side icon is valid only when it maps to a real official field.

## Required Reference Commands

The first implementation slice must make these domain commands explicit and tested. Names are illustrative; the final code should follow existing project naming.

| Command | Canonical mutation | UI surfaces |
| --- | --- | --- |
| `setRouteFinal(outboundTag)` | `route.final` | Route hub, outbound upstream actions |
| `setRouteRuleOutbound(ruleId, outboundTag)` | `route.rules[index].outbound` or route action outbound | Route Rule card/table, outbound upstream actions |
| `addRouteRuleToOutbound(outboundTag, ruleDraft)` | Append or insert `route.rules[]` with outbound/action reference | Outbound upstream action |
| `setDnsFinal(serverTag)` | `dns.final` | DNS hub, DNS server upstream actions |
| `setDnsRuleServer(ruleId, serverTag)` | DNS rule route action server reference | DNS Rule card/table, DNS server upstream actions |
| `addSelectorMember(selectorTag, outboundTag)` | selector `outbounds[]` append | Selector right port, outbound upstream actions |
| `removeSelectorMember(selectorTag, outboundTag)` | selector `outbounds[]` remove | Selector right port, edge delete, Inspector multiselect |
| `setSelectorDefault(selectorTag, outboundTag)` | selector `default` | Selector Inspector |
| `addUrlTestMember(urltestTag, outboundTag)` | URLTest `outbounds[]` append | URLTest right port, outbound upstream actions |
| `removeUrlTestMember(urltestTag, outboundTag)` | URLTest `outbounds[]` remove | URLTest right port, edge delete, Inspector multiselect |
| `setDnsServerDetour(serverTag, outboundTag)` | DNS server Dial Fields `detour` | DNS server Inspector/right port, outbound upstream actions |
| `setDialDetour(ownerId, outboundTag)` | Parent Dial Fields `detour` | Dial-capable Inspector sections and ports |
| `setRuleSetDownloadDetour(ruleSetTag, outboundTag)` | remote rule-set download detour | Rule Set Inspector/right port |
| `addRuleSetReference(ownerId, ruleSetTag)` | route/DNS/TUN rule-set reference | Rule Set upstream actions, route/DNS/TUN Inspectors |
| `setServiceDetour(serviceId, outboundTag)` | service Dial/download detour where documented | Service Inspector/right port |
| `setExperimentalDownloadDetour(outboundTag)` | `experimental.clash_api.external_ui_download_detour` | Experimental Inspector only |

Each command must update canonical JSON, clear or report invalid references, rederive graph edges, and preserve stable/testing target gates.

## Ordinary User Flows

### Add an outbound and define upstream

The user should never be left with an unexplained orphan outbound.

Supported flows:

1. Select Route, click/drag the outbound-compatible side icon, choose or add an outbound. SBC writes `route.final` or opens a route-rule choice.
2. Select a Route Rule, click/drag its outbound side icon, choose or add an outbound. SBC writes that rule's outbound/action reference.
3. Select Selector or URLTest, click/drag its member side icon, choose or add an outbound. SBC appends the outbound tag to `outbounds[]`.
4. Select a DNS Server or any Dial-capable object, use its detour side icon, choose or add an outbound. SBC writes the documented Dial `detour`.
5. Select an orphan outbound. Inspector shows "Connect upstream" actions sorted by real usefulness: Route final, add Route Rule, add to Selector, add to URLTest, use as DNS detour, use as Dial detour.

The same operation must also be possible by dragging a typed line from the source side icon and snapping only to compatible target handles.

### Add a settings object

Settings objects do not belong in the traffic chain:

- Log
- NTP
- Certificate
- Experimental

Library opens or creates the singleton object, shows a small settings card if useful, and opens the Inspector. The card has no traffic ports and no generic chainable plus button. Any documented tag reference inside settings, such as NTP Dial detour or Experimental Clash download detour, is edited in the Inspector through a select or a specific reference handle.

### Add route or DNS rules

Route rules and DNS rules are ordered JSON arrays. They are not free canvas workflow nodes.

Required user flow:

1. Route or DNS hub opens the ordered table in the Inspector.
2. The table owns add, duplicate, delete, and move up/down.
3. Canvas rule cards may visualize the row, but their vertical or edge order is never authoritative.
4. Rule outbound/server fields use tag selects with add-new shortcuts.
5. Importing a large ruleset should not create an unreadable wall of cards by default; the table stays the primary editor.

### Add shared fields

Shared fields never create standalone canvas nodes. They appear only in parent Inspectors documented by the per-node review.

Examples:

- Listen Fields: inbound and service/API owners that cite Listen Fields.
- Dial Fields: outbound protocols, NTP, DNS remote servers, rule-set remote downloads, endpoints/services where documented.
- TLS: inbound server TLS, outbound TLS, encrypted DNS servers, and certificate-related owners where documented.
- Multiplex, V2Ray Transport, UDP over TCP, TCP Brutal: embedded protocol sections only.
- HTTP2 and QUIC: embedded transport/client sections only.
- DNS01 Challenge: certificate provider flow only.
- Pre-match, Wi-Fi State, Neighbor Resolution: only in rule or platform-specific owners that cite the docs.

If a per-node UI review does not list the shared field for that owner, the Inspector must not expose it.

## Library Rules

The Library has two top-level pills:

- `Templates`: curated starters only.
- `Library`: official config object groups.

Templates should stay small and high confidence:

- `1.13 Stable TUN Split`
- `1.12 Legacy Mixed Split`
- `1.14 Testing HTTP Client`

Library groups are collapsed by default. A group expansion must answer one question: "What can I add or open from here?"

Action vocabulary:

| Action | Meaning |
| --- | --- |
| `ADD` | Create a complete or immediately useful object |
| `SETUP` | Create a valid-shaped draft requiring real user values |
| `OPEN` | Open singleton or Inspector-only configuration |
| `TABLE` | Open an ordered table |
| `GATED` | Requires another target such as `1.14 testing` |
| `DOCS` | Documentation only; not a primary creation action |

Every primary Library action must either mutate canonical JSON or open the owning Inspector/table. Silent clicks are invalid.

## Node Card Rules

Use the Higgsfield-style node layout, but map it to sing-box semantics:

- Top outside label: own kind and subtype, for example `Outbound / Socks`.
- Main card title: user-facing tag/name first, for example `hk`.
- Subtitle: compact summary, for example `socks 127.0.0.1:1081`.
- Left side icons: compatible upstream/reference owners.
- Right side icons: compatible downstream/reference fields owned by this node.
- Bottom inner row: compact type chip, object validity chip, one settings button, and small reference count if useful.
- Large `+`: only when the next action is obvious for that node type.
- Delete: visible on selected/hovered node and routed through domain delete with reference cleanup diagnostics.

Buttons around the canvas should use the same dark circular visual language. Text inside node buttons must be short; detailed editing belongs in the Inspector.

## Inspector Rules

The right Inspector is object-specific. It must not contain full-config global JSON tabs or duplicate top toolbar functionality.

For every editable node:

1. Show required fields first.
2. Show official common fields next.
3. Collapse advanced and import-only fields.
4. Use selects/multiselects for tag references.
5. Use repeaters for arrays of scalar or key/value pairs.
6. Use explicit toggles for optional object sections.
7. Show target gates next to fields, not only at the whole-page level.
8. Hide fields that are invalid for the current subtype.
9. Type switching preserves tag when possible and clears incompatible fields through a domain command with diagnostics.

Raw JSON textareas are allowed only for advanced escape hatches and should never be the default ordinary-user editing surface.

## Top Toolbar Rules

The top toolbar stays minimal:

- Target dropdown: `1.13 stable`, `1.12 Legacy`, `1.14 testing`.
- `Check`
- `Export`
- `Import`
- Status pill

`Minimal`, Route Rules, DNS Rules, JSON, and Diagnostics do not belong as permanent top-level pills. Templates and Library own starters. Inspector and tables own node-specific editing. Advanced JSON can exist as a deliberate mode, not a duplicated default panel.

`Check` behavior:

1. On click, status pill becomes loading with label `Checking`.
2. Browser semantic validation runs first.
3. If an official runner is available, run the matching target binary:
   - `1.13 stable`: `sing-box-stable`
   - `1.12 Legacy`: `sing-box-1.12`
   - `1.14 testing`: `sing-box-testing`
4. Success status is a green check and `Valid`.
5. Failure status is red with `Invalid`, and the details panel points to the failing field or official command output.
6. A clean official pass requires exit code `0` and no warning/deprecation/removal output.

`Export` downloads `sbcv_<timestamp>.json`.

`Import` means import JSON; the button label should not need to say `Import JSON` when the product has one primary import format.

## Canvas Behavior Rules

- The canvas is fullscreen.
- Navigation/header controls float above the canvas.
- No decorative divider should split the canvas unless it has a concrete function.
- Initial load/import may fit the graph once.
- User pan, zoom, or node drag disables automatic re-fit until the user explicitly chooses fit-view.
- Nodes should be arranged by canonical logic order, not raw insertion order.
- Default spacing should be wide enough for large route and outbound graphs.
- Imported large configs should summarize repeated rules and groups instead of forcing every rule card into the main viewport.

Layout order:

1. Inbounds and endpoints.
2. Route and DNS hubs.
3. Route/DNS rules as compact rows or grouped columns.
4. Outbound groups such as selector/urltest.
5. Concrete outbounds.
6. DNS servers, rule sets, services, and settings in secondary lanes.

## Frontend Performance Gate

Apply `vercel-react-best-practices` before writing or reviewing implementation:

- Keep hover, drag preview, and temporary snap state in refs or localized state, not broad canonical config subscriptions.
- Memoize graph derivation from canonical config and stable indexes.
- Subscribe components to narrow derived booleans or selected object slices.
- Avoid barrel imports for icon and component modules.
- Lazy-load heavy advanced JSON editors and optional diagnostics panels.
- Use transitions for non-urgent graph recalculation after large imports.
- Build `Map`/`Set` indexes for tag lookups instead of repeated array scans in render paths.

## Implementation Slices

Do not try to implement all 66 reviews in one code pass. Each slice must leave the app in a coherent state and include tests.

### Slice 1: Reference Editing

Goal: users can attach upstream/downstream references without knowing tag strings.

Required evidence:

- Unit tests for every command in [Required Reference Commands](#required-reference-commands).
- Graph derivation tests proving edges come from canonical references.
- E2E tests for add outbound from Route, Route Rule, Selector, URLTest, DNS Server, and orphan outbound Inspector actions.
- No broad canvas rerender from hover/drag state.

### Slice 2: Inspector Schemas

Goal: highest-use stable nodes have ordinary-user structured fields.

Priority families:

- Outbound leaf protocols.
- TUN and Mixed inbounds.
- Route Rule and DNS Rule.
- DNS servers.
- Selector and URLTest.
- Log, NTP, Certificate, Experimental.

Required evidence:

- Schema coverage tests tied to `docs/ui-reviews/*.md`.
- Import -> edit -> export tests for each priority family.
- Type-switch tests for Inbound, Outbound, DNS Server, Endpoint, and Rule Set where supported.

### Slice 3: Library Add Flow

Goal: Library actions are discoverable, context-aware, and never silent.

Required evidence:

- E2E tests for Templates and Library pill behavior.
- Add/open/table/gated/docs actions behave according to [Library Rules](#library-rules).
- Adding an object while a compatible owner is selected offers a canonical attachment path.

### Slice 4: Visual Interaction

Goal: side icons behave like typed reference handles.

Required evidence:

- Hover shows compatible add/remove affordances.
- Dragging from a handle previews one typed relation.
- Compatible target handles snap; incompatible handles do not.
- Deleting an edge removes the canonical reference only.
- Screenshots verify full-screen canvas, floating toolbar, no right-side divider, no bottom duplicate panel, and no Inspector when nothing is selected.

### Slice 5: Validation, Import, Export

Goal: the product tells the truth about semantic validity and official validation.

Required evidence:

- Target dropdown labels are exactly `1.13 stable`, `1.12 Legacy`, `1.14 testing`.
- Check status pill states: idle, checking, valid, invalid.
- Fixture validation is target matched and excludes sing-box 1.11.
- Export filename matches `sbcv_<timestamp>.json`.
- Import preserves canonical JSON and derives graph layout without making canvas the source of truth.

## Per-Node Review Consumption

Every implementation PR that touches an editable node must name the matching review doc and update its status only when evidence exists.

Allowed status progression:

1. `official-read`
2. `ui-verified`
3. `implemented`

Do not mark a node `implemented` because the Library item exists. It requires:

- Domain command.
- Graph derivation.
- Inspector schema.
- Unit test.
- UI/E2E test.
- Fixture or target-matched validation where the config is expected to pass.

## Anti-Patterns

- Adding fake standalone Shared nodes.
- Making side icons generic plus buttons without relation semantics.
- Showing the same global JSON/check/tables in both top toolbar and node Inspector.
- Leaving newly added objects as unexplained orphans.
- Letting route/DNS edge layout imply rule order.
- Using raw comma-separated tag text for ordinary tag references.
- Auto-fitting the canvas after the user pans, zooms, or drags.
- Marking browser semantic `Valid` as official `sing-box check` success without running the matching binary.
- Hiding target gates behind disabled buttons or silent no-ops.

## Done Definition For The Current Goal

The implementation goal is done only when a normal user can:

1. Start from a stable template or import a real stable config.
2. See a readable graph derived from canonical JSON.
3. Add inbounds, route rules, DNS servers, outbounds, groups, rule sets, endpoints, services, and settings through the correct surfaces.
4. Attach references through side handles or Inspector selects without hand-writing tags.
5. Edit official fields for the selected object through a structured Inspector.
6. Run Check and see truthful semantic and official validation state.
7. Export `sbcv_<timestamp>.json`.
8. Re-import the exported file and get the same canonical config and explainable graph.

This doc is complete as a planning bridge. It does not complete the product implementation.
