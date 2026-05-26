<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Inbound / anytls — Deep UI Review

> Source: official stable docs (`inbound/anytls.md`), official testing docs (identical), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts.
> Review date: 2026-05-27.

---

## Version / Build Restriction

**Since sing-box 1.12.0** — both the stable and testing docs carry `!!! question "Since sing-box 1.12.0"`.

AnyTLS is a new protocol with no prior stable release. It is absent from any 1.11.x build. UI should surface a prominent version warning or gate this node behind a version/build guard when the user has configured a pre-1.12 target.

Stable and testing docs are **identical** as of this review — no field differences between branches.

---

## Official Field Inventory

**Protocol-specific fields (3)**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `users[]` | array of objects | **Required** | — | Each entry: `{ name: string, password: string }`. No auth if absent. |
| `padding_scheme` | array of strings | optional | (built-in default, 9 entries) | AnyTLS padding scheme line array. If omitted the binary uses its built-in default. Setting `[]` disables padding. |
| `tls` | object | recommended | — | Shared inbound TLS section. No TLS restriction stated in docs, but AnyTLS is TLS-oriented; excluding TLS produces a plaintext server. |

**Default `padding_scheme` value (from official docs)**

```json
[
  "stop=8",
  "0=30-30",
  "1=100-400",
  "2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000",
  "3=9-9,500-1000",
  "4=500-1000",
  "5=500-1000",
  "6=500-1000",
  "7=500-1000"
]
```

**Shared Listen Fields** — same as all inbounds, via `shared/listen.md`.

**No** multiplex, transport, QUIC, or UDP-over-TCP sections: `sharedFieldRegistry.ts` confirms AnyTLS inbound is in `inboundTlsTypes` only; it is not in `inboundMultiplexTypes`, `inboundTransportTypes`, `inboundQuicTypes`, or `inboundNestedDialTypes`.

Total official fields: **3 protocol-specific + 14 active listen fields + 15+ TLS inbound fields**.

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 144):

```ts
{ label: "AnyTLS", kind: "inbound-anytls", icon: Shield, docsUrl: docs("inbound/anytls/"), status: "setup" }
```

### Findings

- Label `"AnyTLS"` is correct.
- `status: "setup"` renders a non-clickable badge. The node cannot be dragged or clicked to create an inbound. No add action affordance.
- `docsUrl` target `docs("inbound/anytls/")` is correct.
- `icon: Shield` is shared with Trojan, Shadowsocks, VMess, VLESS, TUIC, ShadowTLS, Hysteria2 — no visual differentiation. Acceptable for now.
- **No version gate is present.** A user on a 1.11 target can add this node without any warning that the binary does not support AnyTLS.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"inbound"` (generic inbound node, same as all protocol inbounds).

### Port Specification

```
Right ports (output):
  - "route"             → Route hub
  - "route-rule-match"  → Route rule matcher
  - "dns-rule-match"    → DNS rule matcher
```

No input ports. Correct — inbound is a source node in sing-box topology.

### Findings

- Standard three-output port layout is correct for AnyTLS inbound.
- No AnyTLS-specific port behavior needed.
- Canvas node displays `tag ?? ref.kind` label. Acceptable.
- No `listen_port` or user-count summary visible on canvas when multiple AnyTLS inbounds coexist.

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "inbound"`

1. **Tag** rename input.
2. **Type** select from `CREATABLE_INBOUND_TYPES` (includes `"anytls"` at line 82 of `protocols.ts`).
3. **Address** text input bound to `entity.address` — **not an AnyTLS field**.
4. **Auto route** checkbox bound to `entity.auto_route` — **not an AnyTLS field**.
5. **AdvancedScalarFields** — generic accordion for non-object, non-array scalars not in `inboundHandledFields`.
6. **SharedFieldCards** — `"listen"` and `"tls"` sections via `sharedGroupsForEntity` (AnyTLS is in `inboundTlsTypes`).

### `inboundHandledFields` set — AnyTLS fields NOT included

```ts
const inboundHandledFields = new Set([
  "tag", "type", "address", "auto_route",
  "tls", "multiplex", "transport", "handshake",
  ...listenSharedFields,  // listen, listen_port, bind_interface, routing_mark, reuse_addr, netns, tcp_fast_open, udp_timeout
  ...quicSharedFields,    // initial_packet_size, disable_path_mtu_discovery, idle_timeout, keep_alive_period
]);
```

Neither `users` nor `padding_scheme` appears in this set.

### Gap analysis for AnyTLS inbound

| Field | Expected UI | Actual |
|---|---|---|
| `users[]` | Structured repeater (`name` + `password` per row). Required field — missing means non-functional server. | **Not in `inboundHandledFields`**. `AdvancedScalarFields` only surfaces scalars; arrays are silently invisible. Users array is entirely invisible in Inspector. |
| `padding_scheme` | Multi-line textarea or string-per-row repeater (array of strings). | **Not in `inboundHandledFields`**. Array type — silently invisible in both Inspector sections. |
| `tls` | Shared TLS card | Correctly handled: AnyTLS is in `inboundTlsTypes`. TLS card is shown. |
| Listen fields | Shared Listen card | Correctly handled. |
| `address` | Must NOT appear | Unconditionally shown for all inbounds. AnyTLS has no `address` field in the official spec. |
| `auto_route` | Must NOT appear | Unconditionally shown for all inbounds. AnyTLS has no `auto_route` field. |

### Default template — `commands.ts` (line 234–242)

```ts
if (type === "anytls") {
  return {
    type,
    tag,
    listen: "127.0.0.1",
    listen_port: 2080,
    users: [{ name: "user", password: "change-me" }],
  };
}
```

`users` with one placeholder entry is seeded correctly. `padding_scheme` is omitted (correct — omitting uses the built-in default). `tls` is omitted — this means a newly created AnyTLS inbound defaults to **no TLS**, which contradicts the protocol's TLS-oriented design.

### SharedFieldCards — Listen group gaps (same as all inbounds)

`listenSharedFields` (line 95–103 of `Inspector.tsx`) exposes 8 fields. Missing from the Listen card:
- `tcp_multi_path`
- `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`
- `detour` (inbound-to-inbound forwarding)

### SharedFieldCards — TLS group gaps (same as all inbounds)

The TLS card exposes 8 fields. Missing for AnyTLS inbound:
- `tls.key_path` (server private key path — critical for a TLS server)
- `tls.certificate[]` / `tls.key[]` (inline PEM)
- `tls.client_authentication` (since 1.13.0)
- `tls.acme{}`, `tls.ech{}`, `tls.reality{}` sub-objects

---

## Priority Findings

### P0 — users[] is silently invisible (Required field)

`users` is **Required** per the official spec. It is an array of `{ name, password }` objects. It is not in `inboundHandledFields` and is not rendered in any dedicated inbound block. `AdvancedScalarFields` filters to scalar values only, so `users` is completely invisible in the Inspector.

A user who imports any AnyTLS inbound config sees no credential controls and cannot add, remove, or edit users. The default template seeds one `{ name: "user", password: "change-me" }` entry but there is no UI path to change it — the user must use the global JSON textarea.

Since `users` is Required, its absence means a newly created node with the default template technically produces a valid JSON but the password "change-me" can never be updated through the Inspector. Any import that has credentials loses all visibility.

**Resolution required:** Add a `users[]` repeater (or `JsonField` as minimum) for `entityType === "anytls"` inside the inbound block. Add `"users"` to `inboundHandledFields`.

### P0 — padding_scheme silently invisible

`padding_scheme` is an array of strings. It is not in `inboundHandledFields` and is not rendered anywhere in the inbound Inspector block. Arrays are skipped by `AdvancedScalarFields`. If an imported config includes a custom `padding_scheme`, it is silently invisible in the Inspector.

An operator who wants to tune AnyTLS obfuscation must use the raw JSON textarea — there is no structured path. Worse, if they edit the node through Inspector and save, the round-trip is lossy only if the field is absent from the exported JSON object (depends on how the config store serializes). If the field was imported and stored, it persists invisibly. If the user wants to clear it, they cannot do so through Inspector.

**Resolution required:** Add `"padding_scheme"` to `inboundHandledFields`. Render a `JsonField` (textarea of the JSON array) gated on `entityType === "anytls"`, with label "Padding Scheme" and placeholder showing the default array. Long-term: a string-per-row repeater with Add/Remove controls is preferred since each entry is a plain string.

### P1 — No TLS in default template

`commands.ts` creates a new AnyTLS inbound without a `tls` block. AnyTLS is a TLS-oriented protocol — the official example config always includes `"tls": {}`. A newly created node with no TLS configured will fail at runtime or operate in plaintext mode, which is probably unintended.

The TLS shared card IS shown (correct), so a user can expand it and enable TLS. However the default template should seed at minimum `tls: { enabled: true }` to match the protocol's expected configuration.

**Resolution required:** Update the `createInbound` branch for `"anytls"` in `commands.ts` to include `tls: { enabled: true }` in the default template.

### P1 — No version gate for sing-box 1.12.0 requirement

AnyTLS is unavailable in any sing-box build before 1.12.0. The Palette entry has no version guard, no tooltip, and no disabled state for pre-1.12 targets. A user configuring a 1.11 deployment can add this node without any warning; the exported config will be rejected by the binary.

**Resolution required:** Add a version/build gate to the `"inbound-anytls"` Palette entry when the active configuration target is pre-1.12. At minimum, a tooltip on the `status` badge noting "Requires sing-box ≥ 1.12.0".

### P1 — address and auto_route shown for AnyTLS inbound (wrong fields)

The inbound block unconditionally renders `address` (line 1486) and `auto_route` (line 1493) for every inbound regardless of type. AnyTLS inbound has neither of these fields in the official spec; they belong to TUN inbound only. These controls write spurious fields into the JSON object and pollute the exported config.

**Resolution required:** Gate `address` and `auto_route` controls on `entityType === "tun"`. This is a cross-cutting issue affecting all non-TUN inbounds but it is particularly important for AnyTLS since the config would be rejected by a strict binary parser.

---

## Implementation Tasks

### Task 1 — users[] repeater for AnyTLS inbound (P0)

**File:** `src/components/Inspector.tsx`

In the `ref.kind === "inbound"` block (around line 1484–1503), add:

```tsx
{entityType === "anytls" ? (
  <>
    <JsonField
      label="Users (name / password)"
      value={entity.users ?? []}
      onChange={(value) => updateField(ref, "users", value)}
    />
  </>
) : null}
```

Also add `"users"` to `inboundHandledFields` so it no longer leaks to `AdvancedScalarFields`.

Long-term: replace with a dedicated `UsersRepeater` that renders one `{ name, password }` row per entry with Add/Remove buttons.

### Task 2 — padding_scheme field for AnyTLS inbound (P0)

**File:** `src/components/Inspector.tsx`

In the same `entityType === "anytls"` conditional block from Task 1, add:

```tsx
<JsonField
  label="Padding Scheme"
  value={entity.padding_scheme ?? []}
  onChange={(value) => updateField(ref, "padding_scheme", value)}
/>
```

Add `"padding_scheme"` to `inboundHandledFields`.

Include a note/placeholder indicating that an empty array `[]` disables padding and omitting the field uses the built-in 9-entry default.

Long-term: a string-per-row repeater (each line is one scheme string) with Add/Remove controls is cleaner than a raw JSON textarea for this field.

### Task 3 — Seed TLS in default template (P1)

**File:** `src/domain/commands.ts` (line 234–242)

Change the `"anytls"` inbound default template to:

```ts
if (type === "anytls") {
  return {
    type,
    tag,
    listen: "127.0.0.1",
    listen_port: 2080,
    users: [{ name: "user", password: "change-me" }],
    tls: { enabled: true },
  };
}
```

### Task 4 — Version gate for 1.12.0 requirement (P1)

**File:** `src/components/Palette.tsx` (line 144)

Add version metadata or a `minVersion: "1.12.0"` property to the Palette entry and implement the guard in the Palette rendering logic when a target version is set. Until a full version-gate system exists, add a tooltip text: `"Requires sing-box ≥ 1.12.0"` to the status badge.

### Task 5 — Gate address/auto_route to TUN only (P1, cross-cutting)

**File:** `src/components/Inspector.tsx` lines 1486–1500

Wrap the `address` and `auto_route` controls so they only render when `entityType === "tun"`. This affects all non-TUN inbounds but is especially important for AnyTLS.

### Task 6 — Expand TLS card with server key fields (P1, cross-cutting)

**File:** `src/components/Inspector.tsx` — TLS shared card definitions

Add at minimum `tls.key_path` next to `tls.certificate_path` so an operator can configure a TLS-enabled AnyTLS server without dropping to the raw JSON textarea.

---

## Done Criteria

- `users[]` array is visible and editable in the Inspector for `type === "anytls"` inbound.
- `padding_scheme` array is visible and editable (JsonField or string repeater).
- New AnyTLS inbound created from Palette seeds `tls: { enabled: true }` in the default template.
- `address` and `auto_route` inputs are not shown for AnyTLS inbound in the Inspector.
- TLS card shows `tls.key_path` so a basic TLS server can be configured without raw JSON.
- Version warning is visible when the active target is pre-1.12.0.
- Fixture or e2e smoke test: import `{ type: "anytls", listen: "127.0.0.1", listen_port: 443, users: [{name:"u", password:"p"}], padding_scheme: ["stop=8"], tls: { enabled: true } }`, verify Inspector shows `users` and `padding_scheme`, edit tag, export JSON, check round-trip.
