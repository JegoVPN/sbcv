<!-- Status: official-read. Source: stable docs/configuration/inbound/direct.md and shared/listen.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Inbound / direct UI Review

## Scope

- Editable node: `inbound:direct`
- Official doc: `inbound/direct.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "direct"`.

Official writable fields from `inbound/direct.md`:

- `type`: `direct`
- `tag`
- Listen Fields from `shared/listen.md`.
- `network`: `tcp` or `udp`; both are enabled when empty.
- `override_address`
- `override_port`

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy `sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, and `udp_disable_domain_unmapping` are deprecated in 1.11 and removed in 1.13; they must be import/migration-only for stable authoring.
- Direct inbound has no users, TLS, multiplex, or V2Ray transport fields.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Inbounds category entry should add a protocol-specific listening source.

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

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference port or Inspector select; it is not the normal flow output.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose tag, listen address, listen port, and network mode first.
- `override_address` and `override_port` are protocol fields for direct inbound and should be grouped as destination override.
- Do not show auth/users/TLS/multiplex/transport sections for direct inbound.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Listen Fields `detour` must use an inbound select/port attachment, not raw tag text.
- Type switching should preserve route/dns rule `inbound[]` references to this tag.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 direct inbound must not expose generic auth/TLS/transport fields.
- P0 deprecated Listen Fields must be import/migration-only.
- P0 Listen `detour` must reference inbound tags explicitly.
- P1 destination override fields need clear copy because they change where accepted traffic is sent.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
