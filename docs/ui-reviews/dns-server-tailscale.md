<!-- Status: official-read. Source: stable docs/configuration/dns/server/tailscale.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Server / tailscale UI Review

## Scope

- Editable node: `dns-server:tailscale`
- Official doc: `dns/server/tailscale.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `dns.servers[]` with `type: "tailscale"`.

Official writable fields from `dns/server/tailscale.md`:

- `type`: `tailscale`
- `tag`
- `endpoint`: required tag of a Tailscale Endpoint.
- `accept_default_resolvers`: whether default DNS resolvers are accepted for fallback queries; if disabled, non-Tailscale domain queries return `NXDOMAIN`.

Relationship model:

- `endpoint` is a required tag reference to one `endpoint:tailscale` object.
- The server can be referenced by `dns.final`.
- DNS rules can route to it through `action: "route"` with `server`.
- Route resolve actions and Dial Fields `domain_resolver` can also reference DNS servers by tag.
- This DNS server has no outbound detour/TLS/server-address fields in the official Tailscale server doc; it is endpoint-backed MagicDNS.
- The feature exists since sing-box 1.12.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- DNS category server entries add resolver resources, not traffic outbounds.
- This entry should not look like HTTPS/TCP/UDP DNS servers. Its required first step is selecting or creating a Tailscale endpoint.

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
- Right ports: required Tailscale endpoint reference only.
- Do not show detour outbound or TLS ports for this DNS server type; the official Tailscale DNS server schema does not include them.
- Dragging this node to DNS hub final writes `dns.final`.
- Dragging DNS Rule route action to this node writes `dns.rules[].server`.
- Dragging from this node to Tailscale Endpoint writes `dns.servers[].endpoint`.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must require `endpoint` as a select over existing `endpoint:tailscale` tags, with an inline create/focus shortcut.
- Inspector must expose `accept_default_resolvers` as a toggle with clear MagicDNS-only versus global DNS behavior.
- Inspector must not show server address, path, detour, or TLS controls for this type.
- If no Tailscale endpoint exists, the normal user path should create/focus the endpoint rather than ask for a raw tag string.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 platform/type-specific guidance is required.
- P0 `endpoint` is required and must be a real tag reference to `endpoint:tailscale`.
- P0 hide unrelated DNS-server shared fields; Tailscale DNS is endpoint-backed, not dialable by server address.
- P0 one-click attach/detach with Tailscale Endpoint must update canonical JSON, not canvas-only edge state.
- P1 MagicDNS fallback behavior needs product copy on `accept_default_resolvers`.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
