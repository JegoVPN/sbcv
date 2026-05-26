<!-- Status: ui-verified (2026-05-27). Shared atomics (dial/listen/TLS shared fields + structured editors + diagnostics + platform/channel banners) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# DNS Server / fakeip UI Review

## Scope

- Editable node: `dns-server:fakeip`
- Official doc: `dns/server/fakeip.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "fakeip"`.

Official writable fields from `dns/server/fakeip.md`:

- `type`: `fakeip`
- `tag`
- `inet4_range`: IPv4 address range for FakeIP; example/default shape `198.18.0.0/15`.
- `inet6_range`: IPv6 address range for FakeIP; structure uses `inet6_range` with example/default shape `fc00::/18`. The field heading in the current docs says `inet6_address`, but the JSON structure key is `inet6_range`.

Relationship model:

- FakeIP server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- The top-level `dns.fakeip` object is separate from a DNS server of type `fakeip`; the UI must not collapse them into one hidden setting.
- FakeIP server is not a dialable DNS server and does not support server address, TLS, detour, path, or endpoint fields in its official schema.
- The feature exists since sing-box 1.12.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- DNS category server entries add resolver resources, not traffic outbounds.
- FakeIP is a virtual address allocator. It should not look like a remote resolver.

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

- Left ports: references from DNS final, DNS rules, route resolve actions, and domain resolver fields.
- Right ports: none for normal schema; FakeIP has no outbound detour or endpoint.
- Dragging this node to DNS hub final writes `dns.final`.
- Dragging DNS Rule route action to this node writes `dns.rules[].server`.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose `inet4_range` and `inet6_range` as CIDR inputs with defaults and validation copy.
- Inspector must not show server address, path, detour, TLS, or endpoint controls for this type.
- Inspector should distinguish "DNS Server / FakeIP" from top-level `dns.fakeip` pool settings.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 platform/type-specific guidance is required.
- P0 hide unrelated dial/TLS/detour controls; FakeIP is not a remote DNS server.
- P0 `inet6_range` must export the structure key even though the doc heading currently says `inet6_address`.
- P1 top-level `dns.fakeip` versus `dns.servers[].type=fakeip` needs explicit UI distinction.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
