# Outbound / tuic — Deep UI Review

> Source: official stable docs (`outbound/tuic.md`), official testing docs (diff noted), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts.
> Review date: 2026-05-27.

---

## Version / Build Restriction

No minimum version gate is documented in either the stable or testing branch for TUIC outbound.

**Stable vs. testing diff:** Testing adds a `// QUIC Fields` comment section to the structure example (pointing to `shared/quic.md`). Stable only includes `// Dial Fields`. The field descriptions themselves are otherwise identical — no new or removed fields between branches.

---

## Official Field Inventory

**Protocol-specific fields (9)**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `server` | string | **Required** | — | Server address. |
| `server_port` | integer | **Required** | — | Server port. |
| `uuid` | string | **Required** | — | TUIC user UUID. |
| `password` | string | optional | — | TUIC user password. Not marked Required in docs; omit means no password auth. |
| `congestion_control` | string enum | optional | `"cubic"` | One of: `cubic`, `new_reno`, `bbr`. |
| `udp_relay_mode` | string enum | optional | `"native"` | One of: `native`, `quic`. Conflicts with `udp_over_stream`. |
| `udp_over_stream` | boolean | optional | `false` | TUIC port of UDP-over-TCP protocol. Conflicts with `udp_relay_mode`. |
| `zero_rtt_handshake` | boolean | optional | `false` | Enable 0-RTT QUIC handshake. |
| `heartbeat` | string (duration) | optional | — | Heartbeat interval. |
| `network` | string enum | optional | (both) | One of `tcp`, `udp`. Both enabled if omitted. |
| `tls` | object | **Required** | — | Shared outbound TLS section. |

**Shared field groups (via `sharedFieldRegistry.ts`)**

- `dial` — included for all outbounds that are not `block`, `dns`, `selector`, or `urltest`. TUIC is in scope.
- `tls` — TUIC is in `outboundTlsTypes`.
- `quic` — TUIC is in `outboundQuicTypes`. Covers: `initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period`.
- `udp-over-tcp` — TUIC is in `outboundUdpOverTcpTypes`. The shared card covers `udp_over_stream` fields (enabled, packet_encoding).

**No** multiplex or v2ray-transport sections: confirmed by `outboundMultiplexTypes` and `outboundTransportTypes` in `sharedFieldRegistry.ts` — TUIC is absent from both.

Total official fields: **11 protocol-specific + dial shared fields + TLS shared fields + QUIC shared fields + UDP-over-TCP shared fields**.

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 166):

```ts
{ label: "TUIC", kind: "tuic-out", icon: Plug, docsUrl: docs("outbound/tuic/"), status: "setup" }
```

### Findings

- Label `"TUIC"` is correct.
- `status: "setup"` renders a non-clickable badge. No drag-to-canvas or click-to-create action is available. This is consistent with other outbound setup nodes (hysteria, hysteria2, anytls, etc.).
- `docsUrl` target `docs("outbound/tuic/")` is correct.
- `icon: Plug` is shared with inbound-tuic, hysteria-out, hysteria2-out — no unique visual identity. Acceptable given all QUIC-family nodes share the same icon family.
- No version gate present. TUIC has no documented minimum version restriction, so this is acceptable.

---

## Middle Panel — Canvas Node

**Canvas node kind:** generic outbound node.

### Port Specification

TUIC is a leaf outbound — it terminates connections. Expected ports:

```
Left ports (input):
  - selector candidate
  - urltest candidate
  - route final outbound
  - route rule outbound
  - DNS detour
  - Dial detour target

Right ports (output):
  - downstream dial detour (for outbound dial.detour)
```

### Findings

- Standard outbound port layout is correct for TUIC.
- No TUIC-specific port behavior is needed.
- Canvas node displays `tag ?? ref.kind` label. Acceptable.

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "outbound"`

From `Inspector.tsx` lines 1505–1545:

1. **Tag** rename input.
2. **Type** select from `CREATABLE_OUTBOUND_TYPES`.
3. **Server** text input — shown because `"server" in entity` (seeded by `createOutbound`).
4. **Port** number input — shown because `"server_port" in entity`.
5. **AdvancedScalarFields** — generic accordion for scalars not in `outboundHandledFields`.
6. **SharedFieldCards** — `dial`, `tls`, `quic`, `udp-over-tcp` via `sharedGroupsForEntity`.

### `outboundHandledFields` set — what is explicitly handled

```ts
const outboundHandledFields = new Set([
  "tag", "type", "server", "server_port",
  "outbounds", "default",
  "tls", "multiplex", "transport", "udp_over_tcp",
  ...dialSharedFields,   // detour, bind_interface, connect_timeout, domain_resolver, network_strategy, network_type, fallback_network_type, fallback_delay
  ...quicSharedFields,   // initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period
]);
```

### Gap analysis for TUIC outbound

| Field | Expected UI | Actual |
|---|---|---|
| `server` | Text input — shown. | Correctly rendered via `"server" in entity`. |
| `server_port` | Number input — shown. | Correctly rendered via `"server_port" in entity`. |
| `uuid` | Text input. **Required** per docs. | **NOT in `outboundHandledFields`**. Scalar string — falls through to `AdvancedScalarFields` accordion. Visible but buried under "Advanced fields". |
| `password` | Text input (optionally masked). | **NOT in `outboundHandledFields`**. Falls through to `AdvancedScalarFields`. Visible but buried. |
| `congestion_control` | Select: `cubic`, `new_reno`, `bbr`. | **NOT in `outboundHandledFields`**. Falls through to `AdvancedScalarFields` as plain text input. No enum constraint. |
| `udp_relay_mode` | Select: `native`, `quic`. | **NOT in `outboundHandledFields`**. Falls through to `AdvancedScalarFields` as plain text input. No enum constraint. |
| `udp_over_stream` | Boolean toggle. Conflicts with `udp_relay_mode`. | NOT in `outboundHandledFields`. Boolean — visible in `AdvancedScalarFields` as checkbox. No conflict hint. |
| `zero_rtt_handshake` | Boolean toggle. | NOT in `outboundHandledFields`. Boolean — visible in `AdvancedScalarFields` as checkbox. |
| `heartbeat` | Duration text input. | NOT in `outboundHandledFields`. Scalar string — visible in `AdvancedScalarFields`. |
| `network` | Select: `tcp`, `udp`, or blank (both). | NOT in `outboundHandledFields`. Falls through to `AdvancedScalarFields` as plain text input. No enum constraint. |
| `tls` | Shared TLS card — **Required**. | Correctly handled: TUIC is in `outboundTlsTypes`. TLS card shown. |
| `quic.*` fields | Shared QUIC card. | Correctly handled: TUIC is in `outboundQuicTypes`. |
| `udp-over-tcp.*` fields | Shared UDP-over-TCP card. | Correctly handled: TUIC is in `outboundUdpOverTcpTypes`. |
| `dial.*` fields | Shared Dial card. | Correctly handled for all outbounds. |

### Default template — `commands.ts` (lines 367–379)

```ts
if (type === "tuic") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    uuid: "2dd61d93-75d8-4da4-ac0e-6aece7eac365",
    password: "change-me",
    congestion_control: "cubic",
    udp_relay_mode: "native",
    network: "udp",
  };
}
```

Findings on the default template:

- `uuid` seeded with a placeholder UUID — correct, but user must change it. No validation or UUID-generate button.
- `password` seeded with `"change-me"` — acceptable placeholder, but masked input or in-place generator would improve security UX.
- `congestion_control: "cubic"` matches the official default.
- `udp_relay_mode: "native"` matches the official default.
- `network: "udp"` — **suspicious**. The official default is "both" (omit the field). Setting `network: "udp"` means TCP traffic cannot flow through this outbound when added from the Palette. Most TUIC usage is UDP-dominant but TCP-only seeding excludes TCP entirely, which may be unintended for general use.
- `tls` is **absent** from the default template. TLS is `==Required==` per the official spec. A newly created TUIC outbound will have no TLS configuration and will fail at runtime when the sing-box binary enforces TLS requirement.
- `zero_rtt_handshake` and `heartbeat` are omitted — correct, both have sensible built-in defaults.

### SharedFieldCards — Dial group gaps

`dialSharedFields` (lines 105–113 of `Inspector.tsx`) exposes 8 fields. Missing from the shared Dial card:
- `routing_mark`
- `reuse_addr`
- `tcp_fast_open`
- `tcp_multi_path`
- `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`

These are cross-cutting gaps affecting all outbound types, not TUIC-specific.

### SharedFieldCards — TLS group gaps

The outbound TLS card exposes shared TLS fields. Gaps relevant to TUIC:
- `tls.server_name` — critical for QUIC/TLS outbounds (SNI); should be a first-class control
- `tls.insecure` — skipping cert verification is a common TUIC deployment pattern
- `tls.alpn[]` — TUIC commonly requires specific ALPN values (`h3`)
- `tls.disable_sni`, `tls.utls`, `tls.ech{}` sub-objects

---

## Priority Findings

### P0 — tls absent from default template (Required field)

`tls` is `==Required==` per the official TUIC outbound spec. The `createOutbound` template for `"tuic"` (commands.ts line 367) does not include a `tls` object. A node added from the Palette will immediately have a missing Required field. The TLS shared card IS shown in the Inspector (correct), but there is nothing to expand or edit until the user manually enables TLS — which in the current TLS card implementation may mean clicking a toggle with unclear state.

The official example shows `"tls": {}` in the structure. The binary will reject a TUIC outbound without TLS.

**Resolution required:** Update `createOutbound` for `"tuic"` in `commands.ts` to include `tls: { enabled: true }` (at minimum) in the default template.

### P0 — uuid is a Required field buried in Advanced accordion

`uuid` is `==Required==` per the official spec. It is seeded by the default template (so it exists on creation), but it is not in `outboundHandledFields` — it therefore falls through to `AdvancedScalarFields` (collapsed accordion). A user editing the Inspector sees `server` and `server_port` prominently but must expand "Advanced fields" to reach `uuid`, which is a required protocol credential.

`password` is optional per the spec but is also buried in the same accordion. Because it is seeded and usually needed, it should be near `uuid`.

**Resolution required:** Add first-class `uuid` and `password` controls inside the `ref.kind === "outbound"` block, gated on `entityType === "tuic"`. Add `"uuid"` and `"password"` to `outboundHandledFields`.

### P1 — congestion_control and udp_relay_mode lack enum select

`congestion_control` accepts exactly three values (`cubic`, `new_reno`, `bbr`). `udp_relay_mode` accepts exactly two (`native`, `quic`). Both are currently rendered as freeform text inputs via `AdvancedScalarFields` — invalid values are silently accepted and will cause the binary to reject the config.

**Resolution required:** Add dedicated `<select>` controls for both fields inside the `entityType === "tuic"` outbound block. Add both keys to `outboundHandledFields`.

### P1 — network: "udp" in default template should be omitted

The official default for `network` is "both" (field absent). The default template seeds `network: "udp"`, which silently disables TCP support for any TUIC outbound added from the Palette. In scenarios where the upstream uses TUIC to relay TCP traffic (via `udp_relay_mode: "quic"` or similar), this will break connectivity.

**Resolution required:** Remove `network: "udp"` from the `createOutbound` default for `"tuic"`, or add a `network` select control (tcp / udp / both) and default to "both"/omitted.

### P1 — udp_relay_mode / udp_over_stream conflict not surfaced

`udp_relay_mode` and `udp_over_stream` are mutually exclusive per the official docs ("Conflict with `udp_over_stream`" and "Conflict with `udp_relay_mode`"). Currently both fields appear independently in `AdvancedScalarFields` with no conflict validation or hint. Setting both simultaneously produces an invalid config.

**Resolution required:** When implementing dedicated controls for these fields, add mutual-exclusion logic: enabling `udp_over_stream` should clear/disable `udp_relay_mode`, and vice versa. A diagnostic warning should fire if both are set in an imported config.

---

## Implementation Tasks

### Task 1 — Add tls to default template (P0)

**File:** `src/domain/commands.ts` (line 367–379)

```ts
if (type === "tuic") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    uuid: "2dd61d93-75d8-4da4-ac0e-6aece7eac365",
    password: "change-me",
    congestion_control: "cubic",
    udp_relay_mode: "native",
    // Remove network: "udp" — omission means both tcp+udp (official default)
    tls: { enabled: true },
  };
}
```

### Task 2 — First-class uuid and password controls (P0)

**File:** `src/components/Inspector.tsx` — inside the `ref.kind === "outbound"` block

After the `server_port` control, add:

```tsx
{entityType === "tuic" ? (
  <>
    <label className="field">
      <span>UUID</span>
      <input
        value={String(entity.uuid ?? "")}
        onChange={(event) => updateField(ref, "uuid", event.target.value)}
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        spellCheck={false}
      />
    </label>
    <label className="field">
      <span>Password</span>
      <input
        value={String(entity.password ?? "")}
        onChange={(event) => updateField(ref, "password", event.target.value || undefined)}
        placeholder="(optional)"
      />
    </label>
  </>
) : null}
```

Add `"uuid"` and `"password"` to `outboundHandledFields`.

### Task 3 — Enum selects for congestion_control, udp_relay_mode, network (P1)

**File:** `src/components/Inspector.tsx` — inside the `entityType === "tuic"` block from Task 2

```tsx
<label className="field">
  <span>Congestion Control</span>
  <select
    value={String(entity.congestion_control ?? "cubic")}
    onChange={(event) => updateField(ref, "congestion_control", event.target.value)}
  >
    <option value="cubic">cubic (default)</option>
    <option value="new_reno">new_reno</option>
    <option value="bbr">bbr</option>
  </select>
</label>
<label className="field">
  <span>UDP Relay Mode</span>
  <select
    value={String(entity.udp_relay_mode ?? "native")}
    onChange={(event) => updateField(ref, "udp_relay_mode", event.target.value)}
    disabled={Boolean(entity.udp_over_stream)}
  >
    <option value="native">native (default)</option>
    <option value="quic">quic</option>
  </select>
</label>
<label className="field">
  <span>Network</span>
  <select
    value={String(entity.network ?? "")}
    onChange={(event) => updateField(ref, "network", event.target.value || undefined)}
  >
    <option value="">Both (default)</option>
    <option value="tcp">tcp only</option>
    <option value="udp">udp only</option>
  </select>
</label>
```

Add `"congestion_control"`, `"udp_relay_mode"`, `"network"` to `outboundHandledFields`.

### Task 4 — udp_over_stream mutual exclusion with udp_relay_mode (P1)

**File:** `src/components/Inspector.tsx` — same TUIC block

The `udp_over_stream` toggle (already surfaced via `AdvancedScalarFields`) should be moved to the dedicated block and wired to clear `udp_relay_mode` when enabled:

```tsx
<label className="toggle-row">
  <input
    type="checkbox"
    checked={Boolean(entity.udp_over_stream)}
    onChange={(event) => {
      updateField(ref, "udp_over_stream", event.target.checked || undefined);
      if (event.target.checked) updateField(ref, "udp_relay_mode", undefined);
    }}
  />
  <span>UDP over stream</span>
</label>
```

Add `"udp_over_stream"` to `outboundHandledFields`.

### Task 5 — Remove network: "udp" from default template (P1)

Already covered in Task 1. Separate note: verify any existing imported configs that relied on the `network: "udp"` default are not broken. This is a non-breaking removal — omitting the field expands capability, it does not remove it.

### Task 6 — Add zero_rtt_handshake and heartbeat to handled fields (cleanup)

**File:** `src/components/Inspector.tsx`

Move these from `AdvancedScalarFields` to the dedicated TUIC block:

```tsx
<label className="toggle-row">
  <input
    type="checkbox"
    checked={Boolean(entity.zero_rtt_handshake)}
    onChange={(event) => updateField(ref, "zero_rtt_handshake", event.target.checked || undefined)}
  />
  <span>Zero-RTT handshake</span>
</label>
<label className="field">
  <span>Heartbeat</span>
  <input
    value={String(entity.heartbeat ?? "")}
    onChange={(event) => updateField(ref, "heartbeat", event.target.value || undefined)}
    placeholder="e.g. 10s"
  />
</label>
```

Add `"zero_rtt_handshake"` and `"heartbeat"` to `outboundHandledFields`.

---

## Done Criteria

- New TUIC outbound created from Palette seeds `tls: { enabled: true }` and does NOT set `network: "udp"`.
- Inspector shows `uuid` and `password` as first-class inputs (not buried in Advanced accordion) for `type === "tuic"`.
- `congestion_control` renders as a three-option `<select>` (cubic / new_reno / bbr).
- `udp_relay_mode` renders as a two-option `<select>` (native / quic), disabled when `udp_over_stream` is active.
- `network` renders as a three-option `<select>` (both / tcp / udp).
- Setting `udp_over_stream = true` clears `udp_relay_mode` (and vice versa).
- Fixture or e2e smoke test: import a TUIC outbound config with all fields populated, verify Inspector shows all fields, edit `uuid`, export JSON, confirm round-trip fidelity.
