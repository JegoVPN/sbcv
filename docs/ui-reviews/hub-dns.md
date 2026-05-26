<!-- Status: official-read. Source: stable docs/configuration/dns/index.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Hub UI Review

## Scope

- Editable node: `dns:dns`
- Official doc: `dns/index.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes the singleton top-level `dns` object.

Official writable fields from `dns/index.md`:

- `servers`: list of DNS Server objects. The docs field table has a singular `server` label, but the structure and config key are `servers`.
- `rules`: ordered list of DNS Rule objects.
- `final`: default DNS server tag; sing-box uses the first DNS server if empty.
- `strategy`: default domain strategy; one of `prefer_ipv4`, `prefer_ipv6`, `ipv4_only`, `ipv6_only`.
- `disable_cache`
- `disable_expire`
- `independent_cache`
- `cache_capacity`: added in sing-box 1.11; values below 1024 are ignored.
- `reverse_mapping`
- `client_subnet`: added in sing-box 1.9; can be overridden by DNS server or DNS rule action fields.
- `fakeip`: FakeIP settings object.

Relationship model:

- `servers[]` owns DNS server resources referenced by `dns.final`, DNS rules, route resolve actions, and DNS detour settings elsewhere.
- `rules[]` order is canonical JSON order, not graph edge order.
- `final` references one DNS server tag, not an outbound tag.
- `fakeip` is an embedded DNS module, not an outbound.

## Left: Add Library

Current expected action: `ADD`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- DNS is a singleton top-level object. Repeated Library clicks must create once, then focus/open the existing DNS object.
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

- Left ports: DNS query source visualization and route hijack/resolve relationships.
- Right ports: DNS rules, DNS final server, DNS server resources, and FakeIP module reference.
- Rule edges visualize references only. DNS rule order stays in `dns.rules[]`.
- DNS server ports must not be visually conflated with outbound ports.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- DNS Inspector should prioritize final server selection, global strategy, cache toggles, client subnet, FakeIP setup, and the ordered DNS Rules table entry point.
- `final` must be a select over existing DNS server tags, with missing-tag diagnostics after import.
- `strategy` must be an enum select.
- `cache_capacity` needs helper behavior explaining values under 1024 are ignored.
- `client_subnet` should be an IP/prefix input with validation copy.
- `fakeip` should open an embedded FakeIP settings section, not create an unrelated flow node.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 keep DNS rule order table-owned and distinguish DNS server objects from route outbounds.
- P0 DNS singleton creation must be idempotent; no duplicate DNS nodes or duplicate `dns` objects.
- P0 `final` must reference DNS server tags only.
- P1 cache, strategy, client subnet, and FakeIP need guided controls instead of generic raw fields.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
