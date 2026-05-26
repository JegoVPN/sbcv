<!-- Status: official-read. Source: stable docs/configuration/endpoint/tailscale.md and shared/dial.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Endpoint / tailscale UI Review

## Scope

- Editable node: `endpoint:tailscale`
- Official doc: `endpoint/tailscale.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in top-level `endpoints[]` with `type: "tailscale"`.

Official writable fields from `endpoint/tailscale.md`:

- `type`: `tailscale`
- `tag`
- `state_directory`: defaults to `tailscale`.
- `auth_key`: optional; if omitted, sing-box logs or shows a login URL.
- `control_url`: defaults to `https://controlplane.tailscale.com`.
- `ephemeral`
- `hostname`
- `accept_routes`
- `exit_node`
- `exit_node_allow_lan_access`
- `advertise_routes`
- `advertise_exit_node`
- `advertise_tags`: since 1.13.
- `relay_server_port`: since 1.13.
- `relay_server_static_endpoints`: since 1.13.
- `system_interface`: since 1.13.
- `system_interface_name`: since 1.13.
- `system_interface_mtu`: since 1.13.
- `udp_timeout`: defaults to `5m`.
- Dial Fields: only control how the endpoint connects to the control plane; they do not control user traffic through the endpoint.

Relationship model:

- This endpoint is a real resource node. It can be referenced by Tailscale DNS servers through `dns.servers[].endpoint`.
- DERP services can reference this endpoint through `services[].verify_client_endpoint[]`.
- Route rules can use `preferred_by: ["tailscale"]`, but that is not a tag reference to this endpoint.
- Dial Fields are embedded Inspector sections, not standalone Shared nodes.
- 1.13-only fields must be target-gated for `1.13 stable` and `1.14 testing`; they are unavailable in `1.12 Legacy`.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Endpoint entries add tunnel/interface resources, not route rules.
- The entry should make it clear that this creates a reusable endpoint resource before DNS/DERP can reference it.
- Because Tailscale requires authentication unless state already exists, `SETUP` is acceptable if it opens a guided endpoint wizard; otherwise `ADD` plus Inspector focus is clearer.

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

- Left ports: incoming references from Tailscale DNS servers and DERP `verify_client_endpoint[]`.
- Right ports: optional Dial Fields `detour` outbound for control-plane connectivity only.
- Do not show the same generic outbound ports on both sides; the left side is "who uses this endpoint", the right side is "how this endpoint dials the control plane".
- Dragging from a Tailscale DNS server to this node writes `dns.servers[].endpoint`.
- Dragging from DERP service verification to this node writes `services[].verify_client_endpoint[]`.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose Tailscale identity/setup fields first: tag, state directory, auth key/login behavior, control URL, ephemeral, hostname.
- Routing/advertising fields need grouped controls: accept routes, exit node, advertised routes, advertise exit node, advertise tags.
- 1.13 fields must show target gates: relay server, system interface, advertise tags.
- Dial Fields must be labeled as control-plane connectivity only; users must not think this configures traffic forwarding.
- Inspector must show reference summary for DNS servers and DERP services using this endpoint.
- `auth_key` should be treated as sensitive input and never echoed into screenshots/log copy.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 DERP/DNS endpoint references need one-click attach/detach plus clear platform guidance.
- P0 Tailscale DNS server `endpoint` must be a required tag select/port attachment to this node.
- P0 DERP `verify_client_endpoint[]` must be a multiselect/port attachment to this node.
- P0 1.13-only endpoint fields need target gating; 1.12 Legacy cannot silently export them.
- P1 Dial Fields need a warning that they only affect control-plane connections.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
