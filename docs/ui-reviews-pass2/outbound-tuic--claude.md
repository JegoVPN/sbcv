# outbound-tuic — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The TUIC outbound is now in strong shape: a dedicated Inspector block exposes every protocol-specific field with correct controls (enum selects, sensitive-masked UUID/password + Generate, mutual-exclusion logic), the default template seeds `tls.enabled` and omits `network`, and diagnostics cover server_port, required TLS, and the udp_relay_mode↔udp_over_stream conflict. The pass-1 review (`docs/ui-reviews/outbound-tuic.md`) is now almost entirely STALE — its two P0s (tls missing from template; uuid/password buried in Advanced) and two P1s (network:"udp" seeding; enum selects missing) are all FIXED. Two real gaps remain: the TUIC `uuid` (Required) has no missing/format diagnostic, and the `udp-over-tcp` shared card writes a `udp_over_tcp` object that is NOT a field in the TUIC outbound schema.

## 1. Left Palette
`src/components/Palette.tsx:165` — `{ label: "TUIC", kind: "tuic-out", icon: Plug, docsUrl: docs("outbound/tuic/"), status: "setup" }`.
- Category Outbounds, label "TUIC", docs URL all correct.
- `status: "setup"` → `canActivate` true (Palette.tsx:279-287), so it click-creates a seeded draft via `createFromPalette`. Consistent with other proxy outbounds (hysteria2, anytls, vless). Good.
- `icon: Plug` shared with QUIC family (hysteria/hysteria2/inbound-tuic) — acceptable, no unique-identity requirement.
- No version gate needed; upstream documents no minimum version for TUIC. Correct.

## 2. Canvas Node
`src/canvas/graph.ts:383-433` (generic outbound node builder).
- Title = tag (`tuic-out`); subtitle = `tuic 127.0.0.1:1080` via the `outbound.server` branch (graph.ts:401-402). Correct and informative.
- Status badge is diagnostic-driven (`diagnosticStatus("/outbounds/{i}")`, graph.ts:404) — semantic validity, not binary validation. Correct.
- `compatible` chips empty for TUIC (only populated for selector/urltest groups, graph.ts:405-428). Correct — TUIC is a leaf proxy, not a group.
- Ports (see §3). TLS is an Inspector section, not a port. Correct. No TUIC-specific canvas behavior needed.

## 3. Upstream/Downstream Links
TUIC `type="tuic"` is a leaf proxy outbound (not in any relation `nodeTypeExcludes`). Verified against `src/domain/portRelationRegistry.ts:90-116` and reference scanning in `src/components/SbcNode.tsx:162-188,255-259`.

Inbound ports (TUIC referenced as a target tag) — all present & correct:
- route final — `route-final` (portRelationRegistry.ts:93)
- route rule outbound — `route-rule` (:95)
- selector candidate — `selector` (:103)
- urltest candidate — `urltest` (:104)
- DNS server detour — `dns-server-detour` (:105)
- another outbound's dial detour target — `outbound-detour` target endpoint (:106)
- endpoint dial detour target — `endpoint-detour` (:108)
- service (ccm/ocm) detour — `service-detour-ccm`/`-ocm` (:109-110)
- rule-set download detour — `rule-set-download` (:111)
- NTP detour target — `settings-ntp-detour` (:115)

Outbound port (TUIC's own dial `detour` output):
- `outbound-detour` source endpoint `dial-detour`, excludes `["block","selector","urltest","dns"]` (:106) — TUIC is NOT excluded, so it correctly exposes the downstream dial-detour output.

Missing/extra/wrong: NONE. The relationship model matches the official model exactly (TUIC has no DNS-route-action ownership, no group membership output). Pass-1's port list (which omitted endpoint/service/rule-set/NTP detour inputs) was incomplete but not wrong; current registry is complete.

## 4. Right Inspector (fields)
Outbound block `src/components/Inspector.tsx:3242-4212`; dedicated TUIC block at :4005-4067; shared cards via `sharedGroupsForEntity` → `SharedFieldCards` (:5343-5350). `outboundHandledFields` (:178-240) now includes uuid, password, congestion_control, network, udp_relay_mode, udp_over_stream, heartbeat, zero_rtt_handshake — so none fall through to the Advanced accordion.

| Official field | Req | UI control | Status |
|---|---|---|---|
| `server` | yes | text, `"server" in entity` (:3376-3384) | OK |
| `server_port` | yes | number, default-port hints (:3385-3414) | OK; no default for tuic (blank), validation via diagnostics |
| `uuid` | yes | `SensitiveTextField` + Generate UUID (:3428-3448, gated vmess/vless/tuic) | OK control; **no missing/invalid diagnostic** (see P1) |
| `password` | no | `SensitiveTextField` (:3467-3473, incl. tuic) | OK; masked. Rendered once for tuic |
| `congestion_control` | no, def `cubic` | select cubic/new_reno/bbr, defaults to cubic (:4007-4017) | OK |
| `udp_relay_mode` | no, def `native` | select ""/native/quic; clears udp_over_stream on set (:4018-4034) | OK |
| `udp_over_stream` | no, def false | toggle; clears udp_relay_mode when checked (:4035-4047) | OK; bidirectional mutual-exclusion |
| `zero_rtt_handshake` | no, def false | toggle (:4056-4065) | OK |
| `heartbeat` | no | text, placeholder `10s` (:4048-4055) | OK |
| `network` | no, def both | select both/tcp/udp (:3415-3427) | OK; "" = both (omitted) |
| `tls` | **yes** | shared TLS card (outboundTlsTypes has tuic, sharedFieldRegistry.ts:151) | OK; required enforced by diagnostics |
| QUIC fields | — | shared QUIC card (outboundQuicTypes has tuic, :152) | Partial — see P2 (extra idle_timeout/keep_alive_period) |
| Dial fields | — | shared Dial card (:178-179) | OK; `detour` is a tag select (Inspector.tsx:1478) |
| `udp_over_tcp` (NOT a TUIC field) | n/a | shared UDP-over-TCP card writes `{enabled,version}` (:1589-1593) | **EXTRA — invalid field, see P1** |

Default template `src/domain/commands.ts:377-388`: server, server_port:1080, uuid (placeholder), password "change-me", congestion_control "cubic", udp_relay_mode "native", `tls:{enabled:true,server_name:""}`. No `network` key (both). Matches upstream defaults; TLS-required satisfied.

## Findings (prioritized)

[P1] TUIC `uuid` (Required) has NO missing/invalid-format diagnostic. `src/domain/diagnostics.ts:680-771` validates outbound uuid only for vmess (:682-700) and vless (:711-716); the `tuic` block (:760-770) only checks the udp mode conflict. A TUIC outbound with empty or malformed `uuid` exports silently and sing-box will reject it. Add a tuic uuid missing(error)/format(warning) check mirroring vless, reusing `uuidPattern` (:639).

[P1] `udp-over-tcp` shared card is an EXTRA field not in the TUIC outbound schema. `src/domain/sharedFieldRegistry.ts:155,184` lists `tuic` in `outboundUdpOverTcpTypes`, so the Inspector renders a "UDP over TCP" card writing `udp_over_tcp:{enabled,version}` (`src/components/Inspector.tsx:1589-1593`). The upstream doc (`docs/upstream/.../outbound/tuic.md:71-80`) has NO `udp_over_tcp` object — TUIC's equivalent is the scalar boolean `udp_over_stream` (already handled at Inspector.tsx:4035). Writing `udp_over_tcp` produces an invalid TUIC config. Remove `"tuic"` from `outboundUdpOverTcpTypes` (keep socks/shadowsocks/naive).

[P2] QUIC shared card exposes two fields absent from the upstream QUIC shared doc. `src/components/Inspector.tsx:1554-1555` adds `idle_timeout` and `keep_alive_period`; `docs/upstream/.../shared/quic.md:9-30` lists only `initial_packet_size`, `disable_path_mtu_discovery`, then HTTP2 Fields. For TUIC these two keys are not valid top-level QUIC fields. Cross-cutting (affects hysteria/hysteria2 too), so P2; scope the QUIC card to the two documented fields or move idle_timeout/keep_alive_period to the owners that actually support them.

[P2] Pass-1 doc is stale and should be marked superseded. `docs/ui-reviews/outbound-tuic.md` P0 "tls absent from default template" — FIXED (commands.ts:387). P0 "uuid/password buried in Advanced" — FIXED (Inspector.tsx:3428-3473 + handled fields). P1 `network:"udp"` seeding — FIXED (no network key in commands.ts:377-388). P1 enum selects missing — FIXED (Inspector.tsx:4007-4034). P1 conflict not surfaced — FIXED in both UI (:4022-4044) and diagnostics (:762-769). Only the missing-uuid-diagnostic concern survives.

SUMMARY: 0 P0, 2 P1, 2 P2.
