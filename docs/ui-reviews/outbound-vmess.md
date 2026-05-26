<!-- Status: official-read. Source: stable docs/configuration/outbound/vmess.md, shared/dial.md, shared/tls.md, shared/multiplex.md, and shared/v2ray-transport.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Outbound / vmess UI Review

## Scope

- Editable node: `outbound:vmess`
- Official doc: `outbound/vmess.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "vmess"`.

Official writable fields from `outbound/vmess.md`:

- `type`: `vmess`
- `tag`
- `server`: required.
- `server_port`: required.
- `uuid`: required VMess user id.
- `security`: `auto`, `none`, `zero`, `aes-128-gcm`, `chacha20-poly1305`, or legacy `aes-128-ctr`.
- `alter_id`
- `global_padding`
- `authenticated_length`
- `network`: `tcp` or `udp`; both are enabled by default when empty.
- `tls`: outbound TLS object.
- `packet_encoding`: empty, `packetaddr`, or `xudp`.
- `transport`: embedded V2Ray Transport object.
- `multiplex`: embedded outbound Multiplex object.
- Dial Fields from `shared/dial.md`.

Relationship model:

- This outbound can be referenced by route final/rules, selector/urltest groups, DNS detours where supported, service/rule-set Dial Fields, and other outbound Dial Fields.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- TLS, V2Ray Transport, and Multiplex are embedded Inspector sections, not standalone nodes.
- V2Ray Transport type controls the shape of nested fields.

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
- TLS/transport/multiplex must be Inspector sections, not ports.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose required `server`, `server_port`, and `uuid` first.
- `security`, `network`, and `packet_encoding` should be selects/segmented controls.
- `alter_id`, `global_padding`, and `authenticated_length` should be grouped as VMess protocol options.
- TLS, V2Ray Transport, Multiplex, and Dial Fields should be embedded sections with their own type-aware controls.
- V2Ray Transport nested fields must change with transport type: HTTP, WebSocket, QUIC, gRPC, HTTPUpgrade.
- Dial Fields should include tag-select `detour`.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 required server/port/uuid fields need first-class validation.
- P0 transport type must drive nested transport fields; no raw JSON-only normal path.
- P0 Dial `detour` must use an outbound select/port attachment, not raw tag text.
- P1 legacy security values should be visibly marked.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
