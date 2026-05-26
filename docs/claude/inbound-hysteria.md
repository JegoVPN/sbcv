<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / hysteria — Deep UI Review

> Source: official stable doc, official testing doc, Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts.
> Review date: 2026-05-27.
> **Hysteria v1 is a deprecated protocol.** The official sing-box project has superseded it with Hysteria2 (`type: "hysteria2"`). This review treats the node as a legacy compatibility target that must warn users and guide them to Hysteria2.

---

## Official Field Inventory

### Stable vs Testing differences

| Concern | Stable | Testing (1.14.0+) |
|---|---|---|
| `recv_window_conn` | Present, no deprecation marker | **Deprecated** → use QUIC `stream_receive_window` |
| `recv_window_client` | Present, no deprecation marker | **Deprecated** → use QUIC `connection_receive_window` |
| `max_conn_client` | Present, no deprecation marker | **Deprecated** → use QUIC `max_concurrent_streams` |
| `disable_mtu_discovery` | Present, no deprecation marker | **Deprecated** → use QUIC `disable_path_mtu_discovery` |
| QUIC shared fields | Not present | `... // QUIC Fields` embedded (via shared/quic.md + shared/http2.md) |

In stable the four legacy QUIC-control fields are first-class. In testing they are deprecated inline stubs pointing to QUIC shared fields. The UI must handle both targets.

### Protocol-specific fields (9 canonical, 4 deprecated)

| Field | Type | Required | Notes |
|---|---|---|---|
| `up` | string | Yes (if `up_mbps` absent) | `"[Integer] [Unit]"` — bps/Kbps/Mbps/Gbps/Tbps (bits or bytes). |
| `up_mbps` | integer | Yes (if `up` absent) | Shorthand for `up` in Mbps. |
| `down` | string | Yes (if `down_mbps` absent) | Same unit format as `up`. |
| `down_mbps` | integer | Yes (if `down` absent) | Shorthand for `down` in Mbps. |
| `obfs` | string | No | Obfuscation password. |
| `users[]` | array | No | Array of `{ name?, auth?, auth_str? }`. No auth if empty. |
| `users[].auth` | string | No | Authentication password, base64-encoded. |
| `users[].auth_str` | string | No | Authentication password, plaintext. |
| `tls` | object | **Required** | Shared inbound TLS. Hysteria v1 requires TLS. |
| ~~`recv_window_conn`~~ | integer | No | Deprecated ≥ 1.14.0 → `stream_receive_window`. Stream-level QUIC flow-control window. Default 15 MB/s. |
| ~~`recv_window_client`~~ | integer | No | Deprecated ≥ 1.14.0 → `connection_receive_window`. Connection-level QUIC flow-control window. Default 64 MB/s. |
| ~~`max_conn_client`~~ | integer | No | Deprecated ≥ 1.14.0 → `max_concurrent_streams`. Max concurrent bidirectional QUIC streams. Default 1024. |
| ~~`disable_mtu_discovery`~~ | boolean | No | Deprecated ≥ 1.14.0 → `disable_path_mtu_discovery`. Force-enabled on non-Linux/Windows. |

### Shared Listen Fields (via shared/listen.md — 14 active, 5 deprecated)

| Field | Since | Notes |
|---|---|---|
| `listen` | — | **Required**. Listen address. |
| `listen_port` | — | Listen port. |
| `bind_interface` | 1.12.0 | Network interface to bind. |
| `routing_mark` | 1.12.0 | Linux only. Integer or hex string. |
| `reuse_addr` | 1.12.0 | Reuse listener address. |
| `netns` | 1.12.0 | Linux only. Network namespace name or path. |
| `tcp_fast_open` | — | Enable TCP Fast Open. |
| `tcp_multi_path` | — | Go 1.21 required. |
| `disable_tcp_keep_alive` | 1.13.0 | Disable TCP keep alive. |
| `tcp_keep_alive` | 1.13.0 | Keep alive initial period. Default `5m`. |
| `tcp_keep_alive_interval` | — | Keep alive interval. Default `75s`. |
| `udp_fragment` | — | Enable UDP fragmentation. |
| `udp_timeout` | — | UDP NAT expiration. Default `5m`. |
| `detour` | — | Forward to a specified (injectable) inbound. |
| ~~`sniff`~~ | deprecated 1.11.0 | Removed in 1.13.0. Do not expose. |
| ~~`sniff_override_destination`~~ | deprecated 1.11.0 | Removed in 1.13.0. |
| ~~`sniff_timeout`~~ | deprecated 1.11.0 | Removed in 1.13.0. |
| ~~`domain_strategy`~~ | deprecated 1.11.0 | Removed in 1.13.0. |
| ~~`udp_disable_domain_unmapping`~~ | deprecated 1.11.0 | Removed in 1.13.0. |

### Shared QUIC Fields (testing / 1.14.0+, via shared/quic.md + shared/http2.md)

| Field | Notes |
|---|---|
| `initial_packet_size` | Initial QUIC packet size (integer). |
| `disable_path_mtu_discovery` | Disable path MTU discovery (boolean). Replaces `disable_mtu_discovery`. |
| `idle_timeout` | Idle connection timeout (duration string). |
| `keep_alive_period` | Keep alive period (duration string). |
| `stream_receive_window` | HTTP2/QUIC stream-level flow-control (memory size string, e.g. `"15 MB"`). Replaces `recv_window_conn`. |
| `connection_receive_window` | HTTP2/QUIC connection-level flow-control (memory size string). Replaces `recv_window_client`. |
| `max_concurrent_streams` | Max concurrent streams per connection (integer). Replaces `max_conn_client`. |

Total official fields: **9 protocol-specific (4 deprecated) + 14 active listen fields + 7 QUIC shared (testing) + 15+ TLS inbound fields = ~45 meaningful fields.**

---

## Left Panel — Palette (Add Library)

**Current state:**
```ts
{ label: "Hysteria", kind: "inbound-hysteria", icon: Plug, docsUrl: docs("inbound/hysteria/"), status: "setup" }
```
Listed directly above `"Hysteria2"` in the Inbounds section with no visual distinction to indicate that `"Hysteria"` is a deprecated v1 protocol.

### Findings

- No deprecation indicator or warning badge. A user scanning the Palette has no signal that Hysteria (v1) is legacy and should prefer Hysteria2.
- `status: "setup"` suppresses the ADD action; the node cannot be dragged or clicked to create. This is consistent with other inbounds at this stage.
- `icon: Plug` is shared with TUIC and Hysteria2 — no visual differentiation.
- Docs link target `docs("inbound/hysteria/")` is correct.
- No channel gate: Hysteria v1 inbound is available on both stable and testing targets even though it is a deprecated protocol on testing.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"inbound"` (generic for all inbound types).

### Port Specification

```
Right ports (output):
  - "route"             → Route hub
  - "route-rule-match"  → Route rule matcher
  - "dns-rule-match"    → DNS rule matcher
Left ports: none.
```

This is correct. Hysteria inbound is a source node; it produces traffic that flows to the router.

### Findings

- Canvas node does not display `listen_port`, `up_mbps`/`down_mbps`, or protocol name prominently. When multiple inbounds are on canvas, Hysteria v1 and Hysteria2 nodes are visually indistinguishable.
- No deprecation indicator on the canvas node itself. Users cannot see at a glance that a node uses the legacy v1 protocol.
- No TLS status indicator (TLS is required for Hysteria v1; a node missing TLS is invalid but shows no visual error state).

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "inbound"`

1. **Tag** rename input.
2. **Type** select from `CREATABLE_INBOUND_TYPES` — includes `"hysteria"` at the same level as `"hysteria2"`.
3. **Address** text input (always shown for all inbounds — incorrect for hysteria).
4. **Auto route** checkbox (always shown for all inbounds — incorrect for hysteria).
5. **AdvancedScalarFields** accordion — spills any scalar field not in `inboundHandledFields`.
6. **SharedFieldCards** — renders `"listen"`, `"tls"`, `"quic"` sections for hysteria inbound (correct per `sharedGroupsForEntity`).

### `inboundHandledFields` set

```ts
const inboundHandledFields = new Set([
  "tag", "type", "address", "auto_route",
  "tls", "multiplex", "transport", "handshake",
  ...listenSharedFields,   // listen, listen_port, bind_interface, routing_mark,
                           // reuse_addr, netns, tcp_fast_open, udp_timeout
  ...quicSharedFields,     // initial_packet_size, disable_path_mtu_discovery,
                           // idle_timeout, keep_alive_period
]);
```

### Gap analysis for Hysteria v1 inbound

| Field | Expected | Actual |
|---|---|---|
| `up` / `up_mbps` | Bandwidth input (Required) | **Not in `inboundHandledFields`** — `up_mbps` is a number, appears in `AdvancedScalarFields`. `up` (string) also appears there. No Required label or unit hint. |
| `down` / `down_mbps` | Bandwidth input (Required) | Same gap as `up`. |
| `obfs` | Text input with obfuscation note | Not in `inboundHandledFields` — leaks to `AdvancedScalarFields` as a plain text box. |
| `users[]` | Structured repeater (`name`, `auth`, `auth_str`) | **Not in `inboundHandledFields`** — `users` is an array and is **silently dropped** by `AdvancedScalarFields` (arrays are skipped). Users are entirely invisible. |
| `tls` | Shared TLS card (Required) | Correctly handled via `inboundTlsTypes`. TLS card is shown. However no visual "Required" marker. |
| `recv_window_conn` | Deprecated warning on testing | Not in `inboundHandledFields` — leaks to `AdvancedScalarFields` as a number box. No deprecation note. |
| `recv_window_client` | Deprecated warning on testing | Same gap. |
| `max_conn_client` | Deprecated warning on testing | Same gap. |
| `disable_mtu_discovery` | Deprecated warning on testing | Not in `inboundHandledFields` — leaks as checkbox. No deprecation note. |
| Listen fields | Shared Listen card | Correctly handled. |
| QUIC fields (testing) | Shared QUIC card | Correctly handled via `inboundQuicTypes`. |
| `stream_receive_window` / `connection_receive_window` / `max_concurrent_streams` | Exposed in QUIC/HTTP2 card (testing) | Present in `serviceHandledFields` but **not in `inboundHandledFields`**. For hysteria inbound on testing target these are in the QUIC shared card but are not protected from falling into `AdvancedScalarFields` if they appear at the top level in an imported config. |
| `address` | N/A for hysteria | **Shown unconditionally** for all inbounds. Hysteria v1 has no `address` field. |
| `auto_route` | N/A for hysteria | **Shown unconditionally** for all inbounds. Hysteria v1 has no `auto_route` field. |
| Protocol v1 deprecation warning | Must be shown | **Absent**. No UI signal that this is a deprecated protocol. |

### Default template in `commands.ts` (`createInbound("hysteria", …)`)

```ts
{
  type,
  tag,
  listen: "127.0.0.1",
  listen_port: 2080,
  up_mbps: 100,
  down_mbps: 100,
  users: [{ name: "user", auth_str: "change-me" }],
}
```

**Gap:** Template omits required `tls` field. Hysteria v1 requires TLS (`tls` is `==Required==` per official doc). A newly created node will fail official validation without TLS configured. Template should include at minimum `tls: { enabled: true }`.

---

## Priority Findings

### P0 — users[] is silently invisible

`users` is an array of `{ name?, auth?, auth_str? }` objects. It is not in `inboundHandledFields`. `AdvancedScalarFields` skips non-scalar types (line 205–211 of Inspector.tsx), so `users` is completely invisible in the Inspector for a Hysteria v1 inbound.

A user importing a config with `"users": [{"name":"alice","auth_str":"secret"}]` sees no entry for users and cannot edit credentials. The export silently preserves the array (the state is not destroyed), but there is no way to view, add, or remove users through the UI.

**Resolution required:** Add a `users[]` dedicated section for `entityType === "hysteria"` in the inbound inspector block. At minimum use a `JsonField` labelled "Hysteria Users (name / auth_str)" with `onChange` writing to `entity.users`. Also add `"users"` to `inboundHandledFields`.

### P0 — TLS required but template omits it; no required-field diagnostic

The official spec marks `tls` as `==Required==` for Hysteria v1. The `createInbound("hysteria", …)` template in `commands.ts` does not include a `tls` stub. A newly created node will export a config that fails `sing-box check` immediately. There is also no diagnostic rule in `diagnostics.ts` that checks `inbound.tls.enabled === true` for hysteria inbounds.

**Resolution required:**
1. Add `tls: { enabled: true }` to the `createInbound("hysteria", …)` default template in `commands.ts`.
2. Add a diagnostic rule: if an inbound has `type === "hysteria"` and `!(inbound.tls?.enabled)`, emit a `warning` (or `error`) of kind `"hysteria-tls-required"`.

### P0 — up/down bandwidth fields (Required) buried in AdvancedScalarFields

`up_mbps` and `down_mbps` are both marked `==Required==` in the official doc. They exist in the default template but are not in `inboundHandledFields`, so they surface in the generic "Advanced fields" accordion without labels, unit hints, or Required markers. `up` and `down` (string form) are also missing. Users have no indication these fields are mandatory or what unit format is accepted.

**Resolution required:** Add `up_mbps`, `down_mbps`, `up`, `down` to `inboundHandledFields` and render dedicated labeled number/text inputs for `entityType === "hysteria"` with a hint about the string format for `up`/`down` (`"[Integer] [Unit]"`, case-sensitive units).

### P1 — Hysteria v1 deprecation not communicated anywhere

Hysteria v1 is a deprecated protocol. Neither the Palette entry, the canvas node, nor the Inspector contains any warning directing users to Hysteria2. A user starting fresh has no reason to choose Hysteria2 over Hysteria v1 based on the current UI.

**Resolution required:**
1. In Palette.tsx, add a deprecated sub-label or suffix to the Hysteria entry label, e.g. `"Hysteria (v1, deprecated)"`.
2. In the Inspector, add a `<div className="inspector-warning">` notice for `entityType === "hysteria"`: _"Hysteria v1 is deprecated. Use Hysteria2 for new deployments."_ with a link or reference to the Hysteria2 inbound.
3. Optionally: add a `deprecated-hysteria-v1` diagnostic of level `warning` for any config that contains an inbound with `type === "hysteria"`.

### P1 — Legacy QUIC fields (recv_window_conn / recv_window_client / max_conn_client / disable_mtu_discovery) have no deprecation handling on testing target

On the testing channel (1.14.0+), these four fields are deprecated. They are not in `inboundHandledFields`, so they fall through to `AdvancedScalarFields` as generic number/boolean inputs — no deprecation message, no migration hint pointing to the replacement QUIC shared fields. Users on the testing channel who import an old Hysteria v1 config will see these fields with no guidance.

**Resolution required:**
1. Add `recv_window_conn`, `recv_window_client`, `max_conn_client`, `disable_mtu_discovery` to `inboundHandledFields`.
2. For `entityType === "hysteria"`, render them as labeled inputs with a conditional deprecation notice when `channel === "testing"`: _"Deprecated in 1.14.0 — use QUIC Fields `stream_receive_window` / `connection_receive_window` / `max_concurrent_streams` / `disable_path_mtu_discovery` instead."_

### P1 — address and auto_route shown for Hysteria v1 inbound (wrong fields)

The inbound inspector block unconditionally renders `address` and `auto_route` for every inbound type. Hysteria v1 has neither field in the official spec. These controls write to the entity and pollute the exported config with unrecognized fields.

**Resolution required:** Gate the `address` input and `auto_route` checkbox to `entityType === "tun"` only (this fix applies to all non-TUN inbounds; tracked in inbound-http review as the same P1).

### P1 — Listen card missing 5 fields (shared gap, same as all inbounds)

`tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, and `detour` are absent from `listenSharedFields` and `inboundHandledFields`. For Hysteria v1 these are all valid listen fields per the official shared/listen.md. Any imported config containing them will surface scalar types in `AdvancedScalarFields` without labels or context.

**Resolution required:** Same as inbound-http P1 Task 4 — add these 5 fields to `listenSharedFields` (and `inboundHandledFields`).

### P1 — TLS card missing server key fields (shared gap, same as all TLS inbounds)

`tls.key_path` and `tls.certificate[]` / `tls.key[]` (inline PEM) are not exposed in the TLS shared card. Hysteria v1 requires TLS, so these are critical for any functional deployment. Users must use the global JSON textarea to set the server certificate.

**Resolution required:** Same as inbound-http P1 Task 5 — add `tls.key_path`, `tls.certificate[]`, `tls.key[]` to the TLS group definitions. ACME sub-object should be a secondary collapsible section.

---

## Implementation Tasks

### Task 1 — Add users[] repeater for Hysteria v1 inbound (P0)

**File:** `src/components/Inspector.tsx`

In the `ref.kind === "inbound"` block, add after the existing `address`/`auto_route` section:

```tsx
{entityType === "hysteria" ? (
  <JsonField
    label="Users (name / auth_str / auth)"
    value={entity.users ?? []}
    onChange={(value) => updateField(ref, "users", value)}
  />
) : null}
```

Add `"users"` to `inboundHandledFields`.

Long-term: replace `JsonField` with a `HysteriaUsersRepeater` that renders one `{ name?, auth_str?, auth? }` row per entry with Add/Remove controls.

### Task 2 — Add TLS stub to createInbound("hysteria") template and add TLS-required diagnostic (P0)

**File:** `src/domain/commands.ts`, `src/domain/diagnostics.ts`

In `commands.ts`, change the hysteria inbound default template:

```ts
if (type === "hysteria") {
  return {
    type,
    tag,
    listen: "127.0.0.1",
    listen_port: 2080,
    up_mbps: 100,
    down_mbps: 100,
    users: [{ name: "user", auth_str: "change-me" }],
    tls: { enabled: true },   // add this
  };
}
```

In `diagnostics.ts`, in the inbounds loop, add:

```ts
if (inbound.type === "hysteria") {
  const tls = inbound.tls as Record<string, unknown> | undefined;
  if (!tls || !tls.enabled) {
    push(diagnostics, "error", "hysteria-tls-required",
      `/inbounds/${index}/tls`,
      `Hysteria inbound "${inbound.tag}" requires TLS. Set tls.enabled: true.`);
  }
}
```

### Task 3 — Expose bandwidth fields with Required label for Hysteria v1 inbound (P0)

**File:** `src/components/Inspector.tsx`

Add `"up_mbps"`, `"down_mbps"`, `"up"`, `"down"` to `inboundHandledFields`.

In the inbound block, add for `entityType === "hysteria"`:

```tsx
{entityType === "hysteria" ? (
  <>
    <label className="field">
      <span>Upload Mbps (required)</span>
      <input
        type="number"
        value={Number(entity.up_mbps ?? 0)}
        onChange={(event) => updateField(ref, "up_mbps", Number(event.target.value) || undefined)}
      />
    </label>
    <label className="field">
      <span>Download Mbps (required)</span>
      <input
        type="number"
        value={Number(entity.down_mbps ?? 0)}
        onChange={(event) => updateField(ref, "down_mbps", Number(event.target.value) || undefined)}
      />
    </label>
  </>
) : null}
```

For the string forms `up`/`down`, add them to `inboundHandledFields` and let them fall to `AdvancedScalarFields` as text inputs — they are the non-Mbps alternative and rarely used directly.

### Task 4 — Add Hysteria v1 deprecation warning to Palette and Inspector (P1)

**File:** `src/components/Palette.tsx`, `src/components/Inspector.tsx`

In Palette.tsx, change the Hysteria inbound label:

```ts
{ label: "Hysteria (v1, legacy)", kind: "inbound-hysteria", icon: Plug, docsUrl: docs("inbound/hysteria/"), status: "setup" }
```

In Inspector.tsx, inside the `ref.kind === "inbound"` block, add for `entityType === "hysteria"`:

```tsx
{entityType === "hysteria" ? (
  <div className="inspector-warning">
    Hysteria v1 is a deprecated protocol. Use Hysteria2 for new deployments.
  </div>
) : null}
```

Optionally in `diagnostics.ts` add a `warning` level diagnostic `"deprecated-hysteria-v1"` for any inbound with `type === "hysteria"`.

### Task 5 — Handle legacy QUIC fields with deprecation hints on testing target (P1)

**File:** `src/components/Inspector.tsx`

Add `"recv_window_conn"`, `"recv_window_client"`, `"max_conn_client"`, `"disable_mtu_discovery"` to `inboundHandledFields`.

For `entityType === "hysteria"`, render them inside a collapsible section labelled "Legacy QUIC Settings (deprecated in 1.14.0)" with a note: _"Migrate to QUIC Fields: stream_receive_window / connection_receive_window / max_concurrent_streams / disable_path_mtu_discovery."_

### Task 6 — Gate address/auto_route to TUN only (P1, shared with all inbounds)

**File:** `src/components/Inspector.tsx` lines 1486–1500

Wrap the `address` input and `auto_route` checkbox so they only render when `entityType === "tun"`.

### Task 7 — Expand listenSharedFields with missing fields (P1, shared with all inbounds)

**File:** `src/components/Inspector.tsx`

Add to `listenSharedFields` (and the listen group `sharedFieldDefinitionsFor`):
- `tcp_multi_path` → `{ label: "TCP Multi Path", path: ["tcp_multi_path"], kind: "boolean" }`
- `disable_tcp_keep_alive` → `{ label: "Disable TCP Keep Alive", path: ["disable_tcp_keep_alive"], kind: "boolean" }`
- `tcp_keep_alive` → `{ label: "TCP Keep Alive", path: ["tcp_keep_alive"], kind: "text" }`
- `tcp_keep_alive_interval` → `{ label: "TCP Keep Alive Interval", path: ["tcp_keep_alive_interval"], kind: "text" }`
- `detour` → `{ label: "Detour Inbound", path: ["detour"], kind: "text" }` (inbound tag, not outbound)

Also add these five field names to `inboundHandledFields`.

### Task 8 — Expand TLS card with server key fields (P1, shared with all TLS inbounds)

**File:** `src/components/Inspector.tsx`, TLS group definitions

Add:
- `{ label: "Key Path", path: ["tls", "key_path"], kind: "text" }` (server private key path)
- `{ label: "Certificate (PEM)", path: ["tls", "certificate"], kind: "list" }`
- `{ label: "Key (PEM)", path: ["tls", "key"], kind: "list" }`

ACME, ECH, and Reality sub-objects should be at minimum `JsonField` fallbacks.

---

## Done Criteria

- Inspector shows a deprecation warning banner for `type === "hysteria"`.
- `users[]` array is visible and editable in the Inspector for `type === "hysteria"`.
- `up_mbps` and `down_mbps` appear as labeled Required number inputs.
- `obfs` appears as a labeled text input (not buried in Advanced fields).
- Default template includes `tls: { enabled: true }`.
- Diagnostic fires when `tls.enabled` is not `true` for a hysteria inbound.
- Legacy QUIC fields (`recv_window_conn` etc.) appear with deprecation notes on testing channel.
- `address` and `auto_route` are hidden for non-TUN inbounds.
- Listen card includes `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `detour`.
- TLS card exposes `key_path`, `certificate`, `key`.
- Fixture or e2e smoke test: import `{ type: "hysteria", listen: "0.0.0.0", listen_port: 443, up_mbps: 100, down_mbps: 100, users: [{name:"u","auth_str":"p"}], tls: { enabled: true, certificate_path: "...", key_path: "..." } }`, verify Inspector shows all fields, edit tag, export JSON, check round-trip.
