<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / direct UI Review (Claude Deep Review)

## Scope

- Editable node: `outbound:direct`
- Palette kind: `direct` (Palette.tsx line 154)
- Official doc (stable): `outbound/direct.md`
- Official doc (testing): `outbound/direct.md` — identical to stable, no testing-only fields
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Official Model

### Writable fields

`direct` outbound has **no** `server` / `server_port` fields — it sends requests directly without an upstream proxy address. This is the key structural difference from all proxy outbounds.

#### direct-specific own fields

| Field | Type | Required | Default | Semantic | Version status |
| --- | --- | --- | --- | --- | --- |
| `tag` | string | optional | auto-generated | Unique identifier; referenced by route, DNS, selector, urltest | stable |
| `type` | string literal | required | `"direct"` | Protocol discriminator | stable |
| `override_address` | string | optional | — | Override destination address | **Deprecated 1.11.0, removal 1.13.0** |
| `override_port` | int | optional | — | Override destination port | **Deprecated 1.11.0, removal 1.13.0** |

#### Dial Fields (shared/dial.md)

All dial fields listed below apply to `direct` because `outboundDialTypes` (sharedFieldRegistry.ts line 150) includes `"direct"`.

| Field | Type | Since | Notes |
| --- | --- | --- | --- |
| `detour` | string | stable | Tag of upstream outbound. When set, all other dial fields are ignored. |
| `bind_interface` | string | stable | Network interface to bind to. Conflicts with `network_strategy`. |
| `inet4_bind_address` | string | stable | IPv4 address to bind to. Conflicts with `network_strategy`. |
| `inet6_bind_address` | string | stable | IPv6 address to bind to. Conflicts with `network_strategy`. |
| `bind_address_no_port` | bool | **1.13.0** | Linux only. Do not reserve port when binding source address. |
| `routing_mark` | int / hex-string | stable | Linux only. Set netfilter routing mark. |
| `reuse_addr` | bool | stable | Reuse listener address. |
| `netns` | string | **1.12.0** | Linux only. Set network namespace name or path. |
| `connect_timeout` | duration string | stable | Connect timeout (e.g. `"300ms"`, `"10s"`). |
| `tcp_fast_open` | bool | stable | Enable TCP Fast Open. |
| `tcp_multi_path` | bool | stable | Enable TCP Multi Path (Go 1.21+). |
| `disable_tcp_keep_alive` | bool | **1.13.0** | Disable TCP keep-alive. |
| `tcp_keep_alive` | duration string | **1.13.0** | TCP keep-alive initial period (default `5m`). |
| `tcp_keep_alive_interval` | duration string | **1.13.0** | TCP keep-alive interval (default `75s`). |
| `udp_fragment` | bool | stable | Enable UDP fragmentation. |
| `domain_resolver` | string \| object | **1.12.0** | For `direct`: resolves domain in the forwarded request. Required when no `route.default_domain_resolver` is set and only one DNS server is not configured. |
| `network_strategy` | string | **1.11.0** | Mobile/graphical clients only with `auto_detect_interface`. Values: `default`, `hybrid`, `fallback`. Conflicts with `bind_interface`, `inet4_bind_address`, `inet6_bind_address`. |
| `network_type` | string[] | **1.11.0** | Mobile/graphical only. Preferred network types: `wifi`, `cellular`, `ethernet`, `other`. |
| `fallback_network_type` | string[] | **1.11.0** | Mobile/graphical only. Fallback network types for `fallback` strategy. |
| `fallback_delay` | duration string | **1.11.0** | Timeout before fallback (default `300ms`). Also controls RFC 6555 Fast Fallback for `domain_strategy`. |
| `domain_strategy` | string | stable, **deprecated 1.12.0** | For `direct`: resolves domain in request. Values: `prefer_ipv4`, `prefer_ipv6`, `ipv4_only`, `ipv6_only`. Removed in 1.14.0. |

**Total official writable fields: 4 own (2 deprecated) + 20 shared dial = 24 fields.**

### Cross-version diff (testing)

The testing doc is identical to the stable doc for `outbound/direct.md`. No testing-only fields exist. The only versioning concern is:

- `override_address` / `override_port` — deprecated 1.11.0, removal 1.13.0 (affects 1.12-stable target).
- `domain_strategy` — deprecated 1.12.0, removal 1.14.0 (affects 1.13-stable target).
- `bind_address_no_port`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval` — added in 1.13.0 (not available on 1.12-stable).
- `domain_resolver`, `netns` — added in 1.12.0 (not available on legacy targets if any older target is added).

### Relationship model

#### Outgoing references (from `direct` node)

- `detour` → outbound tag: `direct` can chain through another outbound via dial detour. The canvas right output port (`dial-detour`, key `"dial-detour"`) represents this edge.

#### Incoming references (to `direct` node by its tag)

| Surface | JSON path | Port key (input) | Port label |
| --- | --- | --- | --- |
| Route final | `route.final` | `route` | Upstream Route final |
| Route rule outbound | `route.rules[].outbound` | `route-rule` | Upstream Rule outbound |
| Selector candidate | `outbounds[type=selector].outbounds[]` | `selector-group` | Upstream Selector candidate |
| URLTest candidate | `outbounds[type=urltest].outbounds[]` | `urltest-group` | Upstream URLTest candidate |
| DNS server detour | `dns.servers[].detour` | `dns-detour` | Upstream DNS detour target |
| Dial detour target | `outbounds[].detour` / `endpoints[].detour` | `detour-target` | Upstream Dial detour target |
| Service detour | `services[].detour` | `service-detour` | Upstream service detour target |
| Rule-set download detour | `route.rule_set[].download_detour` | `rule-set-download` | Upstream Rule Set download detour |

All eight input port keys are already defined in `SbcNode.tsx` lines 104–117 for `kind === "outbound"` and are correctly wired.

### Compat / Target gate

- No target gate: `direct` is available on all targets (1.12-stable, 1.13-stable, 1.14-testing).
- `override_address` / `override_port`: should be hidden or marked deprecated in Inspector for 1.13.0+.
- `domain_strategy`: should be hidden or marked deprecated for 1.12.0+.
- `bind_address_no_port`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`: should only be available for 1.13.0+ (stable or testing).

---

## Left: Add Library

### Current state (Palette.tsx line 154)

```ts
{ label: "Direct", kind: "direct", icon: Cable, docsUrl: docs("outbound/direct/"), ready: true }
```

- `itemStatus()` resolves to `"add"` because `ready: true`.
- `canActivate()` returns `true` → clicking triggers `createFromPalette("direct")`.
- `OUTBOUND_PALETTE_TYPES["direct"]` → `"direct"` → `addOutbound(config, "direct", "direct")`.
- `createOutbound("direct", tag)` returns `{ type: "direct", tag }` — minimal skeleton, correct.
- `docsUrl` points to correct `outbound/direct/` page.
- Preferred tag: `preferredOutboundTag("direct")` → `"direct"`.

### Gap analysis

1. No palette kind naming anomaly: `"direct"` is used for both the palette kind and the sing-box outbound type; `OUTBOUND_PALETTE_TYPES` maps `direct: "direct"`. This is consistent (same as `"block"`, `"selector"`, `"urltest"`) unlike the `inbound-*` prefix convention, but it is intentional for outbounds — the outbound palette kinds match the type values directly where there is no ambiguity.
2. No duplicate guard: clicking "Add Direct" twice creates two `direct` outbounds. This is semantically valid (two distinct direct outbounds with different tags are legal) and not a bug.
3. `ready: true` is accurate for creation/export but overstates the Inspector completeness — several dial fields are missing (P1 below).

---

## Middle: Canvas Node

### Current state (SbcNode.tsx)

- `outboundIcon("direct")` → `CheckCircle2` (line 43). Distinct icon, correct.
- `supportsDialDetour("direct")` → `true` (line 62–64: `direct` is not in the exclusion list of `block`, `selector`, `urltest`, `dns`).

#### Left input ports (for `kind === "outbound"`, all types)

| Port key | Label | Source node kind | Source node type |
| --- | --- | --- | --- |
| `route` | Upstream Route final | `route` | — |
| `route-rule` | Upstream Rule outbound | `route-rule` | — |
| `selector-group` | Upstream Selector candidate | `outbound` | `selector` |
| `urltest-group` | Upstream URLTest candidate | `outbound` | `urltest` |
| `dns-detour` | Upstream DNS detour target | `dns-server` | — |
| `detour-target` | Upstream Dial detour target | `outbound` | — |
| `service-detour` | Upstream service detour target | `service` | — |
| `rule-set-download` | Upstream Rule Set download detour | `rule-set` | — |

All eight ports correct and present. Connectivity checks are wired in `isPortConnected` (SbcNode.tsx lines 253–276).

#### Right output ports

| Port key | Label | Target node kind |
| --- | --- | --- |
| `dial-detour` | Downstream dial detour | `outbound` |

Wired at SbcNode.tsx line 179–181 behind `supportsDialDetour(type)` guard. `direct` passes.

#### Port correctness analysis

- The `detour-target` input port checks: `config.outbounds?.some(o => o.tag !== value && o.detour === value) || config.endpoints?.some(e => e.detour === value)` — correct.
- The `dial-detour` output port checks: `config.outbounds?.find(o => o.tag === value)?.detour` — correct.
- All eight input port connectivity checks are present and accurate.

---

## Right: Inspector

### Current state summary

The outbound Inspector for `direct` renders via the generic `ref.kind === "outbound"` block (Inspector.tsx lines 1505–1545). Because `createOutbound("direct", tag)` returns only `{ type, tag }` with no `server`, `server_port`, `outbounds`, or `default` keys, none of the server/candidates controls appear for a newly created `direct` node. The only controls rendered are:

1. **Tag** — text input (line 1182). Correct.
2. **Type** — select from `CREATABLE_OUTBOUND_TYPES` (line 1203). Correct; allows switching to other outbound types.
3. **Dial Fields shared section** — rendered because `outboundDialTypes.has("direct")` → `true` → `sharedGroupsForEntity` pushes `"dial"` group.
4. **AdvancedScalarFields** — fallback for any scalar fields in entity not in `outboundHandledFields`.

#### Dial Fields section: rendered vs official

The `"dial"` shared group renders (Inspector.tsx lines 881–891):

| Inspector label | JSON path | Kind | In `dialSharedFields`? | Status |
| --- | --- | --- | --- | --- |
| Detour | `detour` | select (outbound options) | Yes | Correct |
| Bind Interface | `bind_interface` | text | Yes | Correct |
| Connect Timeout | `connect_timeout` | text | Yes | Correct |
| Domain Resolver | `domain_resolver` | text | Yes | Partial — text-only, should allow object form |
| Network Strategy | `network_strategy` | select (`default`/`hybrid`/`fallback`) | Yes | Correct |
| Network Type | `network_type` | list | Yes | Correct |
| Fallback Network | `fallback_network_type` | list | Yes | Correct |
| Fallback Delay | `fallback_delay` | text | Yes | Correct |

#### Official dial fields missing from the Inspector

The following official dial fields from `shared/dial.md` are **absent** from both `dialSharedFields` and the rendered "dial" group:

| Missing field | Type | Since | Impact |
| --- | --- | --- | --- |
| `inet4_bind_address` | string | stable | Cannot set IPv4 bind address |
| `inet6_bind_address` | string | stable | Cannot set IPv6 bind address |
| `bind_address_no_port` | bool | 1.13.0 | Cannot set (Linux only, 1.13+ only) |
| `tcp_fast_open` | bool | stable | Cannot enable TCP Fast Open |
| `tcp_multi_path` | bool | stable | Cannot enable TCP Multi Path |
| `disable_tcp_keep_alive` | bool | 1.13.0 | Cannot disable keep-alive |
| `tcp_keep_alive` | duration | 1.13.0 | Cannot set keep-alive period |
| `tcp_keep_alive_interval` | duration | 1.13.0 | Cannot set keep-alive interval |
| `udp_fragment` | bool | stable | Cannot enable UDP fragmentation |
| `routing_mark` | int/hex | stable | Cannot set routing mark |
| `reuse_addr` | bool | stable | Cannot set reuse address |
| `netns` | string | 1.12.0 | Cannot set network namespace |
| `domain_strategy` | string | stable (deprecated 1.12.0) | Survives round-trip but cannot be edited |

Note: `routing_mark`, `reuse_addr`, and `netns` appear in `listenSharedFields` (used for inbound/service `"listen"` group) but are **not** in `dialSharedFields` (used for outbound `"dial"` group). These fields are valid for outbounds too per the official dial spec, so their absence from `dialSharedFields` is a bug.

#### direct-specific own fields in Inspector

| Field | Status | Notes |
| --- | --- | --- |
| `override_address` | Not rendered when absent | Falls into `AdvancedScalarFields` only if already in entity (string). Deprecated — acceptable not to create by default, but imported configs must survive round-trip. |
| `override_port` | Not rendered when absent | Same as above — number type, surfaced by `AdvancedScalarFields` if present. |

Since `createOutbound("direct", tag)` returns only `{ type, tag }`, `override_address` and `override_port` are not in the entity object for new nodes and thus never shown. For imported configs that contain them, `AdvancedScalarFields` will surface them as editable fields — this is acceptable for deprecated fields.

`override_address` and `override_port` are **not** in `outboundHandledFields`, so they will appear in `AdvancedScalarFields` for any imported config containing them. This is the correct fallback behavior for deprecated fields.

---

## Tag Reference Surfaces: detour -> outbound select

- In the Dial Fields shared inspector, "Detour" renders as a `<select>` populated by `outboundTags(config, ref.tag)` (which excludes self-reference). This is correct.
- No other tag-reference surfaces are specific to `direct`.
- Selector/URLTest candidate management (`outbounds[]` field) is irrelevant to `direct` (it is not a group outbound).

---

## Priority Findings

### P0 — 13 dial fields missing from `dialSharedFields` and the Inspector "Dial Fields" section

**Finding:** The `dialSharedFields` array (Inspector.tsx lines 105–114) contains only 8 of the 21 official dial fields. The following 13 are absent:

- `inet4_bind_address`, `inet6_bind_address`, `bind_address_no_port` (bind address/port controls)
- `tcp_fast_open`, `tcp_multi_path` (TCP optimization booleans)
- `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval` (keep-alive controls — 1.13.0)
- `udp_fragment` (UDP fragmentation)
- `routing_mark`, `reuse_addr`, `netns` (Linux networking — these live in `listenSharedFields` but apply to outbounds too)
- `domain_strategy` (deprecated but valid for round-trip)

**Impact:** For `direct` specifically, `tcp_fast_open` and `udp_fragment` are commonly used performance settings. `routing_mark` is essential for PBR/split-routing setups on Linux. None can be set from the Inspector for a newly created `direct` outbound. They will appear in `AdvancedScalarFields` only if present in an imported config.

**Scope:** This gap affects **all** outbound types that receive the `"dial"` shared group (direct, socks, http, shadowsocks, vmess, trojan, etc.), not just `direct`. However, `direct` is the most commonly used outbound in production configs where these fields matter.

**Recommendation:** Add the missing fields to `dialSharedFields` and to the `if (group === "dial")` branch in `sharedFieldDefinitionsFor`. Version-gate 1.13.0-specific fields (`bind_address_no_port`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`) and mobile-only fields (`network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay`) with appropriate UI hints or conditional rendering based on the active target version.

---

### P0 — `outboundHandledFields` does not include dial fields that are missing from `dialSharedFields`

**Finding:** `outboundHandledFields` (Inspector.tsx lines 128–141) spreads `dialSharedFields`, meaning it marks 8 dial fields as "handled." The 13 missing dial fields are **not** in `outboundHandledFields` either. For imported configs that contain these fields:

- String/number/bool fields (`inet4_bind_address`, `inet6_bind_address`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `udp_fragment`, `routing_mark`, `reuse_addr`, `netns`, `domain_strategy`) → surfaced in `AdvancedScalarFields` (functional but unformatted).
- Duration strings (`tcp_keep_alive`, `tcp_keep_alive_interval`) → surfaced in `AdvancedScalarFields` (functional).
- Bool `bind_address_no_port` → surfaced in `AdvancedScalarFields` as a checkbox (functional).

This means existing fields survive round-trip but are demoted to the generic "Advanced fields" collapsed section instead of appearing alongside the proper Dial Fields section. No data loss, but poor UX.

**Recommendation:** Once the missing fields are added to `dialSharedFields`, add them to `outboundHandledFields` via the spread so `AdvancedScalarFields` stops double-rendering them.

---

### P1 — `override_address` / `override_port` deprecation not communicated to the user

**Finding:** `override_address` and `override_port` are deprecated in 1.11.0 and will be removed in 1.13.0. On the 1.13-stable target, writing these fields produces an invalid config. The UI has no mechanism to:

1. Warn the user when these fields are present in an imported config.
2. Prevent writing them on 1.13.0+ targets.
3. Show a migration hint (route option `override_address` / `override_port` moved to `route.rules[].action`).

They appear in `AdvancedScalarFields` without any deprecation marker if present in an imported entity.

**Recommendation:** Add a semantic diagnostic in `diagnostics.ts` for outbound type `direct`: if `override_address` or `override_port` is present and the active target is 1.13.0+, emit a `"deprecated-direct-override-fields"` warning with a migration link. Add a UI hint in `AdvancedScalarFields` (or a dedicated branch) when these fields are detected on a `direct` outbound.

---

### P1 — `domain_strategy` deprecation not communicated

**Finding:** `domain_strategy` is deprecated in 1.12.0 and removed in 1.14.0. For the 1.14-testing target, it should not be written. For `direct`, `domain_strategy` has special semantics (resolves the forwarded domain, not a server address), and its replacement `domain_resolver` is available since 1.12.0. The Inspector currently renders `domain_resolver` (in `dialSharedFields`) but does not warn that `domain_strategy` is deprecated or guide the migration.

**Recommendation:** Add a diagnostic for `direct` outbound: if `domain_strategy` is present and target is 1.12.0+, emit a deprecation warning with migration hint to `domain_resolver`. Consider hiding `domain_strategy` from new config creation on 1.12+ targets.

---

### P1 — `domain_resolver` rendered as plain text input, does not support object form

**Finding:** `domain_resolver` is typed in the official docs as `string | {}` (an object with the same fields as DNS route action, minus `action`). The Inspector renders it as `{ label: "Domain Resolver", path: ["domain_resolver"], kind: "text" }` — a plain text input. Setting a string value (the `server` tag shorthand) works correctly. However, the object form (for specifying `server`, `client_subnet`, `rewrite_ttl`, etc.) cannot be set.

For `direct` outbound this is particularly relevant: `domain_resolver` controls how the forwarded domain is resolved, and advanced resolver options require the object form.

**Recommendation (P2 priority for now):** Accept the text input as an acceptable v1 for the string shorthand. Add a `JsonField` fallback or a structured sub-form for the object form in a follow-up.

---

## Implementation Tasks

### Task 1 — Expand `dialSharedFields` with missing dial fields (P0)

**File:** `src/components/Inspector.tsx`

Replace:
```ts
const dialSharedFields = [
  "detour",
  "bind_interface",
  "connect_timeout",
  "domain_resolver",
  "network_strategy",
  "network_type",
  "fallback_network_type",
  "fallback_delay",
];
```

With:
```ts
const dialSharedFields = [
  "detour",
  "bind_interface",
  "inet4_bind_address",
  "inet6_bind_address",
  "bind_address_no_port",
  "routing_mark",
  "reuse_addr",
  "netns",
  "connect_timeout",
  "tcp_fast_open",
  "tcp_multi_path",
  "disable_tcp_keep_alive",
  "tcp_keep_alive",
  "tcp_keep_alive_interval",
  "udp_fragment",
  "domain_resolver",
  "network_strategy",
  "network_type",
  "fallback_network_type",
  "fallback_delay",
  "domain_strategy",  // deprecated but must survive round-trip
];
```

---

### Task 2 — Add missing dial field definitions to `sharedFieldDefinitionsFor` (P0)

**File:** `src/components/Inspector.tsx` — the `if (group === "dial")` branch (lines 881–891)

Extend the returned array:
```ts
if (group === "dial") {
  return [
    { label: "Detour", path: ["detour"], kind: "select", options: outboundOptions },
    { label: "Bind Interface", path: ["bind_interface"], kind: "text" },
    { label: "IPv4 Bind Address", path: ["inet4_bind_address"], kind: "text" },
    { label: "IPv6 Bind Address", path: ["inet6_bind_address"], kind: "text" },
    { label: "Bind Address No Port", path: ["bind_address_no_port"], kind: "boolean" },
    { label: "Routing Mark", path: ["routing_mark"], kind: "number" },
    { label: "Reuse Address", path: ["reuse_addr"], kind: "boolean" },
    { label: "Network Namespace", path: ["netns"], kind: "text" },
    { label: "Connect Timeout", path: ["connect_timeout"], kind: "text" },
    { label: "TCP Fast Open", path: ["tcp_fast_open"], kind: "boolean" },
    { label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" },
    { label: "Disable TCP Keep Alive", path: ["disable_tcp_keep_alive"], kind: "boolean" },
    { label: "TCP Keep Alive", path: ["tcp_keep_alive"], kind: "text" },
    { label: "TCP Keep Alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" },
    { label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" },
    { label: "Domain Resolver", path: ["domain_resolver"], kind: "text" },
    { label: "Network Strategy", path: ["network_strategy"], kind: "select", options: networkStrategyOptions },
    { label: "Network Type", path: ["network_type"], kind: "list" },
    { label: "Fallback Network", path: ["fallback_network_type"], kind: "list" },
    { label: "Fallback Delay", path: ["fallback_delay"], kind: "text" },
    // domain_strategy is deprecated; omit from new creation but do not hide if present
  ];
}
```

Note: `routing_mark`, `reuse_addr`, and `netns` were previously only in `listenSharedFields`. Do **not** remove them from `listenSharedFields` (they are also valid there for inbound/service). Simply add them to `dialSharedFields` as well.

---

### Task 3 — Add deprecation diagnostic for `override_address` / `override_port` on 1.13+ (P1)

**File:** `src/domain/diagnostics.ts`

Add a check: for each `outbound` in `config.outbounds` where `outbound.type === "direct"`, if `outbound.override_address` or `outbound.override_port` is set and the active target version is `>= 1.13`, emit:

```ts
{
  id: "deprecated-direct-override-fields",
  severity: "warning",
  message: `Direct outbound "${tag}" uses deprecated override_address/override_port. Migrate to route.rules[].action override fields.`,
}
```

---

### Task 4 — Add deprecation diagnostic for `domain_strategy` on 1.12+ (P1)

**File:** `src/domain/diagnostics.ts`

Add a check: for each `outbound` where `outbound.detour` field is not set and `outbound.domain_strategy` is present and target is `>= 1.12`, emit:

```ts
{
  id: "deprecated-direct-domain-strategy",
  severity: "warning",
  message: `Direct outbound "${tag}" uses deprecated domain_strategy. Migrate to domain_resolver.`,
}
```

---

## Done Criteria

- Inspector "Dial Fields" section for `outbound:direct` shows all 20 current dial fields (excluding deprecated `domain_strategy` from creation UI).
- `tcp_fast_open`, `udp_fragment`, `routing_mark`, `inet4_bind_address`, `inet6_bind_address` can be toggled/entered for a new `direct` outbound from the Inspector without touching JSON.
- `AdvancedScalarFields` no longer shows redundant entries for any dial field that is now in `dialSharedFields`.
- Importing a config with `override_address` / `override_port` on a 1.13+ target emits a warning diagnostic.
- Importing a config with `domain_strategy` on a 1.12+ target emits a deprecation diagnostic.
- All dial field edits round-trip correctly to exported JSON.
- Canvas input ports (all 8) and output port (`dial-detour`) remain correct and unchanged.
- Palette entry `kind: "direct"`, `ready: true`, `docsUrl: outbound/direct/` is correct — no changes needed.
