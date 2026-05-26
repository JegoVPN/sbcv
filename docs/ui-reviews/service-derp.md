<!-- Status: ui-verified (2026-05-27). Shared atomics (dial/listen/TLS shared fields + structured editors + diagnostics + platform/channel banners) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific outstanding P0/P1 still tracked here. -->
# Service / derp UI Review

## Scope

- Editable node: `service:derp`
- Official doc: `service/derp.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in top-level `services[]` with `type: "derp"`.

Official writable fields from `service/derp.md`:

- `type`: `derp`
- Listen Fields: embedded fields from `shared/listen.md`, including required `listen` and `listen_port` for actual serving.
- `tls`: inbound TLS object from `shared/tls.md`.
- `config_path`: required DERP server configuration file path.
- `verify_client_endpoint`: list of Tailscale endpoint tags to verify clients.
- `verify_client_url`: list of URL objects or strings; URL object supports Dial Fields.
- `home`: empty/default homepage, `blank`, or redirect URL.
- `mesh_with`: list of DERP mesh peer objects; each requires `server` and `server_port`, can include `host`, outbound TLS, and Dial Fields.
- `mesh_psk`
- `mesh_psk_file`
- `stun`: object or numeric shorthand; object includes required `enabled`, `listen`, `listen_port`, and other Listen Fields.

Relationship model:

- `verify_client_endpoint[]` references `endpoint:tailscale` tags.
- `verify_client_url[]` and `mesh_with[]` embed Dial Fields, including optional outbound `detour` references.
- `tls` is an embedded inbound TLS shared section, not a standalone node.
- `stun` embeds Listen Fields, not a standalone service node.
- DERP is a runtime service resource, not an outbound route target.
- The feature exists since sing-box 1.12.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Services category entries add runtime service resources, not route targets.
- The Library action should create/focus a DERP service setup, not imply it can be connected as a traffic outbound.

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

- Left ports: none for normal traffic flow. DERP is not a route target.
- Right/reference ports: `verify_client_endpoint[]` to Tailscale Endpoint and optional Dial Fields detour references inside `verify_client_url[]` / `mesh_with[]`.
- The primary visible reference should be DERP -> Tailscale Endpoint verification.
- Embedded mesh/dial detours should be exposed in Inspector first; canvas ports are optional advanced affordances because they live inside repeated nested objects.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must start with required serving fields: listen address, listen port, TLS status, and `config_path`.
- TLS requirement/health must be visible before Check, because DERP serving without correct TLS is not a useful normal deployment path.
- `verify_client_endpoint[]` should be a multiselect over `endpoint:tailscale` tags with an inline create/focus shortcut.
- `verify_client_url[]` needs a structured repeater for URL plus embedded Dial Fields, not a raw JSON textarea in the normal path.
- `mesh_with[]` needs a structured repeater for `server`, `server_port`, `host`, outbound TLS, and embedded Dial Fields.
- `stun` should be a guided toggle/port form that can represent numeric shorthand but exports canonical object form unless preserving imported JSON.
- Shared fields used here are embedded sections:
  - Listen Fields for DERP service and STUN.
  - Inbound TLS for `tls`.
  - Outbound TLS and Dial Fields for mesh peers.
  - Dial Fields for verification URLs.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 TLS requirement and Tailscale endpoint verification must be visible before Check.
- P0 `config_path` is required and needs first-class validation.
- P0 `verify_client_endpoint[]` must be a multiselect/port attachment to `endpoint:tailscale`.
- P0 DERP must not expose normal route/outbound target ports.
- P1 nested `verify_client_url[]`, `mesh_with[]`, and `stun` need structured repeaters instead of raw JSON for ordinary users.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
