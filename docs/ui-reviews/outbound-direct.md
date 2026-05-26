<!-- Status: ui-verified (2026-05-27). Shared atomics (listenSharedFields + tlsSharedFields + dialSharedFields + JsonField fallback + structured users editor + TLS-required scaffold + sensitive masking + diagnostics) landed; see docs/claude/index-ui-reviews.md Cross-Node Findings #1–#9. Node-specific P0/P1 still tracked here. -->
# Outbound / direct UI Review

## Scope

- Editable node: `outbound:direct`
- Official doc: `outbound/direct.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in `outbounds[]` with `type: "direct"`.

Official writable fields from `outbound/direct.md`:

- `type`: `direct`
- `tag`
- Dial Fields from `shared/dial.md`.
- `override_address`: deprecated in 1.11 and removed in 1.13; migration-only.
- `override_port`: deprecated in 1.11 and removed in 1.13; migration-only.

Relationship model:

- This outbound can be referenced by `route.final`, route rule `action: "route"`, selector/urltest groups, DNS server/rule detours where supported, service/rule-set Dial Fields detours, and other outbound Dial Fields detours.
- Dial Fields `detour` references another outbound tag; if set, other Dial Fields are ignored by sing-box.
- `override_address` and `override_port` should be represented through route-options actions for new configs, not direct outbound fields.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Outbounds category entry should add a target or group candidate.

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

- Left ports: route final, route rule outbound, selector candidate, URLTest candidate, DNS detour where applicable, Dial detour target, service detour target, and rule-set download detour.
- Right ports: optional Dial Fields `detour` outbound.
- No server/TLS/transport ports exist for direct; those fields are not in the official direct schema.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Inspector should keep direct simple: tag, optional Dial Fields, and migration-only deprecated override fields when imported.
- New stable authoring should not show `override_address` / `override_port` in the normal path.
- Dial Fields should be collapsed/advanced except `detour`, because direct is commonly used as a simple route target.
- Type switching away from direct must preserve inbound references to this tag or explicitly update/delete them through domain commands.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P1 common server/dial/TLS fields should be first-class controls.
- P0 deprecated destination override fields must be import/migration-only for stable 1.13+.
- P0 Dial `detour` must use an outbound select/port attachment, not raw tag text.
- P1 direct should have a minimal Inspector, not a generic proxy server form.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
