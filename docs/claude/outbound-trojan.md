# Outbound / trojan UI Review

<!-- Source: official stable + testing docs (identical); reviewed against Palette, Inspector, sharedFieldRegistry, commands.ts, diagnostics.ts, SbcNode.tsx, graph.ts. -->

## Official Model (stable = testing)

Canonical JSON structure for `outbound[type=trojan]`:

```json
{
  "type": "trojan",
  "tag": "trojan-out",
  "server": "127.0.0.1",
  "server_port": 1080,
  "password": "8JCsPssfgS8tiRwiMlhARg==",
  "network": "tcp",
  "tls": {},
  "multiplex": {},
  "transport": {},
  // ... Dial Fields
}
```

### Field inventory (official, 8 top-level slots + nested TLS + shared dial — 42 total including full TLS)

| Field | Required | Type | Notes |
|---|---|---|---|
| `server` | **yes** | string | server address |
| `server_port` | **yes** | integer | server port |
| `password` | **yes** | string | Trojan authentication credential |
| `network` | no | select | `"tcp"` or `"udp"`; both enabled when omitted |
| `tls` | no (strongly recommended) | object | see shared TLS; Trojan over plaintext is possible but insecure |
| `tls.enabled` | no | boolean | |
| `tls.server_name` | no | string | |
| `tls.insecure` | no | boolean | client only |
| `tls.alpn` | no | string[] | |
| `tls.min_version` | no | select | 1.0/1.1/1.2/1.3 |
| `tls.max_version` | no | select | 1.0/1.1/1.2/1.3 |
| `tls.certificate_path` | no | string | |
| `tls.certificate_provider` | no | string | |
| `tls.disable_sni` | no | boolean | client only |
| `tls.reality.*` | no | object | reality.enabled / public_key / short_id |
| `tls.utls.*` | no | object | utls.enabled / fingerprint |
| `tls.ech.*` | no | object | ech.enabled / config / config_path / query_server_name |
| `tls.fragment` | no | boolean | since 1.12.0; client only |
| `tls.fragment_fallback_delay` | no | string | since 1.12.0; default 500ms |
| `tls.record_fragment` | no | boolean | since 1.12.0; client only |
| `tls.cipher_suites` | no | string[] | TLS 1.0–1.2 only |
| `tls.curve_preferences` | no | string[] | since 1.13.0 |
| `tls.certificate` | no | string | inline PEM |
| `tls.certificate_public_key_sha256` | no | string[] | since 1.13.0; client only |
| `tls.client_certificate` | no | string[] | since 1.13.0; mTLS |
| `tls.client_certificate_path` | no | string | since 1.13.0; mTLS |
| `tls.client_key` | no | string[] | since 1.13.0; mTLS |
| `tls.client_key_path` | no | string | since 1.13.0; mTLS |
| `multiplex.*` | no | object | enabled / protocol / max_connections / min_streams / max_streams / padding / brutal |
| `transport.*` | no | object | type: http/ws/quic/grpc/httpupgrade + type-specific fields |
| dial fields | no | object | detour / bind_interface / connect_timeout / domain_resolver / network_strategy / network_type / fallback_network_type / fallback_delay |

**Official field count: 8 named top-level fields + 22 TLS sub-fields + 7 multiplex sub-fields + 1 transport object + 8 dial fields = ~46 total addressable fields.**

---

## Registry / Code Audit

### Palette (`src/components/Palette.tsx` line 160)

```ts
{ label: "Trojan", kind: "trojan-out", icon: Shield, docsUrl: docs("outbound/trojan/"), status: "setup" }
```

- Kind is `trojan-out`, palette kind is NOT `outbound-trojan`. The entry exists, status is `"setup"`.
- `docsUrl` correctly points to the official Trojan outbound doc.
- Status `"setup"` means the button is actionable and calls `createFromPalette("trojan-out")`.
- Button label shown to user: "Setup"; aria-label: "Setup Trojan".

### Palette kind → type mapping (`src/domain/protocols.ts` line 8)

```ts
"trojan-out": "trojan"
```

Correctly maps palette kind `trojan-out` to domain type `trojan`.

### Default object (`src/domain/commands.ts` lines 315–324)

```ts
{
  type: "trojan",
  tag,
  server: "127.0.0.1",
  server_port: 1080,
  password: "change-me",
  network: "tcp",
}
```

- `tls`, `multiplex`, and `transport` are **not included** in the default object; they are omitted until the user adds them via shared module cards.
- `password` is seeded as the placeholder `"change-me"` — not a real credential. No validation diagnostic catches this value.
- `network` defaults to `"tcp"` in the scaffold, overriding the official default of "both enabled". This is a minor deviation; if a user intends to allow UDP they must manually change it.

### sharedFieldRegistry (`src/domain/sharedFieldRegistry.ts`)

```
outboundTlsTypes        includes "trojan"  ✓  (line 151)
outboundMultiplexTypes  includes "trojan"  ✓  (line 153)
outboundTransportTypes  includes "trojan"  ✓  (line 154)
outboundDialTypes       includes "trojan"  ✓  (derived from CREATABLE_OUTBOUND_TYPES, line 150)
```

All four shared group sets correctly include `trojan`. `sharedGroupsForEntity` emits `["dial", "tls", "multiplex", "tcp-brutal", "v2ray-transport"]` for an outbound trojan node.

### Inspector outbound section (`src/components/Inspector.tsx` lines 1505–1546)

The outbound block renders first-class controls for:
- `server` → text input (present in `outboundHandledFields`)
- `server_port` → number input (present in `outboundHandledFields`)
- `outbounds` → comma text (selector/urltest only)
- `default` → text (selector/urltest only)
- Shared group cards: TLS, Dial, Multiplex, V2Ray Transport (from `sharedGroupsForEntity`)

**`outboundHandledFields` set (Inspector.tsx lines 128–141):**
```ts
"tag", "type", "server", "server_port", "outbounds", "default",
"tls", "multiplex", "transport", "udp_over_tcp",
...dialSharedFields, ...quicSharedFields
```

**Fields NOT in `outboundHandledFields` that exist in the Trojan default object:**
- `password` — not in `outboundHandledFields`; falls through to `AdvancedScalarFields` (generic text input, no label distinction from other advanced fields)
- `network` — not in `outboundHandledFields`; falls through to `AdvancedScalarFields` as raw text; should be a `<select>` with `["", "tcp", "udp"]`

Both `password` and `network` are present in the default scaffold so they will appear in `AdvancedScalarFields` — they are editable, but they are buried under the "Advanced fields" disclosure rather than being first-class controls.

### Inspector TLS card (`src/components/Inspector.tsx` lines 894–905)

The TLS shared-field card exposes:
- `tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`

**Missing from Inspector TLS card (present in official spec):**
- `tls.disable_sni`
- `tls.reality.*` — Reality sub-object entirely absent (enabled / public_key / short_id)
- `tls.utls.*` — uTLS sub-object absent (enabled / fingerprint)
- `tls.ech.*` — ECH sub-object absent (enabled / config / config_path / query_server_name)
- `tls.fragment`, `tls.fragment_fallback_delay`, `tls.record_fragment`
- `tls.cipher_suites`
- `tls.curve_preferences` (since 1.13.0)
- `tls.certificate` (inline PEM; only path is exposed)
- `tls.certificate_public_key_sha256`
- `tls.client_certificate`, `tls.client_certificate_path`, `tls.client_key`, `tls.client_key_path` — mTLS fields absent

### Diagnostics (`src/domain/diagnostics.ts`)

There are **no outbound-level field diagnostics** for Trojan. Specifically:
- No diagnostic for `password` being the placeholder `"change-me"` or being empty.
- No diagnostic for `tls.enabled` being `false`/missing on a Trojan outbound (TLS is strongly recommended for Trojan; plaintext Trojan is a security hazard).
- No diagnostic for `server` being the default `"127.0.0.1"` (placeholder server address).

The only outbound-level diagnostics that apply to Trojan are:
- Tag deduplication (all entity types).
- Missing `detour` reference (from `outbound.detour`).
- Missing selector/urltest candidate membership (only for group outbounds, does not apply here).

### Canvas Node (`src/components/SbcNode.tsx` + `src/canvas/graph.ts`)

- Icon: `Shield` (shared by all protocol outbounds that are not direct/block/selector/urltest). Correct.
- Subtitle: `"trojan 127.0.0.1:1080"` (server:port format). Correct representation for a freshly created node.
- Node title bar label: `"outbound / trojan"` (kind + type). Redundant with subtitle; not human-named.
- Output port: `"dial-detour"` (downstream dial detour outbound). Correct via `supportsDialDetour("trojan") === true`.
- Input ports: standard outbound group (route/final, rule outbound, selector candidate, urltest candidate, dns-detour, detour-target, service-detour, rule-set-download).
- `compatible` array: empty (non-group outbounds do not auto-create companions). The `+` button and toolbar count show `1` but create nothing useful.

---

## Priority Findings

### P0 — `password` (required credential) is not a first-class Inspector control

`password` is the sole required authentication credential for Trojan. It is absent from `outboundHandledFields` and falls through to the `AdvancedScalarFields` disclosure ("Advanced fields N") as a generic text input labelled "Password". There is no validation, no type="password" masking option, and no diagnostic for the default placeholder value `"change-me"`.

**Impact:** A user creating a Trojan outbound will have a non-functional credential silently in the config unless they expand the Advanced fields section and change it. This is a critical usability and correctness gap for the only required protocol-specific field.

**Fix required:**
- Add `"password"` to `outboundHandledFields` in `Inspector.tsx`.
- Render a dedicated `<input type="text">` labelled "Password" in the outbound block, immediately after `server_port` and before the shared group cards.
- Add a semantic diagnostic: when `type === "trojan"` and `password` is empty, `undefined`, or equal to `"change-me"`, emit a P0 error at `/outbounds/{index}/password`.

### P0 — TLS absent from default scaffold with no warning (Trojan over plaintext is a security hazard)

The Trojan protocol is designed to masquerade as HTTPS traffic. Without TLS, the `password` is transmitted in plaintext and the masquerade is broken. The default scaffold omits `tls` entirely, and no diagnostic warns the user that TLS is absent.

**Impact:** A user who clicks "Setup Trojan" and uses the default node will export a config with no TLS. This will fail to authenticate with most real Trojan servers and exposes the password in plaintext.

**Fix required:**
- Add a semantic diagnostic: when `type === "trojan"` and `tls.enabled` is `false` or the `tls` object is absent, emit a **warning** at `/outbounds/{index}/tls` stating "Trojan strongly recommends TLS; plaintext Trojan exposes the password and breaks protocol masquerading."
- Optionally: include a minimal `tls: { enabled: false }` stub in the default scaffold so the TLS card renders with the toggle clearly visible as disabled, signalling to the user that TLS configuration is expected.

### P1 — `network` field is a raw text input instead of a select

`network` accepts only `"tcp"` or `"udp"`. It falls through to `AdvancedScalarFields` as unvalidated text. The official docs state "Both is enabled by default", meaning any value other than `"tcp"` or `"udp"` is invalid.

Additionally, the default scaffold seeds `network: "tcp"`, which disables UDP by default — a deviation from the official "both enabled" default that is invisible in the Inspector.

**Fix required:**
- Add `"network"` to `outboundHandledFields` in `Inspector.tsx`.
- Render as `<select>` with options `["(both)", "tcp", "udp"]` where "(both)" maps to an empty/omitted value.
- This fix applies to all outbound types that include `network` (vmess, trojan, vless, naive).

### P1 — TLS Reality, uTLS, ECH, and fragmentation sub-objects absent from TLS Inspector card

The TLS shared-field card at `sharedFieldDefinitions("tls", ...)` in `Inspector.tsx` exposes only 8 fields out of approximately 22+ available TLS sub-fields. For Trojan, the most impactful missing sub-objects are:

- **Reality** (`tls.reality.enabled`, `tls.reality.public_key`, `tls.reality.short_id`) — Used for advanced anti-detection deployments. Full absence means any Reality config must be entered via the raw JSON textarea.
- **uTLS** (`tls.utls.enabled`, `tls.utls.fingerprint`) — Used for browser fingerprint impersonation.
- **ECH** (`tls.ech.enabled`, `tls.ech.config`, `tls.ech.config_path`, `tls.ech.query_server_name`) — Encrypted Client Hello support.
- **Fragmentation** (`tls.fragment`, `tls.fragment_fallback_delay`, `tls.record_fragment`) — Added in 1.12.0.

**Fix required (shared across all TLS-capable outbounds):**
- Extend `sharedFieldDefinitions("tls", ...)` to include Reality, uTLS, ECH, and fragmentation sections.
- These fixes benefit all outbound types in `outboundTlsTypes` (anytls, http, hysteria, hysteria2, naive, shadowtls, trojan, tuic, vless, vmess).

### P1 — Default scaffold seeds placeholder `password: "change-me"` and non-default `network: "tcp"`

The default scaffold for `trojan` outbound (`commands.ts` lines 315–324) seeds:
- `password: "change-me"` — an obviously invalid credential that will fail authentication at any real server.
- `network: "tcp"` — overrides the official "both enabled" default.

Both values would benefit from inline diagnostics or at minimum clearer placeholder handling in the Inspector. The `network` deviation also means that UDP through a Trojan outbound is silently disabled until the user explicitly changes it.

---

## Implementation Tasks

1. **Add `password` as first-class outbound field (P0)**
   - Add `"password"` to `outboundHandledFields` in `Inspector.tsx`.
   - Render a dedicated `<input type="text">` labelled "Password" after `server_port` in the outbound block, gated on `"password" in entity`.
   - Add semantic diagnostic in `diagnostics.ts`: `type === "trojan" && (!password || password === "change-me")` → P0 error at `/outbounds/{index}/password`.

2. **Add TLS-absent warning for Trojan (P0)**
   - In `diagnostics.ts` outbound loop, add: when `outbound.type === "trojan"` and the `tls` object is absent or `tls.enabled !== true`, push a `"warning"` diagnostic (`"trojan-tls-recommended"`) at `/outbounds/{index}/tls`.

3. **Add `network` select control (P1)**
   - Add `"network"` to `outboundHandledFields` in `Inspector.tsx`.
   - Render as `<select>` with values `["", "tcp", "udp"]` (labels: "Both (default)", "TCP only", "UDP only").
   - Gate rendering on `"network" in entity`.
   - This change is shared and benefits vmess, trojan, vless, and naive outbounds.

4. **Extend TLS shared field definitions for Reality (P1)**
   - In `sharedFieldDefinitions("tls", ...)`, add three entries: `tls.reality.enabled` (boolean), `tls.reality.public_key` (text), `tls.reality.short_id` (text).
   - Add a semantic diagnostic: when `tls.reality.enabled === true` and `tls.reality.public_key` is absent, emit an error.

5. **Extend TLS shared field definitions for uTLS (P1)**
   - Add `tls.utls.enabled` (boolean) and `tls.utls.fingerprint` (select: chrome/firefox/edge/safari/360/qq/ios/android/random/randomized).

6. **Extend TLS shared field definitions for ECH (P1)**
   - Add `tls.ech.enabled`, `tls.ech.config` (list), `tls.ech.config_path` (text), `tls.ech.query_server_name` (text).

7. **Extend TLS shared field definitions for fragmentation (P1)**
   - Add `tls.fragment` (boolean), `tls.fragment_fallback_delay` (text, default "500ms"), `tls.record_fragment` (boolean).

8. **Review default scaffold `network` value (P1)**
   - Consider whether to omit `network` from the Trojan default scaffold (to match official "both enabled" default) or keep `"tcp"` and document the deviation. If kept, ensure the `network` select clearly shows the current value so users know UDP is disabled.

9. **Add fixture coverage**
   - Add or extend an E2E fixture that includes a Trojan outbound with `tls.enabled: true`, `tls.server_name`, and a non-placeholder `password` to confirm import, render, edit, and JSON-export round-trip.
   - Verify that adding a Trojan node, editing `password`, and enabling TLS all produce correct canonical JSON output.

---

## Done Criteria

- `password` is rendered as a dedicated labelled input, not hidden in Advanced fields.
- A missing or placeholder `password` emits a P0 diagnostic.
- A Trojan outbound without `tls.enabled` emits a warning diagnostic.
- `network` is a `<select>` control with "Both (default)" / "TCP only" / "UDP only" options.
- The TLS card includes Reality (enabled + public_key + short_id) with a conditional required diagnostic.
- The TLS card includes uTLS (enabled + fingerprint select).
- The TLS card includes ECH fields.
- The TLS card includes fragmentation fields.
- A fixture with Trojan + TLS round-trips through import → edit → export without data loss.
