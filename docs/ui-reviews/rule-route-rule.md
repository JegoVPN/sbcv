<!-- Status: official-read. Source: stable docs/configuration/route/rule.md and route/rule_action.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# Route Rule UI Review

## Scope

- Editable node: `route-rule:route-rule`
- Official doc: `route/rule.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in the ordered `route.rules[]` list.

Official rule shapes from `route/rule.md`:

- Default rule: matcher fields plus `invert`, `action`, and action-specific fields.
- Logical rule: `type: "logical"`, required `mode` (`and` or `or`), required nested `rules[]`, optional `invert`, and action fields.

Official matcher fields:

- Source/context: `inbound`, `ip_version`, `network`, `auth_user`, `protocol`, `client`.
- Domain: `domain`, `domain_suffix`, `domain_keyword`, `domain_regex`.
- Source address: `source_ip_cidr`, `source_ip_is_private`.
- Destination address: `ip_cidr`, `ip_is_private`.
- Ports: `source_port`, `source_port_range`, `port`, `port_range`.
- Process/package/user: `process_name`, `process_path`, `process_path_regex`, `package_name`, `user`, `user_id`.
- Client/platform state: `clash_mode`, `network_type`, `network_is_expensive`, `network_is_constrained`, `interface_address`, `network_interface_address`, `default_interface_address`, `wifi_ssid`, `wifi_bssid`, `preferred_by`.
- Rule-set reference: `rule_set`, `rule_set_ip_cidr_match_source`.
- Boolean modifier: `invert`.

Deprecated or removed matcher fields:

- `geosite`, `source_geoip`, and `geoip` are migration-only and removed from stable 1.12+ normal authoring.
- `rule_set_ipcidr_match_source` is the old spelling and must be import/migration-only.

Official action fields from `route/rule_action.md`:

- Final `route`: required `outbound` tag plus optional route-options fields.
- Final `bypass`: since 1.13, Linux auto-redirect scoped; optional `outbound`.
- Final `reject`: `method`, `no_drop`; ICMP handling expanded in 1.13.
- Final `hijack-dns`: no outbound target.
- Non-final `route-options`: `override_address`, `override_port`, `network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay`, `udp_disable_domain_unmapping`, `udp_connect`, `udp_timeout`, `tls_fragment`, `tls_fragment_fallback_delay`, `tls_record_fragment`.
- Non-final `sniff`: `sniffer`, `timeout`.
- Non-final `resolve`: `server`, `strategy`, `disable_cache`, `rewrite_ttl`, `client_subnet`.

Relationship model:

- Rule order is canonical `route.rules[]` order.
- `inbound[]` references inbound tags.
- `rule_set[]` references route rule-set tags.
- `action: "route"` references one outbound tag through `outbound`.
- `action: "bypass"` may reference one outbound tag, but it is optional.
- `action: "resolve"` may reference one DNS server tag through `server`.
- `preferred_by[]` is not a tag reference; it is an enum-like list (`tailscale`, `wireguard`) from the official docs.

## Left: Add Library

Current expected action: `TABLE`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- Route category table entry; add through ordered table, not free canvas placement.
- A route rule node on the canvas is a visual reference card for an ordered list item, not a source of ordering.

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

- Left ports: route hub/order reference and inbound matcher references.
- Right ports: action outbound target, resolve DNS server target, and rule-set references.
- The visible port set must change with `action`; `reject` and `hijack-dns` must not show an outbound-required port.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- Rule Inspector should start with rule order/name, action type, and the most common match groups.
- Match groups need structured repeaters/selects, not one giant raw textarea:
  - Domain conditions.
  - IP/CIDR conditions.
  - Port conditions.
  - Inbound/auth/protocol conditions.
  - Process/platform conditions.
  - Rule-set conditions.
- Action UI must be action-type aware:
  - `route`: outbound select is required.
  - `bypass`: outbound select is optional and target-gated to 1.13/Linux auto-redirect context.
  - `reject`: method/no_drop only.
  - `hijack-dns`: no target fields.
  - `route-options`, `sniff`, and `resolve`: non-final action fields should be visually separated from final routing decisions.
- Deprecated/removed fields should be shown only when imported from existing JSON, with migration copy and no default new authoring.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 centralize creation/reorder/delete in route.rules table; node is a reference card.
- P0 route rule Inspector must be action-aware; requiring outbound for every action is wrong.
- P0 deprecated `outbound`/geo fields must not be used as the normal stable authoring path.
- P0 canvas ports must reflect real references for the selected action and must update canonical JSON.
- P1 complex match fields need grouped structured editors before broad external fixtures are user-editable.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
