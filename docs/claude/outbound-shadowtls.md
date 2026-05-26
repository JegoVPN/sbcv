# Outbound / shadowtls UI Review

<!-- Source: official stable + testing docs (identical), Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts, protocols.ts -->

## Official Field Model

Stable and testing docs are identical. All fields:

| Field | Required | Notes |
|---|---|---|
| `type` | yes | always `"shadowtls"` |
| `tag` | yes | unique node identifier |
| `server` | yes | server address |
| `server_port` | yes | server port |
| `version` | no | integer 1/2/3; default 1 |
| `password` | no | string; only valid for v2 and v3 |
| `tls` | yes | outbound TLS object |
| dial fields | no | shared dial group |

Total official fields: 8 (excluding tag/type).

## Implementation Audit

### Palette (Left Panel)

- Entry: `{ label: "ShadowTLS", kind: "shadowtls-out", status: "setup" }` (Palette.tsx:164).
- Kind `"shadowtls-out"` maps to type `"shadowtls"` via `OUTBOUND_PALETTE_TYPES` (protocols.ts:12). Correct.
- `status: "setup"` renders a SETUP action. Acceptable.
- Docs URL points to `outbound/shadowtls/`. Correct.

### Default Object (commands.ts createOutbound)

`commands.ts:347-355` generates:
```json
{ "type": "shadowtls", "tag": "shadowtls-out", "server": "127.0.0.1", "server_port": 1080, "version": 3, "password": "change-me" }
```

Findings:
- `version: 3` hardcoded — fine as an opinionated default since v3 is recommended.
- `password` always included in the default — correct for v3.
- `tls` is **missing from the default object**. The official doc marks `tls` as `==Required==`. The node will be created without a `tls` key, which means it will fail validation and likely crash the sing-box binary.

### sharedFieldRegistry

- `outboundTlsTypes` includes `"shadowtls"` (line 151) — TLS shared group will be offered in the Inspector. Correct.
- `outboundDialTypes` includes all creatable outbound types minus block/dns/selector/urltest (line 150) — `"shadowtls"` is included. Dial shared group offered. Correct.
- `shadowtls` does NOT appear in `outboundMultiplexTypes` or `outboundTransportTypes` — no multiplex/transport offered. Correct per spec.

### Inspector (Right Panel)

#### Fields presented first-class

The generic outbound block (Inspector.tsx:1505-1546) shows:
- `server` — text input rendered if `"server" in entity`. Present.
- `server_port` — number input rendered if `"server_port" in entity`. Present.
- `outbounds` / `default` — only for selector/urltest; not applicable here.

#### Fields falling to AdvancedScalarFields

`outboundHandledFields` (Inspector.tsx:128-141) does NOT include `"version"` or `"password"`. These two fields are therefore passed to `AdvancedScalarFields`, which renders them as plain `<input type="text|number">` inside a collapsed `<details>` element labeled "Advanced fields".

Consequences:
- `version` lands in Advanced as a number input. The user sees a raw number field with no indication that only values 1, 2, or 3 are valid and no semantic context (v1=no auth, v2/v3=password required). **No version select exists.**
- `password` lands in Advanced as a text input with no conditional visibility based on version. The user can set a password for v1 (where it has no effect) without any warning. **No version-conditional password logic exists.**

#### TLS section

Offered via `sharedFieldRegistry` → `outboundTlsTypes`. The shared TLS group provides: enabled toggle, server_name, insecure, ALPN, min/max version, certificate_path, certificate_provider (Inspector.tsx:894-904). This covers the outbound TLS surface for ShadowTLS adequately.

#### Dial section

Offered via `outboundDialTypes`. Provides: detour, bind_interface, connect_timeout, domain_resolver, network_strategy, network_type, fallback_network_type, fallback_delay. Correct and complete.

## Priority Findings

### P0

**P0-1: Default object omits required `tls` field.**
`commands.ts:347-355` creates the shadowtls outbound without a `tls` key. The official doc marks `tls` as `==Required==`. Any config exported from a freshly added ShadowTLS outbound will be structurally invalid. The fix is to add `tls: { enabled: true }` (or at minimum `tls: {}`) to the default object in `createOutbound`.

### P1

**P1-1: `version` has no dedicated select control.**
`version` falls into `AdvancedScalarFields` as a plain number input. It should be a first-class `<select>` with options 1, 2, 3 — ideally with human-readable labels ("v1 (no auth)", "v2 (password)", "v3 (password, recommended)"). This is the most important protocol-specific control for ShadowTLS; its placement in "Advanced fields" is misleading.

**P1-2: `password` is always shown, with no version-conditional visibility or warning.**
`password` is only meaningful for `version` 2 or 3. When `version === 1`, password is silently ignored by sing-box. The Inspector should either hide `password` when `version === 1` or display an inline note that it has no effect in v1. Additionally, when `version` is 2 or 3 and `password` is empty, a diagnostic warning should be shown.

**P1-3: `version` and `password` not in `outboundHandledFields`.**
Both fields must be added to `outboundHandledFields` once they are promoted to first-class controls, so they stop appearing in "Advanced fields" after the fix. Currently they are double-exposed: shown as first-class after promotion AND again in Advanced.

## Implementation Tasks

1. **commands.ts** — add `tls: { enabled: true }` to the `shadowtls` outbound default object (fix P0-1).
2. **Inspector.tsx** — in the `ref.kind === "outbound"` block, add a type-specific branch for `entityType === "shadowtls"`:
   - Render `version` as a `<select>` with options 1, 2, 3.
   - Render `password` as a text input, visible only when `version !== 1` (or show a "(ignored for v1)" hint).
3. **Inspector.tsx** — add `"version"` and `"password"` to `outboundHandledFields` so they no longer surface in AdvancedScalarFields.
4. **Inspector.tsx** — consider a semantic diagnostic (inline warning) when `version` is 2 or 3 and `password` is empty/missing.

## Done Criteria

- Adding ShadowTLS outbound from Palette produces a valid default object including `tls`.
- Inspector shows `version` as a select with 1/2/3.
- `password` field is hidden or clearly marked as no-op when `version === 1`.
- `version` and `password` are absent from the "Advanced fields" collapse.
- TLS and Dial shared groups are present and functional.
- Round-trip: import → edit version/password/server/TLS → export produces correct JSON.
