<!-- Status: ui-verified + partially implemented (2026-05-27). Source: stable docs/configuration/outbound/selector.md. P0 Inspector candidate multiselect, default constrained select, and interrupt_exist_connections toggle landed. Outstanding: P0 commands.ts rename/delete cascade for `default`, P0 empty-outbounds[] diagnostic, P1 fixture/E2E coverage. -->
# Outbound / selector UI Review

## Scope

- Editable node: `outbound:selector`
- Official doc: `outbound/selector.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "selector"`.

Official writable fields from `outbound/selector.md`:

- `tag`
- `type`
- `outbounds`: required list of outbound tags to select.
- `default`: optional outbound tag; sing-box uses the first candidate if empty.
- `interrupt_exist_connections`: optional boolean.

Official behavior note:

- The selector is controlled through Clash API at runtime, but config authoring still owns the candidate list.

Relationship model:

- `outbounds[]` is a tag-reference list to other outbounds.
- `default` must either be empty or reference one of the candidate tags.
- Selector can itself be referenced by route final, route rules, DNS detours, service detours, rule-set download detours, and higher-level selector/urltest groups.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- The Library entry can add a selector group, but adding child outbounds must also be discoverable from the selected selector context.

Recommendation:

- Keep the primary action short and explicit: `ADD`, `SETUP`, `OPEN`, or `TABLE`.
- Avoid showing implementation statuses such as internal kind names to ordinary users.

## Middle: Canvas Node

Review:

- The canvas node should show the human object name first and the internal type only as a small secondary label.
- Status should mean semantic validity for this object, not that the full exported config passed official binary validation.
- The large `+` affordance should only exist when it creates an obvious next object of the correct type.
- The bottom pill row is too dense for many nodes; repeated type/status/count controls should be reduced when Inspector already provides the same action.

Port semantics:

- Left ports: route final, route rule outbound, selector candidate, URLTest candidate, DNS detour, Dial detour target, service detour target, rule-set download detour. Right ports: candidate members.

Recommendation:

- Right-side candidate port should be the visual shortcut for editing `outbounds[]`.
- Left-side candidate ports mean "this selector can be a candidate inside another selector/urltest", not "this selector owns upstream members".
- Hover/click/drag should add or remove canonical tag references only.

## Right: Inspector

Review:

- Current gap: Inspector uses a raw text input for `outbounds`, which forces users to know tags and comma syntax.
- Inspector must expose candidate membership as a checklist or multiselect of existing outbound tags, excluding the selector itself.
- Inspector must expose `default` as a select whose choices are empty plus current candidates.
- Inspector must expose `interrupt_exist_connections` as a toggle.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 group membership needs visual add/remove and Inspector multiselect.
- P0 `default` must be constrained to current candidates.
- P1 `interrupt_exist_connections` should be a first-class toggle.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
