<!-- Status: official-read. Sources: stable docs/configuration/inbound/socks.md, testing docs/configuration/inbound/socks.md (identical), stable docs/configuration/shared/listen.md, Palette.tsx, protocols.ts, commands.ts, sharedFieldRegistry.ts, SbcNode.tsx, Inspector.tsx. -->
# Inbound / SOCKS UI Review

## Scope

- Palette kind: `inbound-socks` (Palette.tsx line 133)
- Canvas / Inspector kind: `inbound` with `type = "socks"`
- Official docs:
  - stable: `docs/configuration/inbound/socks.md`
  - testing: `docs/configuration/inbound/socks.md` (identical — no testing-channel additions)
- This node writes one entry in the top-level `inbounds[]` array.
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

---

## Official Model

### SOCKS inbound fields (stable = testing, sing-box all versions)

| Field | Type | Notes |
|---|---|---|
| `type` | `string` | Fixed `"socks"`. Supports SOCKS4 / SOCKS4a / SOCKS5. |
| `tag` | `string` | Required unique identifier. |
| `users` | `[]User` | Optional. No authentication if empty. |
| `users[].username` | `string` | Credential username. |
| `users[].password` | `string` | Credential password. |

**Total official protocol fields: 5** (type, tag, users[], users[].username, users[].password)

### Shared Listen Fields (from `shared/listen.md`)

All fields apply to `socks` inbound because `inbounds[]` is an owner of the listen group:

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

| Field | Type | Deprecated Since |
|---|---|---|
| `sniff` | `bool` | 1.11.0 |
| `sniff_override_destination` | `bool` | 1.11.0 |
| `sniff_timeout` | `string` | 1.11.0 |
| `domain_strategy` | `string` | 1.11.0 |
| `udp_disable_domain_unmapping` | `bool` | 1.11.0 |

---

## Left: Add Library

**Current state** (`Palette.tsx` line 133):
```ts
{ label: "SOCKS", kind: "inbound-socks", icon: Network,
  docsUrl: docs("inbound/socks/"), status: "setup" }
```

- `status: "setup"` is the correct marker for an inbound that is not yet fully implemented.
- The `docsUrl` points to the correct official path.
- `icon: Network` is appropriate.

**No findings.**

---

## Middle: Canvas Node

**Current state** (`SbcNode.tsx` lines 136–142):

The `inbound` kind has a generic port set: right-side ports for Route hub, Route Rule matcher, DNS Rule matcher. For `socks` type specifically, there is no special port (the `service` port only appears for `shadowsocks`). This is correct — SOCKS inbound has no service relationship.

The canvas node inherits the generic inbound rendering. There is no type-specific badge, pill, or affordance for socks vs. other inbounds.

**No findings for canvas node.**

---

## Right: Inspector

### What is currently rendered for `inbound` kind (any type)

1. **Shared listen group** — rendered via the `"listen"` `SharedFieldGroupId` because `socks` is in `CREATABLE_INBOUND_TYPES` (sharedFieldRegistry.ts line 166). Covers `listen`, `listen_port`, and all other listen scalar fields.
2. **Address** — a text input that calls `toList`/`fromList` (comma-separated). Rendered unconditionally for all inbounds (Inspector.tsx line 1486).
3. **Auto route** — a checkbox rendered unconditionally for all inbounds (Inspector.tsx line 1493). SOCKS does not have an `auto_route` field; this is a TUN-only field leaking into all inbound types.
4. **AdvancedScalarFields** — renders only scalar fields (`string | number | boolean`) not in `inboundHandledFields`. Because `users` is an array, it is never surfaced here.

### What is NOT rendered

- `users[]` — the core authentication array is completely missing from the inbound Inspector section.
- The inbound section does not branch on `entityType === "socks"` (or any protocol variant) for custom field rendering.

### createInbound initializer

`commands.ts` line 121–128 seeds a new SOCKS inbound with:
```json
{
  "type": "socks",
  "tag": "socks-in",
  "listen": "127.0.0.1",
  "listen_port": 2080,
  "users": [{ "username": "user", "password": "change-me" }]
}
```

The initializer is correct and complete. The seeded `users` array will exist on the entity, but there is no UI control to view or edit it.

### Shared groups in sharedFieldRegistry for SOCKS inbound

`sharedGroupsForEntity` returns only `["listen"]` for `type = "socks"` inbound. This is correct: SOCKS inbound has no TLS, no QUIC, no multiplex, no v2ray-transport. The `udp-over-tcp` group is listed only for *outbound* SOCKS, not inbound — which is also correct per the official docs.

---

## Priority Findings

### P0 — users[] has no Inspector UI (data loss risk)

**Location:** `src/components/Inspector.tsx`, the `ref.kind === "inbound"` block (lines 1484–1503).

The `inboundHandledFields` set does NOT include `"users"`. However, `AdvancedScalarFields` only surfaces scalar primitives; arrays are excluded by `editableScalarFields` (line 209). As a result, `users[]` is completely invisible in the Inspector.

- A user who creates a SOCKS inbound gets a seeded `users` array in the JSON, but cannot see or edit it in the Inspector.
- The only way to modify credentials is via raw JSON export/import.
- Deleting and re-adding the node resets credentials to the placeholder `"change-me"` password.

**Fix:** Add a `users[]` repeater (or at minimum a `JsonField`) in the inbound Inspector section for types that carry `users[]`. For SOCKS inbound, this means: when `entityType === "socks"` (or more broadly when `"users" in entity && Array.isArray(entity.users)`), render a `JsonField label="Users JSON"` (or a structured repeater with `username` + `password` rows). The `"users"` key should also be added to `inboundHandledFields` to prevent it falling through to AdvancedScalarFields once it is explicitly handled.

### P1 — auto_route checkbox rendered for SOCKS inbound (wrong field)

**Location:** `src/components/Inspector.tsx` line 1493–1499.

`auto_route` is a TUN-only field. The Inspector renders it unconditionally for every inbound kind. For SOCKS inbound, the entity will not have this field set, so the checkbox shows as unchecked. If a user accidentally enables it, the field is written to the JSON for a type that does not honor it.

**Fix:** Gate the `auto_route` toggle on `entityType === "tun"`. Similarly, the `address` text input at line 1486 appears to target TUN's `address[]` field; for SOCKS this will always be an empty list and should also be gated.

### P1 — listenSharedFields missing tcp_multi_path, disable_tcp_keep_alive, tcp_keep_alive, tcp_keep_alive_interval, udp_fragment

**Location:** `src/components/Inspector.tsx` lines 95–104.

The current `listenSharedFields` constant used to populate `inboundHandledFields` lists only:
```
listen, listen_port, bind_interface, routing_mark, reuse_addr, netns,
tcp_fast_open, udp_timeout
```

Fields present in the official listen structure but missing from the constant:
- `tcp_multi_path`
- `disable_tcp_keep_alive`
- `tcp_keep_alive`
- `tcp_keep_alive_interval`
- `udp_fragment`
- `detour` (listen-group detour, distinct from outbound detour)

Because these fields are not in `listenSharedFields`, they are not in `inboundHandledFields`. If any of them exist on the entity (e.g. imported from a config file), they fall through to `AdvancedScalarFields` as raw text inputs rather than being handled by the shared listen group renderer. This is a medium-severity gap — the fields are not lost, but they are not rendered with the correct type or labeling.

**Fix:** Extend `listenSharedFields` to include all current listen fields from the official schema. Add `detour` (listen-level) with a care note that it is different from outbound `detour`.

---

## Implementation Tasks

1. **[P0] Add users[] editor for socks inbound**
   - In `Inspector.tsx`, within the `ref.kind === "inbound"` block, add a branch for when the entity has a `users` array (i.e., `entityType === "socks"` or `entityType === "http"` or similar auth-bearing types).
   - Minimum viable: `<JsonField label="Users JSON" value={entity.users ?? []} onChange={...} />`
   - Better: a structured repeater with `Add user` button, individual `username` / `password` text inputs, and a remove affordance per row.
   - Add `"users"` to `inboundHandledFields` once the field is explicitly rendered.

2. **[P1] Gate auto_route and address to TUN inbound only**
   - Wrap the `auto_route` toggle and `address` text input in a `entityType === "tun"` guard inside the `ref.kind === "inbound"` block.
   - This prevents write-through of TUN-only fields to SOCKS (and other non-TUN inbounds).

3. **[P1] Expand listenSharedFields to match official schema**
   - Add `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, `detour` to the `listenSharedFields` array.
   - Verify the shared listen group renderer in the Inspector handles each field with the appropriate input type.

4. **[Informational] Deprecated sniff fields**
   - The official listen doc marks `sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping` as deprecated since 1.11.0 and removed in 1.13.0.
   - If any of these fields exist on an imported config, they currently fall through to `AdvancedScalarFields` as plain text inputs with no deprecation warning.
   - Consider adding a diagnostic warning when these fields are present on any inbound.

---

## Done Criteria

- Creating SOCKS inbound from Library seeds a valid JSON object with `listen`, `listen_port`, and an optional `users[]`.
- Inspector renders `users[]` in an editable form; add/remove/edit user rows round-trip to JSON export.
- `auto_route` and `address` inputs do not appear for SOCKS inbound.
- All current listen fields appear in the shared listen group, not in AdvancedScalarFields fallback.
- Fixture or smoke test proves the node can be imported, rendered, edited (credential change), and exported with updated credentials.
