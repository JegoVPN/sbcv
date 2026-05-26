<!-- Status: official-read. Source: stable inbound/tuic.md + testing inbound/tuic.md + testing shared/quic.md + Palette/SbcNode/Inspector/sharedFieldRegistry grep. UI verification + implementation fixes still pending. -->
# Inbound / tuic UI Review (Claude Deep Review)

## Scope

- Editable node: `inbound:tuic`
- Palette kind: `inbound-tuic`
- Official doc (stable): `.tmp/sing-box-docs/stable/docs/configuration/inbound/tuic.md`
- Official doc (testing): `.tmp/sing-box-docs/testing/docs/configuration/inbound/tuic.md`
- Shared QUIC fields (testing only): `.tmp/sing-box-docs/testing/docs/configuration/shared/quic.md`
- Source-of-truth: canonical sing-box JSON / domain state.

---

## Official Model

### Protocol-specific fields (tuic.md — stable and testing identical)

| Field | Type | Required | Default | Semantic |
| --- | --- | --- | --- | --- |
| `users` | array of objects | optional (empty array allowed) | — | TUIC user list; each entry has `uuid` (required), `password` (optional), `name` (optional) |
| `users[].uuid` | string (UUID) | **required per entry** | — | TUIC user UUID |
| `users[].password` | string | optional | — | TUIC user password |
| `users[].name` | string | optional | — | Human-readable user label (shown in example, not marked Required) |
| `congestion_control` | enum string | optional | `"cubic"` | QUIC congestion algorithm: `"cubic"`, `"new_reno"`, `"bbr"` |
| `auth_timeout` | string (duration) | optional | `"3s"` | How long server waits for client auth command |
| `zero_rtt_handshake` | bool | optional | `false` | Enable 0-RTT QUIC handshake; **strongly discouraged** (replay-attack risk) |
| `heartbeat` | string (duration) | optional | `"10s"` | Interval for keepalive heartbeat packets |
| `tls` | object | **required** | — | TLS configuration (inbound TLS); TUIC requires TLS |

### TLS required

`tls` is marked `==Required==` in the official doc. TUIC uses QUIC which mandates TLS. A TUIC inbound without a configured TLS block will fail official sing-box validation.

### Listen common fields (shared/listen.md — applies to all inbounds)

Same 15-field surface documented in `inbound-direct.md`. The listen panel currently covers 8 of 15 fields; 5 are missing from `listenSharedFields` (`tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`) — this is a cross-cutting gap, not TUIC-specific. See `inbound-direct.md` Implementation Task 3.

### QUIC shared fields

| Context | Fields |
| --- | --- |
| Stable | No explicit QUIC Fields section in tuic.md (stable) |
| Testing (1.14+) | `... // QUIC Fields` section added — maps to `shared/quic.md`: `initial_packet_size` (number), `disable_path_mtu_discovery` (bool), plus HTTP2 Fields |

The stable Inspector already renders the QUIC group (`sharedFieldRegistry.ts` line 67, 145) for all three QUIC inbound types including `tuic`. The QUIC group covers `initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period` (Inspector.tsx lines 907–913). The testing addition of a formal QUIC Fields section is consistent with this — no new fields introduced, just formalised.

**Total official writable fields (stable):** 5 protocol-specific (users, congestion_control, auth_timeout, zero_rtt_handshake, heartbeat) + 1 required object (tls) + 15 listen common + 4 QUIC shared = **25 fields**.

---

## Cross-version diff (testing vs stable)

The only difference between stable and testing `inbound/tuic.md` is the addition of `... // QUIC Fields` at the bottom of the JSON structure block, pointing to the shared QUIC fields doc. All protocol-specific fields (`users`, `congestion_control`, `auth_timeout`, `zero_rtt_handshake`, `heartbeat`, `tls`) are identical in both versions. No new fields, no changed defaults, no removals.

---

## Relationship model

### Outgoing references from this node

None. TUIC inbound has no `detour` outbound reference and no server/upstream fields.

### Incoming references to this node

| Reference surface | Field | Where set |
| --- | --- | --- |
| Route rule `inbound` | `route.rules[].inbound` | `RouteRuleInspector` |
| DNS rule `inbound` | `dns.rules[].inbound` | `DnsRuleInspector` |
| Route hub (implicit) | all inbounds → route | Canvas edge; no JSON field |

---

## Left: Add Library

### Current state (Palette.tsx line 142)

```ts
{ label: "TUIC", kind: "inbound-tuic", icon: Plug, docsUrl: docs("inbound/tuic/"), status: "setup" }
```

- `status: "setup"` → button label resolves to `"Setup TUIC"`.
- `canActivate()` returns `true` → clicking calls `createFromPalette("inbound-tuic")`.
- `createFromPalette` dispatches `inboundTypeForPaletteKind("inbound-tuic")` → `"tuic"`, then `addInbound(config, "tuic", "tuic-in")`.
- `docsUrl` points to `https://sing-box.sagernet.org/configuration/inbound/tuic/` — correct.

### Gap analysis

- The `"setup"` status is appropriate: TUIC requires non-trivial configuration (TLS, at least one user with a UUID). The setup stub is a reasonable entry point.
- The `Plug` icon is shared with `inbound-hysteria` and `inbound-hysteria2` — acceptable for now.

---

## Middle: Canvas Node

### Current state (SbcNode.tsx lines 136–144)

The `kind === "inbound"` output port block is type-agnostic:

```ts
[
  { key: "route",            label: "Route hub",          nodeKind: "route",      icon: Route },
  { key: "route-rule-match", label: "Route rule matcher", nodeKind: "route-rule", icon: GitBranch },
  { key: "dns-rule-match",   label: "DNS rule matcher",   nodeKind: "dns-rule",   icon: GitBranch },
]
```

No TUIC-specific port branching. This is correct — TUIC inbound has no upstream outbound references, no service links, and no protocol-level canvas relationships beyond the standard inbound output ports.

Port-active checks: `"route"` active when `config.route` exists; `"route-rule-match"` / `"dns-rule-match"` active when any rule references this tag. All correct for TUIC.

### Gap analysis

No TUIC-specific canvas gaps. The port set is accurate.

---

## Right: Inspector

### Current state for inbound rendering

The Inspector has no TUIC-specific section. All TUIC inbound fields are handled as follows:

**Shared groups rendered via `sharedGroupsForEntity` (sharedFieldRegistry.ts):**
- `"listen"` — yes, `"tuic"` is in `CREATABLE_INBOUND_TYPES`.
- `"tls"` — yes, `"tuic"` is in `inboundTlsTypes` (line 144).
- `"quic"` — yes, `"tuic"` is in `inboundQuicTypes` (line 145).
- `"multiplex"` — no (correct; TUIC does not support multiplex).
- `"v2ray-transport"` — no (correct).

**Protocol-specific TUIC fields and how they are currently handled:**

| Field | Type | In `inboundHandledFields`? | Current rendering | Assessment |
| --- | --- | --- | --- | --- |
| `users` | array | No | NOT rendered — `editableScalarFields` only returns `string \| number \| boolean`; arrays are silently excluded | **P0**: `users[]` is completely invisible in the Inspector. A freshly-created TUIC node has `users: [{...}]` in JSON but the user cannot see, add, or modify users at all. |
| `congestion_control` | string | No | Falls to `AdvancedScalarFields` as plain text input (since it is a string scalar present in the default stub) | **P1**: `congestion_control` is a fixed enum (`"cubic"` / `"new_reno"` / `"bbr"`). A raw text input accepts invalid values. Should be a `<select>`. |
| `auth_timeout` | string (duration) | No | Falls to `AdvancedScalarFields` as plain text input | **P1**: First-class duration text field, not a primary control. Collapsed in Advanced fields; easy to miss. |
| `zero_rtt_handshake` | boolean | No | Falls to `AdvancedScalarFields` as checkbox | **P1**: Boolean toggle present via Advanced fields — functionally accessible but buried. Should be a first-class toggle with the security warning from the official doc. |
| `heartbeat` | string (duration) | No | Falls to `AdvancedScalarFields` as plain text input | **P1**: Duration text field buried in Advanced. |
| `tls` | object | Yes (in `inboundHandledFields` line 121) | Rendered as the shared TLS group — correct | Correct. TLS group is shown. |

**Default stub validation (`createInbound("tuic")`, commands.ts line 209):**

```ts
{
  type: "tuic",
  tag,
  listen: "127.0.0.1",
  listen_port: 2080,
  users: [{ name: "user", uuid: "059032a9-7d40-4a96-9bb1-36823d848068", password: "change-me" }],
  congestion_control: "cubic",
  auth_timeout: "3s",
  zero_rtt_handshake: false,
  heartbeat: "10s",
}
```

The stub omits `tls`. Since `tls` is **required** by the official spec, the stub will produce an invalid config that fails official sing-box validation. There is no diagnostic in `diagnostics.ts` to catch missing TLS on TUIC (or any other protocol-specific TLS-required inbound). The stub for `hysteria2` also omits `tls`, so this is a shared pattern; the TUIC case is the highest-priority instance because TLS is explicitly marked `==Required==`.

---

## Priority Findings

### P0

**`users[]` array is invisible in the Inspector.**
- `editableScalarFields` (Inspector.tsx line 205) returns only scalar fields (`string | number | boolean`). Array fields are skipped.
- `users` is not in `inboundHandledFields` and has no dedicated rendering path for `kind === "inbound"` entities.
- The user cannot see, add, edit, or delete TUIC users from the Inspector. The only way to interact with users is via a raw JSON import/export.
- Fix: Add a `users` repeater section in a TUIC-specific Inspector branch (`entityType === "tuic"` under `ref.kind === "inbound"`). Each row needs at minimum: `uuid` text input (required), `password` text input (optional), `name` text input (optional). Also add `"users"` to `inboundHandledFields` to prevent AdvancedScalarFields from attempting to render it.

**No TLS-required diagnostic for TUIC inbound.**
- `diagnostics.ts` does not validate that `tls.enabled` (or at minimum a non-empty `tls` object) is present for any protocol-specific inbound type that requires TLS. For TUIC this is a spec-required field — a missing or empty TLS block causes official sing-box binary validation to fail.
- The default stub (`createInbound("tuic")`) does not include `tls`, compounding the issue: every freshly-created TUIC inbound starts as invalid without a visible warning.
- Fix: Add a diagnostic entry in `diagnostics.ts` for `inbound.type === "tuic"` when `tls` is absent or `tls.enabled !== true`. Severity: `"error"`. Also update the default stub in `commands.ts` to include `tls: { enabled: true }`.

### P1

**`congestion_control` rendered as free-text input instead of a `<select>`.**
- Falls through to `AdvancedScalarFields` as a plain text `<input>`. Accepts `"invalid"`, silently discarded by sing-box.
- Fix: Add a dedicated `<select>` with options `["cubic", "new_reno", "bbr"]` in the TUIC-specific Inspector section. Add `"congestion_control"` to `inboundHandledFields`.

**`auth_timeout`, `heartbeat` buried in Advanced fields.**
- Both are duration strings and appear in `AdvancedScalarFields` because they are present in the default stub. Functionally accessible but not first-class.
- Fix: Add first-class text inputs in the TUIC-specific Inspector section. Add both to `inboundHandledFields`.

**`zero_rtt_handshake` buried in Advanced fields with no security warning.**
- The official doc carries a strong warning: disabling 0-RTT is recommended due to replay attack vulnerability. The Advanced fields checkbox has no label context for this.
- Fix: Add a first-class toggle with inline warning text (e.g., a `<details>` or `<span className="field-hint">` note). Add `"zero_rtt_handshake"` to `inboundHandledFields`.

---

## Implementation Tasks

1. **Add TUIC-specific Inspector section** — `src/components/Inspector.tsx` after the shared inbound block (around line 1501). Add a branch `{ref.kind === "inbound" && entityType === "tuic" ? (...) : null}` rendering:

   a. **`users` repeater** — An array-backed repeater showing rows of `uuid` (text, required), `password` (text, optional), `name` (text, optional). Until a full repeater component exists, use a `JsonField` textarea (same pattern as `service["account-service"]` at line 1805) as an interim: `<JsonField label="Users" value={entity.users ?? []} onChange={(value) => updateField(ref, "users", value)} />`. Add `"users"` to `inboundHandledFields`. [P0]

   b. **`congestion_control` select** — `<select>` with options `["cubic", "new_reno", "bbr"]`. Default display value: `"cubic"`. Add `"congestion_control"` to `inboundHandledFields`. [P1]

   c. **`auth_timeout` text field** — `<input type="text">` with placeholder `"3s"`. Add `"auth_timeout"` to `inboundHandledFields`. [P1]

   d. **`zero_rtt_handshake` toggle with warning** — `<label className="toggle-row">` with checkbox and inline hint text: `"0-RTT is vulnerable to replay attacks; keep disabled unless you understand the risk."`. Add `"zero_rtt_handshake"` to `inboundHandledFields`. [P1]

   e. **`heartbeat` text field** — `<input type="text">` with placeholder `"10s"`. Add `"heartbeat"` to `inboundHandledFields`. [P1]

2. **Add TLS-required diagnostic for TUIC** — `src/domain/diagnostics.ts`. In the inbound iteration loop, add:

   ```ts
   if (inbound.type === "tuic") {
     const tls = inbound.tls;
     const tlsEnabled = tls && typeof tls === "object" && !Array.isArray(tls)
       ? Boolean((tls as Record<string, unknown>).enabled)
       : false;
     if (!tlsEnabled) {
       push(diagnostics, "error", "tuic-inbound-needs-tls", `/inbounds/${index}/tls`,
         `TUIC inbound "${inbound.tag}" requires TLS (tls.enabled must be true).`);
     }
   }
   ```
   [P0]

3. **Update default TUIC inbound stub** — `src/domain/commands.ts` line 209. Add `tls: { enabled: true }` to the `createInbound("tuic")` return value so every new TUIC node starts with a valid TLS stub:

   ```ts
   if (type === "tuic") {
     return {
       type, tag,
       listen: "127.0.0.1",
       listen_port: 2080,
       users: [{ name: "user", uuid: "059032a9-7d40-4a96-9bb1-36823d848068", password: "change-me" }],
       congestion_control: "cubic",
       auth_timeout: "3s",
       zero_rtt_handshake: false,
       heartbeat: "10s",
       tls: { enabled: true },
     };
   }
   ```
   [P0 linked to TLS diagnostic]

---

## Done Criteria

- [ ] TUIC inbound users can be viewed, added, and edited from the Inspector; changes round-trip to JSON export.
- [ ] `congestion_control` is rendered as a `<select>` with `cubic` / `new_reno` / `bbr` options; free-text entry is no longer possible.
- [ ] `auth_timeout` and `heartbeat` are first-class text fields, not buried in Advanced fields.
- [ ] `zero_rtt_handshake` is a first-class toggle with an inline security warning.
- [ ] Creating a new TUIC inbound from the Palette produces a stub that includes `tls: { enabled: true }`.
- [ ] A semantic diagnostic (`error`, code `"tuic-inbound-needs-tls"`) fires when a TUIC inbound lacks `tls.enabled: true`.
- [ ] The `"listen"`, `"tls"`, and `"quic"` shared field groups all render correctly for `inbound:tuic`.
- [ ] Importing a config with a full TUIC inbound (users, congestion_control, auth_timeout, zero_rtt_handshake, heartbeat, tls) round-trips without data loss.
- [ ] Stable and testing docs are effectively identical for this node (confirmed above); no version gate needed beyond the testing-only QUIC Fields formalisation, which the existing QUIC group already covers.
