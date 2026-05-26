# Inbound / Trojan — Deep UI Review

> Source: official stable + testing docs are identical for this node.  
> Reviewed: Palette, SbcNode port specs, Inspector shared-field registry, commands.ts default scaffold.

---

## Official Field Model (stable = testing)

```
type: "trojan"
tag: <string>

# Listen Fields (shared)
listen          REQUIRED
listen_port
bind_interface
routing_mark
reuse_addr
netns
tcp_fast_open
tcp_multi_path
disable_tcp_keep_alive
tcp_keep_alive
tcp_keep_alive_interval
udp_fragment
udp_timeout
detour          (forward to another inbound)

# Protocol Fields
users[]         REQUIRED — array of { name, password }
tls {}          (not marked Required in doc, but Trojan is TLS-by-design — see P0 below)
fallback {}     { server, server_port }
fallback_for_alpn {}   map of ALPN string → { server, server_port }

# Shared sections
multiplex {}
transport {}
```

**Official field count: 21 top-level fields** (8 listen + 2 required protocol + 3 optional protocol + 2 shared sections + `type` + `tag` + 4 newer listen fields).

---

## Left: Add Library (Palette)

**Current state** (`Palette.tsx` line 137):
```ts
{ label: "Trojan", kind: "inbound-trojan", icon: Shield, docsUrl: docs("inbound/trojan/"), status: "setup" }
```

- Label is "Trojan" — correct, human-readable.
- `status: "setup"` — the action text shown to the user is implementation-internal. Needs to become a clear verb: `ADD` or `ADD INBOUND`.
- Docs URL is properly set to `inbound/trojan/`.
- Icon is `Shield` — appropriate for a protocol node.

**No blocking gap** in Palette entry beyond the status label wording.

---

## Middle: Canvas Node (SbcNode)

**Port specs** (`SbcNode.tsx` lines 136–144):

All inbound nodes share the same port set:
- Output → Route hub (`route`)
- Output → Route rule matcher (`route-rule`)
- Output → DNS rule matcher (`dns-rule`)

No input ports — correct; inbounds are traffic sources.

**Trojan-specific gaps on the canvas:**
- No port or badge distinguishing whether TLS is actually configured. Since TLS is practically required for Trojan to work, a missing-TLS state should produce a visible diagnostic (badge/color).
- No port to a fallback server. `fallback` and `fallback_for_alpn` are pure JSON objects (not sing-box `tag` references), so no port is needed — this is correct.
- Canvas node shows generic inbound icon (`RadioTower`), not `Shield` like the palette entry. Minor visual inconsistency; not a blocker.

---

## Right: Inspector

### What is currently rendered for `kind === "inbound"` (all inbound types)

1. **Type selector** — dropdown from `CREATABLE_INBOUND_TYPES`; `trojan` is included (`protocols.ts` line 75).
2. **Tag** — text input (standard, shared).
3. **`address` / `auto_route`** — rendered for the `tun` inbound family; these fields appear in the generic inbound block but are not relevant to Trojan. They will show if present in the entity, which is benign but visually noisy.
4. **`AdvancedScalarFields`** — catches anything not in `inboundHandledFields`. This is where Trojan's `users`, `fallback`, `fallback_for_alpn` currently land.

### Shared field groups applied to `trojan` inbound

From `sharedFieldRegistry.ts`:
| Group | Applied? | Registry line |
|---|---|---|
| `listen` | Yes — all creatable inbounds | line 166 |
| `tls` | Yes — `inboundTlsTypes` includes `trojan` | line 144 |
| `multiplex` | Yes — `inboundMultiplexTypes` includes `trojan` | line 146 |
| `v2ray-transport` | Yes — `inboundTransportTypes` includes `trojan` | line 147 |
| `quic` | No — correct, Trojan is TCP | |
| `dial` | No — correct, inbounds do not dial (except shadowtls) | |

All four correct groups are wired. No missing or spurious group.

### Listen Fields panel gaps

The `listen` shared-field definition (`Inspector.tsx` lines 849–859) covers:
`listen`, `listen_port`, `bind_interface`, `routing_mark`, `reuse_addr`, `netns`, `tcp_fast_open`, `udp_timeout`

**Missing from the panel** (present in official stable listen.md):
- `tcp_multi_path`
- `disable_tcp_keep_alive` (since 1.13.0)
- `tcp_keep_alive` (since 1.13.0)
- `tcp_keep_alive_interval`
- `udp_fragment`
- `detour` (forward-to-inbound, distinct from outbound detour)

These fall through to `AdvancedScalarFields` if present in imported JSON, but are not surfaced as labelled controls. Shared gap — affects all inbounds, not just Trojan.

### TLS panel

`tls` group fields (`Inspector.tsx` lines 894–905):
`enabled`, `server_name`, `insecure`, `alpn`, `min_version`, `max_version`, `certificate_path`, `certificate_provider`

**Trojan TLS specifics not surfaced:**
- `tls.key_path` — not in the panel definition; falls to AdvancedScalarFields.
- `tls.certificate` / `tls.key` (inline PEM) — not in the panel.
- No visual indicator that TLS is **practically required** for Trojan. The TLS card has `enabled` as the first field with a boolean toggle, but there is no warning when `tls.enabled` is false or `tls` is absent.

### Protocol-specific fields: users[], fallback, fallback_for_alpn

**Current state:** no dedicated Inspector block exists for `kind === "inbound"` + `type === "trojan"`. The `inboundHandledFields` set does NOT include `users`, `fallback`, or `fallback_for_alpn`, so all three spill to `AdvancedScalarFields` as raw scalars — but `users` is an array and `fallback`/`fallback_for_alpn` are objects, so `AdvancedScalarFields` (which only renders string/number/boolean) will **silently skip** them. They are not editable in the Inspector at all.

**Default scaffold** (`commands.ts` line 159–167):
```ts
{
  type: "trojan",
  tag,
  listen: "127.0.0.1",
  listen_port: 2080,
  users: [{ name: "user", password: "change-me" }],
}
```
- No `tls: {}` in the default scaffold — node is created without TLS configured.
- No `fallback` or `fallback_for_alpn` in scaffold — acceptable (optional).
- `password: "change-me"` is a placeholder, not a security hazard for a local scaffold.

---

## Priority Findings

### P0 — Protocol fields (users, fallback) are completely uneditable in the Inspector

**Evidence:** `inboundHandledFields` does not include `users`, `fallback`, or `fallback_for_alpn`. `AdvancedScalarFields` only shows scalar fields; arrays and objects are silently skipped. No Trojan-specific Inspector block exists for `kind === "inbound"`.

**Impact:** After creating a Trojan inbound, there is no UI path to add a second user, change a password, or configure fallback servers. The only workaround is raw JSON import/export.

**Fix required:**
1. Add a Trojan-specific block under `ref.kind === "inbound"` guarded by `entityType === "trojan"`.
2. Render a `users[]` repeater: each row has `name` (text) + `password` (text/password input). Provide Add / Remove row controls.
3. Render `fallback` as two fields: `Fallback Server` (text) and `Fallback Port` (number), writing to `fallback.server` / `fallback.server_port`.
4. Render `fallback_for_alpn` as a `JsonField` (map structure is too irregular for a simple repeater, but should be visible and editable rather than silently dropped).
5. Add `users`, `fallback`, `fallback_for_alpn` to `inboundHandledFields` so `AdvancedScalarFields` does not re-emit them.

### P0 — Default scaffold is created without TLS; no diagnostic warns the user

**Evidence:** `commands.ts` line 159–167: the `trojan` inbound scaffold does not include `tls: {}`. The TLS card shows `enabled: false` by default. Trojan over plain TCP will not authenticate connections correctly — the protocol is defined as TLS-wrapped by design.

**Impact:** A user who adds a Trojan inbound and exports the config without enabling TLS gets a config that will fail at runtime with no UI-level warning.

**Fix required:**
1. Add `tls: { enabled: true }` to the Trojan inbound scaffold in `commands.ts`.
2. Add a semantic diagnostic: when `entityType === "trojan"` and `entity.tls?.enabled !== true`, display a visible warning in the Inspector (e.g., red border or banner: "TLS must be enabled for Trojan").
3. Optionally surface a [!] badge on the canvas node when TLS is not enabled.

---

### P1 — users[] repeater: password field should mask input by default

**Evidence:** No dedicated `users` UI exists yet (P0 above). When built, the password column must use `type="password"` or a toggle-reveal pattern, not a plain text input, to avoid credential exposure in screen recordings and shoulder surfing.

### P1 — Listen Fields panel missing 5 official fields

**Evidence:** `tcp_multi_path`, `disable_tcp_keep_alive`, `tcp_keep_alive`, `tcp_keep_alive_interval`, `udp_fragment`, and listen-`detour` are absent from the `listen` shared-field definitions in `Inspector.tsx`. They fall through to AdvancedScalarFields as individual scalar edits, but `detour` (string) and numeric/boolean fields will appear inconsistently depending on what is in the current entity.

**Impact:** Users cannot discover and configure these fields through normal Inspector interaction.

**Fix required:** Add the missing fields to the `listen` group definition in `sharedFieldDefinitions`. Note that listen `detour` must be a select rendered against inbound tags, not a free-text input, to avoid tag drift.

### P1 — TLS section does not expose key_path, certificate (inline PEM), or key (inline PEM)

**Evidence:** `sharedFieldDefinitions` for `tls` group (lines 894–905) only covers 8 fields; official inbound TLS supports `certificate_path`, `key_path`, inline `certificate`, inline `key`, and `acme` sub-object.

**Impact:** Server TLS configuration (required for Trojan) cannot be completed in the Inspector without raw JSON.

**Fix required:** Add `key_path` text field to the TLS panel. `certificate` and `key` (inline PEM arrays) can be JsonField controls. `acme` should remain a JsonField until a dedicated panel exists.

### P1 — fallback_for_alpn has no structured editor

**Evidence:** Even after P0 is fixed, `fallback_for_alpn` is a map from ALPN string to `{ server, server_port }`. A raw JsonField is the minimum viable control, but a structured repeater (ALPN key + server + port rows) would be significantly better UX.

**Impact:** Users cannot visually understand or validate their per-ALPN fallback routing.

**Fix required (post-P0):** Implement a key-value repeater where the key is the ALPN string and the value has `server` + `server_port` sub-fields. Low priority relative to P0.

---

## Implementation Tasks

1. **[P0] Add Trojan-specific Inspector block**
   - File: `src/components/Inspector.tsx`
   - Location: inside `{ref.kind === "inbound" ? …}` section, gated by `entityType === "trojan"`
   - Controls: `users[]` repeater (name + password), `fallback.server` + `fallback.server_port`, `fallback_for_alpn` JsonField
   - Update `inboundHandledFields` to include `"users"`, `"fallback"`, `"fallback_for_alpn"`

2. **[P0] Add TLS to default Trojan scaffold**
   - File: `src/domain/commands.ts`, line ~159
   - Change: add `tls: { enabled: true }` to the returned scaffold object
   - Add semantic diagnostic (Inspector banner) when `tls?.enabled !== true`

3. **[P1] Password masking in users[] repeater**
   - When implementing task 1, use `type="password"` with a show/hide toggle for the password column

4. **[P1] Complete the listen shared-field panel**
   - File: `src/components/Inspector.tsx`, `sharedFieldDefinitions` for group `"listen"`
   - Add: `tcp_multi_path` (boolean), `disable_tcp_keep_alive` (boolean), `tcp_keep_alive` (text), `tcp_keep_alive_interval` (text), `udp_fragment` (boolean), `detour` (select → inbound tags)
   - Update `listenSharedFields` array so AdvancedScalarFields does not duplicate them

5. **[P1] Extend TLS panel with server-side key fields**
   - File: `src/components/Inspector.tsx`, `sharedFieldDefinitions` for group `"tls"`
   - Add: `{ label: "Key Path", path: ["tls", "key_path"], kind: "text" }`, JsonField rows for inline `certificate` and `key` arrays

6. **[P1] Structured fallback_for_alpn repeater** (follow-on to task 1)
   - Replace the raw JsonField with a per-row control: ALPN string key + `server` text + `server_port` number
   - Can be deferred until the basic JsonField version is stable

---

## Summary

| Area | Status |
|---|---|
| Palette entry | OK (label wording minor) |
| Canvas ports | OK for tag-based connections; no TLS-absent diagnostic |
| Default scaffold | BROKEN — created without TLS |
| users[] editing | MISSING — no UI path exists |
| fallback editing | MISSING — silently dropped |
| TLS shared panel | PARTIAL — missing key_path, inline PEM |
| Listen shared panel | PARTIAL — missing 5 fields from 1.12/1.13 |
| multiplex group | OK |
| v2ray-transport group | OK |
