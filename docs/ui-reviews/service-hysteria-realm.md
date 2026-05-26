<!-- Status: official-read. Source: testing docs/configuration/service/hysteria-realm.md plus shared/listen.md, shared/tls.md, and shared/http2.md references. UI verification and implementation fixes still required. -->
# Service / hysteria-realm UI Review

## Scope

- Editable node: `service:hysteria-realm`
- Official doc: `service/hysteria-realm.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in top-level `services[]` with `type: "hysteria-realm"`.

Official writable fields from testing `service/hysteria-realm.md`:

- `type`: `hysteria-realm`
- Listen Fields from `shared/listen.md`.
- `tls`: inbound TLS object from `shared/tls.md`.
- HTTP2 Fields from `shared/http2.md`.
- `users`: required list of authorized users.
- `users[].name`: required.
- `users[].token`: required bearer token used by Hysteria2 inbounds/outbounds.
- `users[].max_realms`

Official behavior:

- Hysteria Realm is a rendezvous service for Hysteria2 NAT traversal.
- It carries control-plane signaling only; successful hole-punching sends proxy traffic directly between client and server.
- If TLS is configured, it serves HTTP/2 over TLS; otherwise plain HTTP/1.1.

Relationship model:

- This is a runtime service resource, not an outbound route target.
- Hysteria2 inbounds/outbounds use the user bearer token operationally, but the service doc does not define a direct tag reference from those nodes to the realm service.
- TLS and HTTP2 are embedded shared fields, not standalone nodes.
- The feature exists since sing-box 1.14 testing only; it is unavailable for `1.13 stable` and `1.12 Legacy`.

## Left: Add Library

Current expected action: `SETUP gated`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Services category entries add runtime service resources, not route targets.
- Stable targets must not add or export this service silently.

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

- Left ports: none for normal tag references in the official service schema.
- Right ports: none for normal tag references in the official service schema.
- Do not invent ports to Hysteria2 inbounds/outbounds unless an official tag reference exists in their docs.
- The node may visually annotate Hysteria2 NAT traversal context, but any actual config write must be through the service fields.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must be target-gated to `1.14 testing`.
- Inspector should start with Listen Fields, TLS status, HTTP2 settings, and users.
- `users[]` needs a structured repeater with `name`, sensitive `token`, and `max_realms`.
- `token` should be treated as sensitive input and not echoed into screenshots/log copy.
- TLS and HTTP2 must be embedded shared sections only.
- Stable/Legacy target UI should show documentation or disabled state, not produce unsupported JSON.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 target-gated to 1.14 testing; stable UI must not add/export it silently.
- P0 `users[]` is required and must be structured; no raw JSON-only normal path.
- P0 no generic route/outbound/DNS ports should appear because the service schema has no tag references.
- P1 Hysteria Realm needs explanatory placement as control-plane service, not data-plane proxy flow.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
