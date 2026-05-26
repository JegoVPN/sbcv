<!-- Status: official-read. Source: stable docs/configuration/outbound/socks.md, shared/dial.md, and shared/udp-over-tcp.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Outbound / socks UI Review

## Scope

- Editable node: `outbound:socks`
- Official doc: `outbound/socks.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "socks"`.

Official writable fields from `outbound/socks.md`:

- `type`: `socks`
- `tag`
- `server`: required.
- `server_port`: required.
- `version`: `4`, `4a`, or `5`; SOCKS5 is default.
- `username`
- `password`: SOCKS5 password.
- `network`: `tcp` or `udp`; both are enabled by default when empty.
- `udp_over_tcp`: boolean or object from `shared/udp-over-tcp.md`.
- Dial Fields from `shared/dial.md`.

Relationship model:

- This outbound can be referenced by route final/rules, selector/urltest groups, DNS detours where supported, service/rule-set Dial Fields, and other outbound Dial Fields.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- `udp_over_tcp` is an embedded shared section, not a standalone node.
- There is no TLS or V2Ray transport field for SOCKS outbound.

## Left: Add Library

Current expected action: `ADD`.

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
- No TLS/transport/multiplex ports should appear for SOCKS.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose required `server` and `server_port` first.
- `version` should be a segmented/select control for `4`, `4a`, `5`.
- `network` should be a mode control allowing TCP, UDP, or both/default without requiring users to know empty-string semantics.
- `udp_over_tcp` should be a guided embedded section with enable toggle and version select.
- Dial Fields should be an advanced embedded section with tag-select `detour`.
- Do not show TLS/transport/multiplex controls for SOCKS.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 `server` and `server_port` are required and need first-class validation.
- P0 Dial `detour` must use an outbound select/port attachment, not raw tag text.
- P0 SOCKS must not inherit TLS/transport/multiplex controls from other outbound types.
- P1 `udp_over_tcp` needs structured controls instead of raw JSON for ordinary users.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
