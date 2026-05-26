<!-- Status: ui-verified + partially implemented (2026-05-27). P0 outbound-select-always-renders FIXED: outbound `<select>` only appears for action route/bypass; selecting reject/sniff/resolve/route-options/hijack-dns clears `rule.outbound` automatically. P0 missing action sub-forms partially FIXED: reject (method + no_drop), sniff (sniffer + timeout), resolve (server tag-select + strategy). Outstanding: P0 route-options sub-form (override_address / override_port / network_strategy / network_type / fallback_* / udp_disable_domain_unmapping), P0 canvas outbound port action-gating, P0 deprecated geosite/source_geoip/geoip removal from routeRuleAdvancedFields, P1 resolve.server diagnostic when missing on action=route. -->
# Route Rule UI Review — `rule:route-rule`

## Scope

- Node ID: `route-rule` (Palette kind `route-rule`, status `table`)
- Official docs: `route/rule.md` + `route/rule_action.md` (stable 1.13 and testing 1.14)
- Canonical location in JSON: ordered `route.rules[]` array — first-match semantics
- Rule shape: either **Default** (matcher fields + action) or **Logical** (`type: "logical"`, required `mode`, required nested `rules[]`)

---

## Official Model

### Writable Fields

#### Matcher Fields — Default Rule

| Field | Type | Notes | Platform gate |
|---|---|---|---|
| `inbound` | `string[]` | Inbound tags | — |
| `ip_version` | `4` or `6` | Not limited if empty | — |
| `network` | `string[]` | `tcp`, `udp`, or `icmp` (icmp added 1.13) | — |
| `auth_user` | `string[]` | Username; depends on inbound type | — |
| `protocol` | `string[]` | Sniffed protocol (requires prior sniff action or inbound sniff) | — |
| `client` | `string[]` | Sniffed client type; since 1.10 | — |
| `domain` | `string[]` | Exact domain match | — |
| `domain_suffix` | `string[]` | Suffix match | — |
| `domain_keyword` | `string[]` | Keyword match | — |
| `domain_regex` | `string[]` | Regex match | — |
| `source_ip_cidr` | `string[]` | Source IP/CIDR | — |
| `source_ip_is_private` | `bool` | Non-public source IP; since 1.8 | — |
| `ip_cidr` | `string[]` | Destination IP/CIDR | — |
| `ip_is_private` | `bool` | Non-public destination IP; since 1.8 | — |
| `source_port` | `int[]` | Source port | — |
| `source_port_range` | `string[]` | Source port range (`1000:2000`, `:3000`, `4000:`) | — |
| `port` | `int[]` | Destination port | — |
| `port_range` | `string[]` | Destination port range | — |
| `process_name` | `string[]` | — | Linux, Windows, macOS only |
| `process_path` | `string[]` | — | Linux, Windows, macOS only |
| `process_path_regex` | `string[]` | Since 1.10 | Linux, Windows, macOS only |
| `package_name` | `string[]` | Android package name | Android only |
| `package_name_regex` | `string[]` | Since 1.14 (testing only) | Android only |
| `user` | `string[]` | — | Linux only |
| `user_id` | `int[]` | — | Linux only |
| `clash_mode` | `string` | Clash mode match | — |
| `network_type` | `string[]` | `wifi`, `cellular`, `ethernet`, `other`; since 1.11 | Graphical clients on Android + Apple |
| `network_is_expensive` | `bool` | Since 1.11 | Graphical clients on Android + Apple |
| `network_is_constrained` | `bool` | Since 1.11 | Graphical clients on Apple only |
| `interface_address` | `object` | Map of interface→CIDR[]; since 1.13 | Linux, Windows, macOS only |
| `network_interface_address` | `object` | Map of network_type→CIDR[]; since 1.13 | Graphical clients on Android + Apple |
| `default_interface_address` | `string[]` | Since 1.13 | Linux, Windows, macOS only |
| `wifi_ssid` | `string[]` | — | WiFi state required |
| `wifi_bssid` | `string[]` | — | WiFi state required |
| `preferred_by` | `string[]` | `tailscale` or `wireguard` enum values; since 1.13 | — |
| `source_mac_address` | `string[]` | Since 1.14 (testing only) | Linux, macOS, graphical Android/macOS clients; requires Neighbor Resolution setup |
| `source_hostname` | `string[]` | Since 1.14 (testing only) | Linux, macOS, graphical Android/macOS clients; requires Neighbor Resolution setup |
| `rule_set` | `string[]` | Rule-set tag references; since 1.8 | — |
| `rule_set_ip_cidr_match_source` | `bool` | Makes ip_cidr in rule-sets match source; since 1.10 | — |
| `invert` | `bool` | Invert final match result | — |

**Deprecated / migration-only (must not be used for new authoring):**

| Field | Deprecated since | Removed |
|---|---|---|
| `geosite` | 1.8 | 1.12 |
| `geoip` | 1.8 | 1.12 |
| `source_geoip` | 1.8 | 1.12 |
| `rule_set_ipcidr_match_source` | 1.10 (renamed) | 1.11 |
| `outbound` (top-level) | 1.11 (moved to action) | — |

#### Logical Rule Fields

| Field | Required | Notes |
|---|---|---|
| `type` | yes | Must be `"logical"` |
| `mode` | yes | `"and"` or `"or"` |
| `rules` | yes | Array of nested default or logical rules |
| `invert` | no | Invert the logical result |
| `action` + action fields | yes | Same as default rule |

#### Action Fields

**Final actions** (terminate rule evaluation):

| Action | Required fields | Optional fields |
|---|---|---|
| `route` (default) | `outbound` (outbound tag) | All route-options fields (see below) |
| `bypass` | — | `outbound` (optional); since 1.13, Linux + `auto_redirect` only |
| `reject` | — | `method` (`default`/`drop`/`reply`), `no_drop` |
| `hijack-dns` | — | — |

**Non-final actions** (continue evaluation after applying):

| Action | Fields |
|---|---|
| `route-options` | `override_address`, `override_port`, `network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay`, `udp_disable_domain_unmapping`, `udp_connect`, `udp_timeout`, `tls_fragment`, `tls_fragment_fallback_delay`, `tls_record_fragment` |
| `route-options` (testing 1.14 additions) | `tls_spoof`, `tls_spoof_method` |
| `sniff` | `sniffer` (array, all enabled by default), `timeout` (default 300ms) |
| `resolve` | `server` (DNS server tag), `strategy`, `disable_cache` (1.12+), `rewrite_ttl` (1.12+), `client_subnet` (1.12+) |
| `resolve` (testing 1.14 additions) | `disable_optimistic_cache`, `timeout` |

Route-options fields also appear inline on the `route` and `bypass` actions.

### Cross-Version Diff — Stable vs Testing

| Feature | Stable (1.13) | Testing (1.14) |
|---|---|---|
| Matcher: `source_mac_address` | absent | present |
| Matcher: `source_hostname` | absent | present |
| Matcher: `package_name_regex` | absent | present |
| Action: `tls_spoof` / `tls_spoof_method` on route-options | absent | present |
| Action: `resolve.disable_optimistic_cache` | absent | present |
| Action: `resolve.timeout` | absent | present |

### Relationship Model

| Reference field | Points to | Cardinality |
|---|---|---|
| `inbound[]` | Inbound `tag` values | many |
| `rule_set[]` | Route `rule_set[].tag` values | many |
| `action: "route"` → `outbound` | Outbound `tag` (required) | one |
| `action: "bypass"` → `outbound` | Outbound `tag` (optional) | zero or one |
| `action: "resolve"` → `server` | DNS server `tag` | zero or one |
| `preferred_by[]` | Not a tag reference — enum values: `tailscale`, `wireguard` | — |

**Matching logic within a default rule:**

`(domain_group || geoip/ip_cidr group)` AND `(port_group)` AND `(source_address_group)` AND `(source_port_group)` AND `other individual fields`

Each rule-set branch merges into the outer rule with OR semantics between branches.

### Compat / Target Gate

| Field group | Gate |
|---|---|
| `process_name`, `process_path`, `process_path_regex`, `interface_address`, `default_interface_address` | Linux/Windows/macOS only |
| `package_name`, `package_name_regex` (1.14) | Android only |
| `user`, `user_id` | Linux only |
| `network_type`, `network_is_expensive`, `network_is_constrained`, `network_interface_address` | Graphical clients on Android + Apple only |
| `wifi_ssid`, `wifi_bssid` | Requires Wi-Fi state configuration |
| `source_mac_address`, `source_hostname` (1.14) | Requires Neighbor Resolution setup |
| `bypass` action | Stable 1.13+; Linux with `auto_redirect` for kernel bypass |
| `icmp` value in `network` | Since 1.13; TUN/WireGuard/Tailscale inbounds only |
| `tls_spoof`, `tls_spoof_method` | Testing 1.14+; Linux/macOS/Windows, elevated privileges |

---

## Left: Add Library

**Current state:** `{ label: "Route Rule", kind: "route-rule", status: "table" }` in Palette.tsx line 180. The status is `"table"`, which correctly signals that creation goes through the ordered table, not free canvas placement. The Palette gating at line 267 allows "table" status for `route-rule` and `dns-rule` to produce the TABLE action in the library UI.

**Findings:**

- P1: The Library entry label is just "Route Rule" with no sub-label clarifying it opens the route rules table. A user who has never used the app will not know that clicking this opens a table panel inside the Route node inspector, not a drag-and-drop node.
- P1: The `docsUrl` is set to `docs("route/rule/")` — good. Ensure the Docs link is an accessible external link, not a disabled status badge.
- No issue with the `status: "table"` classification itself. This correctly blocks canvas drag-and-drop creation.

---

## Middle: Canvas Node

**Current ports (from SbcNode.tsx `getPortSpecs`):**

Input (left) ports:
- `route` — "Route order" — links to the route node (always connected per `isPortConnected`)
- `inbound` — "Inbound matcher" — connected when the rule's `inbound[]` is non-empty

Output (right) ports:
- `outbound` — "Outbound" — connected when `rule.outbound` matches an outbound tag
- `rule-set` — "Rule Set" — connected when `rule.rule_set` is non-empty

**Findings:**

- P0: **Port set is action-blind.** The `outbound` output port is always shown regardless of `action`. For `reject`, `hijack-dns`, `sniff`, `route-options`, and `resolve` actions, showing the outbound port is misleading and implies a required connection that is not canonical. The port should be hidden or changed to optional-indicator when action is not `route` or `bypass`.
- P0: **`resolve` action's `server` reference has no port.** When `action: "resolve"`, the `server` field references a DNS server tag, but there is no port for this connection on the canvas node. The DNS server relationship is not visualized at all.
- P1: Canvas node carries no visible action label. When a rule has `action: "sniff"` or `action: "resolve"`, the node looks identical to `action: "route"`, making visual inspection of the canvas impossible.
- P1: The `+` button affordance on rule nodes (if present) must not create a new sibling rule directly from the canvas. New rules must be created from the RouteRulesTable in the Route node inspector. The `+` should either be absent or open the Route node's rules table.
- P1: The canvas node's header shows `Rule {index+1}` as the identifier — this is correct positional indexing. However, reordering rules in the table does not currently trigger canvas node repositioning, so index labels can become stale visually if nodes were moved on canvas.
- P2: The `inbound` input port is always rendered, but most rules do not use `inbound[]` matching. A dimmed/optional style when `rule.inbound` is empty would reduce visual noise.

---

## Right: Inspector

**Current implementation (Inspector.tsx `RouteRuleInspector`):**

**Primary / always-visible fields:**
- Rule Type select (`default` / `logical`)
- For logical: Mode select, Rules JSON textarea (raw)
- For default Match section: Inbound tags (RuleListField text input), Domain suffix, Domain keyword, Domain, Domain regex, Rule Set (all RuleListField text inputs)
- Action section: Action select (all 7 action values), Outbound select (always shown, populates from all outbounds), Invert match toggle
- SharedRuleFields (collapsed details): wifi_ssid, wifi_bssid, source_mac_address, source_hostname
- RuleAdvancedFields (collapsed details, 23 fields): ip_version, network, auth_user, protocol, client, geosite, source_geoip, geoip, source_ip_cidr, source_ip_is_private, ip_cidr, ip_is_private, source_port, source_port_range, port, port_range, process_name, process_path, process_path_regex, package_name, user, user_id, clash_mode, network_type, network_is_expensive, network_is_constrained, preferred_by, rule_set_ip_cidr_match_source
- AdvancedScalarFields (unhandled scalar fields catch-all)

**Findings:**

- P0: **Outbound select is always visible regardless of action.** `reject`, `hijack-dns`, `sniff`, `route-options`, and `resolve` actions do not use `outbound` at all (except `resolve` uses `server` which is a different tag type). Showing the outbound select unconditionally is actively misleading: a user selecting `reject` can still accidentally set an outbound. The outbound select must be conditionally rendered only when `action === "route"` or `action === "bypass"`.
- P0: **Action-specific sub-fields are not rendered.** When `action: "reject"` is selected, `method` and `no_drop` are not shown. When `action: "sniff"`, `sniffer` and `timeout` are not shown. When `action: "resolve"`, `server`, `strategy`, `disable_cache`, `rewrite_ttl`, `client_subnet` are not shown. When `action: "route-options"` or the route-options fields on `route`/`bypass`, none of `override_address`, `override_port`, `network_strategy`, `udp_connect`, `udp_timeout`, `tls_fragment`, `tls_record_fragment` are shown. All action-specific field groups must be conditionally rendered based on the selected action.
- P0: **`resolve.server` is a DNS server tag reference** and must be rendered as a select populated from `config.dns.servers[].tag`, not as a raw text input in the advanced fields catch-all.
- P0: **Deprecated fields `geosite`, `source_geoip`, `geoip` are listed in `routeRuleAdvancedFields`** (Inspector.tsx lines 311–313) and are therefore presented as standard authoring options in the Advanced match fields section. These fields were deprecated in 1.8 and removed in stable 1.12. They must be excluded from the default advanced fields list and shown only when their value is non-empty in an imported config, with a deprecation warning.
- P1: **`inbound` tag input is a free-text field.** The `inbound[]` array references inbound tags; it should be a multiselect or tag-chip repeater populated from `config.inbounds[].tag`. The current text input allows typos and does not round-trip correctly through comma-splitting when tags contain commas.
- P1: **`rule_set` tag input is a free-text field** in the primary Inspector section (RuleListField at line 608). The Advanced match fields also contain `rule_set_ip_cidr_match_source`. The `rule_set[]` field should be a multiselect populated from `config.route.rule_set[].tag`. The current text-with-datalist in RuleTables.tsx is a partial improvement but the Inspector version is raw text.
- P1: **Port, CIDR, and port-range fields** (`port`, `port_range`, `source_port`, `source_port_range`, `ip_cidr`, `source_ip_cidr`) are plain text inputs in the advanced section. These need structured repeater controls because their values are arrays of numbers/strings; the current comma-split approach handles only the simplest cases and will silently corrupt inputs like `1000:2000` that contain colons.
- P1: **Logical rule `rules[]` field is a raw JSON textarea.** Nested logical rules are complex objects; a raw textarea is an authoring footgun. A minimum improvement is schema-validated editing; an ideal improvement is a recursive rule editor.
- P1: **`preferred_by[]` is in the advanced fields list as a RuleListField** (text input). It should be a multiselect with the two valid enum values: `tailscale` and `wireguard`.
- P1: **Action selector shows all 7 actions with no grouping.** The UI should differentiate final actions (`route`, `bypass`, `reject`, `hijack-dns`) from non-final actions (`route-options`, `sniff`, `resolve`) with a visual separator or optgroup, since mixing final and non-final in one rule is only valid for non-final.
- P2: **`interface_address` and `network_interface_address`** are object-type fields (map of string → string[]). They fall into the `AdvancedScalarFields` catch-all which will attempt to render them as scalar text inputs, producing incorrect output. These need JsonField or a structured key→CIDR-list editor.
- P2: Testing-only fields (`package_name_regex`, `source_mac_address` already in SharedRuleFields, `source_hostname` already in SharedRuleFields, and 1.14 resolve fields) are accessible in the UI without version gating. A version badge or tooltip is the minimum; outright hiding them behind a "testing" toggle would prevent confusion.
- P2: **`bypass` action** is gated to Linux + `auto_redirect` enabled. Showing it unconditionally in the select misleads users on other platforms.

---

## Tag Reference Surfaces

| Field | Current control | Recommended control | Referenced entity |
|---|---|---|---|
| `inbound[]` | RuleListField (free text) | Multiselect / tag chips from `config.inbounds[].tag` | Inbound tags |
| `rule_set[]` | RuleListField (free text) / datalist in table | Multiselect from `config.route.rule_set[].tag` | Rule-set tags |
| `action: "route"` → `outbound` | Select from all outbounds | Select, **shown only when action is route or bypass** | Outbound tags |
| `action: "bypass"` → `outbound` | Not differentiated from route | Optional select, shown only when action is bypass | Outbound tags |
| `action: "resolve"` → `server` | Missing (falls to catch-all) | Select from `config.dns.servers[].tag` | DNS server tags |
| `preferred_by[]` | RuleListField (free text) | Multiselect with `tailscale`, `wireguard` enum options | Fixed enum, not a tag |
| `network` | RuleListField (free text) | Multiselect with `tcp`, `udp`, `icmp` options | Fixed enum |
| `network_type` | RuleListField (free text) | Multiselect with `wifi`, `cellular`, `ethernet`, `other` | Fixed enum |
| `protocol` | RuleListField (free text) | Multiselect from protocol sniff values | Fixed enum |
| `client` | RuleListField (free text) | Multiselect from known client values | Fixed enum |
| `clash_mode` | RuleListField (free text in advanced) | Text input (scalar) | External string |

---

## Priority Findings

### P0

1. **Centralize create / reorder / delete in route.rules table.** A canvas `+` on a rule node must not add a sibling rule. All structural changes go through `RouteRulesTable`. The canvas node is a reference card for a specific index in the ordered array, not an authoring surface for the array itself. (This is already architecturally correct — `RouteRulesTable` exists and is used — but the canvas node must not expose any affordance that implies direct array manipulation.)

2. **Outbound select must be action-conditional.** Show the outbound select only for `action === "route"` or `action === "bypass"`. For all other actions, hide it entirely. A displayed outbound value when action is `reject` or `hijack-dns` would serialize stale data into the exported JSON.

3. **Action-specific sub-fields must be rendered.** Inspector renders only `outbound` + `invert` for the action section regardless of selected action. All action groups (`reject` → method/no_drop; `sniff` → sniffer/timeout; `resolve` → server/strategy/disable_cache/rewrite_ttl/client_subnet; `route-options` group; `route`/`bypass` inline route-options) must be conditionally shown.

4. **`resolve.server` must be a DNS server tag select.** It references `config.dns.servers[].tag` and must be validated and autocompleted accordingly.

5. **Deprecated geo fields must be removed from standard advanced fields list.** `geosite`, `source_geoip`, `geoip` in `routeRuleAdvancedFields` must be removed. They should appear only in import/migration context with a deprecation banner.

6. **Canvas outbound port must be hidden when action is not `route` or `bypass`.** The current `getPortSpecs` output port `outbound` is always emitted for `route-rule` nodes regardless of action, causing false edge connections for rules with non-routing actions.

### P1

7. **`inbound[]` must be a tag-aware multiselect.** Free text prevents tag validation and produces silent mismatches.

8. **`rule_set[]` must be a tag-aware multiselect** (both in the table and the Inspector). The table uses a datalist which is a partial improvement; the Inspector uses bare RuleListField text.

9. **Action select must visually separate final from non-final actions** (optgroup or divider).

10. **`preferred_by[]`, `network[]`, `network_type[]`, `protocol[]`, `client[]`** should be enum-constrained multiselects rather than free text, since their valid value sets are documented and finite.

11. **Port/CIDR repeater fields** need structured array inputs, not comma-split text inputs, to correctly handle range strings.

12. **Logical `rules[]` textarea** is an authoring footgun; minimum fix is JSON schema validation feedback.

13. **`bypass` action** should carry a platform/version gate note (Linux + auto_redirect + 1.13+).

### P2

14. **Testing-only fields** (`package_name_regex`, `source_mac_address`, `source_hostname`, 1.14 resolve fields) should carry version badges.

15. **`interface_address` / `network_interface_address`** are object-type; they render incorrectly as scalars in AdvancedScalarFields and need a JsonField or structured editor.

16. **`icmp` value in `network`** should carry a version note (1.13+) in the enum multiselect.

---

## Implementation Tasks

1. **Inspector.tsx `RouteRuleInspector`:** Add `action`-aware conditional rendering for the outbound select and all action-specific field groups (`reject`, `sniff`, `resolve`, `route-options`).

2. **Inspector.tsx `routeRuleAdvancedFields`:** Remove `geosite`, `source_geoip`, `geoip`. These three fields must only appear as import-time legacy fields with deprecation notice.

3. **Inspector.tsx `RouteRuleInspector` — `inbound` field:** Replace `RuleListField` with a tag-chip multiselect reading from `config.inbounds[].tag`.

4. **Inspector.tsx `RouteRuleInspector` — `rule_set` field:** Replace `RuleListField` with a tag-chip multiselect reading from `config.route.rule_set[].tag`.

5. **Inspector.tsx `RouteRuleInspector` — `resolve` action block:** Add a select for `server` field populated from `config.dns.servers[].tag`, plus inputs for `strategy`, `disable_cache`, `rewrite_ttl`, `client_subnet`.

6. **Inspector.tsx `RouteRuleInspector` — `reject` action block:** Add `method` select (`default`, `drop`; `reply` for ICMP) and `no_drop` toggle.

7. **Inspector.tsx `RouteRuleInspector` — `sniff` action block:** Add `sniffer` multiselect and `timeout` text input.

8. **Inspector.tsx `RouteRuleInspector` — route-options fields block:** Add fields for `override_address`, `override_port`, `network_strategy`, `udp_connect`, `udp_timeout`, `tls_fragment`, `tls_fragment_fallback_delay`, `tls_record_fragment`. Show inline for `route`/`bypass`, as the full block for `route-options`.

9. **SbcNode.tsx `getPortSpecs` (output, `route-rule`):** Make the `outbound` port conditional on `action === "route" || action === "bypass"`. Add a `dns-server` output port conditional on `action === "resolve"`.

10. **Inspector.tsx `routeRuleAdvancedFields`:** Upgrade `preferred_by`, `network`, `network_type`, `protocol`, `client` to enum-constrained multiselect controls rather than free text RuleListField.

11. **diagnostics.ts:** Add diagnostic for `action === "route"` with missing or empty `outbound`. Add diagnostic for `action === "resolve"` with `server` referencing a missing DNS server tag.

12. **Palette.tsx:** Update the Route Rule library item label or tooltip to clarify it opens the route rules table inside the Route node inspector.

---

## Done Criteria

- Adding a route rule from the Library opens or scrolls to the `RouteRulesTable` and appends a new rule to `route.rules[]` in canonical JSON.
- Canvas rule nodes do not expose any `+` affordance that creates sibling rules.
- The canvas outbound port is absent (or visually inert) when the rule's action is not `route` or `bypass`.
- A canvas `dns-server` port is present when the rule's action is `resolve`.
- Inspector action select change conditionally shows and hides the correct field groups for all 7 action values.
- `outbound` select is absent from the Inspector when `action` is `reject`, `hijack-dns`, `sniff`, `route-options`, or `resolve`.
- `action: "resolve"` shows a `server` select populated exclusively from `config.dns.servers[].tag`.
- `action: "reject"` shows `method` and `no_drop` controls.
- `action: "sniff"` shows `sniffer` and `timeout` controls.
- `action: "route-options"` (and inline on `route`/`bypass`) shows override and TLS fragment controls.
- `inbound[]` field is a tag-validated multiselect.
- `rule_set[]` field is a tag-validated multiselect.
- Deprecated `geosite`/`geoip`/`source_geoip` fields are absent from the default advanced fields list; they appear only when present in imported JSON, with a deprecation banner.
- `diagnostics.ts` reports an error for `action: "route"` rules missing `outbound`, and for `action: "resolve"` rules with `server` referencing a missing DNS server.
- E2E or smoke test imports a rule with each action type, renders the correct Inspector fields, and exports valid JSON.
