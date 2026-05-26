<!-- Source: official stable + testing docs (identical), Palette.tsx, Inspector.tsx, SbcNode.tsx, sharedFieldRegistry.ts, diagnostics.ts, templates.ts -->
# Outbound / socks UI Review

## Scope

- Node ID: `outbound:socks`
- Palette kind: `socks`
- Official docs: `outbound/socks.md` (stable and testing are identical)

## Official Field Model

Stable and testing docs are identical. All official fields:

| Field | Required | Notes |
|---|---|---|
| `server` | yes | server address |
| `server_port` | yes | server port |
| `version` | no | `"4"` / `"4a"` / `"5"` (default `"5"`) |
| `username` | no | SOCKS username (applies to all versions) |
| `password` | no | SOCKS5 only |
| `network` | no | `"tcp"` or `"udp"` (default: both) |
| `udp_over_tcp` | no | shared UDP-over-TCP object/bool |
| dial fields | no | shared via Dial Fields |

Total official fields: 8 (7 protocol-specific + 1 shared group).

## What the UI Does Today

### Left: Palette

- Entry: `{ label: "SOCKS", kind: "socks", ready: true }` at line 156 of `Palette.tsx`.
- `ready: true` — the item is active and adds a node immediately. No `status` badge.
- Docs link points to `outbound/socks/` which is correct.

### Middle: Canvas Node

- `kind === "outbound"` branch in `SbcNode.tsx` applies uniformly to all outbound types including `socks`.
- Input ports: Route final, Rule outbound, Selector candidate, URLTest candidate, DNS detour target, Dial detour target, Service detour target, Rule Set download detour — correct for this node.
- Output port: `supportsDialDetour("socks")` returns `true` (socks is not in the exclusion list), so a `dial-detour` output port is rendered — correct per dial field spec.
- No socks-specific canvas rendering; label and type come from the generic outbound display.
- Templates in `templates.ts` seed socks nodes with only `type`, `tag`, `server`, `server_port` — no `version`, `username`, `password`, or `network`. This is fine as defaults, but users adding credentials or locking to SOCKS4 get no UI hint.

### Right: Inspector

#### Rendered first-class fields (outbound branch, lines 1505–1545)

- `server` — text input, rendered if `"server" in entity`. Present in templates, so always shown for socks. Correct.
- `server_port` — number input, rendered if `"server_port" in entity`. Correct.
- `outbounds` — only for selector/urltest, not shown for socks. Correct.
- `default` — only for selector/urltest, not shown for socks. Correct.

#### Shared field groups for socks (`sharedGroupsForEntity`)

`outboundUdpOverTcpTypes` includes `"socks"`, so `sharedGroupsForEntity` returns `["dial", "udp-over-tcp"]` for a socks outbound.

- `dial` group — rendered via shared field controls: Detour (select), Bind Interface, Connect Timeout, Domain Resolver, Network Strategy, Network Type, Fallback Network, Fallback Delay. Correct and complete.
- `udp-over-tcp` group — renders Enabled (boolean) and Version (select `["1", "2"]`). This is the UoT protocol version, not the SOCKS version.

#### Fields NOT in outboundHandledFields (fall through to AdvancedScalarFields)

The `outboundHandledFields` set (lines 128–141) includes `tag`, `type`, `server`, `server_port`, `outbounds`, `default`, `tls`, `multiplex`, `transport`, `udp_over_tcp`, and all dial/quic shared fields. It does NOT include `version`, `username`, `password`, or `network`.

These four protocol-specific fields are NOT handled as first-class controls. Their fate:

- If the socks node was imported from JSON and the entity object contains `version`, `username`, `password`, or `network` as scalar values, `editableScalarFields` will surface them under the "Advanced fields" collapsible section — as generic text/number/boolean inputs with auto-generated labels (`Version`, `Username`, `Password`, `Network`).
- If the node was created fresh from the Palette (template seed contains only `type`, `tag`, `server`, `server_port`), these four fields will be **absent from the entity object**. `editableScalarFields` filters on `Object.entries(entity)` — if the key is absent, it is never shown. The user has no way to add `version`, `username`, `password`, or `network` without editing raw JSON.

#### Semantic diagnostics

`diagnostics.ts` has no socks-specific validation. Missing required fields (`server`, `server_port`) are not caught semantically — there is no check that warns when a socks outbound lacks a server. This is a gap compared to other outbound types.

## Priority Findings

### P0 — Protocol fields absent from new socks nodes

**Severity:** Blocker for full protocol control.

When a socks outbound is created via the Palette, the template seed (`templates.ts`) contains only `{ type, tag, server, server_port }`. The fields `version`, `username`, `password`, and `network` are not seeded. Because `editableScalarFields` only shows fields already present in the entity, there is no UI path to set these fields without hand-editing JSON.

- A user cannot select SOCKS4/4a (must export and edit JSON).
- A user cannot add credentials (username/password) without leaving the UI.
- A user cannot restrict to TCP-only or UDP-only network.

**Fix:** Add first-class Inspector controls for `version` (select: `4`/`4a`/`5`), `username` (text), `password` (text, shown only when version is `"5"` or absent/defaulting to 5), and `network` (select: `""` both / `"tcp"` / `"udp"`). Add `version`, `username`, `password`, `network` to `outboundHandledFields` so they do not double-render if already present in imported JSON.

### P0 — Password field available for all SOCKS versions, docs say SOCKS5 only

**Severity:** Data correctness / user confusion.

The official doc says `password` is SOCKS5 password. `username` applies to all versions but `password` is SOCKS5-specific. If first-class controls are added, the `password` field should be conditionally shown or at least annotated "SOCKS5 only". Currently the Advanced fields section, if it surfaces `password`, shows it as a plain text input with no version context.

**Fix:** When adding first-class controls, gate the `password` field on `version !== "4" && version !== "4a"`, or show a note. A simpler acceptable approach: always show both but label password "Password (SOCKS5 only)".

### P1 — No semantic diagnostic for missing server / server_port

`diagnostics.ts` does not check that socks (or any proxy outbound) has a non-empty `server` and a valid `server_port`. A socks node with `server: ""` or without `server_port` will export silently and fail at runtime.

**Fix:** Add a diagnostic check (warning or error) for outbounds that have `server` in their schema but the field is empty or missing. This can be a general proxy-outbound check covering socks, http, shadowsocks, vmess, trojan, etc.

### P1 — udp-over-tcp Version select conflicts visually with SOCKS version

The shared `udp-over-tcp` group renders a field labelled "Version" (UoT protocol version 1 or 2). If a first-class SOCKS `version` select is added, both will be labelled "Version" in the Inspector with no grouping separator. The UoT version is nested under `udp_over_tcp.version`; the SOCKS version is top-level `version`. The shared field system renders UoT under its own ModuleCard/group title, so the visual collision is manageable — but the labels need disambiguation: SOCKS version select should be labelled "SOCKS Version" and the UoT version already lives in the "UDP over TCP" section.

## Implementation Tasks

1. **Add first-class outbound socks controls to Inspector**
   - In the `ref.kind === "outbound"` block, add a type-guarded sub-section that renders when `entityType === "socks"`:
     - `version` — `<select>` with options `"4"`, `"4a"`, `"5"` (placeholder / default label "5 (default)").
     - `username` — `<input type="text">`.
     - `password` — `<input type="text">` with label "Password (SOCKS5 only)".
     - `network` — `<select>` with options: `""` → "Both (default)", `"tcp"`, `"udp"`.
   - Add `"version"`, `"username"`, `"password"`, `"network"` to `outboundHandledFields`.

2. **Seed template with version placeholder or add creation dialog**
   - Either seed `version: "5"` explicitly in both socks template entries in `templates.ts` so the select is visible immediately, or accept that the select will not appear until the user sets it and rely on the first-class select to write it.

3. **Add missing-server diagnostic**
   - In `diagnostics.ts`, iterate outbounds and push a warning for any outbound whose type is a proxy protocol (socks, http, shadowsocks, vmess, trojan, vless, etc.) that has a blank or missing `server`.

4. **Label disambiguation**
   - Label the SOCKS version control "SOCKS Version" (not "Version") to avoid visual confusion with the UoT Version select in the shared udp-over-tcp section.
