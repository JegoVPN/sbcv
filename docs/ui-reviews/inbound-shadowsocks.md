<!-- Status: official-read. Source: stable docs/configuration/inbound/shadowsocks.md, service/ssm-api.md, shared/listen.md, and shared/multiplex.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Inbound / shadowsocks UI Review

## Scope

- Editable node: `inbound:shadowsocks`
- Official doc: `inbound/shadowsocks.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "shadowsocks"`.

Official writable fields from `inbound/shadowsocks.md`:

- `type`: `shadowsocks`
- `tag`
- Listen Fields from `shared/listen.md`.
- `network`: `tcp` or `udp`; both if empty.
- `method`: required.
- `password`: required for single-user/relay forms.
- `users[]`: multi-user form with `name` and `password`.
- `managed`: defaults to false; enable when managed by SSM API.
- `destinations[]`: relay structure with `name`, `server`, `server_port`, and `password`.
- `multiplex`: embedded inbound Multiplex settings.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- SSM API `servers` mapping can reference this inbound only when `managed: true`.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- Multiplex is an embedded inbound shared section, not a standalone node.
- Single-user, multi-user, managed, and relay modes are distinct authoring shapes and should not be accidentally mixed.

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

- Left ports: optional incoming SSM API management reference.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference port or Inspector select.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, method, mode, and credentials first.
- Mode should be explicit: single-user, multi-user, managed by SSM API, or relay.
- `managed: true` must be visible and linked to SSM API `servers` mapping.
- `users[]` and `destinations[]` need structured repeaters; passwords are sensitive.
- `method` should be a select with key-length guidance for 2022 methods.
- Multiplex must be the inbound Multiplex shared section.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 SSM managed mode must be explicit when connected to SSM API.
- P0 mode conflicts must be handled; managed/multi-user/relay/single-user should not silently export mixed shapes.
- P0 required `method` and credential fields need first-class validation.
- P0 passwords must be treated as sensitive.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
