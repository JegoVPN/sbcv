<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / NaiveProxy UI Review

## Scope

- Palette kind: `naive-out` (Palette.tsx line 161)
- Canvas / Inspector kind: `outbound` with `type = "naive"`
- Official docs:
  - stable: `docs/configuration/outbound/naive.md`
  - testing: `docs/configuration/outbound/naive.md` (identical — no testing-channel additions)
  - Available since sing-box 1.13.0
- This node writes one entry in the top-level `outbounds[]` array.
- Review shape: Left Add Library, Middle Canvas Node, Right Inspector.

---

## Official Model

### NaiveProxy outbound fields (stable = testing)

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `string` | yes | Fixed `"naive"`. |
| `tag` | `string` | yes | Required unique identifier. |
| `server` | `string` | **Required** | Server address. |
| `server_port` | `uint16` | **Required** | Server port. |
| `username` | `string` | no | Authentication username. |
| `password` | `string` | no | Authentication password. |
| `insecure_concurrency` | `int` | no | Number of concurrent tunnel connections. Increases detection risk; defeats NaiveProxy traffic-analysis resistance. Default 0 (single connection). |
| `extra_headers` | `object` | no | Extra HTTP request headers. Key-value map. |
| `udp_over_tcp` | `bool\|object` | no | UDP over TCP settings. See `shared/udp-over-tcp.md`. |
| `quic` | `bool` | no | Use QUIC instead of HTTP/2. |
| `quic_congestion_control` | `string` | no | QUIC congestion control algorithm. Enum: `bbr` (default), `bbr2`, `cubic`, `reno`. |
| `tls` | `object` | **Required** | TLS configuration. Outbound NaiveProxy only supports `server_name`, `certificate`, `certificate_path`, and `ech`. Self-signed certificates should not be used in production (they defeat traffic-analysis resistance). |

**Total official protocol fields: 12** (type, tag, server, server_port, username, password, insecure_concurrency, extra_headers, udp_over_tcp, quic, quic_congestion_control, tls)

**Platform support note:** NaiveProxy outbound is only available on Apple platforms, Android, Windows, and certain Linux builds (purego or glibc/musl variants). Standard Linux amd64/arm64 purego builds require `libcronet.so` in the same directory as the binary or in the system library path.

### Shared Dial Fields (from `shared/dial.md`)

`naive` is in `outboundDialTypes` (sharedFieldRegistry.ts line 150), so all Dial Fields apply:

| Field | Type | Notes |
|---|---|---|
| `detour` | `string` | Outbound tag to use as upstream dial tunnel. |
| `bind_interface` | `string` | Network interface to bind outbound connection. |
| `inet4_bind_address` | `string` | IPv4 bind address. |
| `inet6_bind_address` | `string` | IPv6 bind address. |
| `routing_mark` | `int` | Linux only. Netfilter routing mark. |
| `reuse_addr` | `bool` | Reuse listener address. |
| `connect_timeout` | `string` | Connection timeout. |
| `tcp_fast_open` | `bool` | Enable TCP Fast Open. |
| `tcp_multi_path` | `bool` | Enable TCP Multi Path. |
| `udp_fragment` | `bool` | Enable UDP fragmentation. |
| `domain_strategy` | `string` | Domain resolution strategy. |
| `fallback_delay` | `string` | HappyEyeballs fallback delay. |

### Shared UDP-over-TCP Fields

`naive` is in `outboundUdpOverTcpTypes` (sharedFieldRegistry.ts line 155), so the `udp-over-tcp` shared group applies.

### TLS restriction for NaiveProxy outbound

The official docs explicitly state: only `server_name`, `certificate`, `certificate_path`, and `ech` are supported by the NaiveProxy outbound's TLS. All other fields available in the generic TLS group (`insecure`, `alpn`, `min_version`, `max_version`, `certificate_provider`) are not honored by NaiveProxy's underlying Chromium/QUICHE stack.

---

## Left: Add Library

**Current state** (`Palette.tsx` line 161):
```ts
{ label: "Naive", kind: "naive-out", icon: Globe2,
  docsUrl: docs("outbound/naive/"), status: "setup" }
```

- `status: "setup"` is correct given the node is not yet fully implemented.
- `docsUrl` points to the correct official path.
- `icon: Globe2` is acceptable.

**No findings.**

---

## Middle: Canvas Node

**Current state** (`SbcNode.tsx`, `graph.ts`):

The `outbound` kind has a generic input port set (route final, route rule outbound, selector/urltest candidate, DNS detour, Dial detour target, service detour target, rule-set download detour). Output port: `dial-detour` (downstream dial detour outbound) — present because `naive` is not in the excluded list in `supportsDialDetour` (SbcNode.tsx line 62–64, which excludes only `block`, `selector`, `urltest`, `dns`). This is correct per the official Dial Fields support.

Canvas display:
- Title: `tag` value (e.g., `naive-out`)
- Subtitle: `"naive 127.0.0.1:1080"` when `server` is set (graph.ts line 413–415: `${outbound.type} ${outbound.server}:${outbound.server_port}`)
- Bottom toolbar pill: type name `"naive"` + status indicator
- `+` affordance: calls `createCompatible` but `compatible` array is `[]` for non-group outbounds (graph.ts line 417–421)

**Findings:**

The `+` button is visible and clickable but does nothing because `data.compatible[0]` is `undefined` for `naive` (a non-group outbound). This is a shared issue across all non-group outbounds.

---

## Right: Inspector

### What is currently rendered for `outbound` kind

1. **Tag + Type selectors** — standard rename and type-switch dropdowns. Type switch uses `CREATABLE_OUTBOUND_TYPES` which includes `"naive"` (protocols.ts line 32).
2. **Server** — text input, rendered when `"server" in entity` (Inspector.tsx line 1507). Present because `createOutbound` seeds `server`.
3. **Port** — number input, rendered when `"server_port" in entity` (Inspector.tsx line 1516). Present because `createOutbound` seeds `server_port`.
4. **Shared dial group** — rendered because `naive` is in `outboundDialTypes` (sharedFieldRegistry.ts line 150). Covers `detour`, `bind_interface`, `inet4_bind_address`, `inet6_bind_address`, `routing_mark`, `reuse_addr`, `connect_timeout`, `tcp_fast_open`, `tcp_multi_path`, `udp_fragment`, `domain_strategy`, `fallback_delay`.
5. **Shared TLS group** — rendered because `naive` is in `outboundTlsTypes` (sharedFieldRegistry.ts line 151). Renders `tls.enabled`, `tls.server_name`, `tls.insecure`, `tls.alpn`, `tls.min_version`, `tls.max_version`, `tls.certificate_path`, `tls.certificate_provider`.
6. **Shared udp-over-tcp group** — rendered because `naive` is in `outboundUdpOverTcpTypes` (sharedFieldRegistry.ts line 155). Renders `udp_over_tcp.enabled` and `udp_over_tcp.version`.
7. **AdvancedScalarFields** — falls through for scalar fields not in `outboundHandledFields`.

### What is NOT rendered

- `username` — not in `outboundHandledFields` (Inspector.tsx line 128–141). It IS a scalar string, so `AdvancedScalarFields` will surface it as a plain text input labeled "Username". Functionally present but without the `password` field in first-class controls.
- `password` — same as above. Falls through to `AdvancedScalarFields` as plain text.
- `insecure_concurrency` — not in `outboundHandledFields`. Falls through to `AdvancedScalarFields` as a number input (the field is a number). Minimal but functional.
- `quic` — a boolean; falls through to `AdvancedScalarFields` as a checkbox if present in the seeded or imported entity. Not seeded by `createOutbound`, so absent by default on new nodes.
- `quic_congestion_control` — string scalar; falls through to `AdvancedScalarFields` as plain text if present. Not seeded by default. The 4 valid values (`bbr`, `bbr2`, `cubic`, `reno`) are not offered as a select.
- `extra_headers` — an object field. `editableScalarFields` (Inspector.tsx line 206–210) excludes objects and arrays. No `JsonField` fallback exists for it. **Completely invisible and uneditable.**
- `ech` — an object inside `tls`. Neither the generic TLS group nor any other path renders `tls.ech`. No ECH support exists anywhere in Inspector.tsx.

### `outboundHandledFields` status for naive fields

`outboundHandledFields` (Inspector.tsx lines 128–141) explicitly lists: `tag`, `type`, `server`, `server_port`, `outbounds`, `default`, `tls`, `multiplex`, `transport`, `udp_over_tcp`, plus `dialSharedFields` and `quicSharedFields`. Fields NOT in this set for naive: `username`, `password`, `insecure_concurrency`, `extra_headers`, `quic`, `quic_congestion_control`.

### `createOutbound` initializer for naive

`commands.ts` lines 325–333 seeds a new NaiveProxy outbound with:
```json
{
  "type": "naive",
  "tag": "naive-out",
  "server": "127.0.0.1",
  "server_port": 1080,
  "username": "user",
  "password": "change-me"
}
```

The initializer does NOT seed a `tls` object. Per the official docs, `tls` is **Required** for NaiveProxy outbound. A user who creates this node from Library gets a non-functional configuration that sing-box will reject at runtime.

### TLS group oversharing for NaiveProxy

The generic TLS group renders `insecure`, `alpn`, `min_version`, `max_version`, and `certificate_provider`. The official NaiveProxy outbound docs explicitly restrict TLS to only `server_name`, `certificate`, `certificate_path`, and `ech`. Fields like `insecure`, `alpn`, `min_version`, and `max_version` are not honored by the Chromium-based NaiveProxy stack. Writing them to JSON produces a config whose TLS section has fields that are silently ignored at runtime.

### `certificate` field missing from TLS group

The generic TLS group renders `certificate_path` and `certificate_provider` but NOT `certificate` (the inline PEM certificate string). The official NaiveProxy outbound TLS explicitly lists `certificate` as one of its four supported fields. It is absent from the TLS group definition (Inspector.tsx lines 894–904).

---

## Priority Findings

### P0 — `tls` not seeded in `createOutbound` initializer (non-functional default)

**Location:** `src/domain/commands.ts` lines 325–333.

`tls` is **Required** per the official docs. Without it, sing-box will fail to start with a NaiveProxy outbound. A user creating the node from Library receives a configuration that is functionally broken out of the box.

**Fix:** Seed a minimal `tls` object in the naive outbound initializer:
```json
{
  "type": "naive",
  "tag": "naive-out",
  "server": "127.0.0.1",
  "server_port": 443,
  "username": "user",
  "password": "change-me",
  "tls": {
    "enabled": true,
    "server_name": ""
  }
}
```
Change `server_port` default to `443` to reflect the standard HTTPS deployment pattern. The `tls.enabled: true` skeleton makes the TLS group immediately visible with a clear indicator that `server_name` needs to be configured.

### P0 — TLS group renders unsupported fields for NaiveProxy outbound

**Location:** `src/components/Inspector.tsx` lines 894–904, `src/domain/sharedFieldRegistry.ts` line 151.

The generic TLS group shared by all `outboundTlsTypes` renders `insecure`, `alpn`, `min_version`, `max_version`, and `certificate_provider`. The NaiveProxy outbound docs restrict TLS to only `server_name`, `certificate`, `certificate_path`, and `ech`. Writing `insecure: true` or setting `alpn`/version fields creates a JSON that silently produces incorrect runtime behavior, defeating the protocol's traffic-analysis resistance design goal.

**Fix option A (narrow TLS group per type):** Add a type-specific override path in `sharedFieldDefinitions` for `group === "tls"` when `ref.kind === "outbound"` and `entityType === "naive"`. Render only `tls.enabled`, `tls.server_name`, `tls.certificate`, `tls.certificate_path`, and `tls.ech` (as JSON advanced field). Suppress `insecure`, `alpn`, `min_version`, `max_version`, and `certificate_provider`.

**Fix option B (diagnostic warning):** Keep the generic TLS group but add a diagnostic warning visible in the Inspector or as a tooltip when `entityType === "naive"` that certain TLS fields are ignored by NaiveProxy.

Option A is preferred for correctness.

### P0 — `extra_headers` completely invisible and uneditable

**Location:** `src/components/Inspector.tsx`, outbound section; `editableScalarFields` (lines 206–210).

`extra_headers` is an object (key-value map of extra HTTP headers). `editableScalarFields` excludes objects and arrays. There is no `JsonField` for it in the outbound block. A user who imports a config with `extra_headers` cannot see or edit it. Creating a new config offers no way to add headers. Add `"extra_headers"` to `outboundHandledFields` and render a `JsonField` in the `ref.kind === "outbound"` block gated on `entityType === "naive"`.

### P1 — `username` and `password` only in AdvancedScalarFields fallback

**Location:** `src/components/Inspector.tsx`, `AdvancedScalarFields` path.

Credentials are the primary authentication mechanism for NaiveProxy. Currently `username` and `password` fall through to the `AdvancedScalarFields` disclosure widget under "Advanced fields". They are functional as text inputs there, but the user must expand the disclosure to see or edit them. For a protocol where auth is the first thing to configure, these should be first-class form fields in the main Inspector body.

**Fix:** In the `ref.kind === "outbound"` block, add explicit `<label>` inputs for `username` and `password` when `entityType === "naive"` (after `server`/`server_port`, before the advanced section). Add `"username"` and `"password"` to `outboundHandledFields` to prevent double-rendering. The `password` field should use `type="password"` or at minimum be clearly labeled as a credential.

### P1 — `quic_congestion_control` rendered as plain text; no enum select

**Location:** `src/components/Inspector.tsx`, `AdvancedScalarFields` path.

`quic_congestion_control` falls through to `AdvancedScalarFields` as a plain text input if present in an imported config. The official docs list exactly 4 valid values: `bbr` (default), `bbr2`, `cubic`, `reno`. Arbitrary text input allows invalid values.

**Fix:** Add `"quic_congestion_control"` to `outboundHandledFields` and render a `<select>` in the `entityType === "naive"` outbound branch with options: `""` (default = bbr), `"bbr"`, `"bbr2"`, `"cubic"`, `"reno"`. This control should only appear when `quic` is `true` (it is meaningless over HTTP/2), but a simpler always-visible select is also acceptable.

### P1 — `ech` field not rendered anywhere in TLS group

**Location:** `src/components/Inspector.tsx` lines 894–904.

The NaiveProxy outbound TLS explicitly lists `ech` as one of its four supported fields. ECH is absent from the generic TLS group entirely (no `ech` field exists anywhere in Inspector.tsx or the source). If a user imports a config with `tls.ech`, it falls to `AdvancedScalarFields` but as an object it is excluded. The value is silently dropped from the rendered Inspector and uneditable.

**Fix:** Add a `JsonField` for `tls.ech` in the `group === "tls"` section (or in a NaiveProxy-specific TLS override) so imported ECH configuration is preserved and editable as raw JSON.

### P1 — `certificate` inline PEM missing from TLS group

**Location:** `src/components/Inspector.tsx` lines 894–904.

The official NaiveProxy outbound TLS supports `certificate` (inline PEM string array) as one of its four fields. The generic TLS group renders `certificate_path` but not `certificate` inline. If a user imports a config that uses inline certificate PEM strings, `tls.certificate` falls through to `AdvancedScalarFields`, but since it is an array it is excluded and silently dropped.

**Fix:** Add `{ label: "Certificate (inline PEM)", path: ["tls", "certificate"], kind: "list" }` to the TLS group definition (or to the NaiveProxy-specific TLS override). Add `"certificate"` to the paths handled by the TLS group so it is not double-rendered.

---

## Implementation Tasks

1. **[P0] Seed `tls` in the naive outbound initializer**
   - In `commands.ts`, update the `type === "naive"` outbound branch (lines 325–333) to include `tls: { enabled: true, server_name: "" }` and change `server_port` default to `443`.

2. **[P0] Restrict TLS group to NaiveProxy-supported fields**
   - In `Inspector.tsx`, add a type-specific branch in `sharedFieldDefinitions` for `group === "tls"` when `ref.kind === "outbound" && entityType === "naive"`.
   - Render only: `tls.enabled`, `tls.server_name`, `tls.certificate_path`, `tls.certificate` (list), `tls.ech` (JSON field).
   - Suppress `insecure`, `alpn`, `min_version`, `max_version`, `certificate_provider` for this type.

3. **[P0] Add `extra_headers` JsonField for naive outbound**
   - In `Inspector.tsx`, in the `ref.kind === "outbound"` block, add a branch for `entityType === "naive"` that renders `<JsonField label="Extra Headers" value={entity.extra_headers ?? {}} onChange={(v) => updateField(ref, "extra_headers", v)} />`.
   - Add `"extra_headers"` to `outboundHandledFields`.

4. **[P1] Promote `username` and `password` to first-class controls**
   - In `Inspector.tsx`, in the `ref.kind === "outbound"` block, add labeled inputs for `username` (text) and `password` (password/text) when `entityType === "naive"`, placed after `server_port`.
   - Add `"username"` and `"password"` to `outboundHandledFields`.

5. **[P1] Add `quic_congestion_control` enum select for naive outbound**
   - In `Inspector.tsx`, within the `entityType === "naive"` outbound branch, render a `<select>` for `quic_congestion_control` with options: `""` (default = bbr), `"bbr"`, `"bbr2"`, `"cubic"`, `"reno"`.
   - Add `"quic_congestion_control"` to `outboundHandledFields`.

6. **[P1] Add `ech` JsonField in TLS group (or NaiveProxy-specific TLS override)**
   - In `Inspector.tsx`, in the TLS group definition (or the NaiveProxy-specific override from task 2), add a `JsonField` for `tls.ech`.

7. **[P1] Add `certificate` inline PEM to TLS group**
   - In `Inspector.tsx`, in the TLS group definition, add `{ label: "Certificate (inline PEM)", path: ["tls", "certificate"], kind: "list" }`.

---

## Done Criteria

- Creating NaiveProxy outbound from Library seeds a valid JSON with `server`, `server_port` (443), `username`, `password`, and a `tls: { enabled: true, server_name: "" }` skeleton.
- Inspector renders `username` and `password` as first-class form inputs, not inside the AdvancedScalarFields disclosure.
- TLS group shows only NaiveProxy-supported fields: `server_name`, `certificate`, `certificate_path`, `ech`. Does not show `insecure`, `alpn`, version selects, or `certificate_provider`.
- Inspector renders `extra_headers` as an editable JSON object field.
- Inspector renders `quic_congestion_control` as a select with the 4 valid enum values.
- `ech` is editable via a JSON field in the TLS section.
- Dial Fields group (`detour`, bind interface, etc.) is present and functions correctly.
- UDP-over-TCP group is present and functions correctly.
- Canvas node subtitle shows `server:server_port` when both are set.
- Fixture or smoke test proves the node can be imported (with TLS, username/password, and optionally extra_headers), rendered, edited (credential change, server_name update), and exported with updated values.
