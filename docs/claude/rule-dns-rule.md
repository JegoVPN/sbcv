<!-- Status: ui-verified + partially implemented (2026-05-27). P0 #2 (server select rendered for all actions) FIXED — server select only on action=route; action change clears `rule.server` and exits with the right namespace (dns.servers[].tag). P0 #3 (action sub-fields absent) partially FIXED — reject (method + no_drop) and predefined (rcode) render. Outstanding: P0 evaluate / respond / route-options sub-forms, P0 dns-rule-action phantom Palette kind cleanup, P0 canvas dns-server port action-gating, P1 1.13 interface_address fields, P1 1.14 source_mac_address / source_hostname / preferred_by / match_response. -->
# DNS Rule Node — Deep UI Review

Status: official-read. Sources: stable docs/configuration/dns/rule.md + rule_action.md, testing docs/configuration/dns/rule.md + rule_action.md, Palette.tsx, SbcNode.tsx, Inspector.tsx, RuleTables.tsx, diagnostics.ts.

## Scope

- Node ID: `rule:dns-rule`
- Palette kind: `dns-rule` (status `table`) and `dns-rule-action` (status `inspector`)
- Official docs: `dns/rule.md` and `dns/rule_action.md`
- This node writes one object in the ordered `dns.rules[]` list.

---

## Official Model

### Matcher Fields (default rule)

**Source / context** (20 fields):

| Field | Since | Notes |
|---|---|---|
| `inbound` | - | Tags of Inbound. Array or single value. |
| `ip_version` | - | 4 (A) or 6 (AAAA). Testing 1.14: also applies to internal domain resolution without a specific server. |
| `query_type` | - | DNS query type, integer or name string. Testing 1.14: same scope change as ip_version. |
| `network` | - | `tcp` or `udp`. |
| `auth_user` | - | Username per-inbound. |
| `protocol` | - | Sniffed protocol (tls, http, quic). |
| `domain` | - | Full domain match. |
| `domain_suffix` | - | Suffix match. |
| `domain_keyword` | - | Keyword match. |
| `domain_regex` | - | Regex match. |
| `source_ip_cidr` | - | Source IP CIDR. |
| `source_ip_is_private` | 1.8 | Non-public source IP. |
| `source_port` | - | Source port. |
| `source_port_range` | - | Source port range. |
| `port` | - | Port. |
| `port_range` | - | Port range. |
| `process_name` | - | Linux/Windows/macOS only. |
| `process_path` | - | Linux/Windows/macOS only. |
| `process_path_regex` | 1.10 | Linux/Windows/macOS only. |
| `package_name` | - | Android package name. |
| `package_name_regex` | 1.14 testing | Android package name regex. |
| `user` | - | Linux only. |
| `user_id` | - | Linux only. |
| `clash_mode` | - | Clash mode string. |
| `network_type` | 1.11 | `wifi`/`cellular`/`ethernet`/`other`. Graphical clients, Android + Apple. |
| `network_is_expensive` | 1.11 | Metered (Android) or expensive (Apple). Graphical clients only. |
| `network_is_constrained` | 1.11 | Low Data Mode. Apple graphical clients only. |
| `interface_address` | 1.13 | Map of interface name -> CIDR list. Linux/Windows/macOS. |
| `network_interface_address` | 1.13 | Map of network_type -> CIDR list. Graphical clients, Android + Apple. |
| `default_interface_address` | 1.13 | CIDR list for default interface. Linux/Windows/macOS. |
| `source_mac_address` | 1.14 testing | MAC address of source device. Requires Neighbor Resolution. |
| `source_hostname` | 1.14 testing | Hostname from DHCP leases. Requires Neighbor Resolution. |
| `preferred_by` | 1.14 testing | Matches specified DNS servers' preferred domains. Values: `hosts`, `local`, `mdns`, `tailscale`, `resolved`. |
| `wifi_ssid` | - | Android/Apple graphical clients or Linux. |
| `wifi_bssid` | - | Android/Apple graphical clients or Linux. |
| `rule_set` | 1.8 | Tags of rule-sets. |
| `rule_set_ip_cidr_match_source` | 1.10 | Makes ip_cidr in rule-sets match source IP. |
| `match_response` | 1.14 testing | Enable response-based matching. Requires preceding `evaluate` rule. Required for Response Match Fields. |
| `invert` | - | Invert match result. |

**Address Filter Fields (stable — legacy in testing 1.14):**

| Field | Since | Notes |
|---|---|---|
| `ip_cidr` | 1.9 | Match IP CIDR with query response. Testing 1.14: deprecated as Legacy AF; use with `match_response` instead. |
| `ip_is_private` | 1.9 | Match private IP with query response. Testing 1.14: same deprecation. |
| `rule_set_ip_cidr_accept_empty` | 1.10 | ip_cidr in rule-sets accepts empty response. Testing 1.14: deprecated. |
| `ip_accept_any` | 1.12 | Match any IP with query response. Testing 1.14: use with `match_response`. |

**Response Match Fields (testing 1.14 only — requires `match_response: true`):**

| Field | Notes |
|---|---|
| `response_rcode` | Match DNS response code. |
| `response_answer` | Match DNS answer records. |
| `response_ns` | Match DNS name server records. |
| `response_extra` | Match DNS extra records. |

**Deprecated / removed matcher fields:**

| Field | Status |
|---|---|
| `outbound` | Deprecated 1.12, removed 1.14. Import/migration only. |
| `geosite` | Deprecated 1.8, removed 1.12. Import/migration only. |
| `source_geoip` | Deprecated 1.8, removed 1.12. Import/migration only. |
| `geoip` | Deprecated 1.8, removed 1.12. Import/migration only. |
| `rule_set_ipcidr_match_source` | Deprecated 1.10 (renamed to `rule_set_ip_cidr_match_source`). |

**Logical rule shape:**

- `type: "logical"`, `mode: "and" | "or"`, `rules[]` (nested default rules), plus action fields.

### Action Fields

All actions require the top-level `action` key.

**`route` (default) — stable + testing:**

| Field | Required | Notes |
|---|---|---|
| `server` | Yes | Tag of target DNS server (not outbound). |
| `strategy` | No | Stable: `prefer_ipv4`/`prefer_ipv6`/`ipv4_only`/`ipv6_only`. Testing 1.14: deprecated (removed 1.16). |
| `disable_cache` | No | Disable cache for this query. |
| `disable_optimistic_cache` | No (1.14 testing) | Disable optimistic cache for this query. |
| `rewrite_ttl` | No | Rewrite TTL in responses. |
| `timeout` | No (1.14 testing) | Override DNS query timeout. Overrides `dns.timeout`. |
| `client_subnet` | No | EDNS0 client subnet. Overrides `dns.client_subnet`. |

**`evaluate` (testing 1.14 only):**

| Field | Required | Notes |
|---|---|---|
| `server` | Yes | Tag of target DNS server. |
| `disable_cache` | No | Disable cache. |
| `disable_optimistic_cache` | No | Disable optimistic cache. |
| `rewrite_ttl` | No | Rewrite TTL. |
| `timeout` | No | Override timeout. |
| `client_subnet` | No | EDNS0 subnet. |

Does NOT terminate rule evaluation. Saves result for subsequent `match_response` rules.

**`respond` (testing 1.14 only):**

No extra fields. Returns evaluated response from preceding `evaluate` rule. Requires a preceding `evaluate` rule; fails if none exists at runtime.

**`route-options` — stable + testing:**

| Field | Notes |
|---|---|
| `disable_cache` | Disable cache. |
| `disable_optimistic_cache` | (testing 1.14) |
| `rewrite_ttl` | Rewrite TTL. |
| `timeout` | (testing 1.14) Override timeout. |
| `client_subnet` | EDNS0 subnet. |

No `server` field. Sets options only, does not pick a server.

**`reject` — stable + testing:**

| Field | Notes |
|---|---|
| `method` | `default` (REFUSED) or `drop`. Default: `default`. |
| `no_drop` | Prevent auto-switch to `drop` after 50 triggers in 30s. Invalid when method is already `drop`. |

No `server` field.

**`predefined` (stable 1.12+):**

| Field | Notes |
|---|---|
| `rcode` | Response code: `NOERROR`, `FORMERR`, `SERVFAIL`, `NXDOMAIN`, `NOTIMP`, `REFUSED`. Default: `NOERROR`. |
| `answer` | List of text DNS records for answers. |
| `ns` | List of text DNS records for name servers. |
| `extra` | List of text DNS records for extra records. |

No `server` field.

**Deprecated action-level fields (moved from rule level in 1.11):**

Top-level rule `server`, `disable_cache`, `rewrite_ttl`, `client_subnet` are deprecated in 1.11. They were moved into rule actions. Import/migration only; new authoring must use action-specific fields.

---

## Relationship Model

```
dns-rule
  ├── dns.rules[] order  →  dns hub (ordered list, table is authoritative)
  ├── inbound[]          →  inbound tags  (match context)
  ├── rule_set[]         →  rule-set tags (match context)
  └── action: "route"
        └── server       →  dns-server tag  (NOT an outbound)
      action: "evaluate"
        └── server       →  dns-server tag  (NOT an outbound)
      action: "route-options" / "reject" / "predefined" / "respond"
        └── (no server reference)
```

Key disambiguation:
- `server` in `route`/`evaluate` actions = dns-server tag (e.g. `"local"`, `"google"`).
- `outbound` = deprecated matcher field in 1.12+, NOT an action target.
- DNS rules never route to outbounds in current authoring.

---

## Compat / Target Gate Summary

| Feature | Stable | Testing |
|---|---|---|
| `action` field (required) | 1.11+ | 1.11+ |
| `predefined` action | 1.12+ | 1.12+ |
| `strategy` in route action | 1.12–1.13 (deprecated 1.14) | deprecated 1.14 |
| `ip_accept_any` matcher | 1.12+ | 1.12+ |
| `interface_address` / `network_interface_address` / `default_interface_address` | 1.13+ | 1.13+ |
| `evaluate` action | not available | 1.14 only |
| `respond` action | not available | 1.14 only |
| `match_response` matcher | not available | 1.14 only |
| Response Match Fields | not available | 1.14 only |
| `package_name_regex` | not available | 1.14 only |
| `source_mac_address` / `source_hostname` | not available | 1.14 only |
| `preferred_by` | not available | 1.14 only |
| `disable_optimistic_cache` / `timeout` in actions | not available | 1.14 only |
| Legacy Address Filter Fields (`ip_cidr`, `ip_is_private`, `rule_set_ip_cidr_accept_empty`) | current | deprecated 1.14, removed 1.16 |
| `outbound` matcher | deprecated 1.12 | removed 1.14 |
| `geosite` / `source_geoip` / `geoip` | removed 1.12 | removed 1.12 |

---

## Left: Palette / Library

**Current state:**
- `dns-rule` entry: `status: "table"`, label "DNS Rule", GitBranch icon, docsUrl `dns/rule/`.
- `dns-rule-action` entry: `status: "inspector"`, label "DNS Rule Action", GitBranch icon, docsUrl `dns/rule_action/`.
- Click enablement: `dns-rule` with `status: "table"` is activated by the same condition as `route-rule`.

**Issues:**

- `dns-rule-action` as a separate Palette kind is misleading. DNS rule actions are not standalone objects; they are fields embedded inside each DNS rule entry in `dns.rules[]`. There is no `dns-rule-action` entity in canonical sing-box JSON. Showing it as a clickable Palette item implies users can create one, which is not correct.
- The `status: "table"` label is an internal implementation keyword, not user-facing copy. Users need explicit UI affordance ("Add Rule via Table", "Edit DNS Rules").
- Both entries use the same GitBranch icon, making them visually identical and undifferentiated in the palette.
- The docsUrl for `dns-rule-action` is valid, but without a real node object backing it, its purpose in the palette is unclear.

**Recommendation:**

- Remove `dns-rule-action` as a separate Palette entry. Merge action configuration entirely into the DNS rule Inspector.
- Rename the `dns-rule` Palette entry label to something explicit like "DNS Rules Table" or "Edit DNS Rules".
- The primary action should open or scroll to the `DnsRulesTable`, not place a standalone node.

---

## Middle: Canvas Node

**Current state (from SbcNode.tsx `getPortSpecs`):**

Left ports (inputs):
- `dns` — "DNS order" → nodeKind `dns` (the DNS hub)
- `inbound` — "Inbound matcher" → nodeKind `inbound`

Right ports (outputs):
- `dns-server` — "DNS server" → nodeKind `dns-server`
- `rule-set` — "Rule Set" → nodeKind `rule-set`

Connectivity validity checks (from SbcNode.tsx):
- `dns-rule` + portKey `dns`: always connectable.
- `dns-rule` + portKey `inbound`: checks if inbound tag is referenced in rule.
- `dns-server` + portKey `dns-rule`: checks if a matching server tag exists in rule.
- `rule-set` + portKey `dns-rule`: checks rule_set references.
- `dns` + portKey `dns-rule`: checks `config.dns?.rules?.length > 0`.
- `dns-rule` + portKey `dns-server`: checks if rule has a server field.
- `dns-rule` + portKey `rule-set`: checks rule_set references.

**Issues:**

- The canvas node always shows a `dns-server` (right) port regardless of action type. For `reject`, `route-options`, `predefined`, and `respond` actions, there is no `server` field. Showing this port is misleading and implies a required reference that does not exist.
- The canvas node is a visual reference card for an ordered list item. Order is determined by `dns.rules[]` array position, not by canvas layout or edge connections. Edges from the `dns` hub to `dns-rule` nodes visualize the list but cannot reorder it; this must be clearly communicated to avoid user confusion.
- The `dns` left port is labeled "DNS order" but the node has no real ordering authority on the canvas. The label should instead say something like "DNS list member" or "DNS rule list".
- The `dns-rule-action` kind in the Palette has no corresponding canvas node entry in SbcNode.tsx. It is a phantom kind that currently appears in the palette with no canvas or Inspector implementation.

**Recommendation:**

- Gate the `dns-server` right port on action type. Show it only when `action === "route"` or `action === "evaluate"`.
- Add a canvas label or tooltip indicating that rule order is controlled by the DNS Rules table, not canvas edge position.
- Eliminate `dns-rule-action` from the node registry entirely.

---

## Right: Inspector

**Current state (DnsRuleInspector in Inspector.tsx):**

Primary fields rendered (`dnsRulePrimaryFields`):
- `type` (Rule Type select: default / logical)
- `mode` (logical only)
- `rules` (logical only — raw JSON textarea)
- `inbound`, `query_type`, `domain_suffix`, `domain_keyword`, `domain`, `domain_regex`, `rule_set` (RuleListField)
- `action` select: `route`, `evaluate`, `respond`, `route-options`, `reject`, `predefined`
- `server` select (from `config.dns?.servers`) — always visible regardless of action
- `invert` checkbox
- SharedRuleFields (wifi_ssid, wifi_bssid, source_mac_address, source_hostname) — collapsed group
- RuleAdvancedFields (collapsed "Advanced match fields") with `dnsRuleAdvancedFields` list
- AdvancedScalarFields catch-all for remaining scalars

`dnsRuleAdvancedFields` list (from Inspector.tsx lines 335–367):
`ip_version`, `network`, `auth_user`, `protocol`, `geosite`(depr), `source_geoip`(depr), `geoip`(depr), `source_ip_cidr`, `source_ip_is_private`, `ip_cidr`, `ip_is_private`, `ip_accept_any`, `source_port`, `source_port_range`, `port`, `port_range`, `process_name`, `process_path`, `process_path_regex`, `package_name`, `user`, `user_id`, `clash_mode`, `network_type`, `network_is_expensive`, `network_is_constrained`, `rule_set_ip_cidr_match_source`, `rule_set_ip_cidr_accept_empty`, `disable_cache`, `rewrite_ttl`, `client_subnet`.

**Issues:**

**I1 — Server field always visible regardless of action (P0).**
The Inspector renders the `server` select for every action including `reject`, `route-options`, `predefined`, and `respond`. For these actions, `server` is not a valid field. A user selecting `reject` still sees the server dropdown and may set it, producing a confusing or invalid config. The Inspector must condition the server select on `action === "route" || action === "evaluate"`.

**I2 — No action-specific fields for reject / route-options / predefined / respond / evaluate (P0).**
- `reject` needs `method` (select: `default`/`drop`) and `no_drop` (checkbox).
- `route-options` needs `disable_cache`, `rewrite_ttl`, `client_subnet` as action-level fields, not as advanced match fields.
- `predefined` needs `rcode` (select) and `answer[]`, `ns[]`, `extra[]` (repeaters or textareas).
- `evaluate` (testing) needs the same action fields as `route` except it does not terminate evaluation.
- `respond` (testing) has no options, just a status note that it requires a preceding `evaluate` rule.
Currently none of this conditional rendering exists. All action-specific parameters are either absent or misplaced in the generic advanced match fields.

**I3 — `disable_cache`, `rewrite_ttl`, `client_subnet` are placed in advanced match fields (P1).**
These three fields were moved from the top-level rule into DNS Rule Actions in 1.11. The Inspector still treats them as generic advanced match fields in `dnsRuleAdvancedFields`. They should be shown as action-level options for `route`, `route-options`, and `evaluate`, not as match fields.

**I4 — Missing testing-only fields with no version gate (P1).**
The Inspector includes `evaluate` and `respond` in the action select but has no version gate. Selecting these on a stable target silently generates an invalid config. A channel-aware gate (or at minimum a warning label) is needed.

**I5 — Testing-only fields absent from dnsRuleAdvancedFields (P1).**
The following fields introduced in testing 1.14 are not present in `dnsRuleAdvancedFields` and are not in any primary field set:
- `match_response` (boolean)
- `response_rcode`, `response_answer`, `response_ns`, `response_extra` (Response Match Fields)
- `package_name_regex`
- `disable_optimistic_cache` (action field for route/evaluate/route-options)
- `timeout` (action field for route/evaluate/route-options)

These will be caught by the `AdvancedScalarFields` fallback only if the raw imported JSON contains them, but new authoring is not supported.

**I6 — `preferred_by` in routeRuleAdvancedFields but not dnsRuleAdvancedFields (P1).**
`preferred_by` is listed in `routeRuleAdvancedFields` (line 331) but is absent from `dnsRuleAdvancedFields`. It is a valid 1.14-testing DNS rule matcher field.

**I7 — `interface_address`, `network_interface_address`, `default_interface_address` not in dnsRuleAdvancedFields (P1).**
These three 1.13 stable fields are not present in `dnsRuleAdvancedFields`. They may be handled by the AdvancedScalarFields fallback on import, but are not offered for new authoring. They are valid for both stable and testing.

**I8 — Logical rule uses raw JSON textarea for nested rules (P2).**
The logical rule editor renders `rules` as a raw JSON textarea. This is functional for power users but fragile. A structured nested repeater or at least a validated JSON editor would improve the experience.

**I9 — Deprecated fields in dnsRuleAdvancedFields without migration labels (P2).**
`geosite`, `source_geoip`, `geoip` (removed in stable 1.12) are listed in `dnsRuleAdvancedFields` as regular advanced fields. They should only be visible when the imported JSON already contains them, and they should carry a "deprecated / migration only" label.

**I10 — `server` select uses "None" as empty sentinel (P2).**
For `route` and `evaluate` actions, `server` is required. The select shows "None" as the default but does not visually mark the field as required or generate a diagnostic for the missing server until after save. A required-field visual marker or inline diagnostic would help.

**I11 — `rule_set` uses RuleListField with comma-separated text input (P2).**
Tags can contain spaces theoretically; a multi-select or tag-chip UI backed by existing `config.route?.rule_set` entries would be more reliable.

---

## Priority Findings

**P0 — Centralize creation / reorder / delete in dns.rules table; canvas node is a reference card only.**
The canvas node placement and edge connections do not determine rule order in `dns.rules[]`. All structural operations (add, delete, reorder) must happen in the `DnsRulesTable`. The canvas node should display the rule's position index and a summary only. This is already architecturally true (DnsRulesTable exists and works), but the Palette still advertises `dns-rule` with `status: "table"` while the canvas node suggests it is a first-class draggable entity. UI copy and on-boarding must make this clear.

**P0 — Inspector server field must be action-conditional.**
`server` is only valid for `action: "route"` and `action: "evaluate"`. Showing it unconditionally for all actions including `reject`, `route-options`, `predefined`, `respond` is incorrect and misleads users into setting a field that has no effect or is invalid for those actions.

**P0 — Inspector must render action-specific sub-forms.**
Each action type has distinct fields: `reject` needs `method`/`no_drop`; `predefined` needs `rcode`, `answer`, `ns`, `extra`; `route-options` needs `disable_cache`, `rewrite_ttl`, `client_subnet`; `evaluate` mirrors `route` but without termination semantics; `respond` needs no fields. Currently none of these are presented.

**P0 — `dns-rule-action` Palette kind has no implementation and should be removed.**
The `dns-rule-action` Palette entry (status `inspector`) references a kind that does not exist as a canvas node, has no Inspector rendering, and does not correspond to any standalone sing-box JSON entity. It is a dead Palette entry that must be removed to avoid user confusion.

**P1 — `disable_cache`, `rewrite_ttl`, `client_subnet` must be moved to action sub-form, not match fields.**
These are action-level route options (since 1.11). Presenting them under "Advanced match fields" is a category error.

**P1 — Testing-only fields (`evaluate`, `respond`, `match_response`, Response Match Fields) require version gate.**
Selecting `evaluate` or `respond` on a stable target silently generates an invalid config. A channel check or inline warning is needed.

**P1 — `preferred_by`, `interface_address` family, `package_name_regex` missing from dnsRuleAdvancedFields.**
Three stable-1.13 fields (`interface_address`, `network_interface_address`, `default_interface_address`) and the testing-1.14 field `preferred_by` are missing. New authoring cannot set them.

**P1 — Deprecated `geosite`/`source_geoip`/`geoip` in advanced fields need migration warning labels.**
These were removed in stable 1.12. Presenting them as ordinary advanced fields implies they are valid for new authoring.

**P2 — Predefined DNS record fields need structured repeaters.**
`answer`, `ns`, `extra` in the `predefined` action are lists of text DNS records. A raw textarea is acceptable initially but a structured repeater would reduce parse errors.

**P2 — Diagnostics do not check `server` required-ness per action.**
`diagnostics.ts` line 261 checks `if (rule.server && !dnsServerTags.has(rule.server))` but does not check the inverse: if `action === "route"` and `server` is absent, no error is raised. A `missing-dns-rule-server-for-route` error diagnostic is needed.

---

## Implementation Tasks

1. **Remove `dns-rule-action` from Palette** and consolidate action editing into DnsRuleInspector.
2. **Conditionalize `server` select** in DnsRuleInspector on `action === "route" || action === "evaluate"`.
3. **Add action sub-forms** in DnsRuleInspector:
   - `reject`: `method` select + `no_drop` checkbox.
   - `predefined`: `rcode` select + `answer`/`ns`/`extra` textarea or repeaters.
   - `route-options`: `disable_cache` checkbox + `rewrite_ttl` number + `client_subnet` text.
   - `evaluate` (testing): same as `route` sub-form.
   - `respond` (testing): info-only, no fields.
4. **Move `disable_cache`, `rewrite_ttl`, `client_subnet`** out of `dnsRuleAdvancedFields` and into action sub-form for applicable actions.
5. **Add `preferred_by`, `interface_address`, `network_interface_address`, `default_interface_address`** to `dnsRuleAdvancedFields`.
6. **Add version gate** for `evaluate`, `respond`, `match_response`, Response Match Fields, `package_name_regex`, `disable_optimistic_cache`, `timeout`. Show warning or hide based on `channel === "testing"`.
7. **Mark `geosite`, `source_geoip`, `geoip`** as import/migration-only in advanced fields with a deprecated label.
8. **Add diagnostic** `missing-dns-rule-server-for-route`: error when `action === "route"` and `server` is absent or empty.
9. **Gate canvas `dns-server` right port** on action type (`route` or `evaluate` only).
10. **Update Palette label** for `dns-rule` to make the table-only nature explicit.
11. **Add `match_response`** boolean to primary or advanced DNS rule fields for testing channel.
12. **Add Response Match Fields** (`response_rcode`, `response_answer`, `response_ns`, `response_extra`) gated on `match_response === true` and `channel === "testing"`.

---

## Done Criteria

- `dns-rule-action` Palette entry is removed; action config lives entirely in DNS rule Inspector.
- Selecting any action in the DNS rule Inspector shows only the fields valid for that action.
- `server` field is absent from Inspector when action is `reject`, `route-options`, `predefined`, or `respond`.
- `reject` Inspector shows `method` and `no_drop`; `predefined` shows `rcode`, `answer`, `ns`, `extra`; `route-options` shows `disable_cache`, `rewrite_ttl`, `client_subnet`.
- Testing-only actions and fields carry version-gate labels or are hidden on stable channel.
- `preferred_by`, `interface_address`, `network_interface_address`, `default_interface_address` are configurable in the Inspector.
- Deprecated legacy fields (`geosite`, `source_geoip`, `geoip`) are import-only with visible deprecation labels.
- Diagnostics raise an error when `action: "route"` has no `server`.
- Canvas `dns-server` port is only shown when action is `route` or `evaluate`.
- All Inspector edits round-trip correctly to `dns.rules[]` JSON export.
- DnsRulesTable remains the sole location for add/delete/reorder operations; canvas edges are visual-only.
- Smoke test: import a config containing `reject`, `predefined`, and `route` DNS rules; verify each renders correct Inspector sub-form; verify export matches original structure.
