<!-- Status: ui-verified + partially implemented (2026-05-27). P0 route.final select (constrained to outbound tags) and top-level toggles (auto_detect_interface, override_android_vpn) now editable from Inspector. Outstanding: P0 platform-scoped fields (default_interface, default_mark, find_process, default_interface_address, default_network_strategy/type conflict guard), P1 testing-1.14 fields channel gate, P1 default_domain_resolver object-form support. -->
# Route Hub UI Review

## Scope

- Editable node: `route:route`
- Official doc: `route/index.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes the singleton top-level `route` object.

Official writable fields from `route/index.md`:

- `rules`: ordered list of Route Rule objects.
- `rule_set`: list of rule-set resource objects, added in sing-box 1.8.
- `final`: default outbound tag; sing-box uses the first outbound if empty.
- `auto_detect_interface`: platform-scoped default NIC detection.
- `override_android_vpn`: Android-only upstream VPN handling.
- `default_interface`: platform-scoped default NIC binding; ineffective with `auto_detect_interface`.
- `default_mark`: Linux-only routing mark.
- `default_domain_resolver`: added in sing-box 1.12; uses Dial Fields `domain_resolver` shape and can be overridden by outbound dial fields.
- `default_network_strategy`: added in sing-box 1.11; conflicts with `default_interface`.
- `default_network_type`: added in sing-box 1.11.
- `default_fallback_network_type`: added in sing-box 1.11.
- `default_fallback_delay`: added in sing-box 1.11.

Removed or migration-only fields:

- `geoip` and `geosite` are removed in 1.12 and must not be offered as normal new stable fields.

Relationship model:

- `rules[]` order is canonical JSON order, not graph edge order.
- `rule_set[]` owns rule-set resources referenced by route rules.
- `final` is a tag reference to one outbound.
- `default_domain_resolver` can reference DNS server/domain resolver configuration through Dial Fields semantics.
- Platform-scoped fields must show platform applicability before Check.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Route is a singleton top-level object. Repeated Library clicks must create once, then focus/open the existing route object.
- `ADD` is potentially misleading for a singleton. `SETUP` or `OPEN` is clearer after the object exists.

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

- Left ports: inbound traffic visualization only, derived from inbounds and route rule matchers.
- Right ports: route rules, route final outbound, and rule-set references.
- Rule edges visualize references only. Route rule order stays in `route.rules[]`.
- The final outbound port writes `route.final`; it must not create an implicit rule.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Route Inspector should prioritize `final` outbound selection and the ordered Route Rules table entry point.
- `rules[]` editing belongs in a table or rule-focused editor with explicit up/down/reorder controls.
- `rule_set[]` should link to rule-set resources rather than pretending to be a chain edge.
- Interface/default network fields need platform and conflict labels:
  - `auto_detect_interface` versus `default_interface`.
  - `default_network_strategy` versus `default_interface`.
  - `default_mark` Linux-only.
  - `override_android_vpn` Android-only.
- `default_domain_resolver` should not be a raw JSON textarea in the normal path; it should be an embedded Dial Fields editor or a guided advanced section.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 keep rule order table-owned and remove any UI that implies edge order is authoritative.
- P0 route singleton creation must be idempotent; no duplicate route nodes or duplicate `route` objects.
- P0 `final` must be a select over existing outbound tags, with missing-tag diagnostics after import.
- P1 platform/conflict fields need guided toggles/selects instead of unexplained raw inputs.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
