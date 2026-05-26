<!-- Status: official-read. Source: stable docs/configuration/inbound/vless.md, shared/listen.md, shared/tls.md, shared/multiplex.md, and shared/v2ray-transport.md; reviewed against current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Inbound / vless UI Review

## Scope

- Editable node: `inbound:vless`
- Official doc: `inbound/vless.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "vless"`.

Official writable fields from `inbound/vless.md`:

- `type`: `vless`
- `tag`
- Listen Fields from `shared/listen.md`.
- `users[]`: required VLESS users.
- `users[].uuid`: required user id.
- `users[].flow`: optional VLESS sub-protocol, currently `xtls-rprx-vision`.
- `tls`: inbound TLS object.
- `multiplex`: embedded inbound Multiplex settings.
- `transport`: embedded V2Ray Transport object.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS, Multiplex, and V2Ray Transport are embedded Inspector sections, not standalone nodes.
- `flow` is a constrained enum and should not be a free-form field.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must add a VLESS inbound object or clearly open a setup draft.
- The Docs action must open `inbound/vless.md`.
- Adding this node should create an incomplete draft and select it for user/UUID setup.

Node-specific concern:

- VLESS is mostly user/TLS/transport driven; the canvas should not imply free chaining is enough to make it valid.

Recommendation:

- Use `ADD` and open Inspector with user UUID and TLS/transport sections visible.

## Middle: Canvas Node

Review:

- The node label should show tag/name first, with `vless` as the protocol chip.
- Status must fail locally when `users[]` is empty or any UUID is invalid.
- The card can summarize user count, TLS enabled state, and transport type.

Port semantics:

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference affordance or Inspector select.

Recommendation:

- Do not expose TLS, Multiplex, or Transport as separate side nodes; use compact card metadata and Inspector sections.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, users, TLS, multiplex, and transport.
- Users need a structured repeater with UUID validation and `flow` select.
- V2Ray Transport must be type-aware; it should not be one generic JSON textarea.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Type switching must preserve tag references or show exactly which protocol fields will be dropped.

Recommendation:

- Prefer user repeaters, enum selects, and collapsible embedded shared sections.

## Priority Findings

- P0 `users[]` with valid UUIDs is required.
- P0 `flow` must be enum controlled.
- P1 TLS, Multiplex, and Transport are embedded shared sections.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags, user UUIDs, and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
