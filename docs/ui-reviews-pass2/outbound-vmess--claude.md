# outbound-vmess — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Source of truth: `docs/upstream/sing-box/testing/configuration/outbound/vmess.md` (read in full; fields enumerated: server, server_port, uuid, security, alter_id, global_padding, authenticated_length, network, tls, packet_encoding, multiplex, transport, + Dial Fields). Verified against code, not against `docs/claude/outbound-vmess.md` or pass-1 `docs/ui-reviews/outbound-vmess.md`.

## Verdict (2-3 sentences)
The vmess outbound is in very good shape: all 4 surfaces round-trip and every *required* field (`server`, `server_port`, `uuid`) plus the high-value enums (`security`, `network`, `packet_encoding`) are now first-class with correct controls, UUID masking + generate, and semantic diagnostics. Pass-1's headline P0s (uuid buried in Advanced, security/network/packet_encoding as free-text, missing alter_id warning) are ALL fixed and now stale. Remaining gaps are minor: three protocol params (`alter_id`, `global_padding`, `authenticated_length`) render via the generic Advanced fallback with no AEAD/legacy labelling, and the V2Ray Transport editor omits WebSocket/httpupgrade-specific fields.

## 1. Left Palette
Present and correct. `Palette.tsx:158` — `{ label: "VMess", kind: "vmess-out", icon: Shield, docsUrl: docs("outbound/vmess/"), status: "setup" }`, under the `Outbounds` group (`Palette.tsx:151`). Category, label, icon (Shield, consistent with other encrypted outbounds), and docs URL all correct. Default action `setup` → renders "Setup" and is actionable (`canActivate`, `Palette.tsx:279`), invoking `createFromPalette("vmess-out")`. Kind→type mapping `vmess-out → vmess` (`protocols.ts:7`), in `CREATABLE_OUTBOUND_TYPES` (`protocols.ts:30`), preferred tag `vmess-out` (`protocols.ts:152`). No gating issues. No findings.

## 2. Canvas Node
Correct. Created by `createOutbound("vmess", tag)` (`commands.ts:312-321`). Node data built in `graph.ts:383-433`:
- title = tag (`graph.ts:395`); titlebar also shows `outbound / vmess` (`SbcNode.tsx:291`).
- subtitle = `vmess <server>:<server_port>` (`graph.ts:401-402`) — accurate.
- status from `diagnosticStatus("/outbounds/<i>")` (`graph.ts:404`) — semantic validity, drives the node badge/pill (`SbcNode.tsx:386,412`). Correct (not full-config binary validity).
- `compatible: []` for a non-group vmess (`graph.ts:405-428` only populates for selector/urltest), so the large `+` affordance is correctly suppressed (`SbcNode.tsx:392`). Good.
- No deprecated badge (only `type === "block"` gets one, `SbcNode.tsx:279`). Correct.

Ports (resolved via `portEndpointsForNode("outbound","vmess",…)`, `portRelationRegistry.ts:196`):
- Inputs: `route` (route-final), `route-rule`, `selector-group`, `urltest-group`, `dns-detour`, `detour-target`, `service-detour`, `rule-set-download` — all correct, matching every way an outbound can be referenced.
- Output: `dial-detour` (relation `outbound-detour`, `portRelationRegistry.ts:106`) — excludes block/selector/urltest/dns, so vmess correctly exposes its own dial `detour`.
- TLS/transport/multiplex correctly are NOT ports (Inspector sections only). No findings.

## 3. Upstream/Downstream Links
Complete and correct; no missing/extra/wrong links.
Inbound references to vmess (it being targeted) are all present in `portRelationRegistry.ts`: route-final (`:93`), route-rule (`:95`), selector (`:103`), urltest (`:104`), dns-server detour (`:105`), outbound→outbound dial detour (`:106`), endpoint detour (`:108`), service ccm/ocm detour (`:109-110`), rule-set download detour (`:111`), ntp detour (`:115`, readonly). vmess's own downstream dial `detour` output = `outbound-detour` (`:106`).
`referenceRegistry.ts:333-334` lists the full outbound reference path set (`/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, `/dns/servers/*/detour`, `/endpoints/*/detour`, `/services/*/detour`, `/route/rule_set/*/download_detour`, `/ntp/detour`, clash/v2ray api) — rename (`:160-163`) and delete (`:181-184`) cascade `outbounds`, `default`, `detour`. `disconnectEdge` handles `outbound-detour`, `route-final`, `route-rule`, `selector`/`urltest` (`commands.ts:1085-1100`). Pass-1's relationship section is satisfied.

## 4. Right Inspector (fields)
Outbound branch `Inspector.tsx:3242`. Shared sections (TLS, Multiplex, V2Ray Transport, Dial) render as `ModuleCard`s via `sharedGroupsForEntity` → `["dial","tls","multiplex","tcp-brutal","v2ray-transport"]` for vmess (`sharedFieldRegistry.ts:178-185`).

| Official field | Req | UI control | State |
|---|---|---|---|
| `server` | yes | text input `Inspector.tsx:3376-3383` | OK (no required marker/validation — minor) |
| `server_port` | yes | number input `:3385-3413` | OK (>0 guard; no default for vmess, blank ok) |
| `uuid` | yes | SensitiveTextField (masked) + Generate UUID `:3428-3447` | OK; diagnostics for missing/invalid `diagnostics.ts:682-700` |
| `security` | — `auto` | select w/ auto,none,zero,aes-128-gcm,chacha20-poly1305,aes-128-ctr(legacy) `:3692-3706` | OK, default auto, legacy marked |
| `alter_id` | — `0` | none → AdvancedScalarFields number input `:4210` | P1: not first-class, no AEAD/legacy label (diag exists `:701-708`) |
| `global_padding` | — | none → AdvancedScalarFields checkbox `:4210` | P2: works but unlabelled, no tooltip |
| `authenticated_length` | — | none → AdvancedScalarFields checkbox `:4210` | P2: works but unlabelled, no tooltip |
| `network` | — both | select: ""(both)/tcp/udp `:3415-3427` | OK; empty omits field (both) |
| `tls` | — | TLS ModuleCard `:1502-1557` | OK (full outbound TLS shape) |
| `packet_encoding` | — `""` | select: ""(disabled)/packetaddr/xudp `:3992-4004` | OK |
| `multiplex` | — | Multiplex + TCP Brutal ModuleCards `:1559-1576` | OK (enabled/protocol/max_conn/min+max_streams/padding/brutal) |
| `transport` | — | V2Ray Transport ModuleCard `:1578-1587` | P1: only type/host/path/service_name/idle_timeout/ping_timeout — see findings |
| dial fields | — | Dial ModuleCard `:1476-1500` | OK (detour as outbound select, + all dial fields) |

Writes go through `updateEntityField` (`commands.ts:850-854`); enums use `value || undefined` so clearing omits the key (no invalid `""` writes). Nested tls/multiplex/transport patched via `nestedPatch` (`Inspector.tsx:1394`) — valid JSON objects, no raw-JSON-only path for normal fields. No UI field exists that is absent from the official model.

## Findings (prioritized)
- [P1] `transport` editor is incomplete for ws/httpupgrade. `Inspector.tsx:1578-1587` only defines `type,host,path,service_name,idle_timeout,ping_timeout`. Missing per shared/v2ray-transport: ws `max_early_data`, `early_data_header_name`, `headers`, `method` (http); `httpupgrade` `headers`. Users on WebSocket transport cannot set early-data fields or custom headers from structured UI (they survive via Advanced JSON only if pre-existing). `host` is rendered as a `list` which is right for http but wrong for httpupgrade (single string) — type-specific fields not driven by `transport.type`.
- [P1] `alter_id` not first-class. Falls to `AdvancedScalarFields` (`Inspector.tsx:4210`) as a bare number input with no AEAD(0)/legacy(>0) explanation inline; the deprecation only appears as a separate diagnostic (`diagnostics.ts:701-708`). Pass-1 asked for an inline control/warning; partially addressed (diag only).
- [P2] `global_padding` / `authenticated_length` render as generic Advanced checkboxes (`Inspector.tsx:4210`) with auto-generated labels and no tooltip about traffic/length-block semantics. Functional but low discoverability for these protocol params.
- [P2] Required-field affordance: `server`, `server_port`, `uuid` have no visible "required" marker in the Inspector (uuid relies on a diagnostic, server/server_port have none). Minor UX/consistency gap vs the official ==Required== markers.

STALE in pass-1 (`docs/ui-reviews/outbound-vmess.md` + `docs/claude/outbound-vmess.md`): the two P0s ("uuid buried in Advanced", "security free-text") and two P1s ("network free-text + default tcp", "packet_encoding free-text", "alter_id warning missing") are all resolved — `outboundHandledFields` now includes uuid/security/network/packet_encoding (`Inspector.tsx:190,193,197,215`), first-class controls exist, and the commands.ts default no longer sets `network` (`commands.ts:312-321`). pass-1 line numbers (Inspector 128-141, 1505-1546) no longer match.

SUMMARY: 0 P0, 2 P1, 2 P2.
