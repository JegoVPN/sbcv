<!-- Status: official-read. Source: stable docs/configuration/outbound/tuic.md, shared/dial.md, and shared/tls.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Outbound / tuic UI Review

## Scope

- Editable node: `outbound:tuic`
- Official doc: `outbound/tuic.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "tuic"`.

Official writable fields from `outbound/tuic.md`:

- `type`: `tuic`
- `tag`
- `server`: required.
- `server_port`: required.
- `uuid`: required.
- `password`
- `congestion_control`: `cubic`, `new_reno`, or `bbr`; `cubic` is default.
- `udp_relay_mode`: `native` or `quic`; conflicts with `udp_over_stream`.
- `udp_over_stream`: conflicts with `udp_relay_mode`.
- `zero_rtt_handshake`
- `heartbeat`
- `network`: `tcp` or `udp`; both are enabled by default when empty.
- `tls`: required outbound TLS object.
- Dial Fields from `shared/dial.md`.

Relationship model:

- This outbound can be referenced by route final/rules, selector/urltest groups, DNS detours where supported, service/rule-set Dial Fields, and other outbound Dial Fields.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- TLS is an embedded outbound TLS section, not a standalone node.
- `udp_relay_mode` and `udp_over_stream` are mutually exclusive.

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
- TLS is an Inspector section, not a port.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose required `server`, `server_port`, `uuid`, and TLS status first.
- `password` should be sensitive.
- `congestion_control`, `udp_relay_mode`, and `network` should be selects/segmented controls.
- `udp_relay_mode` and `udp_over_stream` must be mutually exclusive in UI and diagnostics.
- TLS is required and must be an outbound TLS embedded section.
- Dial Fields should include tag-select `detour`.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 required server/port/uuid/TLS fields need first-class validation.
- P0 `udp_relay_mode` conflicts with `udp_over_stream`; UI must enforce or diagnose.
- P0 Dial `detour` must use an outbound select/port attachment, not raw tag text.
- P1 QUIC/TUIC tuning fields should be grouped away from first-run setup.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
