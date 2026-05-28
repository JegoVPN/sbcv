# dns-server-tcp — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The TCP DNS server is in good shape: both own fields (`server`, `server_port`) and all 21 Dial Fields are now exposed with correct controls, and the two prior P0/P1 diagnostics (missing `server`, domain-without-resolver) are now implemented. The pass-1 review is substantially STALE — it claimed only 8 of 20 dial fields were wired and that no required/resolver diagnostics existed; all of that is now fixed. The only remaining real gaps are: no canvas edge for `domain_resolver`→DNS-server references (link-graph blind spot), the `domain_resolver` control cannot express the object form, and no required marker on the `server` input.

Single source of truth: `docs/upstream/sing-box/testing/configuration/dns/server/tcp.md` (+ `shared/dial.md`). Official model = 2 own fields + 21 dial fields (incl. deprecated `domain_strategy`). Available since sing-box 1.12.0.

## 1. Left Palette

`src/components/Palette.tsx:86` — `{ label: "TCP Server", kind: "dns-tcp", icon: Server, docsUrl: docs("dns/server/tcp/"), status: "setup" }`.

- Present: yes, in the DNS group. Label "TCP Server", correct docs URL `dns/server/tcp/`.
- Category correct (DNS). `status: "setup"` → "Setup" badge, consistent with peer remote DNS servers (udp/tls/quic/h3). `canActivate` allows `setup` to create (`Palette.tsx:279`). Action wires to `createFromPalette("dns-tcp")` → `protocols.ts:94` maps `dns-tcp`→`tcp`.
- Gating: none. Correct — TCP server has no build-tag/platform/channel constraint (unlike `mdns` gated, `resolved`/`tailscale` banner-gated). No issue.

## 2. Canvas Node

`src/canvas/graph.ts:531-572`, render `src/components/SbcNode.tsx`.

- `title` = tag (`graph.ts:542`); `subtitle` = `"tcp dns server"` (`graph.ts:543`); `status` from `diagnosticStatus("/dns/servers/{index}")` (`graph.ts:544`); `compatible: []` (`graph.ts:545`, intentional — no quick-create downstream).
- Titlebar shows `dns-server / tcp` (`SbcNode.tsx:291`, hardcoded `${data.kind} / ${data.type}`). Pass-1's "shows dns-server / tcp" is accurate for the titlebar; `data.title` (the tag) is shown separately in the card body (`SbcNode.tsx:388`). Cosmetic only.
- Ports (via `portRelationRegistry` + `portEndpointsForNode`): for `dns-server` type `tcp`:
  - Inputs: `dns` (DNS final server, rel `dns-final`), `dns-rule` (DNS rule, rel `dns-rule`). Correct.
  - Outputs: `outbound` (Detour outbound, rel `dns-server-detour` → `/dns/servers/*/detour`). Correct.
  - `endpoint`/`service` outputs are type-gated to `tailscale`/`resolved` and correctly absent for tcp (`portRelationRegistry.ts:107,114`). No spurious ports.
- `isPortConnected` for `dns-server`/`outbound` reads `server.detour` (`SbcNode.tsx:246-248`); inputs read `dns.final`/`dns.rules[].server` (`SbcNode.tsx:147-150`). All correct.

## 3. Upstream/Downstream Links

Official relationship model for a tcp DNS server: (a) referenced by `dns.final`; (b) referenced by `dns.rules[].server` (route action); (c) referenced by route `resolve` action `server`; (d) referenced by any dialer's `domain_resolver` and by `route.default_domain_resolver` (string shorthand = a DNS server tag — `shared/dial.md` line 184); (e) its own `detour` → outbound. (Endpoint/service links only for tailscale/resolved, N/A for tcp.)

`referenceRegistry.ts` (rename/delete bookkeeping): kind `dns-server` covers `/dns/final`, `/dns/rules/*/server`, `/route/default_domain_resolver`, `*/domain_resolver` (`referenceRegistry.ts:340`, handles string + `{server}` object via `replaceResolverField`). Complete and correct — no missing refs for delete/rename.

`portRelationRegistry.ts` / `graph.ts` (canvas edges) — gaps:
- **Missing edge: `domain_resolver` → DNS server.** No port relation exists (grep: zero `domain_resolver` in `portRelationRegistry.ts`/`SbcNode.tsx`/`graph.ts`), and `graph.ts:531-572` emits edges only for `detour`, tailscale `endpoint`, and resolved `service`. So when DNS-server-A's `domain_resolver` points at DNS-server-B (a real, common relationship the Inspector itself offers via a select at `Inspector.tsx:1493`), the canvas shows NO edge. Rename/delete still works (registry), but the visual graph is blind to it. [P1]
- **Missing edge: route `resolve` action `server` and `route.default_domain_resolver` → DNS server.** Route-rule `resolve.server` (`Inspector.tsx:1086`) and `route.default_domain_resolver` (`Inspector.tsx:1459`) both reference DNS servers; neither produces a canvas edge into the dns-server node. [P2]
- No extra/wrong links found. The `dns-final`, `dns-rule`, and `dns-server-detour` relations are correct and bidirectionally consistent with `isPortConnected`.

Pass-1 narrated these resolver relationships in prose but did not flag the missing canvas edges as defects — now flagged explicitly.

## 4. Right Inspector (fields)

Render path: explicit dns-server block `Inspector.tsx:4215-4360` (Server, Port, type-specific) + Type select `Inspector.tsx:2128-2140` + shared `dial` group via `sharedGroupsForEntity` (`sharedFieldRegistry.ts:187-188`; tcp ∈ `dnsServerDialTypes`) rendered by `SharedFieldCards`/`SharedFieldControl` (`Inspector.tsx:1695-1740`, defs `1476-1500`). All values round-trip; unhandled scalars/objects fall to `AdvancedScalarFields`/`AdvancedNonScalarFields` (handled set `dnsServerHandledFields` includes all dial fields, `Inspector.tsx:241-260`).

| Official field | Req | Default | UI control | Validation / notes | State |
|---|---|---|---|---|---|
| `type` | yes | tcp | select of CREATABLE_DNS_SERVER_TYPES (`2128`) | type-switch preserves detour (`commands.ts:921-933`) | OK |
| `tag` | yes | `tcp-dns` (`protocols.ts:194`) | text (common header) | uniqueness/refs handled by registry | OK |
| `server` | **Required** | `1.1.1.1` (`commands.ts:617`) | text (`4278-4286`) | diagnostic `dns-server-missing-server` fires for tcp (`diagnostics.ts:1034-1045`) | OK, but no required marker — [P2] |
| `server_port` | no | `53` | number, placeholder/default 53 for tcp (`4287-4315`) | clears when ≤0/NaN | OK |
| `detour` | — | — | select of outbound tags (`1478`) | drives canvas edge; correct | OK |
| `bind_interface` | — | — | text (`1479`) | | OK |
| `inet4_bind_address` | — | — | text (`1480`) | | OK |
| `inet6_bind_address` | — | — | text (`1481`) | | OK |
| `bind_address_no_port` | 1.13 | false | boolean (`1482`) | label notes Linux/1.13 | OK |
| `routing_mark` | — | — | text (`1483`) | int or hex string — text is fine | OK |
| `reuse_addr` | — | false | boolean (`1484`) | | OK |
| `netns` | 1.12 | — | text (`1485`) | label notes Linux/1.12 | OK |
| `connect_timeout` | — | — | text (`1486`) | Go duration; no format validation | OK (minor) |
| `tcp_fast_open` | — | false | boolean (`1487`) | | OK |
| `tcp_multi_path` | — | false | boolean (`1488`) | | OK |
| `disable_tcp_keep_alive` | 1.13 | false | boolean (`1489`) | | OK |
| `tcp_keep_alive` | 1.13 | 5m | text (`1490`) | | OK |
| `tcp_keep_alive_interval` | 1.13 | 75s | text (`1491`) | | OK |
| `udp_fragment` | — | false | boolean (`1492`) | | OK |
| `domain_resolver` | 1.12 | — | **select** of DNS server tags (`1493`) | writes string only; cannot express `{server,strategy,client_subnet}` object form (`shared/dial.md:182`); coerce returns string (`1627-1632`) | partial — [P1] |
| `network_strategy` | 1.11 | default | select default/hybrid/fallback (`1494`) | mobile-only (not surfaced) | OK |
| `network_type` | 1.11 | — | list (`1495`) | mobile-only | OK |
| `fallback_network_type` | 1.11 | — | list (`1496`) | mobile-only | OK |
| `fallback_delay` | 1.11 | 300ms | text (`1497`) | mobile-only | OK |
| `domain_strategy` | **deprecated** | — | text (`1498`, labeled "deprecated 1.12+") | deprecation diagnostic at `diagnostics.ts:1515-1524` | OK |

Coverage: all 23 official keys (type+tag+server+server_port + 19 active dial + deprecated domain_strategy) exposed. No invalid-JSON write paths for tcp (no JSON textareas in the tcp path). No UI fields absent from the official model. Sensitive-masking N/A (tcp server has no secret fields).

## Findings (prioritized)

- **[P1]** Canvas has no edge for `domain_resolver` → DNS-server references. `portRelationRegistry.ts` (no such relation) + `src/canvas/graph.ts:531-572` (only detour/endpoint/service edges). The Inspector lets users point a dns-server's `domain_resolver` at another dns-server (`Inspector.tsx:1493`) but the graph never visualizes it; users cannot see/disconnect the link on canvas. Add a `dns-server`→`dns-server` (and dialer→dns-server) port relation + edge emission.
- **[P1]** `domain_resolver` control supports only the string shorthand, not the object form `{ server, strategy, client_subnet, ... }` (`Inspector.tsx:1493` select; `coerceSharedFieldValue` returns a bare string, `Inspector.tsx:1627-1632`). Object-form configs imported from JSON survive (registry preserves), but cannot be created/edited in the UI and a select renders blank for an existing object value. Add a structured editor or JSON-object fallback for the object case.
- **[P2]** `server` input has no required marker/asterisk despite `==Required==` (`Inspector.tsx:4278-4286`). The diagnostic catches emptiness post-hoc, but the field should signal "required" before the user leaves it blank.
- **[P2]** Route `resolve` action `server` and `route.default_domain_resolver` references to this DNS server are not visualized as canvas edges (`graph.ts` emits no such edges). Lower priority than the dialer `domain_resolver` link.
- **[P2]** Canvas titlebar exposes the internal `dns-server / tcp` string (`SbcNode.tsx:291`) rather than the friendly "TCP Server" label; tag is shown separately so this is cosmetic only.
- **[P2]** `connect_timeout`/`tcp_keep_alive*`/`fallback_delay` accept any text with no Go-duration format validation (`Inspector.tsx:1486,1490,1491,1497`). Minor; sing-box will reject malformed values at load.

Stale pass-1 notes (now fixed, for the record): "8 of 20 dial fields wired / 12 fall to AdvancedScalarFields" — now all 21 dial fields have labeled controls (`Inspector.tsx:1476-1500`). "No `dns-server-missing-server` diagnostic" — now exists (`diagnostics.ts:1034-1045`). "No domain-without-resolver diagnostic" — now exists (`diagnostics.ts:1137-1144`). "`domain_resolver` is a plain text input" — now a DNS-server-tag select (`Inspector.tsx:1493`).

SUMMARY: 0 P0, 2 P1, 4 P2.
