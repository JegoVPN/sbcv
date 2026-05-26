<!-- Deep review. Source: official stable + testing docs (identical for this node), Palette.tsx, Inspector.tsx, SbcNode.tsx, sharedFieldRegistry.ts, commands.ts. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / vmess — UI Deep Review

## Official Field Inventory (stable = testing)

Total top-level protocol-specific fields: **17** (including shared section references).

### Top-level vmess outbound

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `type` | `"vmess"` | yes | — | fixed |
| `tag` | string | — | — | identifies node |
| `server` | string | **yes** | — | server address |
| `server_port` | integer | **yes** | — | server port |
| `uuid` | string (UUID) | **yes** | — | VMess user ID |
| `security` | string (enum) | — | `"auto"` | encryption method (see below) |
| `alter_id` | integer | — | `0` | 0 = AEAD; 1 = legacy; >1 = same as 1 |
| `global_padding` | boolean | — | — | wastes traffic randomly (v2ray default-on) |
| `authenticated_length` | boolean | — | — | enables length block encryption |
| `network` | string (enum) | — | both | `"tcp"` or `"udp"`; both enabled if omitted |
| `tls` | object | — | — | shared outbound TLS section |
| `packet_encoding` | string (enum) | — | `""` | UDP packet encoding (see below) |
| `transport` | object | — | — | shared v2ray-transport section |
| `multiplex` | object | — | — | shared multiplex section |
| *(dial fields)* | — | — | — | see shared/dial.md |

### `security` enum values

Standard (all versions):
- `"auto"` — automatic selection (default)
- `"none"` — no encryption
- `"zero"` — no encryption, no authentication
- `"aes-128-gcm"` — AES-128-GCM AEAD
- `"chacha20-poly1305"` — ChaCha20-Poly1305 AEAD

Legacy (deprecated):
- `"aes-128-ctr"` — legacy AES-128-CTR (not recommended)

### `alter_id` semantics

| Value | Behavior |
|---|---|
| `0` | Use AEAD protocol (recommended) |
| `1` | Use legacy MD5 protocol |
| `> 1` | Unused; treated same as `1` |

### `packet_encoding` enum values

| Value | Description |
|---|---|
| `""` (empty) | Disabled |
| `"packetaddr"` | v2ray 5+ compatible |
| `"xudp"` | xray compatible |

### tls (outbound shape)

Key outbound-relevant TLS fields:

| Field | Notes |
|---|---|
| `enabled` | boolean toggle |
| `disable_sni` | omit SNI from ClientHello |
| `server_name` | override SNI |
| `insecure` | skip certificate verification |
| `alpn` | string[] |
| `min_version` / `max_version` | `1.0`–`1.3` |
| `cipher_suites` | string[] |
| `certificate` / `certificate_path` | trust anchor PEM |
| `certificate_public_key_sha256` | pin by public key hash |
| `client_certificate` / `client_certificate_path` | mTLS client cert |
| `client_key` / `client_key_path` | mTLS client private key |
| `utls` | sub-object: `enabled`, `fingerprint` |
| `fragment` | sub-object: `enabled`, `size`, `sleep` |
| `record_fragment` | boolean (since 1.13.0) |
| `ech` | sub-object: `enabled`, `config`, `config_path` |
| `reality` | sub-object: `enabled`, `public_key`, `short_id` |

### multiplex (outbound shape)

| Field | Notes |
|---|---|
| `enabled` | boolean |
| `protocol` | `"smux"`, `"yamux"`, `"h2mux"` |
| `max_connections` | integer |
| `min_streams` | integer |
| `max_streams` | integer |
| `padding` | boolean |
| `brutal` | sub-object (TCP Brutal rate control) |

### transport (v2ray-transport)

Type discriminated by `type` field. Available types: `http`, `ws`, `quic`, `grpc`, `httpupgrade`.

| type | Unique fields |
|---|---|
| `http` | `host[]`, `path`, `method`, `headers{}`, `idle_timeout`, `ping_timeout` |
| `ws` | `path`, `headers{}`, `max_early_data`, `early_data_header_name` |
| `quic` | (no extra fields) |
| `grpc` | `service_name`, `idle_timeout`, `ping_timeout`, `permit_without_stream` |
| `httpupgrade` | `host`, `path`, `headers{}` |

### dial fields (shared/dial.md)

| Field | Notes |
|---|---|
| `detour` | outbound tag for upstream dial |
| `bind_interface` | bind to interface |
| `connect_timeout` | duration string |
| `domain_resolver` | DNS server tag |
| `network_strategy` | `"default"`, `"hybrid"`, `"fallback"` |
| `network_type` | string[] |
| `fallback_network_type` | string[] |
| `fallback_delay` | duration string |

---

## Current UI State

### Palette (Palette.tsx:159)

```
{ label: "VMess", kind: "vmess-out", icon: Shield, docsUrl: docs("outbound/vmess/"), status: "setup" }
```

- Status `"setup"` — the item renders as a non-ready setup action.
- `docsUrl` is correctly set to `outbound/vmess/`.
- Icon is `Shield` — consistent with other encrypted outbound types.

### Protocols / kind mapping (protocols.ts)

- `"vmess-out"` maps to sing-box type `"vmess"` (line 7).
- `"vmess"` is in `CREATABLE_OUTBOUND_TYPES` (line 30).
- Reverse map: `vmess: "vmess-out"` (line 152) — this is correct and consistent with the Palette kind.
- Preferred tag: `vmess: "vmess-out"` (line 152) — generated tags will be `"vmess-out"`.

### Default creation object (commands.ts:303–314)

```js
{
  type: "vmess",
  tag,
  server: "127.0.0.1",
  server_port: 1080,
  uuid: "bf000d23-0752-40b4-affe-68f7707a9661",
  security: "auto",
  alter_id: 0,
  network: "tcp",
}
```

Findings:

- `server` and `server_port` are present — correct.
- `uuid` is a hardcoded placeholder UUID — acceptable for default but must prompt user to change.
- `security: "auto"` — correct default.
- `alter_id: 0` — correct (AEAD mode).
- `network: "tcp"` is set explicitly. Official docs say both TCP and UDP are enabled if omitted. Hardcoding `"tcp"` restricts UDP-capable configurations unnecessarily; the default should arguably omit this field.
- Missing from default: `global_padding`, `authenticated_length`, `packet_encoding` — omission is fine as these are optional/false-by-default. But `packet_encoding` is a common field that users frequently need to set; it should appear in the Inspector even when absent from the JSON object.

### sharedFieldRegistry.ts

VMess outbound correctly participates in all applicable shared groups:

| Group | Set | Included |
|---|---|---|
| `dial` | `outboundDialTypes` (all creatable outbounds except block/dns/selector/urltest) | yes |
| `tls` | `outboundTlsTypes` (line 151) | yes |
| `multiplex` | `outboundMultiplexTypes` (line 153) | yes |
| `tcp-brutal` | pushed together with `multiplex` (line 178) | yes |
| `v2ray-transport` | `outboundTransportTypes` (line 154) | yes |

`sharedGroupsForEntity` for `kind=outbound, type=vmess` returns: `["dial", "tls", "multiplex", "tcp-brutal", "v2ray-transport"]` — correct.

Absent groups correctly excluded:
- `quic` — VMess does not use QUIC natively (correct).
- `udp-over-tcp` — not applicable to VMess (correct).

### outboundHandledFields (Inspector.tsx:128–141)

```js
const outboundHandledFields = new Set([
  "tag", "type",
  "server", "server_port",
  "outbounds", "default",
  "tls", "multiplex", "transport", "udp_over_tcp",
  ...dialSharedFields,   // detour, bind_interface, connect_timeout, domain_resolver,
                          // network_strategy, network_type, fallback_network_type, fallback_delay
  ...quicSharedFields,   // initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period
]);
```

Fields **NOT in handledFields** (will fall to `AdvancedScalarFields` raw scalar fallback):

| Field | Type | Expected treatment |
|---|---|---|
| `uuid` | string | **first-class text input** (required field) |
| `security` | string (enum) | **first-class select** (5 standard + 1 legacy option) |
| `alter_id` | integer | **first-class number input** with warning when > 0 |
| `global_padding` | boolean | advanced boolean toggle (acceptable in Advanced section) |
| `authenticated_length` | boolean | advanced boolean toggle (acceptable in Advanced section) |
| `network` | string (enum) | **first-class select**: `""` (both), `"tcp"`, `"udp"` |
| `packet_encoding` | string (enum) | **first-class select**: `""`, `"packetaddr"`, `"xudp"` |

Currently `uuid`, `security`, `alter_id`, `network`, and `packet_encoding` all fall through to `AdvancedScalarFields`. Since `AdvancedScalarFields` renders raw text inputs for strings and number inputs for integers, `uuid` and `alter_id` will surface as plain text/number fields. However:

1. `security` is a string — it will render as a free-text input, not a constrained select. A user could type an invalid value.
2. `network` is a string — same issue; `"both"` is not a valid sing-box value (omitting the field means both).
3. `packet_encoding` is a string — a user could type anything; there are only three valid values.
4. `alter_id` will surface as a number input (type auto-detection works for integers) — this is functional but lacks the AEAD/legacy warning.
5. `global_padding` and `authenticated_length` are booleans — `AdvancedScalarFields` renders these as checkboxes (line 387–391), which is acceptable for advanced/rarely-used protocol parameters.

The key problem is that `uuid` is a **required field** that must be correct for authentication to work. It should be a first-class text input with UUID validation, not buried in an "Advanced fields" collapsible section.

### Inspector.tsx — server/server_port rendering

The outbound Inspector branch (lines 1505–1546) renders:

- `server` — first-class text input (line 1507–1514): correct.
- `server_port` — first-class number input (line 1516–1524): correct.
- `outbounds` — candidates list (selector/urltest only): not applicable to vmess, but guarded by `"outbounds" in entity`.
- `default` — default outbound (selector/urltest only): not applicable.
- `AdvancedScalarFields` fallback (line 1544): catches all remaining scalar fields.

The `server` and `server_port` first-class controls are correct. The VMess-specific fields (`uuid`, `security`, `alter_id`, `network`, `packet_encoding`) are left to the generic scalar fallback.

### SbcNode.tsx — ports

For `kind === "outbound"` (lines 104–118):

Input ports:
- Route final, Route rule outbound, Selector candidate, URLTest candidate, Dial detour target, DNS detour, Service detour — all correct.

Output ports (line 179–180):
- `supportsDialDetour(type)` returns `true` for `"vmess"` (since it is not block/selector/urltest/dns).
- Right output port: "Downstream dial detour" — correct, VMess supports `detour`.

No VMess-specific port logic — acceptable; VMess does not have inbound-side connection ports (it is purely an outbound).

---

## Priority Findings

### P0 — `uuid` is a required field buried in "Advanced fields"

`uuid` is listed in the official docs as **Required**. It is not in `outboundHandledFields`, so it falls to `AdvancedScalarFields` as a plain text input inside a collapsed `<details>` section labeled "Advanced fields". A user creating a new VMess outbound node will see the Inspector with `server`, `server_port` first-class, but must expand "Advanced fields" to find and edit the UUID — the single most critical auth credential. This is a critical usability failure for a required field.

**Required fix:** Add `uuid` to the outbound inspector rendering block for VMess (or a dedicated vmess block), before the `AdvancedScalarFields` fallback. It should appear as a first-class text input alongside `server`/`server_port`, with a UUID generation button.

### P0 — `security` is a free-text input instead of a constrained select

`security` is a string with exactly 6 valid values (5 standard + 1 legacy). As a generic `AdvancedScalarFields` text input, a user can type any string — invalid values silently produce a broken config. There is no validation, no enum hint, and no legacy warning for `aes-128-ctr`.

**Required fix:** Render `security` as a `<select>` element with the correct option list, with `"auto"` as the pre-selected default. Include a visible warning next to `"aes-128-ctr"` noting it is a legacy method.

### P1 — `network` is missing a constrained select; default `"tcp"` in commands.ts is too restrictive

Two sub-issues:

1. `network` falls to a free-text input. Valid values are only `"tcp"` and `"udp"` (plus the omit-to-mean-both semantics). A user typing `"both"` would produce an invalid config.
2. The default creation object sets `network: "tcp"` explicitly, disabling UDP for all newly created VMess nodes. Official default is both-enabled (field omitted). This means real-world configs that need UDP (e.g., for DNS-over-VMess or XUDP) require the user to remember to delete the `network` field — a non-obvious operation in the current UI.

**Required fix:**
- Render `network` as a `<select>` with options: `""` (Both — default), `"tcp"`, `"udp"`.
- Change commands.ts default for outbound vmess to omit `network` entirely, letting the protocol default (both) apply.

### P1 — `packet_encoding` is a free-text input instead of a constrained select

`packet_encoding` has exactly 3 valid values (empty string, `"packetaddr"`, `"xudp"`). As a free-text input it can accept arbitrary values. This field is also important for xray/v2ray interoperability and users frequently need to set it; it should be a select and could reasonably be a first-class control (not buried in advanced).

**Required fix:** Render `packet_encoding` as a `<select>` with options: `""` (Disabled), `"packetaddr"` (v2ray 5+), `"xudp"` (xray).

### P1 — `alter_id` warning not surfaced in UI

`alter_id: 1` enables the legacy MD5 VMess protocol, which is cryptographically weak and deprecated. The default `0` is correct. However, there is no UI-level validation or inline warning when a user sets `alter_id > 0` via the "Advanced fields" input. Any config with `alter_id > 0` should show a diagnostic.

**Required fix:** Add an inline warning/diagnostic when `alter_id > 0`: "Legacy VMess MD5 auth — not recommended; use alter_id: 0 for AEAD protocol."

---

## Implementation Tasks

1. **[P0] Add first-class `uuid` field to outbound Inspector**
   - In `Inspector.tsx`, inside the `ref.kind === "outbound"` branch, add a conditional for `entityType === "vmess"` (or a broader protocol-outbound block) that renders:
     - `uuid`: text input with UUID pattern hint and a "Generate UUID" button.
   - Add `"uuid"` to `outboundHandledFields` to suppress it from the `AdvancedScalarFields` fallback.

2. **[P0] Render `security` as a constrained select**
   - In the vmess-specific outbound block, render `security` as a `<select>` with options:
     `auto`, `none`, `zero`, `aes-128-gcm`, `chacha20-poly1305`, `aes-128-ctr` (marked Legacy).
   - Add `"security"` to `outboundHandledFields`.

3. **[P1] Render `network` as a constrained select + fix default**
   - In the vmess block, render `network` as a `<select>` with:
     `""` (Both — default), `"tcp"`, `"udp"`.
   - In `commands.ts` outbound vmess default, remove `network: "tcp"` so both are enabled by default.
   - Add `"network"` to `outboundHandledFields`.

4. **[P1] Render `packet_encoding` as a constrained select**
   - In the vmess block (or general outbound block shared with vless), render `packet_encoding` as a `<select>` with:
     `""` (Disabled), `"packetaddr"` (v2ray 5+), `"xudp"` (xray).
   - Add `"packet_encoding"` to `outboundHandledFields`.

5. **[P1] Add `alter_id` diagnostic**
   - In the semantic validator (or inline in Inspector), surface a warning when `alter_id > 0` for a vmess outbound.
   - Optionally, render `alter_id` as a first-class number input with an inline note when value > 0.
   - Add `"alter_id"` to `outboundHandledFields`.

6. **[Future / structured] UUID generation helper**
   - Provide a "Generate" button next to the `uuid` input that creates a new RFC 4122 v4 UUID.
   - Consider a diagnostic when the UUID matches the placeholder `bf000d23-0752-40b4-affe-68f7707a9661`.

7. **[Future / structured] `global_padding` and `authenticated_length` promotion**
   - Currently these boolean protocol parameters fall to `AdvancedScalarFields` checkboxes — acceptable for now.
   - Consider adding inline tooltips explaining the traffic implications: `global_padding` wastes bandwidth randomly (v2ray default-on behavior), `authenticated_length` enables length block encryption.
