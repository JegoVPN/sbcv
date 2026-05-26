<!-- Deep review. Source: official stable + testing docs, Palette.tsx, Inspector.tsx, sharedFieldRegistry.ts, commands.ts, diagnostics.ts, protocols.ts. -->
<!-- Status: ui-verified (2026-05-27). Shared atomics shipped (see docs/claude/index-ui-reviews.md Cross-Node Findings #1-#9). Node-specific outstanding P0/P1 still tracked below. -->
# Outbound / hysteria UI Review

## Deprecation Warning

Hysteria v1 (`type: "hysteria"`) is a **legacy protocol**. The sing-box testing branch (1.14+) marks `recv_window_conn`, `recv_window`, and `disable_mtu_discovery` as deprecated fields, replaced by shared QUIC fields. The broader community has migrated to Hysteria v2. The UI currently shows no deprecation signal — no badge, no tooltip, no suggestion to use `hysteria2` instead.

Recommended action: add a deprecation banner in the Inspector and a visual marker (e.g., `legacy` badge) on the Palette entry and canvas node.

---

## Official Field Model (stable + testing)

Protocol type: `hysteria` (outbound)
Required fields: `server`, `server_port` (or `server_ports`), `up`/`up_mbps`, `down`/`down_mbps`, `tls`

| Field | Required | Notes |
|---|---|---|
| `server` | Yes | Server address |
| `server_port` | Yes (exclusive with `server_ports`) | Single port |
| `server_ports` | Since 1.12.0, conflicts with `server_port` | Port range list for hopping |
| `hop_interval` | No | Port hop interval; default `30s`; only with `server_ports` |
| `up` | Yes | Bandwidth string e.g. `"100 Mbps"` |
| `up_mbps` | Yes | Integer Mbps alternative to `up` |
| `down` | Yes | Bandwidth string |
| `down_mbps` | Yes | Integer Mbps alternative to `down` |
| `obfs` | No | Obfuscation password |
| `auth` | No | Auth password base64 |
| `auth_str` | No | Auth password plaintext |
| `network` | No | `"tcp"` or `"udp"`, default both |
| `tls` | Yes | TLS config object (outbound) |
| `recv_window_conn` | Deprecated 1.14 | Replaced by QUIC `stream_receive_window` |
| `recv_window` | Deprecated 1.14 | Replaced by QUIC `connection_receive_window` |
| `disable_mtu_discovery` | Deprecated 1.14 | Replaced by QUIC `disable_path_mtu_discovery` |
| Dial fields | — | Standard shared dial block |
| QUIC fields (testing) | — | `initial_packet_size`, `disable_path_mtu_discovery`, `idle_timeout`, `keep_alive_period` |

Total official fields: 18 (including 3 deprecated + 4 QUIC shared)

---

## Palette (Left Panel)

Entry: line 163 of `src/components/Palette.tsx`

```
{ label: "Hysteria", kind: "hysteria-out", icon: Plug, docsUrl: docs("outbound/hysteria/"), status: "setup" }
```

Note: the Palette `kind` is `"hysteria-out"`, but the task brief refers to `outbound-hysteria` as the palette kind. In `protocols.ts` the canonical mapping is `"hysteria-out" -> "hysteria"` (line 11). There is no kind named `outbound-hysteria` anywhere in the codebase; the correct existing kind is `hysteria-out`.

Findings:

- No deprecation badge or visual distinction from `hysteria2-out`. A user browsing the palette has no signal that Hysteria v1 is legacy.
- `status: "setup"` is correct — the node enters canvas with a default skeleton when clicked.
- `docsUrl` points to `outbound/hysteria/` which is correct.
- No `channel` gate — `hysteria-out` is available in both stable and testing channels. This is consistent with the protocol still being supported, but the missing deprecation signal is a UX gap.

---

## Canvas Node (Middle)

The canvas node is driven by `protocols.ts` type mapping (`"hysteria-out"` -> type `"hysteria"`) and the default skeleton from `commands.ts` lines 335–346:

```ts
{
  type,
  tag,
  server: "127.0.0.1",
  server_port: 1080,
  up_mbps: 100,
  down_mbps: 100,
  auth_str: "change-me",
  network: "udp",
}
```

Findings:

- **P0 — Missing required `tls` field in default skeleton.** Official docs mark `tls` as `==Required==`. The default skeleton has no `tls` key at all. Any exported config using this default will fail sing-box validation. `hysteria2` default skeleton has the same omission.
- **P1 — `network: "udp"` in default is a partial default.** Official docs say both TCP and UDP are enabled by default (omit the field). Hardcoding `"udp"` restricts the outbound unnecessarily unless the user explicitly wants UDP-only. Consider omitting or defaulting to `""` / removing from skeleton.
- **P1 — No canvas-level deprecation signal.** The node renders identically to non-deprecated outbounds. A "legacy" or "deprecated" pill or badge on the node body would help users identify configurations that should be migrated to `hysteria2`.
- Bandwidth fields `up_mbps`/`down_mbps` are present in the skeleton. The string form `up`/`down` is not in the skeleton; this is acceptable as a choice but should be documented — if a user imports a config using the string form, it should round-trip correctly via AdvancedScalarFields.

---

## Inspector (Right Panel)

The outbound Inspector section (lines 1505–1546 of `Inspector.tsx`) renders:

1. `server` — first-class text input (present because `"server" in entity`)
2. `server_port` — first-class number input (present because `"server_port" in entity`)
3. `AdvancedScalarFields` — fallback for any scalar field not in `outboundHandledFields`

Fields that fall into `AdvancedScalarFields` (raw input with auto-generated label) for a default hysteria outbound:
- `up_mbps`, `down_mbps` — rendered as generic number inputs
- `auth_str` — rendered as generic text input
- `network` — rendered as generic text input (no enum constraint)

Shared group modules registered for `hysteria` outbound via `sharedGroupsForEntity` (lines 174–180 of `sharedFieldRegistry.ts`):
- `dial` — rendered (outboundDialTypes includes all CREATABLE_OUTBOUND_TYPES)
- `tls` — rendered (outboundTlsTypes includes `"hysteria"`)
- `quic` — rendered (outboundQuicTypes includes `"hysteria"`)

Findings:

- **P0 — `up_mbps`/`down_mbps` fall through to AdvancedScalarFields.** These are required bandwidth fields and have no first-class Inspector controls. They appear under "Advanced fields" hidden behind a `<details>` toggle. A user adding a hysteria outbound cannot easily see or set the required bandwidth without expanding advanced fields.
- **P0 — `obfs` field has no Inspector control.** Not in `outboundHandledFields`. It is optional but functionally important; if present in an imported config it will appear in AdvancedScalarFields. If absent from the default skeleton it is invisible — the user cannot add it without manual JSON editing or knowing to open Advanced.
- **P0 — `auth` (base64) and `auth_str` (plaintext) are not differentiated.** Both appear as identical generic text inputs if present. The Inspector should show at most one (prefer `auth_str`), label it clearly, and note the base64 variant.
- **P1 — `server_ports` and `hop_interval` (1.12.0+) have no Inspector controls.** If the user imports a config using port hopping, these fields fall to AdvancedScalarFields. Port hopping is an important operational feature; first-class controls (a multi-line input for ranges + a text input for interval) would improve usability.
- **P1 — `network` field has no enum select.** Falls through as a raw text input. Should be a `<select>` with options `""` (both), `"tcp"`, `"udp"`.
- **P1 — Deprecated fields `recv_window_conn`, `recv_window`, `disable_mtu_discovery`.** These are deprecated in 1.14 in favor of QUIC shared fields (`stream_receive_window`, `connection_receive_window`, `disable_path_mtu_discovery`). The QUIC shared group inspector (lines 907–913) already exposes the replacement QUIC fields. If an imported config contains the old fields they will appear in AdvancedScalarFields with no deprecation hint. No migration suggestion is surfaced.
- **P1 — `tls` is required but the TLS module card is gated on `tls.enabled`.** If TLS is absent from the entity object (as in the default skeleton), the TLS shared group will render an "Enabled" toggle that starts false. The user must manually enable TLS before filling in server_name/certificate. The Inspector should warn that TLS is required for this protocol type and start with `tls: { enabled: true }` in the default skeleton.
- No `stream_receive_window` or `connection_receive_window` fields appear in the QUIC inspector group (lines 907–913). These are QUIC-spec fields present in the testing branch; the Inspector QUIC group currently renders only 4 fields. They are however in the `serviceHandledFields` list (lines 191–192), suggesting they are handled elsewhere — but for outbound hysteria they would appear in AdvancedScalarFields if present in the entity.

---

## Shared Field Registry Coverage

`sharedGroupsForEntity` for `ref.kind === "outbound"`, `type === "hysteria"`:

- `dial` — included (correct, official docs list Dial Fields)
- `tls` — included (correct, TLS is required)
- `quic` — included (correct, stable docs list QUIC-adjacent fields; testing adds full QUIC block)
- `multiplex` — NOT included (correct, official docs do not list multiplex for hysteria)
- `v2ray-transport` — NOT included (correct)
- `udp-over-tcp` — NOT included (correct)

Registry coverage is accurate.

---

## Diagnostics

No hysteria-specific diagnostic rules exist in `diagnostics.ts`. Relevant gaps:

- No check that `tls` is present and `enabled: true` for `type: "hysteria"`.
- No deprecation diagnostic for `type: "hysteria"` itself (suggesting migration to `hysteria2`).
- No check that exactly one of `server_port` / `server_ports` is set.
- No check that exactly one of `up`+`down` / `up_mbps`+`down_mbps` is set (both pairs are required; mixing string and integer forms for the same direction is valid but unexpected).
- No check that deprecated fields `recv_window_conn`/`recv_window`/`disable_mtu_discovery` are absent (or warn if present on 1.14+ channel).

---

## Priority Findings

### P0 — Missing `tls` in default outbound skeleton (commands.ts line 335)
The default object created when adding a hysteria outbound contains no `tls` key. TLS is documented as `==Required==`. Exporting the config without TLS will fail sing-box validation.

**Fix:** add `tls: { enabled: true }` (and optionally `server_name: ""`) to the default skeleton at `commands.ts` line 335.

### P0 — Required bandwidth fields `up_mbps`/`down_mbps` buried in AdvancedScalarFields
These required fields are not in `outboundHandledFields` and have no first-class Inspector controls. A user must open the "Advanced fields" collapsible to set them.

**Fix:** add `up_mbps` and `down_mbps` to `outboundHandledFields` and render them as labeled number inputs in the outbound Inspector section, or add a hysteria-specific section gated on `entityType === "hysteria"`.

### P0 — `obfs`, `auth`, `auth_str` have no Inspector controls
Authentication and obfuscation fields are absent from `outboundHandledFields`. They are not in the default skeleton either (except `auth_str` which is in the skeleton). A user cannot add `obfs` without advanced JSON manipulation.

**Fix:** add `obfs`, `auth_str` (and `auth` as secondary) to `outboundHandledFields`; render as labeled inputs in the hysteria-specific Inspector section.

### P1 — No deprecation signal for Hysteria v1 anywhere in UI
No badge, banner, tooltip, or diagnostic warns that `type: "hysteria"` is the legacy v1 protocol and `hysteria2` is the current recommendation.

**Fix:** add a diagnostic rule that emits a `"hysteria-v1-deprecated"` warning for any outbound with `type === "hysteria"`; surface a callout in the Inspector; add a `legacy` visual marker to the Palette entry and canvas node.

### P1 — `network` field exposed as raw text, not enum select
`network` accepts `"tcp"`, `"udp"`, or omitted (both). It is in the default skeleton but falls to AdvancedScalarFields as a plain text input.

**Fix:** add `network` to `outboundHandledFields`; render as `<select>` with options `""` / `"tcp"` / `"udp"` in a hysteria-specific block, or add a general network select for QUIC outbound types.

### P1 — No Inspector controls for `server_ports` and `hop_interval` (1.12.0+)
Port hopping is a first-class feature added in 1.12.0. These fields are invisible unless already present in an imported config.

**Fix:** add `server_ports` and `hop_interval` to `outboundHandledFields`; render `server_ports` as a list input and `hop_interval` as a text input inside a hysteria-specific section.

### P1 — Deprecated QUIC legacy fields in imported configs show no migration hint
`recv_window_conn`, `recv_window`, `disable_mtu_discovery` appear in AdvancedScalarFields without any deprecation label. The replacement QUIC fields are already exposed by the QUIC shared group.

**Fix:** add a diagnostic rule that warns when these deprecated fields are present on a testing-channel config; show a migration hint pointing to the QUIC inspector group.

---

## Implementation Tasks

1. **commands.ts** — add `tls: { enabled: true }` to the outbound hysteria default skeleton (line 335). [P0]

2. **Inspector.tsx** — add `"up_mbps"`, `"down_mbps"`, `"obfs"`, `"auth_str"`, `"auth"`, `"network"`, `"server_ports"`, `"hop_interval"` to `outboundHandledFields`. Add a hysteria-specific Inspector subsection (gated on `entityType === "hysteria"`) rendering:
   - Upload Mbps (number input, required)
   - Download Mbps (number input, required)
   - Obfuscation (text input)
   - Auth (text input, label "Auth Password")
   - Network (select: both / tcp / udp)
   - Server Ports (list input, mutually exclusive with Server Port)
   - Hop Interval (text input) [P0 bandwidth + obfs/auth; P1 network + hopping]

3. **diagnostics.ts** — add diagnostic rules:
   - `"hysteria-v1-deprecated"` warning for `type === "hysteria"` outbound
   - `"hysteria-tls-required"` error when `tls` is absent or `tls.enabled !== true` for `type === "hysteria"`
   - `"hysteria-deprecated-quic-fields"` info/warning when `recv_window_conn` / `recv_window` / `disable_mtu_discovery` are present (testing channel) [P0 TLS diagnostic; P1 deprecation]

4. **Palette.tsx** — add a `legacy: true` or `deprecated: true` property to the hysteria-out entry; render a visual badge ("Legacy" or "v1") on the Palette card and propagate to the canvas node label. [P1]

5. **Inspector.tsx** — render a deprecation banner for `type === "hysteria"` outbound nodes: "Hysteria v1 is a legacy protocol. Consider migrating to Hysteria2." [P1]

---

## Done Criteria

- Default skeleton includes `tls: { enabled: true }`; exported config passes sing-box validation.
- `up_mbps`, `down_mbps`, `obfs`, `auth_str`, `network` have first-class Inspector controls for `type: "hysteria"` outbounds.
- `server_ports` / `hop_interval` are accessible without opening Advanced fields.
- A deprecation diagnostic fires for any config using `type: "hysteria"` outbound.
- A missing-TLS diagnostic fires when `tls` is absent.
- The Palette entry and canvas node show a legacy/v1 badge.
- Imported configs using deprecated QUIC fields show a migration hint.
- Fixture or smoke test covers add → configure (bandwidth + auth + obfs) → export → import round-trip.
