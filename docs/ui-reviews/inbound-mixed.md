<!-- Status: official-read. Source: stable docs/configuration/inbound/mixed.md and shared/listen.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Inbound / mixed UI Review

## Scope

- Editable node: `inbound:mixed`
- Official doc: `inbound/mixed.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "mixed"`.

Official writable fields from `inbound/mixed.md`:

- `type`: `mixed`
- `tag`
- Listen Fields from `shared/listen.md`.
- `users`: SOCKS and HTTP users; no authentication required if empty.
- `set_system_proxy`: only supported on Linux, Android, Windows, and macOS; Android/Apple without privileges should use `tun.platform.http_proxy` instead.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- Users are embedded credentials, not separate nodes.

## Left: Add Library

Current expected action: `ADD`.

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
- Optional Listen Fields `detour` should be an advanced inbound-reference port or Inspector select.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose tag, listen address, listen port, users, and system proxy toggle.
- `users[]` needs a structured repeater; passwords are sensitive.
- `set_system_proxy` must show platform/privilege warning and the `tun.platform.http_proxy` alternative.
- Do not show TLS/multiplex/transport sections for mixed inbound.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Listen Fields `detour` must use an inbound select/port attachment, not raw tag text.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 users must be a structured credential repeater with sensitive password handling.
- P0 `set_system_proxy` needs platform/privilege guidance before export/check.
- P0 deprecated Listen Fields must be import/migration-only.
- P1 mixed should be presented as SOCKS+HTTP listener, not an outbound proxy.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
