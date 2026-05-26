<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / anytls — Deep UI Review

> Source: official stable docs (`outbound/anytls.md`), official testing docs (identical), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts.
> Review date: 2026-05-27.

---

## Version / Build Restriction

**Since sing-box 1.12.0** — both the stable and testing docs carry `!!! question "Since sing-box 1.12.0"`.

AnyTLS is a new protocol absent from any 1.11.x build. Stable and testing docs are **identical** as of this review — no field differences between branches.

---

## Official Field Inventory

**Protocol-specific fields (6)**

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `server` | string | **Required** | — | Server address. |
| `server_port` | integer | **Required** | — | Server port. |
| `password` | string | **Required** | — | AnyTLS password. |
| `idle_session_check_interval` | duration string | optional | `"30s"` | Interval for checking idle sessions. |
| `idle_session_timeout` | duration string | optional | `"30s"` | Close sessions idle longer than this during check. |
| `min_idle_session` | integer | optional | `0` | Minimum number of idle sessions to keep open during check. |
| `tls` | object | **Required** | — | Shared outbound TLS section. Explicitly required by docs. |

**Shared Dial Fields** — full set via `shared/dial.md`.

**No** multiplex, transport, QUIC, UDP-over-TCP, or udp_over_tcp sections.

`sharedFieldRegistry.ts` confirms:
- `anytls` is in `outboundTlsTypes` (line 151) — TLS card is shown. Correct.
- `anytls` is included via `outboundDialTypes` (line 150, derived from `CREATABLE_OUTBOUND_TYPES` minus `block`, `dns`, `selector`, `urltest`) — Dial card is shown. Correct.
- `anytls` is NOT in `outboundMultiplexTypes`, `outboundTransportTypes`, `outboundQuicTypes`, `outboundUdpOverTcpTypes`. Correct.

Total official fields: **7 protocol-specific + Dial shared fields + TLS outbound fields**.

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 168):

```ts
{ label: "AnyTLS", kind: "anytls-out", icon: Shield, docsUrl: docs("outbound/anytls/"), status: "setup" }
```

### Findings

- Label `"AnyTLS"` is correct.
- `status: "setup"` renders a non-clickable badge. The node cannot be dragged or clicked to create an outbound.
- `docsUrl` target `docs("outbound/anytls/")` is correct.
- `icon: Shield` is shared with several other protocol outbounds — no visual differentiation. Acceptable for now.
- **No version gate is present.** A user on a pre-1.12 target can add this node without any warning.

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"outbound"` (generic outbound node, same as all protocol outbounds).

### Findings

- Standard outbound port layout is expected.
- No AnyTLS-specific port behavior needed.
- Canvas node displays `tag ?? ref.kind` label. Acceptable.

---

## Right Panel — Inspector

### What the inspector currently provides for `ref.kind === "outbound"`

1. **Tag** rename input.
2. **Type** select from `CREATABLE_OUTBOUND_TYPES` (includes `"anytls"` at line 38 of `protocols.ts`).
3. **Server** text input bound to `entity.server` — present in AnyTLS. Correct.
4. **Port** number input bound to `entity.server_port` — present in AnyTLS. Correct.
5. **AdvancedScalarFields** — generic accordion for non-object, non-array scalars not in `outboundHandledFields`.
6. **SharedFieldCards** — `"dial"` and `"tls"` sections via `sharedGroupsForEntity`.

### `outboundHandledFields` set — AnyTLS fields NOT included

```ts
const outboundHandledFields = new Set([
  "tag", "type",
  "server", "server_port",
  "outbounds", "default",
  "tls", "multiplex", "transport", "udp_over_tcp",
  ...dialSharedFields,
  ...quicSharedFields,
]);
```

The AnyTLS-specific fields `password`, `idle_session_check_interval`, `idle_session_timeout`, and `min_idle_session` are NOT in this set.

### Gap analysis for AnyTLS outbound

| Field | Expected UI | Actual |
|---|---|---|
| `server` | Text input | Correctly shown via `"server" in entity` check (line 1507). |
| `server_port` | Number input | Correctly shown via `"server_port" in entity` check (line 1516). |
| `password` | Password/text input. Required — missing means non-functional client. | **Not in `outboundHandledFields`**. Falls through to `AdvancedScalarFields`. `AdvancedScalarFields` only surfaces scalars and `password` IS a scalar string, so it DOES appear — but as an unlabeled generic "Advanced" field, not a prominent first-class required input. |
| `idle_session_check_interval` | Duration text input. | **Not in `outboundHandledFields`**. Falls to `AdvancedScalarFields` as a generic scalar. |
| `idle_session_timeout` | Duration text input. | **Not in `outboundHandledFields`**. Falls to `AdvancedScalarFields` as a generic scalar. |
| `min_idle_session` | Number input. | **Not in `outboundHandledFields`**. Falls to `AdvancedScalarFields` as a generic scalar (shown as integer). |
| `tls` | Shared TLS card | Correctly handled — AnyTLS is in `outboundTlsTypes`. TLS card is shown. |
| Dial fields | Shared Dial card | Correctly handled — AnyTLS in `outboundDialTypes`. Dial card is shown. |

### Default template — `commands.ts` (lines 392–402)

```ts
if (type === "anytls") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    password: "change-me",
    idle_session_check_interval: "30s",
    idle_session_timeout: "30s",
    min_idle_session: 5,
  };
}
```

All three required fields (`server`, `server_port`, `password`) are seeded. Idle session fields are seeded with their documented defaults. However, **`tls` is omitted** from the default template — `tls` is **Required** per the official spec, so a newly created AnyTLS outbound defaults to no TLS, which is invalid per the protocol documentation.

---

## Priority Findings

### P0 — password rendered as generic Advanced field, not first-class required input

`password` is **Required** per the official spec. It is not in `outboundHandledFields`. Because `password` is a scalar string value, `AdvancedScalarFields` does surface it — but buried in the Advanced accordion, unlabeled except by auto-capitalisation ("Password"), with no visual distinction from optional fields or indication that it is required.

A user editing an AnyTLS outbound via Inspector will not see `password` in the primary controls area. It sits alongside genuinely optional advanced tuning fields. There is no required-field marking, no placeholder hint, and no validation feedback.

**Resolution required:** Add `password` as an explicit first-class `<input>` in the outbound block, gated on `entityType === "anytls"` (or `"password" in entity`), placed immediately after `server_port`. Mark visually as required. Add `"password"` to `outboundHandledFields` so it no longer appears in the Advanced section.

### P0 — tls absent from default template (Required field)

The official spec lists `tls` as **Required** for AnyTLS outbound. The `commands.ts` default template for `"anytls"` outbound (lines 392–402) does not include a `tls` block. A node created from the Palette and exported without adding TLS manually will be rejected by the binary.

The TLS shared card IS shown in the Inspector (correct), so a user can expand it and enable TLS. However the default template must seed at least `tls: { enabled: true }` to match the protocol's required configuration.

**Resolution required:** Update the `createOutbound` branch for `"anytls"` in `commands.ts` to include `tls: { enabled: true }` in the default template.

### P1 — idle_session fields buried in Advanced accordion

`idle_session_check_interval`, `idle_session_timeout`, and `min_idle_session` are AnyTLS-specific session management fields. They are not in `outboundHandledFields` and fall to `AdvancedScalarFields`. While they are optional and have documented defaults, they are conceptually a coherent group unique to this protocol and belong in the primary inspector area.

Currently they appear as three separate labelled fields in the Advanced accordion with no grouping, no default-value hints, and no explanation of their interaction.

**Resolution required:** Add dedicated AnyTLS-specific controls in the outbound Inspector block (gated on `entityType === "anytls"`), grouping the three idle session fields together with descriptive labels and default hints. Add all three to `outboundHandledFields`.

### P1 — No version gate for sing-box 1.12.0 requirement

AnyTLS is unavailable in any sing-box build before 1.12.0. The Palette entry has no version guard, no tooltip, and no disabled state for pre-1.12 targets. A user configuring a 1.11 deployment can add this node without any warning; the exported config will be rejected by the binary.

**Resolution required:** Add a version/build gate to the `"anytls-out"` Palette entry when the active configuration target is pre-1.12. At minimum, a tooltip noting "Requires sing-box ≥ 1.12.0" on the status badge.

---

## Implementation Tasks

### Task 1 — password as first-class required input (P0)

**File:** `src/components/Inspector.tsx`

In the `ref.kind === "outbound"` block (around line 1505–1545), add after the `server_port` control:

```tsx
{entityType === "anytls" && "password" in entity ? (
  <label className="field">
    <span>Password <span aria-label="required">*</span></span>
    <input
      value={String(entity.password ?? "")}
      onChange={(event) => updateField(ref, "password", event.target.value)}
      placeholder="AnyTLS password (required)"
    />
  </label>
) : null}
```

Add `"password"` to `outboundHandledFields` so it no longer leaks to `AdvancedScalarFields`.

### Task 2 — Idle session fields group for AnyTLS outbound (P1)

**File:** `src/components/Inspector.tsx`

In the same `ref.kind === "outbound"` block, after Task 1's password field, add:

```tsx
{entityType === "anytls" ? (
  <>
    <label className="field">
      <span>Idle Check Interval</span>
      <input
        value={String(entity.idle_session_check_interval ?? "30s")}
        onChange={(event) => updateField(ref, "idle_session_check_interval", event.target.value || undefined)}
        placeholder="30s"
      />
    </label>
    <label className="field">
      <span>Idle Session Timeout</span>
      <input
        value={String(entity.idle_session_timeout ?? "30s")}
        onChange={(event) => updateField(ref, "idle_session_timeout", event.target.value || undefined)}
        placeholder="30s"
      />
    </label>
    <label className="field">
      <span>Min Idle Sessions</span>
      <input
        type="number"
        value={Number(entity.min_idle_session ?? 0)}
        onChange={(event) => updateField(ref, "min_idle_session", Number(event.target.value))}
        placeholder="0"
      />
    </label>
  </>
) : null}
```

Add `"idle_session_check_interval"`, `"idle_session_timeout"`, `"min_idle_session"` to `outboundHandledFields`.

### Task 3 — Seed TLS in default outbound template (P0)

**File:** `src/domain/commands.ts` (lines 392–402)

Change the `"anytls"` outbound default template to:

```ts
if (type === "anytls") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    password: "change-me",
    idle_session_check_interval: "30s",
    idle_session_timeout: "30s",
    min_idle_session: 5,
    tls: { enabled: true },
  };
}
```

### Task 4 — Version gate for 1.12.0 requirement (P1)

**File:** `src/components/Palette.tsx` (line 168)

Add version metadata or a `minVersion: "1.12.0"` property to the Palette entry and implement the guard in the Palette rendering logic when a target version is set. Until a full version-gate system exists, add a tooltip text: `"Requires sing-box ≥ 1.12.0"` to the status badge.

---

## Done Criteria

- `password` is rendered as a first-class labelled input in the Inspector for `type === "anytls"` outbound, not buried in Advanced.
- `idle_session_check_interval`, `idle_session_timeout`, and `min_idle_session` are rendered as a coherent group in the primary Inspector area for `type === "anytls"` outbound.
- New AnyTLS outbound created from Palette seeds `tls: { enabled: true }` in the default template.
- Version warning is visible when the active target is pre-1.12.0.
- Dial and TLS shared cards continue to appear correctly.
- Fixture or e2e smoke test: import `{ type: "anytls", tag: "anytls-out", server: "example.com", server_port: 443, password: "test-pass", idle_session_check_interval: "30s", idle_session_timeout: "30s", min_idle_session: 0, tls: { enabled: true, server_name: "example.com" } }`, verify Inspector shows `password` and idle session fields as first-class controls, edit tag, export JSON, check round-trip.
