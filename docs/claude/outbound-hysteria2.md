<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / hysteria2 — Deep UI Review

> Source: official stable + testing docs, Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, SbcNode.tsx, commands.ts, diagnostics.ts.
> Review date: 2026-05-27.

---

## Official Field Inventory

### Stable vs Testing delta

| Channel | New fields vs stable |
|---|---|
| Stable (1.11+) | Adds `server_ports`, `hop_interval` (port hopping). |
| Testing (1.14+) | Adds `hop_interval_max`, `bbr_profile`, `realm{}`, `obfs.min_packet_size`, `obfs.max_packet_size`, `obfs.type` gains `gecko` option. Stable has only `salamander`. |

### Protocol-specific fields — Stable (14)

| Field | Type | Required | Notes |
|---|---|---|---|
| `server` | string | **Yes** | Server address. Conflicts with `realm` (testing). |
| `server_port` | uint16 | **Yes** | Server port. Ignored when `server_ports` is set. Conflicts with `realm` (testing). |
| `server_ports` | string[] | No | Port range list, e.g. `["2080:3000"]`. Since 1.11. Conflicts with `server_port` and `realm` (testing). |
| `hop_interval` | duration | No | Port hopping interval. Default `30s`. Since 1.11. |
| `up_mbps` | int | No | Max upload bandwidth in Mbps. If empty, BBR CC is used instead of Hysteria CC. |
| `down_mbps` | int | No | Max download bandwidth in Mbps. If empty, BBR CC is used. |
| `obfs` | object | No | QUIC traffic obfuscator block. |
| `obfs.type` | string | No | Obfuscator type. Stable: only `salamander`. Testing adds `gecko`. Disabled if empty. |
| `obfs.password` | string | No | Obfuscator password. Required when `obfs.type` is set. |
| `password` | string | No (spec) | Authentication password. No `==Required==` marker in docs but functionally required for any real server. |
| `network` | string | No | `tcp` or `udp`. Both enabled by default. |
| `tls` | object | **Yes** | TLS configuration (outbound shape). Required by spec. |
| `brutal_debug` | bool | No | Enable Hysteria Brutal CC debug logging. |
| *(dial fields)* | — | No | Shared Dial block (see below). |

### Protocol-specific fields — Testing additions (8 additional)

| Field | Type | Required | Notes |
|---|---|---|---|
| `hop_interval_max` | duration | No | Maximum hop interval for randomization. Since 1.14. |
| `obfs.min_packet_size` | int | No | Min on-wire packet size (bytes). Gecko only. Default 512. Since 1.14. |
| `obfs.max_packet_size` | int | No | Max on-wire packet size (bytes). Gecko only. Default 1200. Since 1.14. |
| `bbr_profile` | string | No | BBR CC profile: `conservative`, `standard`, `aggressive`. Default `standard`. Since 1.14. |
| `realm` | object | No | Connect via Hysteria Realm rendezvous (NAT traversal). Since 1.14. Conflicts with `server`/`server_port`/`server_ports`. |
| `realm.server_url` | string | **Yes** | Realm rendezvous service URL. |
| `realm.token` | string | No | Bearer token for realm auth. |
| `realm.realm_id` | string | **Yes** | Slot identifier matching the registered Hysteria2 server. |
| `realm.stun_servers` | string[] | **Yes** | STUN server list (`host` or `host:port`) for NAT traversal. |
| `realm.http_client` | object | No | HTTP client used to talk to the realm service. |

### Shared TLS Fields

`"hysteria2"` is in `outboundTlsTypes` (`sharedFieldRegistry.ts` line 151). TLS group is enabled.

TLS is **Required** per spec for Hysteria2 outbound.

### Shared QUIC Fields

`"hysteria2"` is in `outboundQuicTypes` (`sharedFieldRegistry.ts` line 152). QUIC group is enabled.

| Field | Notes |
|---|---|
| `initial_packet_size` | Initial QUIC packet size. |
| `disable_path_mtu_discovery` | Disable PMTU discovery. |
| `idle_timeout` | QUIC idle timeout. |
| `keep_alive_period` | QUIC keep-alive interval. |

### Shared Dial Fields

`"hysteria2"` is in `outboundDialTypes` (all non-block/dns/selector/urltest outbounds, line 150). Dial group enabled.

| Field | Notes |
|---|---|
| `detour` | Upstream outbound tag (select). |
| `bind_interface` | Network interface to bind. |
| `connect_timeout` | Dial timeout. |
| `domain_resolver` | DNS resolver tag. |
| `network_strategy` | `default` / `hybrid` / `fallback`. |
| `network_type` | Network type filter list. |
| `fallback_network_type` | Fallback network type list. |
| `fallback_delay` | Duration string. |

**Total stable official fields: 14 protocol-specific + 4 QUIC + 8 dial + TLS block = 26+ tracked fields.**

---

## Left Panel — Palette (Add Library)

**Current state** (`Palette.tsx` line 167):
```ts
{ label: "Hysteria2", kind: "hysteria2-out", icon: Plug, docsUrl: docs("outbound/hysteria2/"), status: "setup" }
```

**Palette kind mapping** (`protocols.ts` line 15):
```ts
"hysteria2-out": "hysteria2"
```

**Note:** The task spec references `outbound-hysteria2` as the palette kind, but the actual palette kind registered in the codebase is `hysteria2-out`. The node ID format is `outbound:hysteria2` (using `kind:tag`). This naming inconsistency between the review spec and the codebase is a documentation concern, not a UI bug.

**Default template** (`commands.ts` lines 380–391):
```ts
if (type === "hysteria2") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    password: "change-me",
    up_mbps: 100,
    down_mbps: 100,
    network: "udp",
  };
}
```

### Findings

- Label `"Hysteria2"` is correct and matches the official protocol name.
- `status: "setup"` means Palette renders a non-functional status badge. Users cannot click-to-create or drag the node from the Palette.
- `icon: Plug` is shared with Hysteria (v1) and TUIC — acceptable grouping for QUIC-based protocols.
- Docs URL `docs("outbound/hysteria2/")` points to the correct location.
- Default template includes `password`, `up_mbps`, `down_mbps`, and `network` — this is a reasonable minimal bootstrap.
- Default template is **missing `tls: {}`**. The official spec marks `tls` as **Required**. A newly created node will be invalid (no TLS block) with no diagnostic error.
- Default template uses `network: "udp"` but the spec says "Both is enabled by default" — default should be omitted or set to match spec default behavior.
- `obfs` block is absent from the default template (correct, it is optional).
- `server_ports` and `hop_interval` are absent from the default template (correct, optional).

---

## Middle Panel — Canvas Node

**Canvas node kind:** `"outbound"` (SbcNode.tsx).

### Port Specification

**Input ports (left side) — 8 ports, all outbound nodes:**
```
route              → Upstream Route final
route-rule         → Upstream Rule outbound
selector-group     → Upstream Selector candidate
urltest-group      → Upstream URLTest candidate
dns-detour         → Upstream DNS detour target
detour-target      → Upstream Dial detour target
service-detour     → Upstream service detour target
rule-set-download  → Upstream Rule Set download detour
```

**Output ports (right side):**
```
dial-detour → Downstream dial detour
```

`supportsDialDetour("hysteria2")` returns `true` (hysteria2 is not in the excluded set `["block", "selector", "urltest", "dns"]`). The `dial-detour` output port is correctly available.

### Canvas Subtitle

`graph.ts` line 414: when `outbound.server` is truthy, subtitle renders as:
```
`${outbound.type} ${outbound.server}:${outbound.server_port ?? ""}`
```

For a default hysteria2 node: `"hysteria2 127.0.0.1:1080"`.

### Findings

- Port spec is correct for the dial detour relationship.
- Canvas subtitle correctly shows `server:port` when `server` is set — but when `server_port` is replaced by `server_ports` (port hopping), the subtitle still shows `server:""` since `server_port` is absent. The subtitle becomes `"hysteria2 127.0.0.1:"` with trailing colon — cosmetic regression.
- `realm` mode (testing): when `realm` is configured instead of `server`, `outbound.server` is undefined and the subtitle falls through to `"hysteria2 outbound"` — acceptable fallback, but could display realm URL for clarity.
- The node icon falls through `outboundIcon(type)` to the default `Shield` icon — acceptable.
- Canvas node status badge reflects diagnostic severity from `diagnostics.ts`. Since there are no hysteria2-specific diagnostics (see below), the badge will not catch missing TLS or missing password.

---

## Right Panel — Inspector

### What the inspector provides for `ref.kind === "outbound"`

From `Inspector.tsx` lines 1505–1546, the outbound inspector renders:

1. **Tag** rename input.
2. **Type** select from `CREATABLE_OUTBOUND_TYPES`.
3. **Server** text input, shown when `"server" in entity`.
4. **Port** number input, shown when `"server_port" in entity`.
5. **Candidates** text input for `outbounds[]` (selector/urltest only).
6. **Default** text input for `default` (urltest only).
7. **AdvancedScalarFields** — spills all non-handled scalar fields.
8. **SharedFieldCards** — renders Dial, TLS, and QUIC sections as collapsible module cards.

### `outboundHandledFields` set (lines 128–141)

```ts
const outboundHandledFields = new Set([
  "tag", "type",
  "server", "server_port",
  "outbounds", "default",
  "tls", "multiplex", "transport", "udp_over_tcp",
  // dialSharedFields:
  "detour", "bind_interface", "connect_timeout", "domain_resolver",
  "network_strategy", "network_type", "fallback_network_type", "fallback_delay",
  // quicSharedFields:
  "initial_packet_size", "disable_path_mtu_discovery", "idle_timeout", "keep_alive_period",
]);
```

### Gap analysis for hysteria2 outbound

| Field | Expected UI | Actual |
|---|---|---|
| `server` | First-class text input | **Present** — rendered when `"server" in entity`. |
| `server_port` | First-class number input | **Present** — rendered when `"server_port" in entity`. |
| `server_ports` | Array repeater or textarea | **Not in `outboundHandledFields`** — it is an array, so `AdvancedScalarFields` silently drops it. Imported configs with `server_ports` lose visibility in Inspector. |
| `hop_interval` | Duration text input | **Not in `outboundHandledFields`** — string scalar, will appear in `AdvancedScalarFields` if present in entity. Absent from template so invisible for new nodes. |
| `hop_interval_max` | Duration text input (testing) | Same as `hop_interval` — falls to `AdvancedScalarFields` if present. |
| `up_mbps` | Number input | **Not in `outboundHandledFields`** — number scalar present in default template. Falls to `AdvancedScalarFields` as unlabeled "Up Mbps". |
| `down_mbps` | Number input | Same as `up_mbps`. |
| `obfs` | Nested object section (type + password) | **Not in `outboundHandledFields`** — it is an object, `AdvancedScalarFields` **silently drops it**. Imported configs with `obfs` have the field entirely invisible. |
| `password` | Dedicated text/password input | **Not in `outboundHandledFields`** — string scalar in default template, falls to `AdvancedScalarFields` as plain text "Password". No `type="password"`. |
| `network` | Select: `tcp` / `udp` / (both) | **Not in `outboundHandledFields`** — string scalar in default template, falls to `AdvancedScalarFields` as plain text "Network". Should be a select with options `tcp`, `udp`, and blank for "both". |
| `brutal_debug` | Toggle | **Not in `outboundHandledFields`** — boolean, falls to `AdvancedScalarFields` as checkbox. Auto-label "Brutal Debug" is acceptable but placement is wrong. |
| `bbr_profile` | Select: `conservative` / `standard` / `aggressive` (testing) | Falls to `AdvancedScalarFields` as plain text if present. |
| `realm` | Nested object section (testing) | **Not in `outboundHandledFields`** — object, `AdvancedScalarFields` **silently drops it**. |
| `tls` | Shared TLS card | **Correctly handled** — `"hysteria2"` is in `outboundTlsTypes`; TLS card is shown. |
| QUIC fields | Shared QUIC card | **Correctly handled** — `"hysteria2"` is in `outboundQuicTypes`; QUIC card is shown. |
| Dial fields | Shared Dial card | **Correctly handled** — Dial card is shown. |

### Template vs. Inspector consistency

The default template creates:
```json
{
  "type": "hysteria2", "tag": "hy2-out",
  "server": "127.0.0.1", "server_port": 1080,
  "password": "change-me",
  "up_mbps": 100, "down_mbps": 100, "network": "udp"
}
```

When rendered in Inspector:
- `server` and `server_port` appear as first-class inputs.
- `password` appears in `AdvancedScalarFields` under "Advanced fields (4)" — alongside `up_mbps`, `down_mbps`, `network` — without semantic labeling, ordering by importance, or `type="password"` for the password field.
- The TLS block is absent from the template, so the TLS shared card will render but with no data. The missing `tls` required field will not produce a diagnostic error.

---

## Priority Findings

### P0 — `obfs` object is silently invisible in Inspector

`obfs` is `{ type: string; password: string }`. It is not in `outboundHandledFields` and is not a scalar, so `AdvancedScalarFields` **silently drops it**. For any imported config with `"obfs": { "type": "salamander", "password": "..." }`, the entire obfs block is **invisible and uneditable** in the Inspector.

The field survives round-trip only if no other field on the entity is patched (store shallow-merges). There is no way to add, view, or remove obfs configuration from the UI.

**Resolution required:**

1. Add `"obfs"` to `outboundHandledFields`.
2. Add an explicit obfs sub-section in the outbound inspector block, gated on `(ref.kind === "outbound" && entityType === "hysteria2")`:

```tsx
{entityType === "hysteria2" ? (
  <>
    <label className="field">
      <span>Obfs Type</span>
      <select
        value={String((entity.obfs as Record<string, unknown>)?.type ?? "")}
        onChange={(event) => updateField(ref, "obfs",
          event.target.value ? { ...objectField(entity.obfs), type: event.target.value } : undefined
        )}
      >
        <option value="">(disabled)</option>
        <option value="salamander">salamander</option>
        {/* testing channel: <option value="gecko">gecko</option> */}
      </select>
    </label>
    {(entity.obfs as Record<string, unknown>)?.type ? (
      <label className="field">
        <span>Obfs Password</span>
        <input
          value={String((entity.obfs as Record<string, unknown>)?.password ?? "")}
          onChange={(event) => updateField(ref, "obfs",
            { ...objectField(entity.obfs), password: event.target.value }
          )}
        />
      </label>
    ) : null}
  </>
) : null}
```

### P0 — `realm` object (testing) is silently invisible in Inspector

`realm` is a nested object with `server_url`, `token`, `realm_id`, `stun_servers[]`, `http_client{}`. It is not in `outboundHandledFields` and is an object, so `AdvancedScalarFields` **silently drops it**. Any imported testing-channel config using Realm NAT traversal will have the entire realm block invisible and uneditable.

**Resolution required:**

1. Add `"realm"` to `outboundHandledFields`.
2. Add a `JsonField` labeled "Realm (testing)" gated on `ref.kind === "outbound" && entityType === "hysteria2"` as a stopgap until a structured realm sub-form is built:

```tsx
{entityType === "hysteria2" && "realm" in entity ? (
  <JsonField
    label="Realm (testing)"
    value={entity.realm ?? null}
    onChange={(value) => updateField(ref, "realm", value)}
  />
) : null}
```

Long-term: implement a structured realm sub-form with individual inputs for `server_url`, `realm_id`, `token`, `stun_servers[]`.

### P0 — `server_ports` array is silently invisible in Inspector

`server_ports` is a string array (port range list). It is not in `outboundHandledFields` and is not a scalar, so `AdvancedScalarFields` silently drops it. Any imported config using port hopping (`server_ports: ["2080:3000"]`) will lose visibility of this field.

**Resolution required:**

1. Add `"server_ports"` to `outboundHandledFields`.
2. Add a JSON/textarea field gated on `entityType === "hysteria2"`:

```tsx
{entityType === "hysteria2" ? (
  <JsonField
    label="Server Port Ranges (port hopping)"
    value={entity.server_ports ?? []}
    onChange={(value) => updateField(ref, "server_ports", value)}
  />
) : null}
```

Or use a comma-separated text input matching the existing `toList`/`fromList` pattern.

### P0 — Default template omits required `tls` block; no diagnostic catches it

The official spec marks `tls` as **Required**. The default template (`commands.ts` line 381–390) does not include `tls: {}`. A freshly created hysteria2 outbound is immediately invalid. `diagnostics.ts` has no check for missing TLS on hysteria2 outbound, so no error badge appears on the canvas node.

**Resolution required (two parts):**

**Part A** — Fix default template in `commands.ts`:
```ts
if (type === "hysteria2") {
  return {
    type,
    tag,
    server: "127.0.0.1",
    server_port: 1080,
    password: "change-me",
    tls: { enabled: true },
  };
}
```

Remove `up_mbps`, `down_mbps`, and `network` from the default (or keep them as optional guidance). The key fix is adding `tls`.

**Part B** — Add diagnostic in `diagnostics.ts` in the `outbounds.forEach` loop:
```ts
if (outbound.type === "hysteria2") {
  const tls = outbound.tls as Record<string, unknown> | undefined;
  if (!tls || !tls.enabled) {
    push(diagnostics, "error", "hysteria2-requires-tls", `/outbounds/${index}/tls`,
      `Hysteria2 outbound "${outbound.tag}" requires TLS (tls.enabled must be true).`);
  }
  if (!outbound.password) {
    push(diagnostics, "error", "hysteria2-requires-password", `/outbounds/${index}/password`,
      `Hysteria2 outbound "${outbound.tag}" requires a password.`);
  }
}
```

### P1 — `password` field appears in generic AdvancedScalarFields without semantic labeling

The hysteria2 `password` field is a string present in the default template. It falls through to `AdvancedScalarFields` as a plain unlabeled text input with auto-derived label "Password" — rendered as `type="text"`, not `type="password"`. It appears mixed with `up_mbps`, `down_mbps`, `network`, `brutal_debug` without section grouping.

**Resolution required:**

1. Add `"password"` to `outboundHandledFields`.
2. Add a dedicated hysteria2 credentials section in the outbound inspector block gated on `entityType === "hysteria2"`:

```tsx
{entityType === "hysteria2" ? (
  <label className="field">
    <span>Password</span>
    <input
      type="password"
      autoComplete="new-password"
      value={String(entity.password ?? "")}
      onChange={(event) => updateField(ref, "password", event.target.value || undefined)}
      placeholder="Authentication password"
    />
  </label>
) : null}
```

### P1 — `network` is a free text input instead of a select

`network` is a string present in the default template (`"udp"`). It falls to `AdvancedScalarFields` as a plain text input. The valid values are `"tcp"`, `"udp"`, or omitted (both). A user can type an invalid value with no feedback.

**Resolution required:**

1. Add `"network"` to `outboundHandledFields`.
2. Add a select gated on hysteria2 (and hysteria/tuic which have the same semantics):

```tsx
{(entityType === "hysteria2" || entityType === "hysteria" || entityType === "tuic") ? (
  <label className="field">
    <span>Network</span>
    <select
      value={String(entity.network ?? "")}
      onChange={(event) => updateField(ref, "network", event.target.value || undefined)}
    >
      <option value="">Both (tcp + udp)</option>
      <option value="tcp">TCP only</option>
      <option value="udp">UDP only</option>
    </select>
  </label>
) : null}
```

### P1 — `up_mbps` and `down_mbps` have no bandwidth semantics label

Both fields are present in the default template and appear in `AdvancedScalarFields` as "Up Mbps" / "Down Mbps" with auto-derived labels. The labels are acceptable but the important semantic — "if empty, BBR CC is used instead of Hysteria CC" — is invisible. A user who clears these fields has no indication that this changes the congestion control algorithm.

**Resolution required:**

1. Add `"up_mbps"` and `"down_mbps"` to `outboundHandledFields`.
2. Add dedicated bandwidth inputs gated on `entityType === "hysteria2"` (also applicable for `"hysteria"`) with hint text:

```tsx
{entityType === "hysteria2" ? (
  <>
    <label className="field">
      <span>Upload Mbps</span>
      <input
        type="number"
        value={Number(entity.up_mbps ?? "")}
        onChange={(event) => updateField(ref, "up_mbps",
          event.target.value ? Number(event.target.value) : undefined
        )}
        placeholder="empty = use BBR CC"
      />
    </label>
    <label className="field">
      <span>Download Mbps</span>
      <input
        type="number"
        value={Number(entity.down_mbps ?? "")}
        onChange={(event) => updateField(ref, "down_mbps",
          event.target.value ? Number(event.target.value) : undefined
        )}
        placeholder="empty = use BBR CC"
      />
    </label>
  </>
) : null}
```

### P1 — `hop_interval` and `hop_interval_max` not surfaced for new nodes

`hop_interval` is a duration string (e.g. `"30s"`). It is not in `outboundHandledFields`, is a string scalar, and is absent from the default template. For a freshly created node it does not exist in the entity and `AdvancedScalarFields` will not show it. For imported configs it appears in `AdvancedScalarFields` as a generic text input — inconsistent behavior.

`hop_interval_max` (testing) has the same gap.

**Resolution required:**

1. Add `"hop_interval"` to `outboundHandledFields`. Add `"hop_interval_max"` for testing channel.
2. Add explicit duration inputs gated on `entityType === "hysteria2"` and `"server_ports" in entity || entityType === "hysteria2"`:

```tsx
{entityType === "hysteria2" ? (
  <>
    <label className="field">
      <span>Hop Interval</span>
      <input
        value={String(entity.hop_interval ?? "")}
        onChange={(event) => updateField(ref, "hop_interval", event.target.value || undefined)}
        placeholder="default 30s"
      />
    </label>
  </>
) : null}
```

---

## Implementation Tasks

### Task 1 — Expose `obfs` as structured nested fields (P0)

**File:** `src/components/Inspector.tsx`

1. Add `"obfs"` to `outboundHandledFields` (line 128).
2. In the `ref.kind === "outbound"` block (line 1505), add a hysteria2-gated obfs section with a select for `obfs.type` and conditional password input for `obfs.password`. See P0 resolution code sketch above.
3. For testing channel: add `gecko` option to the type select with `obfs.min_packet_size` and `obfs.max_packet_size` number inputs.

### Task 2 — Expose `server_ports` as JSON/textarea field (P0)

**File:** `src/components/Inspector.tsx`

1. Add `"server_ports"` to `outboundHandledFields`.
2. Add a `JsonField` or comma-separated text input for server port ranges, gated on `entityType === "hysteria2"`.
3. Note mutual exclusivity: when `server_ports` is set, `server_port` is ignored. Consider adding a visual note or disabling the `server_port` input when `server_ports` is non-empty.

### Task 3 — Expose `realm` as JSON field (P0, testing channel)

**File:** `src/components/Inspector.tsx`

1. Add `"realm"` to `outboundHandledFields`.
2. Add a `JsonField` labeled "Realm (testing)" as stopgap, or a structured sub-form with individual fields for `realm.server_url`, `realm.realm_id`, `realm.token`, `realm.stun_servers[]`.
3. Add channel gating so the realm section is only visible when `channel === "testing"`.

### Task 4 — Fix default template to include `tls: { enabled: true }` (P0)

**File:** `src/domain/commands.ts`

In `createOutbound` at line 380, add `tls: { enabled: true }` to the hysteria2 return object. Remove or make optional `up_mbps`, `down_mbps`, `network` from the default template to reduce noise.

### Task 5 — Add hysteria2 diagnostic checks for TLS and password (P0)

**File:** `src/domain/diagnostics.ts`

In the `outbounds.forEach` loop (after line 95), add:
- Error if `tls` is absent or `tls.enabled !== true` for `type === "hysteria2"`.
- Warning/error if `password` is absent or empty for `type === "hysteria2"`.

### Task 6 — Add dedicated `password` field with `type="password"` (P1)

**File:** `src/components/Inspector.tsx`

1. Add `"password"` to `outboundHandledFields`.
2. Add a labeled password input in the hysteria2-gated section. Use `type="password"` and `autoComplete="new-password"`. Place it immediately after the server/port fields.

### Task 7 — Add `network` select with valid options (P1)

**File:** `src/components/Inspector.tsx`

1. Add `"network"` to `outboundHandledFields`.
2. Add a select for `tcp` / `udp` / (both), applicable to `hysteria2`, `hysteria`, and `tuic` which share this field semantics.

### Task 8 — Add `up_mbps` / `down_mbps` with semantic hint (P1)

**File:** `src/components/Inspector.tsx`

1. Add `"up_mbps"` and `"down_mbps"` to `outboundHandledFields`.
2. Add number inputs with placeholder "empty = use BBR CC" in the hysteria2-gated section.

### Task 9 — Add `hop_interval` (and `hop_interval_max`) text inputs (P1)

**File:** `src/components/Inspector.tsx`

1. Add `"hop_interval"` (and `"hop_interval_max"` for testing) to `outboundHandledFields`.
2. Add duration text inputs, gated on `entityType === "hysteria2"`, with placeholder "default 30s".

### Task 10 — Fix canvas subtitle for `server_ports` mode (P1)

**File:** `src/canvas/graph.ts` (line 414)

When `server_ports` is set and `server_port` is absent, update subtitle to:
```ts
outbound.server_ports?.length
  ? `${outbound.type} ${outbound.server} [${outbound.server_ports.join(",")}]`
  : outbound.server
    ? `${outbound.type} ${outbound.server}:${outbound.server_port ?? ""}`
    : `${outbound.type} outbound`
```

### Task 11 — Upgrade Palette status once above tasks complete (P1)

**File:** `src/components/Palette.tsx` line 167

Change `status: "setup"` to `ready: true` once tasks 1–10 are complete and the node round-trips correctly through import/edit/export.

---

## Done Criteria

- `obfs` block is visible and editable via a structured type-select + password-input section.
- `server_ports` is editable as a JSON array or comma-separated text field.
- `realm` block is visible as a JSON field (testing channel).
- Default template includes `tls: { enabled: true }`.
- Diagnostic error fires when `tls.enabled !== true` on a hysteria2 outbound.
- Diagnostic error fires when `password` is absent on a hysteria2 outbound.
- `password` field uses `type="password"` rendering.
- `network` field uses a select with `tcp` / `udp` / (both) options.
- `up_mbps` and `down_mbps` have placeholder text indicating BBR CC fallback.
- `hop_interval` is always shown for hysteria2 outbound, regardless of template.
- Canvas subtitle handles `server_ports` mode without trailing colon.
- Round-trip test: import config with `server_ports`, `hop_interval`, `obfs`, `password`, and `tls` all set; verify all fields visible; edit tag; export; verify all fields preserved.
