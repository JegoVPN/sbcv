<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / NaiveProxy UI Review

## Scope

- Palette kind: `inbound-naive` (Palette.tsx line 138)
- Canvas / Inspector kind: `inbound` with `type = "naive"`
- Official docs:
  - stable: `docs/configuration/inbound/naive.md`
  - testing: `docs/configuration/inbound/naive.md` (identical — no testing-channel additions)
  - New field since 1.13.0: `quic_congestion_control`
- This node writes one entry in the top-level `inbounds[]` array.
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

---

## Official Model

### NaiveProxy inbound fields (stable; testing adds `quic_congestion_control`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `string` | yes | Fixed `"naive"`. |
| `tag` | `string` | yes | Required unique identifier. |
| `network` | `string` | no | `"tcp"` or `"udp"`. Both if empty. |
| `users` | `[]User` | **Required** | Naive users. Cannot be empty. |
| `users[].username` | `string` | yes | Credential username. |
| `users[].password` | `string` | yes | Credential password. |
| `quic_congestion_control` | `string` | no | Since 1.13.0. Enum: `bbr`, `bbr_standard`, `bbr2`, `bbr2_variant`, `cubic`, `reno`. Default `bbr`. |
| `tls` | `object` | no (functionally required) | TLS configuration. NaiveProxy operates over HTTPS so TLS must be configured for the inbound to function. |

**Total official protocol fields: 8** (type, tag, network, users[], users[].username, users[].password, quic_congestion_control, tls)

### Shared Listen Fields (from `shared/listen.md`)

All fields apply to `naive` inbound because `inbounds[]` is an owner of the listen group:

| Field | Type | Notes |
|---|---|---|
| `listen` | `string` | Required. Listen address. |
| `listen_port` | `int` | Listen port. |
| `bind_interface` | `string` | Since 1.12.0. Network interface to bind to. |
| `routing_mark` | `int` | Since 1.12.0. Linux only. Netfilter routing mark. |
| `reuse_addr` | `bool` | Since 1.12.0. Reuse listener address. |
| `netns` | `string` | Since 1.12.0. Linux only. Network namespace. |
| `tcp_fast_open` | `bool` | Enable TCP Fast Open. |
| `tcp_multi_path` | `bool` | Enable TCP Multi Path (Go 1.21+). |
| `disable_tcp_keep_alive` | `bool` | Since 1.13.0. Disable TCP keep alive. |
| `tcp_keep_alive` | `string` | Since 1.13.0. TCP keep alive initial period. Default `5m`. |
| `tcp_keep_alive_interval` | `string` | TCP keep alive interval. Default `75s`. |
| `udp_fragment` | `bool` | Enable UDP fragmentation. |
| `udp_timeout` | `string` | UDP NAT expiration time. Default `5m`. |
| `detour` | `string` | Forward connections to the specified inbound. |

**Deprecated listen fields** (removed in sing-box 1.13.0):

| Field | Deprecated Since |
|---|---|
| `sniff` | 1.11.0 |
| `sniff_override_destination` | 1.11.0 |
| `sniff_timeout` | 1.11.0 |
| `domain_strategy` | 1.11.0 |
| `udp_disable_domain_unmapping` | 1.11.0 |

---

## Left: Add Library

**Current state** (`Palette.tsx` line 138):
```ts
{ label: "Naive", kind: "inbound-naive", icon: Globe2,
  docsUrl: docs("inbound/naive/"), status: "setup" }
```

- `status: "setup"` is correct for an inbound that is not yet fully implemented.
- `docsUrl` points to the correct official path.
- `icon: Globe2` is acceptable (same icon as the Naive outbound; NaiveProxy is HTTP/2-based so Globe2 is reasonable).

**No findings.**

---

## Middle: Canvas Node

**Current state** (`SbcNode.tsx` lines 136–142):

The `inbound` kind has a generic port set: right-side output ports for Route hub, Route Rule matcher, DNS Rule matcher. For `naive` type there is no special port (the `service` port only exists for `shadowsocks`). This is correct — NaiveProxy inbound has no service relationship.

The canvas node shows:
- Title: `tag` value (e.g., `naive-in`)
- Subtitle: `"naive inbound"` (generic pattern: `${inbound.type} inbound` from `graph.ts` line 239)
- Bottom toolbar pill: type name `"naive"` + status indicator
- `+` affordance: creates a Route hub (compatible: `["Route"]`)

**No findings for canvas node.**

---

## Right: Inspector

### What is currently rendered for `inbound` kind (any type)

1. **Tag + Type selectors** — standard rename and type-switch dropdowns (Inspector.tsx line 1191–1245). The type switch works via `CREATABLE_INBOUND_TYPES`.
2. **Shared listen group** — rendered via the `"listen"` `SharedFieldGroupId` because `naive` is in `CREATABLE_INBOUND_TYPES` (sharedFieldRegistry.ts line 166). Covers `listen`, `listen_port`, and the listen scalars present in `listenSharedFields`.
3. **Shared TLS group** — rendered because `naive` is in `inboundTlsTypes` (sharedFieldRegistry.ts line 144). The TLS group renders `tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`.
4. **Address** — a text input (comma-separated) rendered unconditionally for all inbounds (Inspector.tsx line 1486). Not a NaiveProxy field; this leaks from TUN.
5. **Auto route** — a checkbox rendered unconditionally for all inbounds (Inspector.tsx line 1493). Not a NaiveProxy field; this leaks from TUN.
6. **AdvancedScalarFields** — renders only scalar fields (`string | number | boolean`) not in `inboundHandledFields`. Arrays are excluded by `editableScalarFields` (Inspector.tsx line 206–210).

### What is NOT rendered

- `users[]` — the core required authentication array is completely absent from the inbound Inspector section. It is not in `inboundHandledFields` and it is an array, so `AdvancedScalarFields` will not surface it. There is no `JsonField` fallback for it here (unlike `service` kind which adds one for CCM/SSM-API).
- `network` — this scalar field IS NOT in `inboundHandledFields` so it WILL appear in `AdvancedScalarFields` as a plain text input with auto-labeling "Network". This is minimal but functional. It does not offer the official enum values (`tcp` / `udp`) as a select.
- `quic_congestion_control` — since 1.13.0. This scalar field is also not in `inboundHandledFields`, so if present it falls through to `AdvancedScalarFields` as a plain text input. No enum select for the 6 valid values.

### createInbound initializer

`commands.ts` lines 168–177 seeds a new NaiveProxy inbound with:
```json
{
  "type": "naive",
  "tag": "naive-in",
  "listen": "127.0.0.1",
  "listen_port": 2080,
  "network": "tcp",
  "users": [{ "username": "user", "password": "change-me" }]
}
```

The initializer seeds `users[]` correctly. However, it does NOT seed a `tls` object. Because NaiveProxy is an HTTPS/HTTP2-based protocol, the inbound cannot function without TLS configured. A user who creates this node from Library gets a non-functional configuration: the sing-box process will reject or ignore the inbound at runtime without a valid TLS certificate.

### Shared groups in sharedFieldRegistry for NaiveProxy inbound

`sharedGroupsForEntity` for `type = "naive"` inbound returns:
- `["listen", "tls"]`

This is correct per the official docs (NaiveProxy supports TLS). No `quic` group (unlike hysteria/tuic), no `multiplex` group, no `v2ray-transport` group.

---

## Priority Findings

### P0 — users[] has no Inspector UI (data loss risk)

**Location:** `src/components/Inspector.tsx`, the `ref.kind === "inbound"` block (lines 1484–1503).

`inboundHandledFields` does NOT include `"users"`. The `users` field is an array, so `AdvancedScalarFields` (which only surfaces scalar primitives) never renders it. There is no `JsonField` for it in the inbound section.

- A user who creates a NaiveProxy inbound gets a seeded `users` array in JSON, but cannot see or edit it in the Inspector.
- The only way to modify credentials is via raw JSON export/import.
- Deleting and re-adding the node resets credentials to the placeholder `"change-me"` password.
- `users` is **Required** per the official docs: an inbound with an empty or missing `users[]` is invalid.

**Fix:** In the `ref.kind === "inbound"` block, add a `JsonField` (or structured repeater) for `users[]` when the type is one that carries users. For NaiveProxy inbound specifically, this means adding a branch when `entityType === "naive"` with `<JsonField label="Users JSON" value={entity.users ?? []} onChange={...} />`. Also add `"users"` to `inboundHandledFields` once rendered explicitly. A structured repeater (rows with `username` + `password` inputs + Add/Remove) would be the ideal UX given the fixed 2-field shape.

### P0 — TLS not seeded in createInbound initializer (non-functional default)

**Location:** `src/domain/commands.ts` lines 168–177.

The NaiveProxy inbound is based on HTTPS/HTTP2. Without a TLS configuration (at minimum a `certificate_path` or a `certificate_provider` reference), the inbound is non-functional: sing-box will fail to start or will reject connections. Other inbounds that mandate TLS (e.g., hysteria, hysteria2, TUIC, VLESS) also do not pre-seed TLS in their initializers, but NaiveProxy has the strongest dependency because TLS is the entire transport layer.

**Fix:** Seed a minimal `tls` object in the naive inbound initializer:
```json
{
  "type": "naive",
  "tag": "naive-in",
  "listen": "0.0.0.0",
  "listen_port": 443,
  "network": "tcp",
  "users": [{ "username": "user", "password": "change-me" }],
  "tls": {
    "enabled": true,
    "certificate_path": "",
    "key_path": ""
  }
}
```
This makes it immediately visible in the TLS group in the Inspector that configuration is needed. Alternatively, the TLS group should show a visual warning when `tls.enabled` is false or `tls` is missing for types that require it.

### P1 — network field rendered as plain text; no enum select

**Location:** `src/components/Inspector.tsx`, `AdvancedScalarFields` (lines 369–411).

`network` falls through to `AdvancedScalarFields` as a plain text input. The official docs specify valid values are `"tcp"` and `"udp"` (both if empty). Arbitrary text input allows invalid values like `"TCP"`, `"TCP/UDP"`, or `""` when they should be blocked.

**Fix:** Add `"network"` to `inboundHandledFields` and render a dedicated `<select>` inside the `ref.kind === "inbound"` block when `entityType === "naive"` (and any other inbound type with a `network` enum). Valid options: `""` (both), `"tcp"`, `"udp"`.

### P1 — quic_congestion_control field rendered as plain text; no enum select

**Location:** `src/components/Inspector.tsx`, `AdvancedScalarFields` (lines 369–411).

`quic_congestion_control` (since 1.13.0) falls through to `AdvancedScalarFields` as a plain text input if present on an imported config. The official docs list exactly 6 valid values: `bbr`, `bbr_standard`, `bbr2`, `bbr2_variant`, `cubic`, `reno`.

**Fix:** Add `"quic_congestion_control"` to `inboundHandledFields` and render a `<select>` inside the `entityType === "naive"` branch with the 6 valid options plus an empty default (renders as `bbr` per the official default). This only needs to appear when the version context is 1.13.0+; until then it is absent from the model.

### P1 — auto_route and address rendered for NaiveProxy inbound (wrong fields)

**Location:** `src/components/Inspector.tsx` lines 1486–1499.

`auto_route` is TUN-only. `address` (as a comma-separated list) targets TUN's `address[]` field. Both are rendered unconditionally for every inbound kind. For NaiveProxy inbound, neither field exists in the protocol; if a user enables `auto_route`, it is written to the JSON for a type that does not honor it.

**Fix:** Gate both the `auto_route` toggle and the `address` text input behind `entityType === "tun"`.

### P1 — listenSharedFields missing several official listen fields

**Location:** `src/components/Inspector.tsx` lines 95–104.

Current `listenSharedFields`:
```
listen, listen_port, bind_interface, routing_mark, reuse_addr, netns,
tcp_fast_open, udp_timeout
```

Missing fields present in the official listen schema:
- `tcp_multi_path`
- `disable_tcp_keep_alive` (since 1.13.0)
- `tcp_keep_alive` (since 1.13.0)
- `tcp_keep_alive_interval`
- `udp_fragment`
- `detour` (listen-level detour, distinct from outbound dial `detour`)

If any of these exist on an imported config, they fall through to `AdvancedScalarFields` as raw text inputs rather than being rendered in the shared listen group with correct type and label.

**Fix:** Extend `listenSharedFields` to include all current listen fields. Add `detour` with a `select` using inbound tag options (distinct from outbound `detour`). Add the shared listen group renderer definitions accordingly in the `group === "listen"` branch of `sharedFieldDefinitions`.

---

## Implementation Tasks

1. **[P0] Add users[] editor for naive inbound**
   - In `Inspector.tsx`, within the `ref.kind === "inbound"` block, add a branch for `entityType === "naive"` (and other auth-bearing types: `http`, `socks`, `trojan`, `vmess`, etc.).
   - Minimum viable: `<JsonField label="Users JSON" value={entity.users ?? []} onChange={(v) => updateField(ref, "users", v)} />`
   - Better: structured repeater with `username` + `password` text inputs, Add/Remove row affordance.
   - Add `"users"` to `inboundHandledFields` once explicitly rendered.

2. **[P0] Seed TLS object in naive inbound initializer**
   - In `commands.ts`, update the `type === "naive"` inbound branch to include a minimal `tls` object (at least `enabled: true` with empty `certificate_path` and `key_path`).
   - Optionally change default `listen` to `"0.0.0.0"` and `listen_port` to `443` to reflect the typical NaiveProxy deployment pattern.

3. **[P1] Add network enum select for naive inbound**
   - In `Inspector.tsx`, within the `entityType === "naive"` branch, render a `<select>` for `network` with options: `""` (both), `"tcp"`, `"udp"`.
   - Add `"network"` to `inboundHandledFields`.

4. **[P1] Add quic_congestion_control enum select for naive inbound**
   - In `Inspector.tsx`, within the `entityType === "naive"` branch, render a `<select>` for `quic_congestion_control` with options: `""` (default = bbr), `"bbr"`, `"bbr_standard"`, `"bbr2"`, `"bbr2_variant"`, `"cubic"`, `"reno"`.
   - Add `"quic_congestion_control"` to `inboundHandledFields`.

5. **[P1] Gate auto_route and address to TUN inbound only**
   - In `Inspector.tsx`, wrap the `auto_route` toggle and `address` text input in an `entityType === "tun"` guard.

6. **[P1] Expand listenSharedFields to match official schema**
   - Add `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour` to the `listenSharedFields` array.
   - Update the `group === "listen"` branch in the shared field definitions to include these fields with appropriate input types.

---

## Done Criteria

- Creating NaiveProxy inbound from Library seeds a valid JSON with `listen`, `listen_port`, `network`, `users[]`, and a `tls` skeleton.
- Inspector renders `users[]` as an editable form; add/remove/edit user rows round-trip to JSON export.
- Inspector renders `network` as a select (`""` / `"tcp"` / `"udp"`).
- Inspector renders `quic_congestion_control` as a select with all 6 valid options.
- `auto_route` and `address` inputs do not appear for NaiveProxy inbound.
- All current listen fields appear in the shared listen group, not in AdvancedScalarFields fallback.
- TLS group shows that `enabled` + certificate fields need configuration; a visual hint or diagnostic for missing TLS on naive inbound would be ideal.
- Fixture or smoke test proves the node can be imported, rendered, edited (credential change, TLS path entry), and exported with updated values.
