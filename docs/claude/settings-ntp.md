<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Settings / NTP UI Review (Claude Deep Review)

## Scope
- Editable node: `settings:ntp`
- Official doc (stable): `ntp/index.md`
- Official doc (testing): `ntp/index.md` — identical to stable, no testing diff
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Official Model

### Writable fields (stable)

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `enabled` | boolean | no | `false` | Enables the NTP client service |
| `server` | string | **yes** | — | NTP server address |
| `server_port` | integer | no | `123` | NTP server UDP port |
| `interval` | duration string | no | `"30m"` | Time synchronisation interval |
| *(Dial Fields)* | — | — | — | See shared/dial.md |

#### Dial Fields (from shared/dial.md, applicable to `ntp`)

| Field | Type | Required | Default | Version gate | Notes |
|---|---|---|---|---|---|
| `detour` | string (outbound tag) | no | — | — | Upstream outbound; all other dial fields are ignored if set |
| `bind_interface` | string | no | — | — | Network interface to bind |
| `inet4_bind_address` | string | no | — | — | IPv4 address to bind |
| `inet6_bind_address` | string | no | — | — | IPv6 address to bind |
| `bind_address_no_port` | boolean | no | — | 1.13.0, Linux only | Do not reserve port when binding |
| `routing_mark` | integer | no | — | Linux only | netfilter routing mark (int or hex string) |
| `reuse_addr` | boolean | no | — | — | Reuse listener address |
| `netns` | string | no | — | 1.12.0, Linux only | Network namespace (name or path) |
| `connect_timeout` | duration string | no | — | — | golang Duration format |
| `tcp_fast_open` | boolean | no | — | — | TCP Fast Open |
| `tcp_multi_path` | boolean | no | — | Go 1.21 required | TCP Multi Path |
| `disable_tcp_keep_alive` | boolean | no | — | 1.13.0 | Disable TCP keep-alive |
| `tcp_keep_alive` | duration string | no | `"5m"` | 1.13.0 | TCP keep-alive initial period |
| `tcp_keep_alive_interval` | duration string | no | `"75s"` | 1.13.0 | TCP keep-alive interval |
| `udp_fragment` | boolean | no | — | — | UDP fragmentation |
| `domain_resolver` | string or object | no | — | 1.12.0; required in 1.14.0 for domain server addresses | DNS resolver for server address resolution |
| `network_strategy` | string enum | no | `"default"` | 1.11.0, mobile only | `default`, `hybrid`, `fallback` |
| `network_type` | string[] | no | — | 1.11.0, mobile only | `wifi`, `cellular`, `ethernet`, `other` |
| `fallback_network_type` | string[] | no | — | 1.11.0, mobile only | Fallback network types for `fallback` strategy |
| `fallback_delay` | duration string | no | `"300ms"` | 1.11.0, mobile only | Fast-fallback delay |
| `domain_strategy` | string enum | no | — | Deprecated 1.12.0, removed 1.14.0 | `prefer_ipv4`, `prefer_ipv6`, `ipv4_only`, `ipv6_only` |

**Note:** `write_to_system` is not listed in either stable or testing official docs. Not a real field.

### Cross-version diff (testing)

No testing diff — testing `ntp/index.md` is byte-for-byte identical to stable.

### Relationship model

- **Outgoing reference:** `detour` -> outbound tag (one outbound node).
- **Incoming references:** none. NTP is a global-settings singleton, not a tag-addressable resource.

### Compat / Target gate

- No explicit version gate on the NTP module itself.
- Several dial sub-fields are version-gated: `bind_address_no_port` (1.13.0), `netns` (1.12.0), `domain_resolver` (1.12.0), `network_strategy`/`network_type`/`fallback_network_type`/`fallback_delay` (1.11.0), `tcp_keep_alive`/`tcp_keep_alive_interval`/`disable_tcp_keep_alive` (1.13.0).
- `domain_strategy` is deprecated in 1.12.0 and removed in 1.14.0.
- `tcp_multi_path` requires Go 1.21 build.
- `network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay` only work on Android / Apple graphical clients with `auto_detect_interface` enabled.

---

## Left: Add Library

**Current implementation** (`src/components/Palette.tsx`, line 102):

```
{ label: "NTP Settings", kind: "settings-ntp", icon: Clock3, docsUrl: docs("ntp/"), status: "setup" }
```

- label: `"NTP Settings"` — clear and human-readable.
- kind: `"settings-ntp"` — correctly maps to palette kind.
- docsUrl: `docs("ntp/")` — points to correct official doc.
- status: `"setup"` — the item is shown as a setup/stub item.

**Findings:**

- The `status: "setup"` badge may render as a disabled/stub affordance without clearly telling the user what clicking it does (open the global NTP settings form, or add a canvas node). The Palette spec (`docs/experimental-ui-review.md`) says the action must be explicit (`ADD`, `SETUP`, `OPEN`).
- There is no target-version gate despite some NTP dial sub-fields being version-specific. The NTP module itself has no gate so a simple `status: "setup"` is acceptable.

**Recommendation:**

- Change the action label or tooltip to state the effect: "Open NTP settings" or "Enable NTP".
- Optionally badge the docs link separately so it does not double as a disabled-state indicator.

---

## Middle: Canvas Node

**Current implementation** (`src/canvas/graph.ts`, lines 42, 184–205):

- `settings:ntp` is included in `SETTINGS_NODE_IDS` (line 42).
- A node is conditionally added when `config.ntp` is non-null and non-empty (lines 184–204).
- Node data: `kind: "settings"`, `type: "ntp"`, `title: "Ntp"`, `subtitle: "global settings"`.
- Layout column: `COLUMNS.settings` = x=-300, stacked vertically with other settings nodes at `ROUTE_HUB_Y + index * NODE_SLOT_Y`.

**Port analysis** (`src/components/SbcNode.tsx`, `getPortSpecs`):

- `kind === "settings"` falls through to the final `return []` on both input and output directions (lines 133, 198).
- **Neither input nor output ports are returned for any settings node, including NTP.**
- Graph edge generation (`graph.ts` lines 622–666): no edge is generated for `config.ntp.detour`. Other nodes (endpoint, service, dns-server, outbound) each have explicit edge-generation loops; NTP has none.

**Findings:**

- **P0: NTP `detour` canvas edge is missing.** The Inspector renders `detour` as a select (via the shared dial group), and `sharedFieldRegistry.ts` line 203 correctly registers `ntp` as a dial owner, but `graph.ts` never reads `config.ntp?.detour` to emit a canvas edge. The NTP canvas node appears isolated even when a valid `detour` outbound is configured.
- **P1: No output port on settings node for NTP.** `getPortSpecs` returns `[]` for `kind === "settings"` regardless of path. A `"dial-detour"` output port should be added for `settings:ntp` (type `"ntp"`) to expose the `detour` reference visually.
- Title capitalisation: `"Ntp"` (from `path[0].toUpperCase() + path.slice(1)`) should read `"NTP"` — this is an acronym.

**Recommendation:**

1. Add an output port for `settings:ntp` in `getPortSpecs` (output branch) that mirrors the dns-server / endpoint pattern.
2. Add an edge-generation block in `graph.ts` (after the services loop, before `return`) for `config.ntp?.detour`.
3. Fix the title string to `"NTP"`.

---

## Right: Inspector

**Current implementation** (`src/components/Inspector.tsx`, lines 1284–1316):

```tsx
{ref.kind === "settings" && ref.path === "ntp" ? (
  <>
    <label className="toggle-row">           // enabled (boolean checkbox)
    <label className="field">               // server (text input)
    <label className="field">               // server_port (number input, default 123)
    <label className="field">               // interval (text input, default "30m")
  </>
) : null}
```

**Shared dial group** (`src/domain/sharedFieldRegistry.ts`, line 203):

```ts
if (ref.kind === "settings" && ref.path === "ntp") groups.push("dial");
```

The generic `"dial"` group renders (Inspector.tsx lines 881–891):

```
Detour (select -> outbound tags)
Bind Interface (text)
Connect Timeout (text)
Domain Resolver (text)
Network Strategy (select: default/hybrid/fallback)
Network Type (list)
Fallback Network (list)
Fallback Delay (text)
```

**Gap analysis against official Dial Fields:**

| Official field | Inspector coverage | Control type | Issue |
|---|---|---|---|
| `enabled` | Yes (line 1286) | checkbox | OK |
| `server` | Yes (line 1294) | text | OK — but missing required-field validation |
| `server_port` | Yes (line 1301) | number | OK |
| `interval` | Yes (line 1309) | text | OK |
| `detour` | Yes via dial group (line 883) | select | OK — correct outbound select |
| `bind_interface` | Yes via dial group (line 884) | text | OK |
| `connect_timeout` | Yes via dial group (line 885) | text | OK |
| `domain_resolver` | Yes via dial group (line 886) | text | Should be outbound/dns-server select (complex type in 1.12.0+) |
| `network_strategy` | Yes via dial group (line 887) | select | OK |
| `network_type` | Yes via dial group (line 888) | list | OK |
| `fallback_network_type` | Yes via dial group (line 889) | list | OK |
| `fallback_delay` | Yes via dial group (line 890) | text | OK |
| `inet4_bind_address` | **Missing** | — | P1: not in dial group or NTP-specific block |
| `inet6_bind_address` | **Missing** | — | P1: not in dial group or NTP-specific block |
| `bind_address_no_port` | **Missing** | — | P2: 1.13.0 gated |
| `routing_mark` | **Missing** | — | P2: Linux-only |
| `reuse_addr` | **Missing** | — | P2: present in listenSharedFields but not dialSharedFields |
| `netns` | **Missing** | — | P2: 1.12.0, Linux-only |
| `tcp_fast_open` | **Missing** | — | P2: in listenSharedFields but not dialSharedFields |
| `tcp_multi_path` | **Missing** | — | P2: Go 1.21 |
| `disable_tcp_keep_alive` | **Missing** | — | P2: 1.13.0 gated |
| `tcp_keep_alive` | **Missing** | — | P2: 1.13.0 gated |
| `tcp_keep_alive_interval` | **Missing** | — | P2: 1.13.0 gated |
| `udp_fragment` | **Missing** | — | P2 |
| `domain_strategy` | **Missing** | — | P2: deprecated, omit or show with deprecation notice |

**Additional Inspector findings:**

- `server` has no required-field semantic validation. If `enabled` is `true` and `server` is empty, the config is invalid (official doc marks `server` as `==Required==`).
- `dialSharedFields` array (line 105–114) defines the "handled fields" set used to suppress the unknown-fields passthrough. It is missing `inet4_bind_address`, `inet6_bind_address`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `bind_address_no_port`, and `domain_strategy`. These will leak through as raw JSON passthrough controls if they are present in imported configs.

**Recommendation:**

1. Add the missing dial fields to `dialSharedFields` so they do not leak as unhandled.
2. Add the missing fields to the generic `"dial"` group definition (Inspector.tsx lines 881–891) with correct control types.
3. Add semantic diagnostic: `server` must be non-empty when `enabled === true`.
4. `detour` control already uses `outbound select` — correct. No change needed there.

---

## Tag Reference Surfaces

| Field | Direction | Target kind | Current control | Status |
|---|---|---|---|---|
| `detour` | NTP -> outbound | outbound tag | `select` (via dial group, line 883) | OK in Inspector, **missing canvas edge** (P0) |

---

## Priority Findings

### P0
- **NTP `detour` canvas edge is never emitted.** `graph.ts` generates edges for outbound/endpoint/service/dns-server/rule-set detour references but has no block for `config.ntp?.detour`. A user who sets `detour` via the Inspector sees a correct JSON export but a broken canvas with no visual connection to the outbound node.

### P1
- **No output port on the NTP canvas node for `detour`.** `getPortSpecs` falls through to `return []` for `kind === "settings"`. A `"dial-detour"` output handle should be added for the `"ntp"` type to make the detour edge renderable.
- **Missing `inet4_bind_address` and `inet6_bind_address` in Inspector dial group.** These are standard dial fields listed in official docs and used commonly; absence means they cannot be set via the UI.

### P2
- **Node title renders as `"Ntp"` instead of `"NTP"`** (graph.ts line 196, naive `toUpperCase` on first char only).
- **dialSharedFields does not declare `inet4_bind_address`, `inet6_bind_address`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `bind_address_no_port`, `domain_strategy`.** Imported configs with these fields will render as raw passthrough unknowns rather than typed controls.
- **`domain_resolver` is rendered as a plain text input** but in 1.12.0+ it accepts either a string (DNS server tag) or an object. It should at minimum be a select over DNS server tags for the string form.
- **No semantic diagnostic for `server` being empty when `enabled === true`.** The official doc marks `server` as `==Required==`.

---

## Implementation Tasks

### Task 1 — Fix NTP canvas title (P2, trivial)
**File:** `src/canvas/graph.ts`, line ~196.

Replace the generic `path[0].toUpperCase() + path.slice(1)` title with a lookup that returns `"NTP"` for `path === "ntp"`.

```ts
// Before:
title: path[0] ? `${path[0].toUpperCase()}${path.slice(1)}` : path,
// After (add a lookup before the generic case):
title: path === "ntp" ? "NTP" : path === "log" ? "Log" : path[0] ? `${path[0].toUpperCase()}${path.slice(1)}` : path,
```

Scope: one line in graph.ts.

---

### Task 2 — Add NTP output port for detour (P1)
**File:** `src/components/SbcNode.tsx`, `getPortSpecs` output branch.

Add before the final `return []`:

```ts
if (kind === "settings" && type === "ntp") {
  return [{ key: "dial-detour", label: "Dial detour outbound", nodeKind: "outbound", icon: Network }];
}
```

Scope: 3 lines in SbcNode.tsx, no type changes needed.

---

### Task 3 — Emit NTP detour canvas edge (P0)
**File:** `src/canvas/graph.ts`, after the services loop (after line ~667, before `return { nodes, edges }`).

```ts
if (config.ntp && typeof config.ntp.detour === "string" && config.ntp.detour) {
  edges.push(
    makeEdge(
      `edge:ntp-detour:${config.ntp.detour}`,
      "settings:ntp",
      `outbound:${config.ntp.detour}`,
      "dial-detour",
      "detour-target",
    ),
  );
}
```

Also update `isPortConnected` in SbcNode.tsx to handle the `outbound` side recognising NTP as a source of `detour-target` connections (currently only outbound→outbound and endpoint→outbound and service→outbound are checked at lines 266–277).

Scope: ~8 lines in graph.ts, ~4 lines in SbcNode.tsx `isPortConnected`.

---

### Task 4 — Add missing dial fields to Inspector dial group (P1/P2)
**File:** `src/components/Inspector.tsx`.

4a. Extend `dialSharedFields` array (line 105) to include all official dial fields not currently listed:

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
  "domain_strategy",
];
```

4b. Extend the generic `"dial"` group return value (lines 881–891) with the missing fields:

```ts
if (group === "dial") {
  return [
    { label: "Detour", path: ["detour"], kind: "select", options: outboundOptions },
    { label: "Bind Interface", path: ["bind_interface"], kind: "text" },
    { label: "IPv4 Bind Address", path: ["inet4_bind_address"], kind: "text" },
    { label: "IPv6 Bind Address", path: ["inet6_bind_address"], kind: "text" },
    { label: "No Bind Port", path: ["bind_address_no_port"], kind: "boolean" },
    { label: "Routing Mark", path: ["routing_mark"], kind: "number" },
    { label: "Reuse Address", path: ["reuse_addr"], kind: "boolean" },
    { label: "Network Namespace", path: ["netns"], kind: "text" },
    { label: "Connect Timeout", path: ["connect_timeout"], kind: "text" },
    { label: "TCP Fast Open", path: ["tcp_fast_open"], kind: "boolean" },
    { label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" },
    { label: "Disable TCP Keep-Alive", path: ["disable_tcp_keep_alive"], kind: "boolean" },
    { label: "TCP Keep-Alive", path: ["tcp_keep_alive"], kind: "text" },
    { label: "TCP Keep-Alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" },
    { label: "UDP Fragment", path: ["udp_fragment"], kind: "boolean" },
    { label: "Domain Resolver", path: ["domain_resolver"], kind: "text" },
    { label: "Network Strategy", path: ["network_strategy"], kind: "select", options: networkStrategyOptions },
    { label: "Network Type", path: ["network_type"], kind: "list" },
    { label: "Fallback Network", path: ["fallback_network_type"], kind: "list" },
    { label: "Fallback Delay", path: ["fallback_delay"], kind: "text" },
  ];
}
```

Note: `domain_strategy` is deprecated; omit from the rendered list (it is declared in `dialSharedFields` only for passthrough suppression purposes).

Scope: ~25 line change to `dialSharedFields` + ~25 line change to dial group return. This change applies to ALL dial-group owners (outbounds, dns-servers, endpoints, route, ntp), so review impact carefully before applying.

---

### Task 5 — Semantic diagnostic for `server` required when `enabled` (P2)
**File:** wherever diagnostic rules are defined (not located in this pass; search for `diagnostics` in the domain layer).

Add a rule: when `config.ntp.enabled === true` and `(config.ntp.server == null || config.ntp.server === "")`, emit a diagnostic at `/ntp/server` of severity `error` with message `"NTP server address is required when NTP is enabled"`.

---

## Done Criteria

- [ ] Library entry: clicking opens NTP settings and the action is clearly labelled.
- [ ] Canvas node title reads `"NTP"` not `"Ntp"`.
- [ ] Canvas node exposes a `dial-detour` output port when `type === "ntp"`.
- [ ] Setting `detour` in the Inspector causes a canvas edge to the target outbound node.
- [ ] `detour` Inspector control is an outbound `select` (already OK — verify round-trip).
- [ ] `inet4_bind_address` and `inet6_bind_address` are editable in the Inspector dial group.
- [ ] All official dial fields are in `dialSharedFields` (no passthrough leakage for imported configs).
- [ ] Semantic diagnostic fires when `enabled = true` and `server` is empty.
- [ ] Library -> Inspector -> JSON export round-trip verified.
- [ ] At least one fixture or e2e test covers: create NTP node, set server + detour, export JSON, re-import, verify canvas edge rendered.
- [ ] Both stable and testing docs read (done — no diff found).
