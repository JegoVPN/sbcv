# Inbound / Hysteria2 — Deep UI Review

> Sources: official stable docs (`inbound/hysteria2.md`) + testing docs (adds `bbr_profile`, `realm`, `obfs.gecko` type, QUIC fields section).
> Reviewed: Palette.tsx, SbcNode.tsx port specs, sharedFieldRegistry.ts, Inspector.tsx shared-field definitions, commands.ts default scaffold.

---

## Official Field Model

### Stable (sing-box ≤ 1.13)

```
type: "hysteria2"
tag: <string>

# Listen Fields (shared)
listen          REQUIRED
listen_port
bind_interface
routing_mark
reuse_addr
netns
tcp_fast_open
udp_timeout
(+ tcp_multi_path, disable_tcp_keep_alive, tcp_keep_alive, tcp_keep_alive_interval, udp_fragment, detour — from listen.md)

# Protocol Fields
up_mbps                   number  (optional; conflicts with ignore_client_bandwidth)
down_mbps                 number  (optional; conflicts with ignore_client_bandwidth)
obfs {}                   object
  obfs.type               "salamander" only (stable)
  obfs.password           string
users[]                   REQUIRED — array of { name, password }
ignore_client_bandwidth   boolean (conflicts with up_mbps/down_mbps)
tls {}                    REQUIRED
masquerade                string (URL) OR object:
  masquerade.type         "file" | "proxy" | "string"
  masquerade.directory    string (type=file)
  masquerade.url          string (type=proxy)
  masquerade.rewrite_host boolean (type=proxy)
  masquerade.status_code  number (type=string)
  masquerade.headers      object (type=string)
  masquerade.content      string (type=string)
brutal_debug              boolean

# Shared sections
quic {}                   (initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period)
```

**Stable official field count: 22 top-level + sub-fields** (8 listen + 3 protocol scalars + `obfs` object + `users[]` + `tls` object + `masquerade` string/object + `brutal_debug` + `quic` shared group + `type` + `tag`).

### Testing additions (sing-box 1.14+)

```
obfs.type        adds "gecko" alongside "salamander"
obfs.min_packet_size  number (gecko only)
obfs.max_packet_size  number (gecko only)
bbr_profile      "conservative" | "standard" | "aggressive"  (default "standard")
realm {}         (NAT traversal via Hysteria Realm service)
  realm.server_url          REQUIRED string
  realm.token               string
  realm.realm_id            REQUIRED string
  realm.stun_servers        REQUIRED string[]
  realm.stun_domain_resolver string or object
  realm.http_client         object (→ shared/http-client)
```

**Testing-only additions: 9 new fields** (3 obfs sub-fields for gecko, `bbr_profile`, `realm` object with 6 sub-fields).

---

## Left: Add Library (Palette)

**Current state** (`Palette.tsx` line 143):
```ts
{ label: "Hysteria2", kind: "inbound-hysteria2", icon: Plug, docsUrl: docs("inbound/hysteria2/"), status: "setup" }
```

- Label "Hysteria2" is human-readable and correct.
- `status: "setup"` — action text is implementation-internal; should be a clear verb such as `ADD` or `ADD INBOUND`.
- `docsUrl` points to `inbound/hysteria2/` — correct.
- Icon `Plug` is protocol-neutral; acceptable.

**No blocking gap** in the Palette entry beyond status label wording.

---

## Middle: Canvas Node (SbcNode)

**Port specs** (all inbound nodes, `SbcNode.tsx` lines 136–143):
- Output → Route hub (`route`)
- Output → Route rule matcher (`route-rule`)
- Output → DNS rule matcher (`dns-rule`)

No input ports — correct; inbounds are traffic sources.

**Hysteria2-specific canvas gaps:**
- No badge or port indicating whether TLS is configured. TLS is **required** by the official doc (`==Required==`); a misconfigured node should produce a visible canvas-level diagnostic.
- No port to the `realm` service. `realm` is a pure JSON object (not a sing-box `tag` reference in the current doc), so no port is needed yet — correct.
- No port to `masquerade`. `masquerade` is a URL string or an inline object with no cross-node `tag` reference — no port needed.
- Canvas node label shows generic `inbound / hysteria2` text — acceptable; no protocol-specific enhancement needed here.

---

## Right: Inspector

### What is currently rendered for `kind === "inbound"` (all inbound types)

1. **Type selector** — dropdown from `CREATABLE_INBOUND_TYPES`; `hysteria2` is included (`protocols.ts` line 81).
2. **Tag** — text input (standard, shared).
3. **`address` / `auto_route`** — rendered for the generic inbound block; these are TUN-family fields and are not relevant to Hysteria2. They appear only if present in the entity object, which is benign but visually noisy.
4. **`AdvancedScalarFields`** — catches all fields not in `inboundHandledFields`. Since `inboundHandledFields` does NOT include `up_mbps`, `down_mbps`, `ignore_client_bandwidth`, `brutal_debug`, those four **scalar** fields will surface here as auto-labelled inputs. Arrays and objects (`users`, `obfs`, `masquerade`, `realm`) are **silently skipped** by `AdvancedScalarFields` because it only renders `string | number | boolean` values.

### Shared field groups applied to `hysteria2` inbound

From `sharedFieldRegistry.ts`:

| Group | Applied? | Evidence |
|---|---|---|
| `listen` | Yes — all creatable inbounds | line 166 |
| `tls` | Yes — `inboundTlsTypes` includes `hysteria2` | line 144 |
| `quic` | Yes — `inboundQuicTypes` includes `hysteria2` | line 145 |
| `multiplex` | No — `inboundMultiplexTypes` does not include `hysteria2` | correct |
| `v2ray-transport` | No — `inboundTransportTypes` does not include `hysteria2` | correct |
| `dial` | No — inbounds do not dial except shadowtls | correct |

All three applicable groups (listen, tls, quic) are correctly registered.

### Listen Fields panel

`sharedFieldDefinitions` for `"listen"` group (`Inspector.tsx` lines 849–859) covers:
`listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout`

**Missing from the panel** (present in official `listen.md`):
- `tcp_multi_path`
- `disable_tcp_keep_alive`
- `tcp_keep_alive`
- `tcp_keep_alive_interval`
- `udp_fragment`
- `detour` (forward-to-inbound)

Shared gap affecting all inbounds — not Hysteria2-specific.

### TLS panel

`sharedFieldDefinitions` for `"tls"` group (`Inspector.tsx` lines 894–905) covers:
`tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`

**Missing server-side TLS fields:**
- `tls.key_path` — required for server TLS; not in the panel.
- `tls.certificate` / `tls.key` (inline PEM arrays) — not in the panel.

Since TLS is **required** for Hysteria2, the absence of `key_path` means a user cannot complete TLS configuration in the Inspector.

### QUIC panel

`sharedFieldDefinitions` for `"quic"` group (`Inspector.tsx` lines 907–913) covers:
`initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period`

This matches the `quicSharedFields` constant at line 115. The QUIC panel is correctly wired and covers the relevant shared QUIC fields. Testing adds additional QUIC fields (`bbr_profile`) that are hysteria2-specific, not generic QUIC.

### Protocol-specific fields

**Current state:** There is no Hysteria2-specific Inspector block. The `inboundHandledFields` set (`Inspector.tsx` line 116) includes `tls`, `...listenSharedFields`, and `...quicSharedFields` but does **not** include:
- `users`
- `obfs`
- `masquerade`
- `brutal_debug`
- `up_mbps`
- `down_mbps`
- `ignore_client_bandwidth`
- `bbr_profile`
- `realm`

The four scalar fields (`up_mbps`, `down_mbps`, `ignore_client_bandwidth`, `brutal_debug`) fall through to `AdvancedScalarFields` and are rendered as auto-labelled inputs — functional but unpolished and missing field semantics (e.g., the mutual conflict between `up_mbps`/`down_mbps` and `ignore_client_bandwidth` is not communicated).

The five array/object fields (`users`, `obfs`, `masquerade`, `realm`) are **silently dropped** by `AdvancedScalarFields` and are completely uneditable in the Inspector.

### Default scaffold (`commands.ts` lines 222–233)

```ts
{
  type: "hysteria2",
  tag,
  listen: "127.0.0.1",
  listen_port: 2080,
  up_mbps: 100,
  down_mbps: 100,
  users: [{ name: "user", password: "change-me" }],
  ignore_client_bandwidth: false,
}
```

**Issues:**
- No `tls: {}` in the scaffold. TLS is marked `==Required==` in the official doc. A node created from the Palette will have no TLS configured.
- `users` is present with a single placeholder entry — correct starting point.
- `obfs` is omitted — acceptable (optional).
- `masquerade` is omitted — acceptable (optional).
- `ignore_client_bandwidth: false` with `up_mbps: 100` / `down_mbps: 100` is technically valid since `ignore_client_bandwidth` only conflicts when true; including it as false in the scaffold is slightly misleading but not broken.

---

## Priority Findings

### P0 — Protocol objects (users[], obfs, masquerade) are completely uneditable in the Inspector

**Evidence:** `inboundHandledFields` does not include `users`, `obfs`, or `masquerade`. `AdvancedScalarFields` only processes `string | number | boolean` leaf values; arrays and objects are silently dropped. No Hysteria2-specific Inspector block exists.

**Impact:** After creating a Hysteria2 inbound:
- There is no UI path to add a second user, change a user password, or remove a user.
- There is no UI path to configure `obfs.type` + `obfs.password` (obfuscation cannot be enabled from the UI).
- There is no UI path to configure `masquerade` (the fallback HTTP3 server behavior cannot be set from the UI).
- The only workaround is raw JSON import/export.

**Fix required:**
1. Add a Hysteria2-specific block under `{ref.kind === "inbound"}` gated by `entityType === "hysteria2"`.
2. Render a `users[]` repeater: each row has `name` (text) + `password` (password input with show/hide toggle). Provide Add / Remove row controls.
3. Render `obfs` as a conditional section: a `Type` select (`""` = disabled, `"salamander"`, and `"gecko"` for testing) plus a `Password` text input, conditionally shown when type is not empty. Testing also needs `min_packet_size` and `max_packet_size` numbers (gecko only).
4. Render `masquerade` as two modes selectable by a toggle: "URL mode" (single text input) or "Object mode" (`type` select + dependent sub-fields per type). A `JsonField` is an acceptable interim control.
5. Add `"users"`, `"obfs"`, `"masquerade"` to `inboundHandledFields`.

### P0 — Default scaffold is created without TLS; no diagnostic warns the user

**Evidence:** `commands.ts` lines 222–233: the `hysteria2` inbound scaffold does not include `tls: {}`. TLS is marked `==Required==` in the official doc.

**Impact:** A user who adds a Hysteria2 inbound and exports without enabling TLS gets a config that will fail at runtime with no UI warning.

**Fix required:**
1. Add `tls: { enabled: true }` to the Hysteria2 inbound scaffold in `commands.ts`.
2. Add a semantic diagnostic: when `entityType === "hysteria2"` and `entity.tls?.enabled !== true`, display a visible warning in the Inspector (red banner or inline message: "TLS is required for Hysteria2").
3. Optionally display a warning badge on the canvas node when TLS is not configured.

---

### P1 — up_mbps / down_mbps / ignore_client_bandwidth conflict not communicated in the UI

**Evidence:** The official doc states that `up_mbps`/`down_mbps` conflict with `ignore_client_bandwidth` when `ignore_client_bandwidth` is true. All three currently surface as independent `AdvancedScalarFields` inputs with no relationship described.

**Impact:** A user could set both `up_mbps: 100` and `ignore_client_bandwidth: true`, producing an invalid config with no feedback.

**Fix required:** In the Hysteria2-specific Inspector block, render `up_mbps` and `down_mbps` as number inputs and `ignore_client_bandwidth` as a boolean toggle. When `ignore_client_bandwidth` is true, disable or visually dim the `up_mbps` / `down_mbps` inputs and show a tooltip or inline note explaining the conflict.

### P1 — QUIC panel does not cover testing-era bbr_profile

**Evidence:** The testing doc adds `bbr_profile` (enum: `conservative` / `standard` / `aggressive`) as a Hysteria2-specific field. The generic QUIC shared panel does not include it; `bbr_profile` would fall through to `AdvancedScalarFields` as a raw text input if present in imported JSON.

**Impact:** Users cannot discover or select `bbr_profile` through the Inspector UI in testing-era configs.

**Fix required:** Add `bbr_profile` to the Hysteria2-specific Inspector block as a `select` with options `""` (default = standard), `"conservative"`, `"standard"`, `"aggressive"`. Add `"bbr_profile"` to `inboundHandledFields`.

### P1 — realm object is uneditable; testing users should be aware

**Evidence:** The testing doc adds a `realm {}` block (6+ sub-fields including required `server_url`, `realm_id`, `stun_servers`). No Inspector block exists for `realm`. `AdvancedScalarFields` will silently drop the entire `realm` object since it is not a scalar.

**Impact:** Testing-version Hysteria2 realm NAT traversal configuration cannot be entered or modified in the Inspector.

**Fix required:** Add a `realm` JsonField at minimum as an interim control. A structured panel (server_url text, realm_id text, stun_servers list, token text, http_client JsonField) is the preferred long-term solution. Add `"realm"` to `inboundHandledFields`.

### P1 — TLS panel missing key_path (server-side TLS incomplete)

**Evidence:** `sharedFieldDefinitions` for `"tls"` does not include `tls.key_path`. Since TLS is required for Hysteria2, users cannot configure server-side TLS (certificate + private key) entirely within the Inspector.

**Impact:** Server TLS configuration requires raw JSON import for the `key_path` (or inline `key`) field.

**Fix required:** Add `{ label: "Key Path", path: ["tls", "key_path"], kind: "text" }` to the TLS panel. Also add `JsonField` controls for inline `tls.certificate` and `tls.key` arrays. Shared gap — affects all inbound TLS types.

### P1 — Listen panel missing 6 official fields

Shared gap with all inbounds: `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, and listen-`detour` are absent from the `listen` shared-field panel. These fall through to `AdvancedScalarFields` as individual scalar inputs if present in imported JSON, but are not discoverable from a fresh node.

---

## Implementation Tasks

1. **[P0] Add Hysteria2-specific Inspector block**
   - File: `src/components/Inspector.tsx`
   - Location: inside `{ref.kind === "inbound" ? …}` section, gated by `entityType === "hysteria2"`
   - Controls:
     - `users[]` repeater (name text + password input with show/hide)
     - `obfs.type` select (`""` = disabled, `"salamander"`, `"gecko"`) + `obfs.password` text input (visible when type ≠ `""`) + `obfs.min_packet_size` / `obfs.max_packet_size` numbers (gecko only)
     - `masquerade` — mode toggle: URL string input OR object type select (`file` / `proxy` / `string`) with dependent sub-fields; `JsonField` is acceptable as an interim
     - `up_mbps` number, `down_mbps` number
     - `ignore_client_bandwidth` boolean toggle (disables `up_mbps`/`down_mbps` when true)
     - `brutal_debug` boolean toggle
   - Update `inboundHandledFields` to add: `"users"`, `"obfs"`, `"masquerade"`, `"up_mbps"`, `"down_mbps"`, `"ignore_client_bandwidth"`, `"brutal_debug"`

2. **[P0] Add TLS to default Hysteria2 scaffold**
   - File: `src/domain/commands.ts`, lines 222–233
   - Change: add `tls: { enabled: true }` to the returned scaffold
   - Add semantic diagnostic in the Inspector: when `entityType === "hysteria2"` and `entity.tls?.enabled !== true`, display a warning banner

3. **[P1] Add bbr_profile to Hysteria2 Inspector block** (task 1 follow-on)
   - `bbr_profile` select with options `""` (default), `"conservative"`, `"standard"`, `"aggressive"`
   - Add `"bbr_profile"` to `inboundHandledFields`

4. **[P1] Add realm as JsonField in Hysteria2 Inspector block** (task 1 follow-on)
   - `JsonField` for `realm` object as minimum viable control
   - Structured panel (server_url, realm_id, stun_servers, token) as preferred follow-on
   - Add `"realm"` to `inboundHandledFields`

5. **[P1] Extend TLS shared panel with server-side key fields**
   - File: `src/components/Inspector.tsx`, `sharedFieldDefinitions` for group `"tls"`
   - Add: `{ label: "Key Path", path: ["tls", "key_path"], kind: "text" }`, JsonField rows for inline `certificate` and `key` arrays

6. **[P1] Complete the listen shared-field panel**
   - File: `src/components/Inspector.tsx`, `sharedFieldDefinitions` for group `"listen"`
   - Add: `tcp_multi_path` (boolean), `disable_tcp_keep_alive` (boolean), `tcp_keep_alive` (text), `tcp_keep_alive_interval` (text), `udp_fragment` (boolean), `detour` (select → inbound tags)
   - Update `listenSharedFields` constant accordingly

---

## Summary

| Area | Status |
|---|---|
| Palette entry | OK (status label wording minor) |
| Canvas ports | OK for tag-based connections; no TLS-absent diagnostic |
| Default scaffold | BROKEN — created without required TLS |
| users[] editing | MISSING — silently dropped by AdvancedScalarFields |
| obfs editing | MISSING — silently dropped |
| masquerade editing | MISSING — silently dropped |
| up_mbps / down_mbps | Partial — surfaces as AdvancedScalarFields; conflict with ignore_client_bandwidth not enforced |
| ignore_client_bandwidth | Partial — surfaces as AdvancedScalarFields boolean; conflict not enforced |
| brutal_debug | Partial — surfaces as AdvancedScalarFields boolean |
| bbr_profile (testing) | MISSING — not surfaced; falls to AdvancedScalarFields as text if present |
| realm (testing) | MISSING — silently dropped |
| TLS shared panel | PARTIAL — missing key_path, inline PEM |
| QUIC shared panel | OK for stable; missing bbr_profile for testing |
| Listen shared panel | PARTIAL — missing 6 fields from listen.md |

**Official stable field count: 22** (counting obfs and masquerade as single entries each).  
**P0 findings: 2. P1 findings: 5.**
