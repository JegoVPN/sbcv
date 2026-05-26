<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / redirect — Deep UI Review

> Source: official stable + testing docs (identical for this node), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, SbcNode.tsx, commands.ts.
> Review date: 2026-05-27.

---

## Platform Gate

**Official quote (stable == testing):**

> Only supported on Linux and macOS.

This is a transparent-proxy (iptables REDIRECT) inbound. It captures TCP traffic redirected at the OS level by iptables/nftables rules. Without the OS redirecting traffic into the listening port, this inbound is inert on any other platform. The UI carries zero platform gating today.

---

## Official Field Inventory

**Stable == Testing** — both versions have identical redirect inbound structure.

### Protocol-specific fields: 0

The redirect inbound has no protocol-specific fields beyond `type` and `tag`. The entire configurable surface is Listen Fields.

### Shared Listen Fields (15 active + 5 deprecated, via shared/listen.md)

| Field | Since | Notes |
|---|---|---|
| `listen` | — | **Required.** Listen address. |
| `listen_port` | — | Listen port. |
| `bind_interface` | 1.12.0 | Network interface to bind. |
| `routing_mark` | 1.12.0 | **Linux only.** netfilter routing mark. Integer or hex string. |
| `reuse_addr` | 1.12.0 | Reuse listener address. |
| `netns` | 1.12.0 | **Linux only.** Network namespace name or path. |
| `tcp_fast_open` | — | Enable TCP Fast Open. |
| `tcp_multi_path` | — | Go 1.21+ required. |
| `disable_tcp_keep_alive` | 1.13.0 | Disable TCP keep alive. |
| `tcp_keep_alive` | 1.13.0 | Keep alive initial period. Default `5m`. |
| `tcp_keep_alive_interval` | — | Keep alive interval. Default `75s`. |
| `udp_fragment` | — | Enable UDP fragmentation. |
| `udp_timeout` | — | UDP NAT expiration. Default `5m`. |
| `detour` | — | Forward connections to another inbound (requires target inbound support). |
| ~~`sniff`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`sniff_override_destination`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`sniff_timeout`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`domain_strategy`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`udp_disable_domain_unmapping`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |

Total official fields: **14 active listen fields + 0 protocol-specific = 14 meaningful fields** (excluding deprecated).

### Default scaffold written by `addInbound` (commands.ts line 243–249)

```json
{
  "type": "redirect",
  "tag": "<generated>",
  "listen": "127.0.0.1",
  "listen_port": 2080
}
```

The default scaffold is correct and minimal. `127.0.0.1` is a reasonable default for a transparent proxy capture point, though operators typically use `0.0.0.0` when iptables rules redirect from all interfaces.

---

## Left Panel — Palette (Add Library)

**Current state:**
```ts
{ label: "Redirect", kind: "inbound-redirect", icon: GitBranch, docsUrl: docs("inbound/redirect/"), status: "setup" }
```

### Findings

- Label `"Redirect"` is correct but context-free. Users unfamiliar with iptables REDIRECT may not understand this is a transparent-proxy inbound. A secondary label like "TCP Transparent (iptables)" would be clearer.
- `status: "setup"` renders a non-interactive badge with no ADD action. The node can neither be dragged nor clicked to create an inbound.
- `icon: GitBranch` is shared with TProxy and route rules — no semantic differentiation between transparent proxy inbounds.
- **No platform gate in Palette.** The item appears equally active on Windows/macOS/Linux. `status: "gated"` or a descriptive badge noting "Linux/macOS only" is absent.
- The Docs link target `docs("inbound/redirect/")` is correct.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"inbound"` (SbcNode.tsx lines 136–144, generic for all inbounds).

### Port Specification

```
Right output ports (all inbounds share these three):
  - "route"             → Route hub
  - "route-rule-match"  → Route rule matcher
  - "dns-rule-match"    → DNS rule matcher
```

No input ports. Correct: inbound is a source node in sing-box topology.

### Findings

- Port set is correct. Redirect has no special downstream connections; the three standard output ports apply.
- Node icon is `RadioTower` for all inbound kinds — redirect is visually indistinguishable from Mixed, TUN, SOCKS, etc.
- Canvas node renders `tag ?? ref.kind`. No secondary display of `listen_port`, which makes distinguishing multiple transparent-proxy inbounds on the canvas difficult.
- No platform annotation at canvas level — a warning badge or icon indicator for "Linux/macOS only" is absent.

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "inbound"`

1. **Tag** rename input.
2. **Type** select from `CREATABLE_INBOUND_TYPES` — includes `"redirect"`.
3. **Address** text input bound to `entity.address` — **does not apply to redirect**. The redirect inbound has no `address` field; `address` belongs to `tun` and `direct` inbounds.
4. **Auto route** checkbox bound to `entity.auto_route` — **does not apply to redirect**. This is a TUN-only field.
5. **AdvancedScalarFields** — spills remaining non-object, non-array fields not in `inboundHandledFields` into a generic accordion. For redirect this would show any extra scalar fields not explicitly handled.
6. **SharedFieldCards** — renders the `"listen"` section as a collapsible module card (driven by `sharedGroupsForEntity` returning `["listen"]` for any CREATABLE_INBOUND_TYPES member).

### `sharedGroupsForEntity` for redirect

From `sharedFieldRegistry.ts` line 165–171:
```ts
if (ref.kind === "inbound") {
  if ((CREATABLE_INBOUND_TYPES as readonly string[]).includes(entityType)) groups.push("listen");
  // tls: not in inboundTlsTypes (which does not include "redirect")
  // quic: not in inboundQuicTypes
  // multiplex: not in inboundMultiplexTypes
  // v2ray-transport: not in inboundTransportTypes
  // dial: not in inboundNestedDialTypes
}
```

Result: only `"listen"` group is pushed. **Correct** — redirect has no TLS, multiplex, transport, or nested dial.

### `listenSharedFields` rendered in Inspector (line 95–104)

```ts
["listen", "listen_port", "bind_interface", "routing_mark", "reuse_addr", "netns", "tcp_fast_open", "udp_timeout"]
```

**Missing from Inspector listen card (present in official docs):**
- `tcp_multi_path`
- `disable_tcp_keep_alive` (since 1.13.0)
- `tcp_keep_alive` (since 1.13.0)
- `tcp_keep_alive_interval`
- `udp_fragment`
- `detour`

These 6 fields are missing from the shared listen card across all inbound types including redirect.

### TLS section incorrectly available

`inboundTlsTypes` in `sharedFieldRegistry.ts` line 144 does not include `"redirect"`, so TLS is correctly absent for this inbound.

### `address` and `auto_route` rendered for redirect

The inspector unconditionally renders both `address` (line 1486) and `auto_route` (line 1493) for all `ref.kind === "inbound"`. Neither field exists in the redirect inbound JSON structure. These controls write phantom fields into the config that sing-box will either ignore or reject.

---

## Priority Findings

### P0 — Platform gate absent

**Severity:** P0 — Silent misconfiguration.

The redirect inbound is officially "Only supported on Linux and macOS." No gate exists in Palette, canvas, Inspector, or diagnostics. A user on Windows can add and export a redirect inbound without any warning. The `diagnostics.ts` file has a precedent for platform warnings (line 210: `"resolved-service-linux-only"`), but no equivalent warning exists for redirect or tproxy.

**Required action:** Add a `"warning"` diagnostic (code `"redirect-platform-warning"`) for any config that contains `type: "redirect"`, surfacing the Linux/macOS-only constraint. Consider adding `status: "gated"` or a tooltip in Palette noting platform requirement.

---

### P0 — `address` and `auto_route` spuriously rendered in Inspector

**Severity:** P0 — Writes invalid fields to exported JSON.

`address` and `auto_route` are TUN/direct-specific fields hardcoded into the shared inbound inspector block (lines 1486–1500). For redirect these controls write fields sing-box will not recognize or will error on. The inspector should conditionally render these only for types that support them (e.g., `tun` for `auto_route`, `direct` for `address`).

**Required action:** Guard `address` render with `entityType === "direct"` (or equivalent set). Guard `auto_route` render with `entityType === "tun"`.

---

### P1 — Six listen fields missing from Inspector shared card

**Severity:** P1 — Incomplete editing surface.

The `listenSharedFields` array (line 95–104) omits: `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour`. All are valid active fields per official docs. `detour` is especially relevant for transparent proxy chains. Users must hand-edit JSON to set these.

**Required action:** Extend `listenSharedFields` (and corresponding `sharedFieldDefinitions` for `group === "listen"`) to include the six missing fields.

---

### P1 — Palette `status: "setup"` blocks node creation

**Severity:** P1 — No ADD action available.

`status: "setup"` renders a non-functional badge. Users cannot add a redirect inbound from the library. Given that commands.ts already implements `addInbound("redirect", ...)` with a working scaffold, the Palette entry should use `ready: true` or `status: "add"` to enable the ADD action.

**Required action:** Promote `inbound-redirect` Palette status to `ready: true` once platform gate diagnostic is in place, or use `status: "add"` if the existing status system supports an intermediate state.

---

### P1 — Palette and canvas lack platform annotation

**Severity:** P1 — UX confusion on non-Linux platforms.

Both the Palette item and canvas node are visually identical to cross-platform inbounds. No tooltip, badge, or secondary label indicates Linux/macOS requirement. Operators setting up configs on macOS for a Linux target may be unaware of the constraint until runtime.

**Required action:** Add a tooltip or badge in Palette noting "Linux / macOS only". Consider a canvas node warning badge when the target platform is unknown or Windows.

---

## Implementation Tasks

1. **diagnostics.ts** — Add platform warning for `type === "redirect"`:
   - Code: `"redirect-platform-warning"`
   - Severity: `"warning"`
   - Path: `/inbounds/${index}`
   - Message: `"Redirect inbound requires Linux or macOS (iptables/pf REDIRECT). This config may not work on other platforms."`

2. **Inspector.tsx** — Guard `address` field render:
   - Condition: only render when `entityType === "direct"` (or a type-set that actually has `address`).

3. **Inspector.tsx** — Guard `auto_route` field render:
   - Condition: only render when `entityType === "tun"`.

4. **Inspector.tsx** (line 95–104) + `sharedFieldDefinitions` (line 849–859) — Add missing listen fields:
   - `tcp_multi_path` (boolean)
   - `udp_fragment` (boolean)
   - `disable_tcp_keep_alive` (boolean, since 1.13.0)
   - `tcp_keep_alive` (text, since 1.13.0)
   - `tcp_keep_alive_interval` (text)
   - `detour` (select from inbound tags, requires inbound-tag options list)

5. **Palette.tsx** — Promote `inbound-redirect` to `ready: true` (or equivalent) after platform diagnostic is in place. Add tooltip text noting Linux/macOS restriction.

6. **SbcNode.tsx** — Consider per-type canvas icon for transparent-proxy inbounds (redirect, tproxy) to distinguish from protocol inbounds visually.

7. **Inspector.tsx** (type selector, line 1194–1199) — Consider grouping or annotating platform-restricted inbound types (`redirect`, `tproxy`) within the type `<select>` to prevent silent misconfiguration when switching types.
