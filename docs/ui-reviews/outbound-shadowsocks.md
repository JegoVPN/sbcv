<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Outbound / shadowsocks UI Review

## Scope

- Editable node: `outbound:shadowsocks`
- Official doc: `outbound/shadowsocks.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "shadowsocks"`.

Official writable fields from `outbound/shadowsocks.md`:

- `type`: `shadowsocks`
- `tag`
- `server`: required.
- `server_port`: required.
- `method`: required.
- `password`: required.
- `plugin`: SIP003 plugin; only internal `obfs-local` and `v2ray-plugin` are supported.
- `plugin_opts`
- `network`: `tcp` or `udp`; both are enabled by default when empty.
- `udp_over_tcp`: embedded UDP over TCP settings.
- `multiplex`: embedded outbound Multiplex settings.
- Dial Fields from `shared/dial.md`.

Relationship model:

- This outbound can be referenced by route final/rules, selector/urltest groups, DNS detours where supported, service/rule-set Dial Fields, and other outbound Dial Fields.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- `udp_over_tcp` conflicts with `multiplex`.
- `udp_over_tcp` and `multiplex` are embedded shared sections, not standalone nodes.
- There is no TLS or V2Ray transport field for Shadowsocks outbound.

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
- No TLS/transport ports should appear for Shadowsocks.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose required `server`, `server_port`, `method`, and `password` first.
- `method` should be a select with stable methods and clearly separated legacy methods.
- `password` should be sensitive.
- `plugin` should be constrained to supported internal plugins, with plugin options visible only when plugin is set.
- `network` should be a mode control allowing TCP, UDP, or both/default.
- `udp_over_tcp` and `multiplex` must be mutually exclusive in UI and diagnostics.
- Dial Fields should be an advanced embedded section with tag-select `detour`.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 required server/method/password fields need first-class validation.
- P0 `udp_over_tcp` conflicts with `multiplex`; UI must enforce or diagnose.
- P0 Dial `detour` must use an outbound select/port attachment, not raw tag text.
- P1 plugin support should be constrained to `obfs-local` and `v2ray-plugin`.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
