# outbound-hysteria — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The hysteria v1 outbound is now in good shape and pass-1 is almost entirely stale: TLS is in the default skeleton, a deprecation banner + Palette "Legacy" badge + `hysteria-v1-deprecated` diagnostic all exist, and `server`/`port`/`up_mbps`/`down_mbps`/`auth_str`/`obfs`/`network` all have first-class controls with matching tests. The remaining real gaps are narrow: `server_ports`/`hop_interval` (1.12.0+) have first-class controls only for hysteria2 (v1 drops them into Advanced), the QUIC card omits the HTTP2/recv-window replacement fields, and there is no diagnostic for `server_port`↔`server_ports` exclusivity or for the deprecated `recv_window*`/`disable_mtu_discovery` fields on v1.

## 1. Left Palette
Present and correct. Entry `src/components/Palette.tsx:162` `{ label: "Hysteria", kind: "hysteria-out", icon: Plug, docsUrl: docs("outbound/hysteria/"), status: "setup" }` under the "Outbounds" group. `kind` maps to type `hysteria` via `OUTBOUND_PALETTE_TYPES` (`src/domain/protocols.ts:11`). It is force-flagged deprecated: `deprecatedKinds` includes `"hysteria-out"` (`Palette.tsx:252-256`), so `itemStatus` returns `"deprecated"` → label renders "Legacy" (`Palette.tsx:248`) with title "...deprecated by sing-box..." (`Palette.tsx:274`) and is still clickable/creatable (`canActivate`, `Palette.tsx:279-287`). Test confirms (`tests/app.test.tsx:2097-2098`). No channel gate — correct, v1 is valid in stable+testing. Pass-1 claim "no deprecation badge / no visual distinction" is STALE.

## 2. Canvas Node
Driven by `src/canvas/graph.ts:383-433`. Title = tag (`graph.ts:395`); subtitle = `hysteria <server>:<server_port>` (`graph.ts:401-402`) — good, shows the live endpoint. Status from diagnostics (`graph.ts:404`), so a missing-TLS/port error turns the node red. Node renders `outbound / hysteria` in the titlebar (`src/components/SbcNode.tsx:291`).
Gap: the canvas "deprecated" badge is hardcoded to `type === "block"` only (`SbcNode.tsx:279`, `292-296`); a hysteria v1 node shows NO legacy badge on-canvas even though the Palette and Inspector both do. Minor inconsistency.
Ports (correct per sing-box semantics): a non-group, non-excluded outbound exposes INPUT ports `route` (route final), `route-rule` (rule outbound), `selector-group`, `urltest-group`, `dns-detour`, `detour-target`, `service-detour`, `rule-set-download`, and one OUTPUT port `dial-detour` (its own Dial `detour`). hysteria is correctly NOT in the `dial-detour` source excludes `["block","selector","urltest","dns"]` (`src/domain/portRelationRegistry.ts:106`) and is NOT a member source (selector/urltest only). TLS is an Inspector section, not a port — correct.

## 3. Upstream/Downstream Links
Matches the official relationship model. Referenced-by (inputs) and own dial detour (output) are all represented in `portRelationRegistry.ts` and mirrored in `referenceRegistry.ts:333-337` (`outbound` paths: `/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, `/dns/servers/*/detour`, `/endpoints/*/detour`, `/services/*/detour`, `/route/rule_set/*/download_detour`, `/ntp/detour`, v2ray/clash UI detour). `disconnectEdge` handles `outbound-detour` and all upstream relations (`commands.ts:1094-1100`, etc.). Rename/delete cascade via `replaceOutboundRefs`/`removeOutboundRefs` (`referenceRegistry.ts:157-197`). No missing, extra, or wrong links found for hysteria.

## 4. Right Inspector (fields)
Outbound block at `src/components/Inspector.tsx:3242+`; hysteria-specific controls at `3370-3375` (banner) and `3415-3427` (network) and `3474-3526` (auth/bandwidth/obfs). TLS/Dial/QUIC cards via `SharedFieldCards` (`Inspector.tsx:5343`), gated by `sharedGroupsForEntity` → outbound `hysteria` gets `dial`,`tls`,`quic` (`src/domain/sharedFieldRegistry.ts:178-185`, `outboundQuicTypes`/`outboundTlsTypes` include `hysteria`).

| Official field | Req | UI state |
|---|---|---|
| `server` | Yes | Text input, gated `"server" in entity` (`Inspector.tsx:3376-3384`). In skeleton (`commands.ts:348`). OK. |
| `server_port` | Yes | Number input w/ validation `>0` (`Inspector.tsx:3385-3414`). Diagnostic enforces 1–65535 (`diagnostics.ts:544-553`). In skeleton (`commands.ts:349`). OK. |
| `server_ports` (1.12) | exclusive w/ `server_port` | **Missing first-class control for v1** — block is `entityType === "hysteria2"` only (`Inspector.tsx:3865-3915`). For v1 falls to AdvancedScalarFields (it IS in `outboundHandledFields` `Inspector.tsx:231`, but no labeled control). P1. |
| `hop_interval` (1.12) | No (default 30s) | **Missing first-class control for v1** — hysteria2-only (`Inspector.tsx:3906-3913`). v1 → Advanced. P2. |
| `up` / `down` (string form) | Yes (or _mbps) | No string-form control; only `up_mbps`/`down_mbps`. Imported `up:"100 Mbps"` round-trips via AdvancedScalarFields. Acceptable; minor. |
| `up_mbps` | Yes (or string) | Number input, `>=0`, testid `outbound-hysteria-up-mbps` (`Inspector.tsx:3481-3498`). Test (`app.test.tsx:758`). OK. Pass-1 "buried in Advanced" is STALE. |
| `down_mbps` | Yes (or string) | Number input, `>=0` (`Inspector.tsx:3499-3516`). OK. |
| `obfs` | No | Text input, testid `outbound-hysteria-obfs` (`Inspector.tsx:3517-3524`). Test (`app.test.tsx:760`). OK. Pass-1 "no control" is STALE. |
| `auth_str` | No | `SensitiveTextField` "Auth (string)" masked w/ reveal (`Inspector.tsx:3476-3480`). In skeleton (`commands.ts:352`). Test asserts type=password (`app.test.tsx:1676-1677`). OK. |
| `auth` (base64) | No | **No control**; `auth` NOT in `outboundHandledFields` so if imported it shows in AdvancedScalarFields (and would be sensitive-masked via name match? "auth" not in `SENSITIVE_FIELD_PATTERNS` `Inspector.tsx:620-632` → rendered as plain text). Minor P2: base64 auth secret unmasked in Advanced. |
| `network` | No (both default) | `<select>` both/tcp/udp (`Inspector.tsx:3415-3427`); writes `undefined` for both. OK. Pass-1 "raw text" is STALE. |
| `tls` | **Yes** | Shared TLS card (`Inspector.tsx:1509-1547`): enabled/server_name/insecure/alpn/min-max/reality/ech/etc. Skeleton seeds `tls:{enabled:true,server_name:""}` (`commands.ts:353`). Missing-TLS diagnostic fires if disabled (`diagnostics.ts:555-569`, `hysteria` in `tlsRequiredOutboundTypes` `:514-522`). OK. Pass-1 "missing tls in skeleton" is STALE. |
| QUIC fields | No | QUIC card renders `initial_packet_size`,`disable_path_mtu_discovery`,`idle_timeout`,`keep_alive_period` (`Inspector.tsx:1550-1556`). **Missing** the HTTP2 fields the QUIC doc pulls in (`stream_receive_window`,`connection_receive_window`,`max_concurrent_streams`) — these are the upstream replacements for the deprecated `recv_window*`. P1. |
| `recv_window_conn` (dep 1.14) | Deprecated | No control + **no deprecation diagnostic**; imported value → Advanced silently. P2. |
| `recv_window` (dep 1.14) | Deprecated | Same as above. P2. |
| `disable_mtu_discovery` (dep 1.14) | Deprecated | Same; rendered as a bare checkbox in Advanced, no migration hint. P2. |
| Dial fields | — | Shared Dial card (`Inspector.tsx:1476-1500`), detour as outbound select. OK. |

No invalid-JSON writes found in the hysteria path (number coercion guards present at `3406-3408`, `3487-3494`, `3505-3512`). No UI-only fields absent from the official model.

## Findings (prioritized)
- **[P1]** `server_ports` has no first-class control for hysteria v1 — the labeled control is gated `entityType === "hysteria2"` (`src/components/Inspector.tsx:3865-3915`); v1 users must use Advanced fields for an official 1.12 feature, and there is no exclusivity diagnostic (next item). Generalize the block to `["hysteria","hysteria2"]`.
- **[P1]** No `server_port` ↔ `server_ports` mutual-exclusivity diagnostic for hysteria v1 — the check exists only for hysteria2 (`src/domain/diagnostics.ts:827-836`). Upstream says they conflict for v1 too (`docs/upstream/.../outbound/hysteria.md:59-65`). Add a v1 variant.
- **[P1]** QUIC shared card omits the HTTP2/recv-window replacement fields (`stream_receive_window`, `connection_receive_window`, `max_concurrent_streams`) that the QUIC doc includes (`docs/upstream/.../shared/quic.md:28-30`; `docs/.../shared/http2.md`). Defined for `group === "http2"` (`src/components/Inspector.tsx:1602-1610`) but not merged into the QUIC card (`Inspector.tsx:1550-1556`), so the documented replacements for v1's deprecated recv-window fields are unreachable.
- **[P2]** No diagnostic/migration hint for the deprecated `recv_window_conn`/`recv_window`/`disable_mtu_discovery` on hysteria v1 (`docs/upstream/.../outbound/hysteria.md:136-152`); imported values land in Advanced with no warning (`src/components/Inspector.tsx:675-731`). Add a `hysteria-deprecated-quic-fields` diagnostic mirroring the existing dial/dns deprecation rules.
- **[P2]** Canvas node shows no "legacy/deprecated" badge for hysteria v1 — badge is `type === "block"`-only (`src/components/SbcNode.tsx:279`,`292-296`), inconsistent with Palette + Inspector which both flag v1. Extend `isDeprecated` to cover `outbound/hysteria`.
- **[P2]** `auth` (base64) has no control and is not masked — absent from `outboundHandledFields` (`src/components/Inspector.tsx:178-240`) and not matched by `SENSITIVE_FIELD_PATTERNS` (`Inspector.tsx:620-632`), so an imported base64 auth secret renders as plain text in Advanced. Add `auth` to the hysteria block (or to sensitive patterns), labeled distinctly from `auth_str`.

SUMMARY: 0 P0, 3 P1, 3 P2.
