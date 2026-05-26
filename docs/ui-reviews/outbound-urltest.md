<!-- Status: ui-verified + partially implemented (2026-05-27). Source: stable docs/configuration/outbound/urltest.md. P0 Inspector candidate multiselect, no `default` field for urltest, and interrupt_exist_connections toggle landed; url/interval/tolerance/idle_timeout fall through to AdvancedScalarFields (still acceptable; promote to first-class in a later atomic). Outstanding: P0 fixture/E2E coverage. -->
# Outbound / urltest UI Review

## Scope

- Editable node: `outbound:urltest`
- Official doc: `outbound/urltest.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "urltest"`.

Official writable fields from `outbound/urltest.md`:

- `tag`
- `type`
- `outbounds`: required list of outbound tags to test.
- `url`: optional URL, defaults to `https://www.gstatic.com/generate_204` if empty.
- `interval`: optional interval, defaults to `3m` if empty.
- `tolerance`: optional milliseconds, defaults to `50` if empty.
- `idle_timeout`: optional duration, defaults to `30m` if empty.
- `interrupt_exist_connections`: optional boolean.

Relationship model:

- `outbounds[]` is a tag-reference list to other outbounds.
- URLTest can itself be referenced by route final, route rules, selector groups, DNS detours, service detours, and rule-set download detours.
- There is no official `default` field for URLTest.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- The Library entry can add a URLTest group, but adding tested child outbounds must also be discoverable from the selected URLTest context.

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
- Left-side candidate ports mean "this URLTest can be a candidate inside selector/urltest", not "this URLTest owns upstream members".
- Hover/click/drag should add or remove canonical tag references only.

## Right: Inspector

Review:

- Current gap: Inspector uses a raw text input for `outbounds`, which forces users to know tags and comma syntax.
- Inspector must expose tested candidates as a checklist or multiselect of existing outbound tags, excluding the URLTest itself.
- Inspector must expose `url`, `interval`, `tolerance`, `idle_timeout`, and `interrupt_exist_connections` as first-class fields.
- Inspector must not expose `default` for URLTest.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 group membership needs visual add/remove and Inspector multiselect.
- P0 URLTest must not inherit selector-only `default` UI.
- P1 URL/interval/tolerance/idle timeout and interrupt toggles should be first-class controls.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
