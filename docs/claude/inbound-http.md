# Inbound / http — Deep UI Review

> Source: official stable + testing docs (identical for this node), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, SbcNode.tsx, commands.ts.
> Review date: 2026-05-27.

---

## Official Field Inventory

**Stable == Testing** — both versions have the same HTTP inbound structure.

### Protocol-specific fields (3)

| Field | Type | Default | Notes |
|---|---|---|---|
| `users[]` | array of objects | `[]` | `{ username, password }`. No auth if empty. |
| `tls` | object | — | Shared inbound TLS section. |
| `set_system_proxy` | boolean | `false` | Linux/Android/Windows/macOS only. Use `tun.platform.http_proxy` on Android/Apple without privileges. |

### Shared Listen Fields (15, via shared/listen.md)

| Field | Since | Notes |
|---|---|---|
| `listen` | — | **Required**. Listen address. |
| `listen_port` | — | Listen port. |
| `bind_interface` | 1.12.0 | Network interface to bind. |
| `routing_mark` | 1.12.0 | Linux only. netfilter routing mark. Integer or hex string. |
| `reuse_addr` | 1.12.0 | Reuse listener address. |
| `netns` | 1.12.0 | Linux only. Network namespace name or path. |
| `tcp_fast_open` | — | Enable TCP Fast Open. |
| `tcp_multi_path` | — | Go 1.21 required. |
| `disable_tcp_keep_alive` | 1.13.0 | Disable TCP keep alive. |
| `tcp_keep_alive` | 1.13.0 | Keep alive initial period. Default changed to `5m` in 1.13.0. |
| `tcp_keep_alive_interval` | — | Keep alive interval. Default `75s`. |
| `udp_fragment` | — | Enable UDP fragmentation. |
| `udp_timeout` | — | UDP NAT expiration. Default `5m`. |
| `detour` | — | Forward to a specified inbound (requires target inbound support). |
| ~~`sniff`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`sniff_override_destination`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`sniff_timeout`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`domain_strategy`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`udp_disable_domain_unmapping`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |

### Shared Inbound TLS Fields (via shared/tls.md — Inbound shape)

| Field | Notes |
|---|---|
| `tls.enabled` | Enable TLS. |
| `tls.server_name` | SNI hostname. |
| `tls.alpn[]` | ALPN list. |
| `tls.min_version` / `tls.max_version` | TLS 1.0–1.3. |
| `tls.cipher_suites[]` | TLS 1.0–1.2 suites. |
| `tls.curve_preferences[]` | Since 1.13.0. Key exchange mechanisms. |
| `tls.certificate[]` / `tls.certificate_path` | PEM cert chain. |
| `tls.key[]` / `tls.key_path` | Server private key. |
| `tls.client_authentication` | Since 1.13.0. `no`/`request`/`require-any`/`verify-if-given`/`require-and-verify`. |
| `tls.client_certificate[]` / `tls.client_certificate_path[]` | Since 1.13.0. mTLS client CA. |
| `tls.client_certificate_public_key_sha256[]` | Since 1.13.0. SHA-256 hash of client cert pub key. |
| `tls.kernel_tx` / `tls.kernel_rx` | Since 1.13.0. Linux 5.1+, TLS 1.3 only. kTLS. |
| `tls.acme{}` | ACME sub-object (domain, data_directory, email, provider, …). |
| `tls.ech{}` | ECH sub-object (enabled, key, key_path). Server: key/key_path only. |
| `tls.reality{}` | Reality sub-object (enabled, handshake, private_key, short_id, max_time_difference). |

Total official fields: **3 protocol-specific + 14 active listen fields + 15+ TLS inbound fields = ~32 meaningful fields** (excluding deprecated and deeply nested sub-fields counted separately).

---

## Left Panel — Palette (Add Library)

**Current state:** `{ label: "HTTP", kind: "inbound-http", icon: Globe2, docsUrl: docs("inbound/http/"), status: "setup" }`

### Findings

- Label `"HTTP"` is correct and concise.
- `status: "setup"` renders a non-clickable badge rather than a functional ADD action. The node cannot be dragged or clicked to create an inbound — users see a status indicator and a Docs link, with no clear action affordance.
- The Docs link target `docs("inbound/http/")` is correct.
- `icon: Globe2` is shared with HTTP Clients and the HTTP outbound — no visual differentiation between listen and connect semantics.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"inbound"` (SbcNode.tsx, line 136–144).

### Port Specification (output ports for inbound)

```
Right ports (output):
  - "route"           → Route hub
  - "route-rule-match" → Route rule matcher
  - "dns-rule-match"  → DNS rule matcher
```

No input ports. This is correct per sing-box topology: inbound is a source node.

### Findings

- Port specification is generic for all inbounds; HTTP has no special ports and the three standard output ports are correct.
- Canvas node label displays `tag ?? ref.kind` — fine.
- Node icon is `RadioTower` for all inbound kinds regardless of protocol — HTTP inbound is indistinguishable from TUN, SOCKS, etc. on canvas.
- No canvas-level display of `listen_port` or authentication state, making it hard to tell nodes apart at a glance when multiple HTTP inbounds exist.

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "inbound"`

1. **Tag** rename input (line 1181–1188).
2. **Type** select from `CREATABLE_INBOUND_TYPES` (line 1194–1199).
3. **Address** text input bound to `entity.address` (line 1486–1490).
4. **Auto route** checkbox bound to `entity.auto_route` (line 1492–1499).
5. **AdvancedScalarFields** — spills any non-object, non-array field not in `inboundHandledFields` into a generic accordion (line 1501).
6. **SharedFieldCards** — renders the `"listen"` and `"tls"` sections as collapsible module cards (lines 1892–1899, driven by `sharedGroupsForEntity`).

### `inboundHandledFields` set (line 116–127)

```ts
const inboundHandledFields = new Set([
  "tag", "type", "address", "auto_route",
  "tls", "multiplex", "transport", "handshake",
  ...listenSharedFields,  // listen, listen_port, bind_interface, routing_mark, reuse_addr, netns, tcp_fast_open, udp_timeout
  ...quicSharedFields,    // initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period
]);
```

### Gap analysis for HTTP inbound

| Field | Expected | Actual |
|---|---|---|
| `users[]` | Structured repeater (`username` + `password` per row) | **Not in `inboundHandledFields`** — falls through to `AdvancedScalarFields` which filters to scalar values only; `users` is an array and is **silently dropped** from the UI. |
| `set_system_proxy` | Boolean toggle with platform note | **Not in `inboundHandledFields`** — `set_system_proxy` is a boolean so it appears in `AdvancedScalarFields` as an unlabeled checkbox. No platform warning shown. |
| `tls` | Shared TLS card | Correctly handled via `sharedGroupsForEntity` (inboundTlsTypes includes `"http"`). TLS card is shown. |
| Listen fields | Shared Listen card | Correctly handled. `"listen"` group is shown for all inbounds. |
| `address` | N/A for http type | Address input is shown for all inbounds generically; HTTP inbound has no `address` field in official spec. |
| `auto_route` | N/A for http type | Auto route checkbox shown for all inbounds; HTTP inbound has no `auto_route` field. |
| Deprecated sniff fields | Must not be created | `commands.ts` default template does not include them. |

### SharedFieldCards — Listen group gap

`listenSharedFields` (line 96–103) exposes 8 fields:
`listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout`.

Missing from the Listen card:
- `tcp_multi_path` (boolean)
- `disable_tcp_keep_alive` (boolean, since 1.13.0)
- `tcp_keep_alive` (string, since 1.13.0)
- `tcp_keep_alive_interval` (string)
- `detour` (select from inbound tags — different from dial `detour`)

These are absent from both `listenSharedFields` and `inboundHandledFields`, so any imported config that has them will surface in `AdvancedScalarFields` for scalars. `detour` (string) would appear there; array fields would be silently invisible.

### SharedFieldCards — TLS group gap

The TLS shared card (line 894–904) exposes only 8 fields:
`tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`.

Missing from the TLS card for inbound HTTP:
- `tls.key_path` (server private key path)
- `tls.certificate[]` (inline PEM)
- `tls.key[]` (inline PEM)
- `tls.client_authentication` (since 1.13.0)
- `tls.client_certificate[]` / `tls.client_certificate_path[]` (mTLS)
- `tls.client_certificate_public_key_sha256[]`
- `tls.acme{}` (ACME auto-cert)
- `tls.ech{}` (ECH server-side key)
- `tls.reality{}` (Reality camouflage)
- `tls.curve_preferences[]` (since 1.13.0)
- `tls.kernel_tx`, `tls.kernel_rx` (since 1.13.0)

These are all swallowed by the opaque `tls` object blob — no UI path exists for them except the global JSON textarea.

---

## Priority Findings

### P0 — users[] is silently invisible

`users` is an array of `{ username, password }` objects. It is neither in `inboundHandledFields` nor displayed via a dedicated section for `ref.kind === "inbound"`. `AdvancedScalarFields` (line 205–211) skips non-scalar types, so `users` is entirely invisible in the Inspector for an HTTP inbound.

A user who imports a config with `"users": [{"username":"admin","password":"secret"}]` sees no `users` entry in the Inspector and has no way to edit or view credentials. Clicking Save/export round-trips silently without the change they expected.

**Resolution required:** Add a `users[]` repeater to the inbound inspector block for type `"http"` (and `"socks"`, `"naive"` which share the same `{ username, password }` shape). Minimally: a `JsonField` labelled "HTTP Users" gated on `entityType === "http"`.

### P0 — set_system_proxy leaks to AdvancedScalarFields without platform warning

`set_system_proxy` is a boolean. Because it is not in `inboundHandledFields` it falls through to `AdvancedScalarFields` and appears as a generic unlabeled checkbox in the "Advanced fields" accordion. The official doc includes a prominent platform restriction warning (Linux/Android/Windows/macOS; use `tun.platform.http_proxy` on Android/Apple without privileges). The current rendering provides no such context.

**Resolution required:** Add `set_system_proxy` to `inboundHandledFields` and render it as an explicit labeled boolean toggle with a help text note for `entityType === "http"`.

### P1 — address and auto_route shown for HTTP inbound (wrong fields)

The inbound block unconditionally renders `address` (line 1486) and `auto_route` (line 1493) for every inbound. HTTP inbound has neither of these fields in the official spec. They belong to TUN inbound only. These controls write to the JSON object and pollute the exported config with unknown fields.

**Resolution required:** Gate `address` and `auto_route` controls on `entityType === "tun"` (or equivalent TUN-specific guard).

### P1 — Listen card missing 5 fields

`tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, and `detour` are omitted from both `listenSharedFields` and `inboundHandledFields`. For an imported config containing these fields, only scalar ones (`detour` as string) surface in AdvancedScalarFields; boolean/string tcp keep-alive fields are silently omitted from the inspector accordion since they are the right types to appear there, but without labels or grouping context.

**Resolution required:** Add these 5 fields to `listenSharedFields` (with appropriate UI controls) and to `inboundHandledFields`.

### P1 — TLS card missing key server fields

`tls.key_path` and `tls.certificate[]` / `tls.key[]` (inline PEM) are the minimum required for a functioning self-signed HTTPS proxy. Neither appears in the TLS shared card. Users must drop to raw JSON to configure an HTTP-over-TLS inbound.

**Resolution required:** Add `tls.key_path`, `tls.certificate[]` (textarea, PEM), and `tls.key[]` (textarea, PEM) to the TLS shared card definitions for inbound. ACME, ECH, Reality should be secondary collapsible sub-sections.

---

## Implementation Tasks

### Task 1 — Implement users[] repeater for HTTP inbound (P0)

**File:** `src/components/Inspector.tsx`

In the `ref.kind === "inbound"` block (line 1484–1503), add a conditional section:

```tsx
{(entityType === "http" || entityType === "socks" || entityType === "naive") ? (
  <JsonField
    label="Users (username / password)"
    value={entity.users ?? []}
    onChange={(value) => updateField(ref, "users", value)}
  />
) : null}
```

Long-term: replace `JsonField` with a dedicated `UsersRepeater` component that renders one `{username, password}` row per entry with Add/Remove controls.

Also add `"users"` to `inboundHandledFields` so it no longer leaks to `AdvancedScalarFields`.

### Task 2 — Expose set_system_proxy for HTTP inbound (P0)

**File:** `src/components/Inspector.tsx`

Add `"set_system_proxy"` to `inboundHandledFields`.

In the inbound block add:

```tsx
{entityType === "http" ? (
  <label className="toggle-row">
    <input
      type="checkbox"
      checked={Boolean(entity.set_system_proxy)}
      onChange={(event) => updateField(ref, "set_system_proxy", event.target.checked || undefined)}
    />
    <span>Set system proxy (Linux / Windows / macOS)</span>
  </label>
) : null}
```

### Task 3 — Gate address/auto_route to TUN only (P1)

**File:** `src/components/Inspector.tsx` lines 1486–1500

Wrap the `address` and `auto_route` controls so they only render when `entityType === "tun"`.

### Task 4 — Expand listenSharedFields with missing fields (P1)

**File:** `src/components/Inspector.tsx`

Add to `listenSharedFields` (and `inboundHandledFields`):
- `tcp_multi_path` → `{ label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" }`
- `disable_tcp_keep_alive` → `{ label: "Disable TCP Keep Alive", path: ["disable_tcp_keep_alive"], kind: "boolean" }`
- `tcp_keep_alive` → `{ label: "TCP Keep Alive", path: ["tcp_keep_alive"], kind: "text" }` (duration string)
- `tcp_keep_alive_interval` → `{ label: "TCP Keep Alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" }`
- `detour` (inbound-to-inbound) → `{ label: "Detour Inbound", path: ["detour"], kind: "text" }`
  - Note: this is an inbound tag reference, not an outbound tag; needs a separate `inboundOptions` list or plain text input.

### Task 5 — Expand TLS card with server key fields (P1)

**File:** `src/components/Inspector.tsx`, `sharedFieldDefinitions` for `group === "tls"`

Add to the TLS group definitions (guarded to inbound or unconditionally where appropriate):
- `{ label: "Key Path", path: ["tls", "key_path"], kind: "text" }` (server private key path, inbound only)
- `{ label: "Certificate (PEM)", path: ["tls", "certificate"], kind: "list" }` (inline cert)
- `{ label: "Key (PEM)", path: ["tls", "key"], kind: "list" }` (inline key)

ACME, ECH, and Reality sub-objects should be exposed at minimum as `JsonField` fallbacks until structured sub-forms are built.

### Task 6 — Palette status upgrade (P1)

**File:** `src/components/Palette.tsx` line 134

Change `status: "setup"` to `ready: true` once tasks 1–5 are complete and the node round-trips correctly. Until then the current `"setup"` badge is the honest state.

---

## Done Criteria

- `users[]` array is visible and editable in the Inspector for `type === "http"` inbound.
- `set_system_proxy` appears as a named toggle with platform hint for `type === "http"`.
- `address` and `auto_route` are not shown for HTTP inbound in Inspector.
- `listen_port`, `bind_interface`, `tcp_fast_open`, and the new TCP keep-alive fields all round-trip cleanly through import → Inspector edit → JSON export.
- TLS card shows at minimum `key_path` next to `certificate_path` so a basic TLS-enabled HTTP proxy can be configured without the JSON textarea.
- Fixture or e2e smoke test: import `{ type: "http", listen: "127.0.0.1", listen_port: 8080, users: [{username:"u", password:"p"}], set_system_proxy: false }`, verify Inspector shows all fields, edit tag, export JSON, check round-trip.
