<!-- Deep review. Source: official stable + testing docs (identical for this node), Palette.tsx, Inspector.tsx, SbcNode.tsx, sharedFieldRegistry.ts, commands.ts. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / vmess — UI Deep Review

## Official Field Inventory (stable = testing)

### Top-level vmess inbound

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"vmess"` | yes | fixed |
| `tag` | string | — | identifies node |
| `users` | `VMessUser[]` | **yes** | repeater array |
| `tls` | object | — | shared inbound TLS section |
| `multiplex` | object | — | shared inbound multiplex section |
| `transport` | object | — | shared v2ray-transport section |
| *(listen fields)* | — | — | see shared/listen.md |

Total protocol-specific top-level fields: **1 required array** (`users`), **3 shared object sections** (`tls`, `multiplex`, `transport`), **listen block** (~14 fields).

### users[] item schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | — | display name |
| `uuid` | string (UUID) | **yes** | auth credential |
| `alterId` | integer | — | 0 = modern (default/recommended); >0 = legacy MD5 auth (not recommended) |

No `security` field on the inbound user — **security is an outbound-only field** (present on `vmess-out` in commands.ts as `"security": "auto"`). Inbound does not accept `security`.

### listen fields (shared/listen.md)

Active fields (non-deprecated):

| Field | Type |
|---|---|
| `listen` | string (required) |
| `listen_port` | integer |
| `bind_interface` | string (since 1.12.0) |
| `routing_mark` | integer/string (since 1.12.0, Linux only) |
| `reuse_addr` | boolean (since 1.12.0) |
| `netns` | string (since 1.12.0, Linux only) |
| `tcp_fast_open` | boolean |
| `tcp_multi_path` | boolean |
| `disable_tcp_keep_alive` | boolean (since 1.13.0) |
| `tcp_keep_alive` | duration string (since 1.13.0, default `5m`) |
| `tcp_keep_alive_interval` | duration string (default `75s`) |
| `udp_fragment` | boolean |
| `udp_timeout` | duration string (default `5m`) |
| `detour` | string (inbound tag) |

Deprecated listen fields (removed in 1.13.0): `sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping`.

### tls (inbound shape)

Key inbound-only fields:

| Field | Notes |
|---|---|
| `enabled` | boolean toggle |
| `server_name` | SNI |
| `alpn` | string[] |
| `min_version` / `max_version` | `1.0`–`1.3` |
| `cipher_suites` | string[] |
| `curve_preferences` | string[] (since 1.13.0) |
| `certificate` / `certificate_path` | PEM chain |
| `key` / `key_path` | server private key (server-only) |
| `client_authentication` | `no`/`request`/`require-any`/`verify-if-given`/`require-and-verify` (since 1.13.0) |
| `client_certificate` / `client_certificate_path` / `client_certificate_public_key_sha256` | mTLS client validation (server-only, since 1.13.0) |
| `kernel_tx` / `kernel_rx` | kTLS (Linux 5.1+, TLS 1.3 only, since 1.13.0) |
| `acme` | sub-object (domain, email, provider, challenges, dns01_challenge) |
| `ech` | sub-object with `enabled`, `key`, `key_path` |
| `reality` | sub-object with `enabled`, `handshake`, `private_key`, `short_id`, `max_time_difference` |

Outbound-only TLS fields NOT applicable here: `disable_sni`, `insecure`, `utls`, `fragment*`, `record_fragment`, `certificate_public_key_sha256`, `client_certificate` (client role), `client_key`.

### multiplex (inbound shape)

| Field | Notes |
|---|---|
| `enabled` | boolean |
| `padding` | boolean; if true, non-padded connections rejected |
| `brutal` | sub-object (TCP Brutal) |

Outbound-only multiplex fields NOT applicable: `protocol`, `max_connections`, `min_streams`, `max_streams`.

### transport (v2ray-transport)

Type discriminated by `type` field. Available types: `http`, `ws`, `quic`, `grpc`, `httpupgrade`.

| type | Unique fields |
|---|---|
| `http` | `host[]`, `path`, `method`, `headers{}`, `idle_timeout`, `ping_timeout` |
| `ws` | `path`, `headers{}`, `max_early_data`, `early_data_header_name` |
| `quic` | (no extra fields) |
| `grpc` | `service_name`, `idle_timeout`, `ping_timeout`, `permit_without_stream` |
| `httpupgrade` | `host`, `path`, `headers{}` |

---

## Current UI State

### Palette (Palette.tsx:136)

```
{ label: "VMess", kind: "inbound-vmess", icon: Shield, docsUrl: docs("inbound/vmess/"), status: "setup" }
```

- Status `"setup"` — the item renders as a non-ready setup action.
- `docsUrl` is set correctly to `inbound/vmess/`.

### Protocols / kind mapping (protocols.ts)

- `"inbound-vmess"` maps to sing-box type `"vmess"` (line 53).
- `"vmess"` is in `CREATABLE_INBOUND_TYPES` (line 74).
- Inbound type→palette kind reverse map: `vmess: "vmess-in"` (line 175) — this is `vmess-in`, but the Palette kind is `inbound-vmess`. Potential inconsistency if the reverse map is used to find a palette entry from a loaded config.

### Default creation object (commands.ts:150–158)

```js
{
  type: "vmess",
  tag,
  listen: "127.0.0.1",
  listen_port: 2080,
  users: [{ name: "user", uuid: "bf000d23-0752-40b4-affe-68f7707a9661", alterId: 0 }],
}
```

- Fields match the official schema exactly.
- The hardcoded UUID is a placeholder — acceptable for default, but should prompt the user to change it.
- No `security` field — correct (security is outbound-only).

### sharedFieldRegistry.ts

VMess inbound correctly participates in all three shared groups:

| Group | Set | Included |
|---|---|---|
| `tls` | `inboundTlsTypes` | yes (line 144) |
| `multiplex` | `inboundMultiplexTypes` | yes (line 146) |
| `v2ray-transport` | `inboundTransportTypes` | yes (line 147) |

`sharedGroupsForEntity` for `kind=inbound, type=vmess` will return: `["listen", "tls", "multiplex", "tcp-brutal", "v2ray-transport"]` — correct.

### SbcNode.tsx

Inbound kind ports (line 136–144):
- Right ports: Route hub, Route rule matcher, DNS rule matcher.
- VMess does **not** get the SSM-API port (only shadowsocks does) — correct.

### Inspector.tsx — users[] rendering

The `users` field is listed in `inboundHandledFields` (line 186) as a handled field. However, there is **no vmess-specific inspector rendering block** for `users`. The only `users` rendering in Inspector.tsx is:

- Line 1805: `<JsonField label="Users JSON" value={entity.users ?? []} .../>` — this is inside a service block (kind `"service"`, type checked nearby), not an inbound block.
- Line 1811: Another `JsonField` for `users` in a `hysteria-realm` service context.

Conclusion: **`users` appears in `inboundHandledFields` (so it won't fall through to `AdvancedScalarFields`), but there is no structured inbound inspector UI that renders it.** The users array is silently suppressed — neither a raw JSON textarea nor a structured repeater is shown for vmess inbound users in the Inspector.

---

## Priority Findings

### P0 — Users array is invisible in Inspector

`users` is listed in `inboundHandledFields` (suppressed from AdvancedScalarFields fallback) but no Inspector rendering block for `ref.kind === "inbound"` with `entityType === "vmess"` exists. The result: a user who opens the vmess inbound in the Inspector cannot see or edit the users list at all. The field is created correctly at node creation time (commands.ts default), but cannot be modified through the UI.

**Required fix:** Add a vmess-specific inbound users block in Inspector.tsx for `ref.kind === "inbound" && entityType === "vmess"`. At minimum, a `JsonField` textarea (matching the pattern used for other complex arrays). Better: a structured repeater with `name` (text), `uuid` (text with UUID validation/generation), and `alterId` (number, 0 default, with warning when > 0).

### P0 — `security` field must not appear on inbound user objects

The outbound vmess default (commands.ts:303–314) uses `security: "auto"`. If a user imports a vmess outbound config and the Inspector leaks outbound fields, or if a future copy-paste scenario merges outbound user fields into an inbound, `security` would be invalid on inbound users. The inbound user schema has no `security` field. The Inspector must not render it for inbound users and must strip it on import/migration.

### P1 — Palette kind / reverse map mismatch

`protocols.ts` line 175 maps `vmess: "vmess-in"` for the inbound reverse lookup, but the actual Palette kind is `"inbound-vmess"`. If any code path uses the reverse map to locate the Palette entry (e.g., for "open in palette" actions or documentation links), it will fail to find the entry. The reverse map value should be `"inbound-vmess"` to match the Palette kind.

### P1 — `alterId` warning not surfaced in UI

The official docs explicitly warn: "use of alterId > 1 is not recommended" (legacy MD5 auth). The default is correctly `alterId: 0`. However, there is no UI-level validation or inline warning when a user sets `alterId > 0`. A diagnostic or inline note in the users repeater would help users avoid enabling legacy protocol accidentally.

### P1 — listenSharedFields list is incomplete

`listenSharedFields` in Inspector.tsx (lines 95–104) contains: `listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout`. Missing from the handled set: `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour`. These missing fields will fall through to `AdvancedScalarFields` (raw scalar display) rather than being handled in the structured listen section. This affects all inbounds including vmess, not vmess-specific, but vmess inherits the problem.

---

## Implementation Tasks

1. **[P0] Add vmess inbound users Inspector block**
   - In `Inspector.tsx`, inside the `ref.kind === "inbound"` branch, add a conditional block for `entityType === "vmess"` (or a shared block for all inbounds that carry `users[]` with `uuid`).
   - Render a structured users repeater with fields: `name` (text), `uuid` (text, UUID pattern, with "Generate" button), `alterId` (number, default 0).
   - Include an inline warning when `alterId > 0`: "Legacy VMess MD5 auth — not recommended".
   - Remove `"users"` from the generic `inboundHandledFields` set, or keep it there and ensure the vmess block renders before the `AdvancedScalarFields` fallback.

2. **[P0] Validate inbound user objects on import**
   - Strip `security` if present on inbound vmess user objects (it is outbound-only).
   - Consider a migration/diagnostic that flags `alterId > 0` as a compatibility warning.

3. **[P1] Fix reverse kind map**
   - In `protocols.ts` line 175, change `vmess: "vmess-in"` to `vmess: "inbound-vmess"` to match the actual Palette kind string.

4. **[P1] Add `alterId` diagnostic**
   - In the semantic validator, add a warning when any vmess inbound user has `alterId > 0`.

5. **[P1] Complete listenSharedFields**
   - Add `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour` to `listenSharedFields` in Inspector.tsx so they are handled by the structured listen section rather than falling to the generic scalar fallback.

6. **[Future / structured] Full users[] repeater**
   - Expose an "Add User" / "Remove User" row-based repeater (similar to how route rules are table-owned) instead of a raw JSON textarea, to allow safe editing of individual user credentials without raw JSON.
