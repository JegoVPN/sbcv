<!-- Status: official-read. Source: stable docs/configuration/outbound/tor.md and shared/dial.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Outbound / tor UI Review

## Scope

- Editable node: `outbound:tor`
- Official doc: `outbound/tor.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "tor"`.

Official writable fields from `outbound/tor.md`:

- `type`: `tor`
- `tag`
- `executable_path`: path to Tor executable; embedded Tor is ignored if set.
- `extra_args`
- `data_directory`: recommended; starts are slow if omitted.
- `torrc`: map of torrc options.
- Dial Fields from `shared/dial.md`.

Relationship model:

- This outbound can be referenced by route final/rules, selector/urltest groups, DNS detours where supported, service/rule-set Dial Fields, and other outbound Dial Fields.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- Tor has no `server`/`server_port`/TLS proxy-server fields.
- Embedded Tor is not included by default and requires build tags; UI must surface this before Check.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Outbounds category entry should add a target or group candidate.

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

- Left ports: route final, route rule outbound, selector candidate, URLTest candidate, DNS detour where applicable, Dial detour target, service detour target, and rule-set download detour.
- Right ports: optional Dial Fields `detour` outbound only.
- No server/TLS/transport ports should appear for Tor.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose executable mode clearly: external `executable_path` or embedded Tor build requirement.
- `data_directory` should be prominent and marked recommended.
- `extra_args` should be a string-list repeater.
- `torrc` should be a structured key/value map editor, with raw JSON as advanced fallback.
- Dial Fields should include tag-select `detour`.
- Do not show server, port, TLS, transport, or multiplex controls for Tor.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 Tor build/executable requirement must be visible; embedded Tor is not available by default.
- P0 Tor must not inherit generic server/TLS proxy fields.
- P0 Dial `detour` must use an outbound select/port attachment, not raw tag text.
- P1 `torrc` needs structured map editing.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
