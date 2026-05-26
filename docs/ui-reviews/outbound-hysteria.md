<!-- Status: official-read. Source: stable docs/configuration/outbound/hysteria.md, shared/dial.md, and shared/tls.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Outbound / hysteria UI Review

## Scope

- Editable node: `outbound:hysteria`
- Official doc: `outbound/hysteria.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "hysteria"`.

Official writable fields from `outbound/hysteria.md`:

- `type`: `hysteria`
- `tag`
- `server`: required.
- `server_port`: required unless `server_ports` is used.
- `server_ports`: since 1.12; conflicts with `server_port`.
- `hop_interval`: since 1.12; default `30s`.
- `up`, `down`: required bandwidth strings.
- `up_mbps`, `down_mbps`: required Mbps values alternative.
- `obfs`
- `auth`
- `auth_str`
- `recv_window_conn`
- `recv_window`
- `disable_mtu_discovery`
- `network`: `tcp` or `udp`; both are enabled by default when empty.
- `tls`: required outbound TLS object.
- Dial Fields from `shared/dial.md`.

Relationship model:

- This outbound can be referenced by route final/rules, selector/urltest groups, DNS detours where supported, service/rule-set Dial Fields, and other outbound Dial Fields.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- TLS is an embedded outbound TLS section, not a standalone node.
- `server_port` and `server_ports` are mutually exclusive.
- Bandwidth can be represented by string fields or Mbps fields; UI must avoid exporting conflicting/duplicated intent accidentally.

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

- Inspector must expose required `server`, port mode, bandwidth, auth, and TLS status first.
- Port mode should be explicit: single port or port hopping range list; `server_port` conflicts with `server_ports`.
- Bandwidth should be one guided control that exports either `up/down` strings or `up_mbps/down_mbps` consistently.
- TLS is required and must be an outbound TLS embedded section.
- `network` should be a mode control allowing TCP, UDP, or both/default.
- Dial Fields should include tag-select `detour`.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 required server/port-or-port-range/bandwidth/TLS fields need first-class validation.
- P0 `server_port` conflicts with `server_ports`; UI must enforce or diagnose.
- P0 bandwidth alternatives must not silently export contradictory values.
- P1 Hysteria v1 should be visually distinguished from Hysteria2.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
