# Outbound / vless UI Review

<!-- Source: official stable + testing docs (identical); reviewed against Palette, Inspector, sharedFieldRegistry, commands.ts. -->

## Official Model (stable = testing)

Canonical JSON structure for `outbound[type=vless]`:

```json
{
  "type": "vless",
  "tag": "vless-out",
  "server": "127.0.0.1",
  "server_port": 1080,
  "uuid": "bf000d23-0752-40b4-affe-68f7707a9661",
  "flow": "xtls-rprx-vision",
  "network": "tcp",
  "tls": {
    "enabled": true,
    "disable_sni": false,
    "server_name": "",
    "insecure": false,
    "alpn": [],
    "min_version": "",
    "max_version": "",
    "cipher_suites": [],
    "curve_preferences": [],
    "certificate": "",
    "certificate_path": "",
    "certificate_public_key_sha256": [],
    "client_certificate": [],
    "client_certificate_path": "",
    "client_key": [],
    "client_key_path": "",
    "fragment": false,
    "fragment_fallback_delay": "",
    "record_fragment": false,
    "ech": { "enabled": false, "config": [], "config_path": "", "query_server_name": "" },
    "utls": { "enabled": false, "fingerprint": "" },
    "reality": {
      "enabled": false,
      "public_key": "jNXHt1yRo0vDuchQlIP6Z0ZvjT3KtzVI-T4E7RoLJS0",
      "short_id": "0123456789abcdef"
    }
  },
  "packet_encoding": "",
  "multiplex": {
    "enabled": true,
    "protocol": "h2mux",
    "max_connections": 4,
    "min_streams": 4,
    "max_streams": 0,
    "padding": false,
    "brutal": {}
  },
  "transport": { "type": "ws", "path": "/", "headers": {} },
  // ... Dial Fields
}
```

### Field inventory (official, 37 fields counted including nested TLS + shared)

| Field | Required | Type | Notes |
|---|---|---|---|
| `server` | yes | string | server address |
| `server_port` | yes | integer | server port |
| `uuid` | yes | string | VLESS user ID |
| `flow` | no | select | only value: `xtls-rprx-vision` |
| `network` | no | select | `tcp` or `udp`; both enabled by default |
| `tls.enabled` | no | boolean | |
| `tls.disable_sni` | no | boolean | client only |
| `tls.server_name` | no | string | |
| `tls.insecure` | no | boolean | client only |
| `tls.alpn` | no | string[] | |
| `tls.min_version` | no | select | 1.0/1.1/1.2/1.3 |
| `tls.max_version` | no | select | 1.0/1.1/1.2/1.3 |
| `tls.cipher_suites` | no | string[] | TLS 1.0–1.2 only |
| `tls.curve_preferences` | no | string[] | since 1.13.0; P256/P384/P521/X25519/X25519MLKEM768 |
| `tls.certificate` | no | string | PEM |
| `tls.certificate_path` | no | string | |
| `tls.certificate_public_key_sha256` | no | string[] | since 1.13.0; client only |
| `tls.client_certificate` | no | string[] | since 1.13.0; client only |
| `tls.client_certificate_path` | no | string | since 1.13.0; client only |
| `tls.client_key` | no | string[] | since 1.13.0; client only |
| `tls.client_key_path` | no | string | since 1.13.0; client only |
| `tls.fragment` | no | boolean | since 1.12.0; client only |
| `tls.fragment_fallback_delay` | no | string | since 1.12.0; default 500ms |
| `tls.record_fragment` | no | boolean | since 1.12.0; client only |
| `tls.ech.enabled` | no | boolean | |
| `tls.ech.config` | no | string[] | PEM; client only |
| `tls.ech.config_path` | no | string | client only |
| `tls.ech.query_server_name` | no | string | since 1.13.0; client only |
| `tls.utls.enabled` | no | boolean | not recommended |
| `tls.utls.fingerprint` | no | select | chrome/firefox/edge/safari/360/qq/ios/android/random/randomized |
| `tls.reality.enabled` | no | boolean | |
| `tls.reality.public_key` | no | string | required when reality enabled |
| `tls.reality.short_id` | no | string | hex 0–8 digits; required when reality enabled |
| `packet_encoding` | no | select | `""` (disabled) / `packetaddr` / `xudp` (default) |
| `multiplex.*` | no | object | enabled/protocol/max_connections/min_streams/max_streams/padding/brutal |
| `transport.*` | no | object | type: http/ws/quic/grpc/httpupgrade + type-specific fields |
| dial fields | no | object | detour/bind_interface/connect_timeout/domain_resolver/network_strategy/network_type/fallback_network_type/fallback_delay |

---

## Registry / Code Audit

### Palette (`src/components/Palette.tsx` line 165)

```ts
{ label: "VLESS", kind: "vless-out", icon: Shield, docsUrl: docs("outbound/vless/"), status: "setup" }
```

- Kind is `vless-out`, not `outbound-vless`. The Palette entry exists, status is `"setup"`.
- `docsUrl` correctly points to the official VLESS outbound doc.

### Default object (`src/domain/commands.ts` line 357-365)

```ts
{
  type: "vless",
  tag,
  server: "127.0.0.1",
  server_port: 1080,
  uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
  network: "tcp",
}
```

- `flow`, `tls`, `packet_encoding`, `multiplex`, `transport` are **not included** in the default object; they are omitted until the user adds them via shared module cards.

### sharedFieldRegistry (`src/domain/sharedFieldRegistry.ts`)

```ts
outboundTlsTypes        includes "vless"  ✓
outboundMultiplexTypes  includes "vless"  ✓
outboundTransportTypes  includes "vless"  ✓
outboundDialTypes       includes "vless"  ✓  (derived from CREATABLE_OUTBOUND_TYPES)
```

All four shared group sets correctly include `vless`. The `sharedGroupsForEntity` function emits `["dial", "tls", "multiplex", "tcp-brutal", "v2ray-transport"]` for an outbound vless node.

### Inspector TLS section (`src/components/Inspector.tsx` line 894-905)

The TLS shared-field card exposes these paths:
- `tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`

**Missing from Inspector TLS card (present in official spec):**
- `tls.disable_sni`
- `tls.reality.enabled` / `tls.reality.public_key` / `tls.reality.short_id` — Reality sub-object entirely absent
- `tls.utls.enabled` / `tls.utls.fingerprint` — uTLS sub-object absent
- `tls.ech.*` (ech.enabled, ech.config, ech.config_path, ech.query_server_name) — ECH sub-object absent
- `tls.fragment`, `tls.fragment_fallback_delay`, `tls.record_fragment` — fragmentation fields absent
- `tls.cipher_suites` — absent
- `tls.curve_preferences` (1.13.0) — absent
- `tls.certificate` (inline PEM) — absent (only path is present)
- `tls.certificate_public_key_sha256` — absent
- `tls.client_certificate`, `tls.client_certificate_path`, `tls.client_key`, `tls.client_key_path` — mTLS fields absent

### Inspector outbound section (`src/components/Inspector.tsx` line 1505-1546)

Handled top-level outbound fields: `server`, `server_port`, `outbounds`, `default`, and anything in `outboundHandledFields` + `dialSharedFields`.

**Missing from outbound block (VLESS-specific, not in `outboundHandledFields`):**
- `uuid` — not in `outboundHandledFields`; falls through to `AdvancedScalarFields` (generic text input, acceptable but not validated)
- `flow` — not in `outboundHandledFields`; falls through to `AdvancedScalarFields` as raw text; should be a `<select>` with `["", "xtls-rprx-vision"]`
- `network` — not in `outboundHandledFields`; falls through to `AdvancedScalarFields` as raw text; should be a `<select>` with `["", "tcp", "udp"]`
- `packet_encoding` — not in `outboundHandledFields`; falls through to `AdvancedScalarFields` as raw text; should be a `<select>` with `["", "packetaddr", "xudp"]`

---

## Priority Findings

### P0 — Reality sub-object not supported in TLS Inspector card

The `tls.reality` object (`enabled`, `public_key`, `short_id`) has zero UI representation. VLESS + Reality is the dominant real-world deployment pattern for this outbound type. A user configuring Reality must drop to the raw JSON textarea. There is no diagnostic to catch a missing `reality.public_key` when `reality.enabled = true`.

**Impact:** VLESS + Reality is completely unusable from the Inspector. Any imported config that contains a `tls.reality` block will display correctly in the JSON panel but will be silently ignored by the TLS card.

**Fix required:**
- Add a "Reality" collapsible section (or extend the TLS card) with:
  - `tls.reality.enabled` (boolean toggle)
  - `tls.reality.public_key` (text, conditionally required)
  - `tls.reality.short_id` (text, conditionally required; hex 0–8 digits, validate format)
- Add a semantic diagnostic: when `tls.reality.enabled = true` and `public_key` is empty, emit a P0 error.

### P0 — `uuid` is required but has no dedicated Inspector control with validation

`uuid` is the only required credential field. It lands in `AdvancedScalarFields` as a plain unvalidated text input labelled "Uuid". There is no UUID format validation and no diagnostic for empty uuid.

**Fix required:**
- Add `uuid` to `outboundHandledFields` and render it as a dedicated labelled `<input type="text">` in the outbound block (above `server`).
- Add a semantic diagnostic: when `uuid` is empty or not a valid UUID v4 format, emit a P0 error.
- The default scaffold already seeds a valid UUID; preserve this on type switch.

### P1 — `flow` and `packet_encoding` lack select controls

`flow` and `packet_encoding` are both enum fields that fall through to the generic scalar text input. This allows invalid values to be silently written to the config.

**`flow`:**
- Official values: `""` (none) or `"xtls-rprx-vision"`.
- Mutual exclusion: `flow` requires TLS and is incompatible with `multiplex.enabled = true`. No diagnostic for this conflict exists.
- Fix: render as `<select>` with options `["(none)", "xtls-rprx-vision"]`. Add a diagnostic when `flow = "xtls-rprx-vision"` and `tls.enabled != true`.
- Add `flow` to `outboundHandledFields`.

**`packet_encoding`:**
- Official values: `""` (disabled), `"packetaddr"`, `"xudp"`.
- Fix: render as `<select>` with options. Add `packet_encoding` to `outboundHandledFields`.

### P1 — `network` field is a raw text input instead of a select

`network` accepts only `"tcp"` or `"udp"`. It currently falls through to `AdvancedScalarFields` as unvalidated text.

**Fix required:**
- Add `network` to `outboundHandledFields` and render as `<select>` with options `["(both)", "tcp", "udp"]`.

### P1 — uTLS sub-object absent from TLS card

`tls.utls` (enabled + fingerprint) is not represented in the TLS Inspector card. Users configuring browser fingerprinting must use raw JSON. While uTLS is not recommended by the official docs, it is widely deployed and must be editable.

**Fix required:** Add a "uTLS" collapsible section to the TLS card with `tls.utls.enabled` (boolean) and `tls.utls.fingerprint` (select: chrome/firefox/edge/safari/360/qq/ios/android/random/randomized).

### P1 — ECH sub-object absent from TLS card

`tls.ech` (enabled, config, config_path, query_server_name) is not represented. For users leveraging ECH, the full ECH configuration requires the raw JSON textarea.

**Fix required:** Add an "ECH" collapsible section to the TLS card with the four client-side fields.

### P1 — Fragmentation fields (fragment, fragment_fallback_delay, record_fragment) absent

These three fields (added in 1.12.0) are entirely absent from the TLS card.

**Fix required:** Add a "TLS Fragmentation" collapsible section under the TLS card.

---

## Implementation Tasks

1. **Add `uuid` as first-class outbound field (P0)**
   - Add `"uuid"` to `outboundHandledFields` in `Inspector.tsx`.
   - Render a dedicated `<input type="text">` labelled "UUID" before `Server` in the outbound block.
   - Add semantic diagnostic for empty or malformed UUID.

2. **Add Reality section to TLS shared field definitions (P0)**
   - Extend `sharedFieldDefinitions("tls", ...)` in `Inspector.tsx` to include three Reality entries: `tls.reality.enabled` (boolean), `tls.reality.public_key` (text), `tls.reality.short_id` (text).
   - Add semantic diagnostic: `reality.enabled && !reality.public_key` → error.
   - Consider gating `public_key` and `short_id` inputs on `reality.enabled = true` via conditional rendering.

3. **Add `flow` select control (P1)**
   - Add `"flow"` to `outboundHandledFields`.
   - Render as `<select>` with options `["", "xtls-rprx-vision"]` only when `entityType === "vless"`.
   - Add a diagnostic: `flow = "xtls-rprx-vision"` and `!tls.enabled` → warning.
   - Add a diagnostic: `flow = "xtls-rprx-vision"` and `multiplex.enabled` → warning (mutually exclusive).

4. **Add `packet_encoding` select control (P1)**
   - Add `"packet_encoding"` to `outboundHandledFields`.
   - Render as `<select>` with options `["", "packetaddr", "xudp"]` only when `entityType === "vless"`.

5. **Add `network` select control (P1)**
   - Add `"network"` to `outboundHandledFields`.
   - Render as `<select>` with options `["", "tcp", "udp"]`. Applicable to any outbound that carries `network` (vmess, trojan also use it).

6. **Extend TLS shared field definitions for uTLS (P1)**
   - Add `tls.utls.enabled` (boolean) and `tls.utls.fingerprint` (select) to the `"tls"` group in `sharedFieldDefinitions`.
   - Fingerprint options: `["", "chrome", "firefox", "edge", "safari", "360", "qq", "ios", "android", "random", "randomized"]`.

7. **Extend TLS shared field definitions for ECH (P1)**
   - Add `tls.ech.enabled`, `tls.ech.config` (list), `tls.ech.config_path` (text), `tls.ech.query_server_name` (text).

8. **Extend TLS shared field definitions for fragmentation (P1)**
   - Add `tls.fragment` (boolean), `tls.fragment_fallback_delay` (text), `tls.record_fragment` (boolean).

9. **Verify type-switch field preservation**
   - When switching from `vless` to another type and back, `uuid` must be preserved. Verify `changeEntityType` in `useProjectStore` handles this. The current default scaffold for vless includes a hardcoded uuid; if a type switch destroys it, users lose their credential silently.

10. **Add fixture coverage**
    - Add an E2E fixture that includes a vless outbound with `tls.reality` and `flow = "xtls-rprx-vision"` to confirm import, render, edit (reality public_key), and JSON-export round-trip.

---

## Done Criteria

- `uuid` is rendered as a dedicated labelled input and a missing uuid emits a P0 diagnostic.
- `flow` is a select control; selecting `xtls-rprx-vision` with TLS disabled emits a warning.
- `packet_encoding` is a select control.
- `network` is a select control.
- The TLS card includes Reality (enabled + public_key + short_id) with a conditional required diagnostic.
- The TLS card includes uTLS (enabled + fingerprint select).
- The TLS card includes ECH (enabled + config + config_path + query_server_name).
- The TLS card includes fragment / fragment_fallback_delay / record_fragment.
- A fixture with Reality config round-trips through import → edit → export without data loss.
