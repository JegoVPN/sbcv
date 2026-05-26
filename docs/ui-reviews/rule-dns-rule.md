<!-- Status: official-read. Source: stable docs/configuration/dns/rule.md and dns/rule_action.md plus current Palette, SbcNode, and Inspector registries. UI verification and implementation fixes still required. -->
# DNS Rule UI Review

## Scope

- Editable node: `dns-rule:dns-rule`
- Official doc: `dns/rule.md`
- Source-of-truth rule: canonical sing-box JSON/domain state, not React Flow nodes or edges.
- Review shape follows `docs/experimental-ui-review.md`: Left Add Library, Middle Canvas Node, Right Inspector.

## Official Model

This node writes one object in the ordered `dns.rules[]` list.

Official rule shapes from `dns/rule.md`:

- Default rule: matcher fields plus address filter fields, `invert`, `action`, and action-specific fields.
- Logical rule: `type: "logical"`, `mode` (`and` or `or`), nested `rules[]`, and action fields.

Official matcher fields:

- Source/context: `inbound`, `ip_version`, `query_type`, `network`, `auth_user`, `protocol`.
- Domain: `domain`, `domain_suffix`, `domain_keyword`, `domain_regex`.
- Source address: `source_ip_cidr`, `source_ip_is_private`.
- Ports: `source_port`, `source_port_range`, `port`, `port_range`.
- Process/package/user: `process_name`, `process_path`, `process_path_regex`, `package_name`, `user`, `user_id`.
- Client/platform state: `clash_mode`, `network_type`, `network_is_expensive`, `network_is_constrained`, `interface_address`, `network_interface_address`, `default_interface_address`, `wifi_ssid`, `wifi_bssid`.
- Rule-set reference: `rule_set`, `rule_set_ip_cidr_match_source`.
- Boolean modifier: `invert`.

Official address filter fields:

- `ip_cidr`
- `ip_is_private`
- `rule_set_ip_cidr_accept_empty`
- `ip_accept_any`: added in sing-box 1.12.

Deprecated or removed fields:

- DNS rule `outbound` is deprecated in 1.12 and removed in 1.14; it should be import/migration-only.
- Legacy `server`, `disable_cache`, `rewrite_ttl`, and `client_subnet` rule fields moved into DNS Rule Actions in 1.11.
- `geosite`, `source_geoip`, and `geoip` are migration-only/removed in stable 1.12+ normal authoring.
- `rule_set_ipcidr_match_source` is the old spelling and must be import/migration-only.

Official action fields from `dns/rule_action.md`:

- `route`: required `server` tag, optional `strategy`, `disable_cache`, `rewrite_ttl`, `client_subnet`.
- `route-options`: `disable_cache`, `rewrite_ttl`, `client_subnet`.
- `reject`: `method`, `no_drop`.
- `predefined`: since 1.12; `rcode`, `answer[]`, `ns[]`, `extra[]`.

Relationship model:

- Rule order is canonical `dns.rules[]` order.
- `inbound[]` references inbound tags.
- `rule_set[]` references rule-set tags.
- `action: "route"` references one DNS server tag through `server`.
- DNS rules do not route to outbounds in new 1.12+ authoring.

## Left: Add Library

Current expected action: `TABLE`.

Review:

- The Library entry must say what happens: add a node, open a settings module, or edit an ordered table.
- The Docs link must open the matching official configuration doc, not act as a disabled status badge.
- If this item is target-gated, the disabled/gated state must name the target instead of silently doing nothing.

Node-specific concern:

- DNS category table entry; add through ordered table, not free canvas placement.
- A DNS rule node on the canvas is a visual reference card for an ordered list item, not a source of ordering.

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

- Left ports: DNS hub/order reference and inbound matcher references.
- Right ports: DNS server target and rule-set references.
- `reject`, `route-options`, and `predefined` actions must not show a required server-target port.
- No normal outbound-target port should be shown for stable 1.12+ DNS rule authoring.

Recommendation:

- Keep ports type-specific and visually explainable. Hover/click/drag should add or remove a canonical tag reference, never create hidden canvas-only state.

## Right: Inspector

Review:

- DNS Rule Inspector should start with rule order/name, action type, query/domain match fields, and DNS server target when action is `route`.
- Match groups need structured repeaters/selects, not one giant raw textarea:
  - Query type and network.
  - Domain conditions.
  - Source/IP address filters.
  - Port conditions.
  - Inbound/auth/protocol conditions.
  - Process/platform conditions.
  - Rule-set conditions.
- Action UI must be action-type aware:
  - `route`: DNS server select is required.
  - `route-options`: cache/TTL/subnet overrides only.
  - `reject`: method/no_drop only.
  - `predefined`: response code and DNS record repeaters.
- Deprecated/removed fields should be shown only when imported from existing JSON, with migration copy and no default new authoring.
- Type switching, if available, must preserve tag references or deliberately clear incompatible fields with diagnostics.
- Shared fields should appear only where official docs say the owner supports them.
- Ordered list fields such as route rules and DNS rules must stay table-owned.

Recommendation:

- Prefer selects/multiselects for tag references and enums. Text inputs are acceptable for scalar protocol values, but raw JSON textareas should be reserved for advanced array/object fields until structured repeaters exist.

## Priority Findings

- P0 centralize creation/reorder/delete in dns.rules table; node is a reference card.
- P0 DNS rule Inspector must be action-aware; requiring `server` for every action is wrong.
- P0 DNS rule target references must point to DNS servers, not outbounds, for normal 1.12+ authoring.
- P0 deprecated outbound/legacy server fields must be import/migration-only.
- P1 predefined DNS records need structured repeaters before broad external fixtures are user-editable.

## Done Criteria

- Adding/opening this node from Library updates canonical JSON.
- Canvas ports represent only real sing-box references.
- Inspector edits round-trip to JSON export.
- Semantic diagnostics catch missing tags and target/version hazards.
- Fixture or smoke coverage proves the node can be imported, rendered, edited, and exported.
