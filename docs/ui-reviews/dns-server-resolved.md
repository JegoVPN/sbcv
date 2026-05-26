<!-- Status: official-read. Source: stable docs/configuration/dns/server/resolved.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / resolved UI Review

## Scope

- Editable node: `dns-server:resolved`
- Official doc: `dns/server/resolved.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "resolved"`.

Official writable fields from `dns/server/resolved.md`:

- `type`: `resolved`
- `tag`
- `service`: required tag of a Resolved Service.
- `accept_default_resolvers`: whether default DNS resolvers are accepted for fallback queries.

Relationship model:

- `service` is a required tag reference to one `service:resolved` object.
- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can also reference DNS servers by tag.
- This DNS server has no outbound detour/TLS/server-address fields in the official Resolved server doc; it is service-backed.
- The feature exists since sing-box 1.12.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- DNS category server entries add resolver resources, not traffic outbounds.
- This entry should make clear that a Resolved Service must exist first or be created inline.

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
- Right ports: required Resolved Service reference only.
- Do not show detour outbound or TLS ports for this DNS server type; the official Resolved DNS server schema does not include them.
- Dragging this node to DNS hub final writes `dns.final`.
- Dragging DNS Rule route action to this node writes `dns.rules[].server`.
- Dragging from this node to Resolved Service writes `dns.servers[].service`.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must require `service` as a select over existing `service:resolved` tags, with an inline create/focus shortcut.
- Inspector must expose `accept_default_resolvers` as a toggle with split-DNS versus global-DNS behavior copy.
- Inspector must not show server address, path, detour, or TLS controls for this type.
- Product copy should explain this pairs with the fake systemd-resolved DBUS service and may not be meaningful outside that deployment model.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 platform/type-specific guidance is required.
- P0 `service` is required and must be a real tag reference to `service:resolved`.
- P0 hide unrelated DNS-server shared fields; Resolved DNS is service-backed, not dialable by server address.
- P0 one-click attach/detach with Resolved Service must update canonical JSON, not canvas-only edge state.
- P1 split-DNS fallback behavior needs product copy on `accept_default_resolvers`.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
