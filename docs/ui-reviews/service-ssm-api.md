<!-- Status: official-read. Source: stable docs/configuration/service/ssm-api.md, inbound/shadowsocks.md, shared/listen.md, and shared/tls.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Service / ssm-api UI Review

## Scope

- Editable node: `service:ssm-api`
- Official doc: `service/ssm-api.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in top-level `services[]` with `type: "ssm-api"`.

Official writable fields from `service/ssm-api.md`:

- `type`: `ssm-api`
- Listen Fields from `shared/listen.md`.
- `servers`: required mapping object from HTTP endpoints to Shadowsocks inbound tags.
- `cache_path`
- `tls`: inbound TLS object from `shared/tls.md`.

Related Shadowsocks inbound requirement from `inbound/shadowsocks.md`:

- Referenced Shadowsocks inbounds must have `managed: true`.

Relationship model:

- `servers` values reference `inbound:shadowsocks` tags only.
- The mapping key is an HTTP endpoint path such as `/`.
- This service manages Shadowsocks servers; it is not itself an inbound, outbound, or route target.
- TLS is embedded inbound TLS, not a standalone node.
- The feature exists since sing-box 1.12.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Services category entries add runtime service resources, not route targets.
- This entry should guide users to create/select managed Shadowsocks inbounds rather than ask them to type tags manually.

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

- Left ports: incoming references from managed Shadowsocks inbounds.
- Right ports: none for normal traffic flow.
- A visual attach action should write `services[].servers[path] = inboundTag` and ensure/check `inbounds[].managed = true` for the referenced Shadowsocks inbound.
- Do not expose route/outbound/DNS ports for SSM API.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must start with Listen Fields and TLS status for the REST API endpoint.
- `servers` must be a structured mapping editor:
  - endpoint path input.
  - Shadowsocks inbound select.
  - managed-mode status and one-click enable/focus for the inbound.
- Inspector must not accept arbitrary inbound types for `servers` values.
- `cache_path` should be a simple path input with explanation that traffic/user state is restored on next startup.
- TLS is an embedded inbound TLS section.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 servers mapping must be a guided Shadowsocks managed-inbound selector.
- P0 `servers` is required and must reference only Shadowsocks inbounds.
- P0 referenced Shadowsocks inbounds must be visibly `managed: true`; missing managed mode is a validation error or guided fix.
- P0 SSM API must not expose generic route/outbound ports.
- P1 endpoint path -> inbound mapping needs a structured repeater, not raw JSON.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
