# dns-server-udp — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The UDP DNS server is correct and shippable across all four surfaces for the common case: it is in the palette, scaffolds the right minimal JSON, exposes `server`/`server_port` plus the full Dial Fields set, and a missing `server` now raises an error diagnostic. Pass-1's two headline P0s (`server_port` falling back to `0`; `domain_resolver` as a bare text input) and its P1 ("12 dial fields fall through to AdvancedScalarFields") are now **STALE** — the code fixes all three. Remaining gaps are secondary: `server` carries no required marker, the `domain_resolver` select cannot author/round-trip the object form, the canvas node summary is thin and draws no resolver edge, and the domain-without-resolver diagnostic is wired for outbounds but not for DNS servers.

## 1. Left Palette

Official taxonomy: `dns.servers[]` entry, `type: "udp"`, since sing-box 1.12.0.

- Entry present: `src/components/Palette.tsx:87` — `{ label: "UDP Server", kind: "dns-udp", icon: Server, docsUrl: docs("dns/server/udp/"), status: "setup" }`. Label, category (DNS group), and docsUrl are correct.
- Default action: `status: "setup"` → `canActivate` true (`Palette.tsx:279-287`), click calls `createFromPalette("dns-udp")`. Correct; matches sibling new-format servers (tcp/tls/quic).
- Gating: kind→type map `protocols.ts:95` (`"dns-udp": "udp"`) and `CREATABLE_DNS_SERVER_TYPES` includes `"udp"` (`protocols.ts:111-120`). Preferred tag `udp-dns` (`protocols.ts:198`). No platform/build-tag gate — correct (UDP is universal). No issues.

## 2. Canvas Node

- Titlebar: `SbcNode.tsx:291` renders `dns-server / udp`. Title = tag, subtitle from graph. OK.
- Subtitle: `graph.ts:543` = `` `${server.type} dns server` `` → "udp dns server". Pass-1/pass-1b both asked the card to summarize `server:port` + detour state; it still does not. Outbounds already do this (`graph.ts:401-403`: `${type} ${server}:${server_port}`). The DNS server lane is strictly less informative. [P2]
- Status: derives from diagnostics on `/dns/servers/<i>` (`graph.ts:544`, `diagnosticStatus`). Missing `server` now errors (see §Diagnostics), so the node correctly turns red. Good.
- Ports/handles (`portEndpointsForNode` + `portRelationRegistry.ts`):
  - Input (left): `dns` final (`dns-final`, line 98), `dns-rule` route server (`dns-rule`, line 101). Correct — a UDP server is the target of `dns.final` and `dns.rules[].server`.
  - Output (right): `outbound` detour (`dns-server-detour`, line 105) → drawn at `graph.ts:551-553`. Correct.
  - The `endpoint`/`service` output ports are type-gated to `tailscale`/`resolved` (lines 107,114), so they do **not** appear on udp. Correct.
  - Missing: no port/handle representing **inbound `domain_resolver` references** (other dial owners — outbounds/endpoints/this server — pointing AT this DNS server by tag). The reference registry tracks `*/domain_resolver` for dns-server (`referenceRegistry.ts:340`) and rename/remove rewrite it, but there is no `PortRelation` and no edge for it, so the dependency is invisible on canvas. [P2]

## 3. Upstream/Downstream Links

Official relationship model for a UDP DNS server: (a) referenced by `dns.final`; (b) referenced by `dns.rules[].server` (route/predefined-ish actions); (c) referenced by route/dns rule `resolve`/`route` actions and by any dial owner's `domain_resolver` / `route.default_domain_resolver`; (d) owns one downstream link via Dial `detour` → outbound.

- `dns-final` (referenceRegistry `/dns/final`, portRelation line 98): present, writable, disconnectable. Correct.
- `dns.rules[].server` (`/dns/rules/*/server`, portRelation line 101, edge `graph.ts:606-608` gated to action `""|route|evaluate`): present. Correct.
- Dial `detour` → outbound (`/dns/servers/*/detour`, portRelation line 105, edge `graph.ts:551-553`, rename/remove `referenceRegistry.ts:165,186`): present and fully wired. Correct.
- `domain_resolver` / `route.default_domain_resolver` pointing at this server: tracked for rename/remove (`referenceRegistry.ts:340`, `replaceDnsServerRefs`/`removeDnsServerRefs` 225-253) — good for integrity — but **not** surfaced as a port relation or canvas edge. So this inbound reference class is invisible. [P2]
- No extra/wrong links found for udp. The `dns-server-endpoint`/`dns-server-service` relations are correctly type-excluded from udp.

## 4. Right Inspector (fields)

dns-server branch begins `Inspector.tsx:4215`; shared Dial card via `sharedGroupsForEntity` (`sharedFieldRegistry.ts:187-191` → `["dial"]` for udp; TLS correctly NOT added) rendered by `sharedFieldDefinitions` group `"dial"` (`Inspector.tsx:1476-1500`).

| Official field | Req | Default | UI state | Verdict |
|---|---|---|---|---|
| `type` (="udp") | fixed | — | select over `CREATABLE_DNS_SERVER_TYPES` (`2128-2134`); changing type re-scaffolds (`commands.ts:925`) | OK |
| `tag` | yes | — | text, commit-on-blur `renameTag` (`2094-2107`); **no required marker** | minor [P2] |
| `server` | **yes** | — | text input (`4278-4286`); **no required marker / aria-required**, though empty → error diagnostic | [P1] |
| `server_port` | no | `53` | number; default-by-type 53 for udp, omits (writes `undefined`) when empty/≤0 (`4287-4315`) | OK — pass-1 P0 STALE |
| `detour` | no | — | select over outbound tags (`1478`) | OK |
| `bind_interface` | no | — | text (`1479`) | OK |
| `inet4_bind_address` | no | — | text (`1480`) | OK — pass-1 P1 STALE |
| `inet6_bind_address` | no | — | text (`1481`) | OK |
| `bind_address_no_port` | no | — | boolean (`1482`) | OK |
| `routing_mark` | no | — | text (`1483`); hex/int both legal, text is acceptable | OK |
| `reuse_addr` | no | — | boolean (`1484`) | OK |
| `netns` | no | — | text (`1485`) | OK |
| `connect_timeout` | no | — | text (`1486`) | OK |
| `tcp_fast_open` | no | — | boolean (`1487`) | OK |
| `tcp_multi_path` | no | — | boolean (`1488`) | OK |
| `disable_tcp_keep_alive` | no | — | boolean (`1489`) | OK |
| `tcp_keep_alive` | no | `5m` | text (`1490`) | OK |
| `tcp_keep_alive_interval` | no | `75s` | text (`1491`) | OK |
| `udp_fragment` | no | — | boolean (`1492`) | OK |
| `domain_resolver` | no (req 1.14 if `server` is domain) | — | **select** over dns-server tags (`1493`); coerces to string only → object form `{server,...}` cannot be authored and an imported object value renders as None and may be clobbered | [P1] nested-object handling |
| `network_strategy` | no | — | select default/hybrid/fallback (`1494`) | OK (mobile-only, not gated — minor) |
| `network_type` | no | — | list (`1495`) | OK |
| `fallback_network_type` | no | — | list (`1496`) | OK |
| `fallback_delay` | no | `300ms` | text (`1497`) | OK |
| `domain_strategy` (deprecated) | no | — | text, labeled "(deprecated 1.12+)" (`1498`) | OK |

No UI fields exist that are absent from the official udp model (the `address`/`path`/`endpoint`/`service`/`prefer_go` blocks are all `"<field>" in entity` / type-gated, so they never render for udp). No invalid-JSON write path on this node (the dial select/text controls coerce empties to `undefined`; the only free-JSON editors — `AdvancedScalarFields`/`JsonField` — receive nothing for a clean udp object). Sensitive-masking: N/A (udp has no secrets).

## Findings (prioritized)

- [P1] `src/components/Inspector.tsx:4278-4286` — `server` is `==Required==` upstream but rendered with no required marker/`aria-required` and no placeholder. The empty-server error diagnostic exists (`diagnostics.ts:1034-1046`), so this is UX/affordance, not data-loss. Add a required indicator (consistent with how the node is the only place server is set).
- [P1] `src/components/Inspector.tsx:1493` + `1664-1681` — `domain_resolver` select stores a plain string only. Upstream allows the object form (route-rule-action shape minus `action`). Authoring the object form is impossible, and importing a config whose `domain_resolver` is an object shows "None" and a stray edit will overwrite the object with a bare tag. Provide an object-aware control (or at minimum preserve/show the object and offer an advanced JSON escape hatch).
- [P1] `src/domain/diagnostics.ts:441-452` — the "domain server without `domain_resolver`" warning iterates `outbounds` only. A UDP DNS server with a domain-name `server` and no `domain_resolver` (and no `route.default_domain_resolver`, when >1 DNS server) gets **no** warning, yet sing-box 1.14 requires resolution. Extend the same `looksLikeDomain(server) && !resolverPresent(domain_resolver)` check to `config.dns.servers` (path `/dns/servers/<i>/domain_resolver`). Pass-1 raised this; it is still unaddressed.
- [P2] `src/canvas/graph.ts:543` — node subtitle is `"udp dns server"`; does not surface `server:server_port` or detour state (outbounds already do, `graph.ts:401-403`). Low-effort parity win.
- [P2] `src/domain/portRelationRegistry.ts` (no entry) + `src/canvas/graph.ts:531-572` — inbound `domain_resolver` references to this DNS server are tracked for rename/remove (`referenceRegistry.ts:340`) but not drawn as a port/edge, so the dependency is invisible on canvas. Pass-1's "canvas does not visualize domain_resolver" remains valid.
- [P2] `src/components/Inspector.tsx:2094-2107` — `tag` has no required marker (shared across all node kinds, not udp-specific).

Stale pass-1 items (now fixed in code; flag the pass-1 doc): `server_port ?? 0` P0 (now defaults 53 and omits on empty, `Inspector.tsx:4287-4315`); `domain_resolver` bare-text P0 (now a select, `1493`); "12 dial fields fall through to AdvancedScalarFields" P1 (now fully enumerated in `dialSharedFields` `116-138` and `sharedFieldDefinitions` dial group `1476-1500`); deprecated `domain_strategy` "not flagged" P1 (now labeled deprecated, `1498`); "missing-server not surfaced" — now an error diagnostic (`diagnostics.ts:1034-1046`).

SUMMARY: 0 P0, 3 P1, 3 P2.
