<!-- Auto-generated deep review. Source: official stable/testing tcp.md + sharedFieldRegistry + Inspector + SbcNode + commands. -->
# DNS Server / tcp — Deep UI Review

## Scope

- Node ID: `dns-server:tcp`
- Palette kind: `dns-tcp`
- Official model: `dns/server/tcp.md` (stable = testing, identical content)
- Available since: sing-box 1.12.0
- Baseline: `docs/ui-reviews/dns-server-tcp.md`

---

## Official Field Model

### Own fields (`type: "tcp"`)

| Field | Required | Default | Notes |
|---|---|---|---|
| `tag` | yes | — | Inherited from common DNS server structure |
| `type` | yes | — | Must be `"tcp"` |
| `server` | **required** | — | IP or domain; if domain, `domain_resolver` must also be set |
| `server_port` | no | `53` | Port of the DNS server |

### Shared Dial Fields (all apply to `type: "tcp"`)

| Field | Since | Notes |
|---|---|---|
| `detour` | — | Tag of upstream outbound; all other dial fields ignored when set |
| `bind_interface` | — | Network interface to bind |
| `inet4_bind_address` | — | IPv4 bind address |
| `inet6_bind_address` | — | IPv6 bind address |
| `bind_address_no_port` | 1.13.0 | Linux only |
| `routing_mark` | — | Linux only; int or hex string |
| `reuse_addr` | — | Reuse listener address |
| `netns` | 1.12.0 | Linux only; network namespace name or path |
| `connect_timeout` | — | Go duration string |
| `tcp_fast_open` | — | Enable TCP Fast Open |
| `tcp_multi_path` | — | Requires Go 1.21 |
| `disable_tcp_keep_alive` | 1.13.0 | Disable TCP keep-alive |
| `tcp_keep_alive` | 1.13.0 | Initial period; default `5m` |
| `tcp_keep_alive_interval` | 1.13.0 | Interval; default `75s` |
| `udp_fragment` | — | Enable UDP fragmentation |
| `domain_resolver` | 1.12.0 | Required when `server` is a domain name; replaces deprecated `domain_strategy` |
| `network_strategy` | 1.11.0 | `default`/`hybrid`/`fallback`; mobile clients with `auto_detect_interface` only |
| `network_type` | 1.11.0 | Mobile only |
| `fallback_network_type` | 1.11.0 | Mobile only |
| `fallback_delay` | 1.11.0 | Mobile only; default `300ms` |
| `domain_strategy` | — | **Deprecated** in 1.12.0, removal in 1.14.0 |

Total official fields: **22** (2 own + 20 dial fields; `domain_strategy` counted as deprecated)

**Key behavioral note from official docs:** The new TCP server uses a dialer like outbound (equivalent to empty direct outbound by default), unlike the legacy server which uses the default outbound unless `detour` is specified. The new server also uses `domain_resolver`/`domain_strategy` in Dial Fields, not `address_resolver`/`address_strategy`.

---

## Left: Add Library (Palette)

### Current state

```
{ label: "TCP Server", kind: "dns-tcp", icon: Server, docsUrl: docs("dns/server/tcp/"), status: "setup" }
```

`status: "setup"` renders a badge. The label is correct.

### Findings

- **No issues found.** The label "TCP Server" is accurate, the docsUrl maps to the correct official page, and `status: "setup"` is consistent with peer DNS server entries (`dns-udp`, `dns-tls`, `dns-quic`, etc.).
- The Docs link points to `dns/server/tcp/` which is valid.

---

## Middle: Canvas Node (SbcNode)

### Current state

- `kind: "dns-server"`, `type: server.type` (resolved from config).
- Title bar renders: `dns-server / tcp`.
- Subtitle: `tcp dns server`.
- Status: driven by `diagnosticStatus("/dns/servers/${index}", diagnostics)`.
- Compatible actions: `compatible: []` (empty array — no quick-create targets).

### Ports

**Input ports** (left side):

| Port key | Label | Connected when |
|---|---|---|
| `dns` | DNS final server | `config.dns.final === tag` |
| `dns-rule` | DNS rule | Any DNS rule's `server === tag` |

**Output ports** (right side):

| Port key | Label | Connected when |
|---|---|---|
| `outbound` | Detour outbound | `server.detour` is set |

No `endpoint` output port for `tcp` type (only `tailscale` type gets one). Correct per spec.

### Findings

- **No P0 issues.** Port semantics are correct for TCP: the detour outbound port correctly maps to `server.detour`; no spurious ports.
- The `isPortConnected` check for `"dns-server" && portKey === "outbound"` reads `server.detour` — correct.
- The title bar shows `dns-server / tcp`, which exposes the internal `kind / type` string to the user. This is a cosmetic P2: the human label "TCP Server" is not surfaced.
- `compatible: []` is intentional; dns-server nodes have no auto-create downstream.

---

## Right: Inspector

### Field coverage analysis

#### `dnsServerHandledFields` set (line 142–153 in Inspector.tsx)

```ts
const dnsServerHandledFields = new Set([
  "tag", "type",
  "address", "server", "server_port",
  "path", "endpoint",
  "tls",
  "neighbor_domain",
  ...dialSharedFields,   // detour, bind_interface, connect_timeout, domain_resolver,
                         // network_strategy, network_type, fallback_network_type, fallback_delay
]);
```

`dialSharedFields` array (line 105–114):

```ts
const dialSharedFields = [
  "detour", "bind_interface", "connect_timeout",
  "domain_resolver", "network_strategy",
  "network_type", "fallback_network_type", "fallback_delay",
];
```

#### Explicit Inspector controls for `dns-server` (lines 1548–1605)

| Field | Rendered? | Control type |
|---|---|---|
| `address` | Yes (if present) | text input |
| `server` | Yes (if present) | text input |
| `server_port` | Yes (if present) | number input |
| `path` | Yes (if present) | text input |
| `endpoint` (tailscale) | Yes (type-gated) | select |
| All others (handled set) | Covered by `AdvancedScalarFields` fallback | scalar display |

#### Dial group via `sharedGroupsForEntity`

```ts
const dnsServerDialTypes = new Set([...CREATABLE_DNS_SERVER_TYPES, "mdns"]
  .filter((type) => type !== "hosts" && type !== "fakeip" && type !== "tailscale" && type !== "resolved"));
```

`tcp` is in `CREATABLE_DNS_SERVER_TYPES` and is **not** filtered out → `dns-server` of type `tcp` **does receive** the `"dial"` shared group.

The `sharedFieldDefinitions("dial")` for a non-route, non-shadowtls entity returns (lines 881–891):

| Definition label | Field path | Kind |
|---|---|---|
| Detour | `detour` | select (outbound tags) |
| Bind Interface | `bind_interface` | text |
| Connect Timeout | `connect_timeout` | text |
| Domain Resolver | `domain_resolver` | text |
| Network Strategy | `network_strategy` | select |
| Network Type | `network_type` | list |
| Fallback Network | `fallback_network_type` | list |
| Fallback Delay | `fallback_delay` | text |

### Gap analysis against official Dial Fields

| Official field | In dialSharedFields / Inspector? | Notes |
|---|---|---|
| `detour` | yes — select | Correct |
| `bind_interface` | yes — text | Correct |
| `inet4_bind_address` | **missing** from dialSharedFields | Not in handled set, not in sharedFieldDefinitions; falls to AdvancedScalarFields if present in entity |
| `inet6_bind_address` | **missing** from dialSharedFields | Same as above |
| `bind_address_no_port` | **missing** | 1.13.0; not in any set |
| `routing_mark` | **missing** from dialSharedFields | Not in handled set; falls to AdvancedScalarFields |
| `reuse_addr` | **missing** from dialSharedFields | Falls to AdvancedScalarFields |
| `netns` | **missing** from dialSharedFields | 1.12.0; falls to AdvancedScalarFields |
| `connect_timeout` | yes — text | Correct |
| `tcp_fast_open` | **missing** from dialSharedFields | Falls to AdvancedScalarFields |
| `tcp_multi_path` | **missing** from dialSharedFields | Falls to AdvancedScalarFields |
| `disable_tcp_keep_alive` | **missing** | 1.13.0; falls to AdvancedScalarFields |
| `tcp_keep_alive` | **missing** | 1.13.0; falls to AdvancedScalarFields |
| `tcp_keep_alive_interval` | **missing** | 1.13.0; falls to AdvancedScalarFields |
| `udp_fragment` | **missing** from dialSharedFields | Falls to AdvancedScalarFields |
| `domain_resolver` | yes — text | Correct; replaces `domain_strategy` |
| `network_strategy` | yes — select | Correct |
| `network_type` | yes — list | Correct |
| `fallback_network_type` | yes — list | Correct |
| `fallback_delay` | yes — text | Correct |
| `domain_strategy` (deprecated) | **missing** from dialSharedFields | Not surfaced; acceptable since deprecated, but should at least be in handled set to suppress AdvancedScalarFields display |

**Summary:** 8 of 20 dial fields are explicitly in `dialSharedFields` and rendered with proper controls. 12 remaining official dial fields fall to `AdvancedScalarFields` (raw scalar rendering) because they are not in `dialSharedFields` or `dnsServerHandledFields`. This is not data-loss (values round-trip via AdvancedScalarFields if already present), but labeled controls and explicit handling are missing.

### `server` field — required validation

**P0 finding:** The `server` field is `==Required==` per official docs. Diagnostics (`diagnostics.ts`) do **not** check for a missing `server` field on `dns-server` of type `tcp`. The only dns-server diagnostics are `missing-dns-server-detour` and `missing-dns-server-endpoint`. A node created with the default template (`server: "1.1.1.1"`, line 605) is fine, but if `server` is cleared or the node is imported without a `server` value, no error is surfaced.

### `domain_resolver` — required when server is domain

**P1 finding:** Official docs state: "If domain name is used, `domain_resolver` must also be set to resolve IP address." There is no diagnostic check for this condition. If a user sets `server` to a hostname and leaves `domain_resolver` empty, the config will export silently and fail at runtime.

### `detour` rendered as select vs. text

The shared dial group renders `detour` as a `<select>` over `outboundTags(config)`. This is correct — it prevents invalid tag references. The canvas port also tracks `server.detour` and shows the visual connection edge.

### `domain_resolver` rendered as text input

The dial group renders `domain_resolver` as a plain text input. Per the official spec, `domain_resolver` accepts either a string (server tag) or an object (`{ server, strategy, ... }`). The text input only covers the string shorthand. Object form would need JSON textarea or a structured sub-inspector. This is a P1 limitation for advanced cases, but the string shorthand covers the common case.

### Type-switching behavior

`changeEntityType` for `dns-server` (commands.ts line 901–913) preserves `detour` and `endpoint` across type changes. For `tcp → tls` switching, `detour` is preserved correctly. No data loss. However, `server_port` default changes (53 for tcp, 853 for tls) — the new type template is applied from scratch while only `detour`/`endpoint` are carried over. This means `server` is reset to `"1.1.1.1"` on type switch, which is acceptable for a template default.

---

## Priority Findings

### P0 — Missing required-field diagnostic for `server`

**Location:** `src/domain/diagnostics.ts` — dns server validation block (line 284–303).

**Issue:** `server` is `==Required==` for `type: "tcp"`, but no diagnostic checks its presence. A node with a blank or missing `server` field will produce a silently invalid config.

**Fix:** In the dns-server diagnostic loop, add:
```ts
if ((server.type === "tcp" || server.type === "udp" || server.type === "tls"
     || server.type === "quic" || server.type === "https" || server.type === "h3")
    && !server.server) {
  push(diagnostics, "error", "missing-dns-server-address",
    `/dns/servers/${index}/server`,
    `DNS server "${server.tag}" (type "${server.type}") is missing required field "server".`);
}
```

### P0 — `domain_resolver` not in `dnsServerHandledFields`

**Location:** `src/components/Inspector.tsx` line 142–153.

**Issue:** `domain_resolver` is in `dialSharedFields` and is therefore indirectly in `dnsServerHandledFields` via spread. Confirmed: `...dialSharedFields` is spread into `dnsServerHandledFields`. No actual gap here — `domain_resolver` is covered. (Self-correction after tracing the spread.)

### P1 — No diagnostic for missing `domain_resolver` when `server` is a domain name

**Location:** `src/domain/diagnostics.ts`.

**Issue:** When `server` contains a non-IP hostname, `domain_resolver` is required. No check exists.

**Fix:**
```ts
if (server.server && !/^[\d.:]+$/.test(server.server) && !server.domain_resolver) {
  push(diagnostics, "warning", "dns-server-domain-without-resolver",
    `/dns/servers/${index}/domain_resolver`,
    `DNS server "${server.tag}" uses a domain name in "server" but "domain_resolver" is not set.`);
}
```

### P1 — `domain_resolver` text input does not support object form

**Location:** `src/components/Inspector.tsx` — `sharedFieldDefinitions("dial")` line 886.

**Issue:** `domain_resolver` accepts a string (server tag shorthand) or an object `{ server, strategy, ... }`. The current text input only handles the string form. Users who need the object form cannot configure it without raw JSON editing.

**Fix (near-term):** No immediate change needed if object form is rare, but add a comment in `sharedFieldDefinitions` noting the limitation. Long-term: replace with a structured sub-inspector or JSON textarea when the field value is an object.

### P1 — `dialSharedFields` missing several official dial fields

**Location:** `src/components/Inspector.tsx` line 105–114.

**Issue:** The following official Dial Fields are absent from `dialSharedFields` and thus rendered only by `AdvancedScalarFields` (no labeled control, no explicit handling):

- `inet4_bind_address`, `inet6_bind_address`, `bind_address_no_port`
- `routing_mark`, `reuse_addr`, `netns`
- `tcp_fast_open`, `tcp_multi_path`
- `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`
- `udp_fragment`
- `domain_strategy` (deprecated — should be in handled set to suppress display)

These fields exist in the official spec for TCP DNS servers. They round-trip correctly only if already present in the imported config. For new configs, users cannot set them without knowing the raw field name. The impact is lower for rarely-used fields (tcp_keep_alive, bind_address_no_port) but higher for `routing_mark` and `tcp_fast_open` (common Linux/routing use cases).

---

## Implementation Tasks

1. **[P0]** Add `missing-dns-server-address` diagnostic in `src/domain/diagnostics.ts` for `dns-server` types that require `server` (`tcp`, `udp`, `tls`, `quic`, `https`, `h3`).

2. **[P1]** Add `dns-server-domain-without-resolver` diagnostic warning in `src/domain/diagnostics.ts` when `server` is a domain name and `domain_resolver` is absent.

3. **[P1]** Extend `dialSharedFields` in `src/components/Inspector.tsx` to include at minimum:
   - `routing_mark` (number)
   - `reuse_addr` (boolean)
   - `tcp_fast_open` (boolean)
   - `netns` (text, 1.12.0)
   - `domain_strategy` (deprecated — add to handled set to suppress AdvancedScalarFields display; show with deprecation label)

4. **[P1]** Consider a note or extended control for `domain_resolver` object form — current text input covers only the string shorthand.

5. **[P2]** Canvas node title bar shows `dns-server / tcp`. Replace or supplement with the human label "TCP Server" so the tag (e.g., `tcp-dns`) and readable type are shown, matching the Library label.

6. **[P2]** Add a `domain_resolver` validation hint label next to the Server text input in Inspector ("If server is a domain name, set Domain Resolver below.") to surface the dependency before the user hits a runtime error.

---

## Done Criteria

- Adding dns-tcp from Library creates a node with `{ type: "tcp", tag: "tcp-dns", server: "1.1.1.1", server_port: 53 }` in `dns.servers[]`.
- Clearing `server` field in Inspector triggers an error diagnostic on the canvas node.
- Setting `server` to a hostname without `domain_resolver` triggers a warning diagnostic.
- `detour` select renders all available outbound tags; selecting one writes `detour` to the dns server object and shows the canvas edge.
- Inspector Dial section renders with labeled controls for at least `detour`, `bind_interface`, `connect_timeout`, `domain_resolver`, `network_strategy`.
- Type-switching from `tcp` to another type in Inspector preserves `detour` and does not corrupt the config.
- Export of a complete tcp dns server config round-trips through import without data loss.
