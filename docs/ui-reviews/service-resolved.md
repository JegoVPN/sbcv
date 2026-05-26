<!-- Status: official-read. Source: stable docs/configuration/service/resolved.md and shared/listen.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Service / resolved UI Review

## Scope

- Editable node: `service:resolved`
- Official doc: `service/resolved.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in top-level `services[]` with `type: "resolved"`.

Official writable fields from `service/resolved.md`:

- `type`: `resolved`
- Listen Fields from `shared/listen.md`.
- `listen`: required listen address; `127.0.0.53` is used by default.
- `listen_port`: required listen port; `53` is used by default.

Relationship model:

- Resolved DNS servers reference this service through `dns.servers[].service`.
- This service is a fake systemd-resolved DBUS service used to receive DNS settings from other programs and provide DNS resolution.
- It is a runtime service resource, not a route target or DNS server by itself.
- The feature exists since sing-box 1.12.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Services category entries add runtime service resources, not route targets.
- This entry should create/focus a Resolved Service setup, usually paired with a DNS Server / Resolved node.

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

- Left ports: incoming references from Resolved DNS servers.
- Right ports: none for normal schema.
- Dragging a Resolved DNS Server to this node writes `dns.servers[].service`.
- Do not expose outbound, DNS final, or route target ports.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector should expose only Listen Fields relevant to the service, with defaults for `127.0.0.53:53`.
- Product copy should explain this is the service backing DNS Server / Resolved, not a standalone resolver choice.
- No TLS/HTTP2/Dial controls should appear for this service type unless future official docs add them.
- If no DNS Server / Resolved references this service, Inspector should offer a clear "Add Resolved DNS server" action in docs/spec terms; implementation can come later.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 mark Linux/systemd-only clearly; official check may fail on non-Linux.
- P0 Resolved Service must expose only Listen Fields from the official doc; no generic service TLS/HTTP2 sections.
- P0 Resolved DNS Server `service` references need one-click attach/detach to this service.
- P1 default `127.0.0.53:53` should be shown as defaults instead of empty confusing inputs.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
