<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Inbound / vmess UI Review

## Scope

- Editable node: `inbound:vmess`
- Official doc: `inbound/vmess.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `inbounds[]` with `type: "vmess"`.

Official writable fields from `inbound/vmess.md`:

- `type`: `vmess`
- `tag`
- Listen Fields from `shared/listen.md`.
- `users[]`: required VMess users with `name`, `uuid`, and `alterId`.
- `tls`: inbound TLS object.
- `multiplex`: embedded inbound Multiplex settings.
- `transport`: embedded V2Ray Transport object.

Relationship model:

- Route rules and DNS rules can match this inbound by tag through their `inbound[]` fields.
- Listen Fields `detour` references another inbound tag only when the target inbound is injectable.
- Listen Fields legacy sniff/domain fields are deprecated in 1.11 and removed in 1.13; import/migration-only.
- TLS, Multiplex, and V2Ray Transport are embedded Inspector sections, not standalone nodes.
- `alterId > 0` enables legacy protocol support; the docs warn legacy VMess MD5 auth is compatibility-only.

## Left: Add Library

Current expected action: `SETUP`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Inbounds category entry should add a protocol-specific listening source.

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

- Left ports: none for upstream traffic.
- Right ports: Route Rule matcher and DNS Rule matcher references via `inbound[]`.
- Optional Listen Fields `detour` should be an advanced inbound-reference port or Inspector select.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector must expose tag, listen fields, and required users first.
- `users[]` needs a structured repeater with name, UUID, and alterId.
- Alter ID should warn when enabling legacy protocol.
- TLS must be the inbound TLS shared section.
- Multiplex and V2Ray Transport must be embedded type-aware sections.
- Deprecated Listen Fields must be hidden unless imported, with migration copy pointing to route actions.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 `users[]` is required and needs structured UUID validation.
- P0 TLS must be inbound TLS, not outbound TLS.
- P0 transport type must drive nested transport fields; no raw JSON-only normal path.
- P1 legacy alterId needs visible compatibility warning.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
