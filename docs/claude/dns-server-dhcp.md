<!-- Auto-generated deep review. Source: official stable/testing dhcp.md + sharedFieldRegistry + Inspector + SbcNode + commands. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# DNS Server / dhcp — Deep UI Review

## Scope

- Node ID: `dns-server:dhcp`
- Palette kind: `dns-dhcp`
- Official model: `dns/server/dhcp.md` (stable = testing, identical content)
- Available since: sing-box 1.12.0
- Baseline: `docs/ui-reviews/dns-server-dhcp.md`

---

## Official Field Model

### Own fields (`type: "dhcp"`)

| Field | Required | Default | Notes |
|---|---|---|---|
| `tag` | yes | — | Inherited from common DNS server structure |
| `type` | yes | — | Must be `"dhcp"` |
| `interface` | no | default interface | Network interface name to listen on; uses system default when omitted |

### Shared Dial Fields (all apply to `type: "dhcp"`)

`dhcp` is included in `dnsServerDialTypes` (sharedFieldRegistry.ts line 156) because it is in `CREATABLE_DNS_SERVER_TYPES` and is not filtered out (only `hosts`, `fakeip`, `tailscale`, `resolved` are excluded). Therefore all standard Dial Fields apply:

| Field | Since | Notes |
|---|---|---|
| `detour` | — | Tag of upstream outbound |
| `bind_interface` | — | Network interface to bind |
| `inet4_bind_address` | — | IPv4 bind address |
| `inet6_bind_address` | — | IPv6 bind address |
| `bind_address_no_port` | 1.13.0 | Linux only |
| `routing_mark` | — | Linux only |
| `reuse_addr` | — | Reuse listener address |
| `netns` | 1.12.0 | Linux only; network namespace name or path |
| `connect_timeout` | — | Go duration string |
| `tcp_fast_open` | — | Enable TCP Fast Open |
| `tcp_multi_path` | — | Requires Go 1.21 |
| `disable_tcp_keep_alive` | 1.13.0 | — |
| `tcp_keep_alive` | 1.13.0 | Default `5m` |
| `tcp_keep_alive_interval` | 1.13.0 | Default `75s` |
| `udp_fragment` | — | Enable UDP fragmentation |
| `domain_resolver` | 1.12.0 | Resolves domain names in dial targets |
| `network_strategy` | 1.11.0 | Mobile clients with `auto_detect_interface` only |
| `network_type` | 1.11.0 | Mobile only |
| `fallback_network_type` | 1.11.0 | Mobile only |
| `fallback_delay` | 1.11.0 | Default `300ms` |
| `domain_strategy` | — | **Deprecated** in 1.12.0 |

Total official fields: **24** (3 own + 21 dial fields including deprecated `domain_strategy`)

**Key behavioral note:** The DHCP DNS server derives resolvers from the DHCP lease of a specified network interface. The `interface` field selects which interface's DHCP-provided DNS servers are used. This server type requires OS-level DHCP access and may require elevated privileges on some platforms. No platform gate exists in the current stable or testing docs, but this is an implicit requirement.

---

## Left: Add Library (Palette)

### Current state

```
{ label: "DHCP Server", kind: "dns-dhcp", icon: Network, docsUrl: docs("dns/server/dhcp/"), status: "setup" }
```

`status: "setup"` renders a "Setup" badge. The label and icon are present.

### Findings

- Label "DHCP Server" is accurate and matches the official doc type name.
- `docsUrl` maps to `dns/server/dhcp/` — correct official page.
- `status: "setup"` is consistent with all peer DNS server entries that do not yet have full validation coverage (e.g., `dns-udp`, `dns-tls`, `dns-quic`). Acceptable.
- `icon: Network` (the network/NIC icon) is a reasonable choice given the interface-centric nature of this server type.
- No platform or privilege gate is shown in the Palette entry. Since `dns-mdns` is the only DNS server with `status: "gated"`, and the official docs for `dhcp` mention no explicit gate condition, leaving `status: "setup"` is defensible. However, a UX note (not a P0) would help users understand that DHCP DNS requires a running DHCP client on the named interface.

---

## Middle: Canvas Node (SbcNode)

### Current state

- `kind: "dns-server"`, `type` resolved from config as `"dhcp"`.
- Title bar renders: `dns-server / dhcp`.
- Status: driven by `diagnosticStatus` for the server index.
- No type-specific ports added beyond the base dns-server spec.

### Ports

**Input ports** (left side, `portsFor(kind, type, ..., "input")`):

| Port key | Label | Connected when |
|---|---|---|
| `dns` | DNS final server | `config.dns.final === tag` |
| `dns-rule` | DNS rule | Any DNS rule's `server === tag` |

**Output ports** (right side, `portsFor(kind, type, ..., "output")`):

| Port key | Label | Connected when |
|---|---|---|
| `outbound` | Detour outbound | `server.detour` is set |

No `endpoint` output port (only `tailscale` type gets one). Correct per spec — DHCP has no endpoint reference.

### Findings

- Port semantics are correct. DHCP does not reference an endpoint or require special output connections beyond dial detour.
- The `isPortConnected` check for `dns-server && portKey === "outbound"` reads `server.detour` — correct.
- Title bar shows `dns-server / dhcp`, exposing the internal kind/type string. This is a cosmetic P2 consistent with all other DNS server types.

---

## Right: Inspector

### Field coverage analysis

#### `dnsServerHandledFields` set (Inspector.tsx line 142–153)

```ts
const dnsServerHandledFields = new Set([
  "tag", "type",
  "address", "server", "server_port",
  "path", "endpoint",
  "tls",
  "neighbor_domain",
  ...dialSharedFields,  // detour, bind_interface, connect_timeout, domain_resolver,
                        // network_strategy, network_type, fallback_network_type, fallback_delay
]);
```

#### `interface` field — the critical own field for dhcp

**P0 finding:** The `interface` field is **not** in `dnsServerHandledFields` and is **not** in any explicit Inspector control block for `dns-server`. It is also not in `dialSharedFields`.

Consequence: When a `dhcp` server is created (commands.ts line 636–642), the default template sets `interface: "auto"`. This value is present in the entity object. Since `interface` is not in `dnsServerHandledFields`, it will appear in `AdvancedScalarFields` as a raw text input with the auto-generated label "Interface". This means the field technically round-trips (if the value is a plain string), but:

1. It is buried under the "Advanced fields" disclosure, with no front-panel visibility.
2. The label "Interface" is auto-generated and provides no hint about what values are valid (interface names or `"auto"`).
3. If the user never expands Advanced fields, they may not know the `interface` field exists or that the default is `"auto"`.

For a field that is the **defining characteristic of the dhcp server type** (it determines which NIC's DHCP DNS is used), this is a significant UX gap. It should be a first-class Inspector control rendered inline for `entityType === "dhcp"`, parallel to how `server`/`server_port` are rendered for tcp/udp, and `endpoint` is rendered for tailscale.

#### Explicit Inspector controls for `dns-server` (lines 1548–1605)

| Field | Rendered? | Control type | Notes |
|---|---|---|---|
| `address` | Yes (if present) | text input | Not used by dhcp |
| `server` | Yes (if present) | text input | Not used by dhcp |
| `server_port` | Yes (if present) | number input | Not used by dhcp |
| `path` | Yes (if present) | text input | Not used by dhcp |
| `endpoint` (tailscale) | Yes (type-gated: `entityType === "tailscale"`) | select | Not used by dhcp |
| `interface` (dhcp) | **No explicit control** | Falls to AdvancedScalarFields | **P0** |

There is no `entityType === "dhcp"` branch in the dns-server Inspector block. The `interface` field is not in `dnsServerHandledFields`, so it escapes to `AdvancedScalarFields`.

#### Default template (commands.ts line 636–642)

```ts
if (type === "dhcp") {
  return {
    type,
    tag,
    interface: "auto",
  };
}
```

The default `"auto"` value means "use the default interface". This is consistent with the official doc ("The default interface will be used by default"). The template is correct, but the field needs a proper UI control to be useful.

#### Dial group

`dhcp` is in `dnsServerDialTypes` (not filtered out), so `sharedGroupsForEntity` returns `["dial"]` for `dns-server` of type `dhcp`. The dial group renders `detour`, `bind_interface`, `connect_timeout`, `domain_resolver`, `network_strategy`, `network_type`, `fallback_network_type`, `fallback_delay` as labeled controls. This is correct.

#### Gap analysis against official fields for `type: "dhcp"`

| Official field | In Inspector? | Notes |
|---|---|---|
| `tag` | yes — text input | Correct |
| `type` | yes — select | Correct |
| `interface` | **no explicit control** | Falls to AdvancedScalarFields; P0 |
| `detour` (dial) | yes — select | Correct |
| `bind_interface` (dial) | yes — text | Correct |
| `connect_timeout` (dial) | yes — text | Correct |
| `domain_resolver` (dial) | yes — text | Correct |
| `network_strategy` (dial) | yes — select | Correct |
| `network_type` (dial) | yes — list | Correct |
| `fallback_network_type` (dial) | yes — list | Correct |
| `fallback_delay` (dial) | yes — text | Correct |
| `inet4_bind_address` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `inet6_bind_address` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `bind_address_no_port` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `routing_mark` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `reuse_addr` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `netns` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `tcp_fast_open` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `tcp_multi_path` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `disable_tcp_keep_alive` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `tcp_keep_alive` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `tcp_keep_alive_interval` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `udp_fragment` (dial) | no | Falls to AdvancedScalarFields (P1, shared gap) |
| `domain_strategy` (deprecated) | no | Deprecated; should be in handled set (P1, shared gap) |

**`interface` not in `dnsServerHandledFields`:** Unlike the dial gap fields (which at least appear in AdvancedScalarFields when present), `interface` being absent from the handled set means it escapes to AdvancedScalarFields. The difference from other types is that for dhcp, `interface` is always present (the template sets it). The field will always show in AdvancedScalarFields, but without an obvious label or positioning, users may not connect "Interface" in Advanced to the conceptual question "which NIC's DHCP lease?".

---

## Priority Findings

### P0 — `interface` field has no first-class Inspector control for `type: "dhcp"`

**Location:** `src/components/Inspector.tsx`, dns-server block lines 1548–1605.

**Issue:** The `interface` field is the only type-specific field for dhcp and it defines which network interface's DHCP-provided DNS server(s) are used. It is not in `dnsServerHandledFields` and has no explicit `entityType === "dhcp"` rendering branch. It falls to `AdvancedScalarFields` with an auto-generated "Interface" label — buried under a disclosure element.

This is a correctness/usability gap: the field is always present in the default template (`"auto"`), the user needs to see and edit it, and the current rendering does not prioritize it.

**Fix — two steps:**

Step 1: Add `"interface"` to `dnsServerHandledFields` so it is excluded from `AdvancedScalarFields`:
```ts
const dnsServerHandledFields = new Set([
  "tag", "type",
  "address", "server", "server_port",
  "path", "endpoint",
  "interface",        // add this
  "tls",
  "neighbor_domain",
  ...dialSharedFields,
]);
```

Step 2: Add an explicit `entityType === "dhcp"` branch in the dns-server Inspector block to render `interface` as a labeled text input (front panel, not Advanced):
```tsx
{entityType === "dhcp" ? (
  <label className="field">
    <span>Interface</span>
    <input
      value={String(entity.interface ?? "auto")}
      onChange={(event) => updateField(ref, "interface", event.target.value || undefined)}
    />
  </label>
) : null}
```

Place this block after the `path` field control and before the `endpoint` (tailscale) control, consistent with how other type-specific fields are ordered.

### P1 — No diagnostic for missing or invalid `interface` value

**Location:** `src/domain/diagnostics.ts`, dns-server validation block (lines 284–303).

**Issue:** The `interface` field defaults to `"auto"`, but if a user sets it to an empty string or a non-existent interface name, there is no diagnostic. While sing-box does not validate interface names at config parse time (they are OS-level), the UI could at least warn on empty string.

**Fix:**
```ts
if (server.type === "dhcp" && server.interface === "") {
  push(diagnostics, "warning", "dns-server-dhcp-empty-interface",
    `/dns/servers/${index}/interface`,
    `DHCP DNS server "${server.tag}" has an empty "interface". Omit the field or use "auto" to use the system default interface.`);
}
```

### P1 — `dialSharedFields` missing several official dial fields (shared gap, applies to dhcp)

**Location:** `src/components/Inspector.tsx` line 105–114.

**Issue:** The following dial fields are absent from `dialSharedFields` and rendered only through `AdvancedScalarFields` (no labeled control). This applies to all dns-server types including dhcp:
- `inet4_bind_address`, `inet6_bind_address`, `bind_address_no_port`
- `routing_mark`, `reuse_addr`, `netns`
- `tcp_fast_open`, `tcp_multi_path`
- `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`
- `udp_fragment`
- `domain_strategy` (deprecated — should be in handled set)

This is a shared gap documented in peer reviews (dns-server-tcp.md). It is included here for completeness and to ensure the dhcp review is self-contained.

---

## Implementation Tasks

1. **[P0]** Add `"interface"` to `dnsServerHandledFields` in `src/components/Inspector.tsx` (line 142–153) to prevent the field from appearing in `AdvancedScalarFields`.

2. **[P0]** Add an `entityType === "dhcp"` branch in the dns-server Inspector block (`src/components/Inspector.tsx`, around line 1587) to render `interface` as a front-panel labeled text input with placeholder hint `"auto"` (uses system default interface).

3. **[P1]** Add a `dns-server-dhcp-empty-interface` warning diagnostic in `src/domain/diagnostics.ts` for the case where `server.type === "dhcp"` and `server.interface === ""`.

4. **[P1]** (Shared) Extend `dialSharedFields` in `src/components/Inspector.tsx` to include at minimum `routing_mark` (number), `reuse_addr` (boolean), `tcp_fast_open` (boolean), `netns` (text), and add `domain_strategy` (deprecated) to the handled set — applies to all dns-server types including dhcp.

5. **[P2]** Canvas node title bar shows `dns-server / dhcp`. Consider supplementing with the human label "DHCP Server" to match the Library label and reduce jargon exposure.

---

## Done Criteria

- Adding dns-dhcp from Library creates a node with `{ type: "dhcp", tag: "dhcp-dns", interface: "auto" }` in `dns.servers[]`.
- Inspector renders an "Interface" text input on the front panel (not inside Advanced fields) for dhcp nodes, showing the current value (`"auto"` by default).
- Changing the `interface` value in Inspector updates the canonical JSON; exporting and re-importing round-trips the value correctly.
- Setting `interface` to `""` in Inspector triggers a warning diagnostic on the canvas node.
- `detour` select renders all available outbound tags; selecting one writes `detour` to the server object and shows the canvas edge.
- Type-switching from `dhcp` to another type in Inspector preserves `detour` and does not corrupt the config.
- Export of a dhcp dns server config (with a non-`"auto"` interface name) round-trips through import without data loss.
