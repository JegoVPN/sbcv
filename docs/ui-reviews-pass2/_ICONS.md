# Icon / SVG audit
<!-- reviewer: principal designer; users add+drag nodes, so icons must be distinct/correct/intuitive -->

Scope: three icon surfaces, all `lucide-react` (repo ships **no** custom `.svg`).
1. Palette per-entry `icon:` + `templateIcon()` — `src/components/Palette.tsx`.
2. Canvas node icon — `src/components/SbcNode.tsx` `iconMap`(:36-50), `outboundIcon`(:52-58), `getNodeIcon`(:84-86).
3. Port/handle icons — `src/domain/portRelationRegistry.ts` `PortIconId`(:20-33) + per-endpoint literals, rendered via `portIconMap`(`SbcNode.tsx:68-82`) at `SbcNode.tsx:104`.

Key mechanic: the canvas uses `getNodeIcon(kind, type)` (`SbcNode.tsx:84`). For every kind **except** `outbound` it returns `iconMap[kind]` and **ignores `type`** — so all 18 inbound protocols, all DNS-server types, all services, etc. collapse to ONE icon per kind. Outbounds use `outboundIcon(type)`. Palette icons are chosen independently per entry, so palette and canvas frequently disagree.

## Inventory (one row per node/type)

Canvas kinds = `PORT_NODE_KINDS` (`portRelationRegistry.ts:1-15`). Palette `kind`→canvas `(kind,type)` via `protocols.ts` maps (`OUTBOUND_PALETTE_TYPES`:1, `INBOUND_PALETTE_TYPES`:47) and `useProjectStore.createFromPalette`:708.

### Canvas node kinds (what actually renders on the card)
| Canvas kind/type | Canvas icon | Source |
|---|---|---|
| inbound (ALL 18 types) | `RadioTower` | iconMap.inbound :37 — `type` ignored |
| route | `Route` | :38 |
| route-rule | `GitBranch` | :39 |
| dns | `Globe2` | :40 |
| dns-server (ALL types) | `Server` | :41 |
| dns-rule | `GitBranch` | :42 |
| endpoint (wg/tailscale) | `Waypoints` | :43 |
| service (ALL types) | `Server` | :44 |
| outbound / direct | `CheckCircle2` | outboundIcon :53 |
| outbound / block | `Ban` | :54 |
| outbound / selector | `Shuffle` | :55 |
| outbound / urltest | `Database` | :56 |
| outbound / http,socks,ss,vmess,trojan,naive,wireguard,hysteria,shadowtls,vless,tuic,hysteria2,anytls,tor,ssh,dns (16) | `Shield` | fallback :57 |
| rule-set | `Layers3` | :46 |
| certificate-provider | `Shield` | :47 |
| http-client | `Network` | :48 |
| settings | `Braces` | :49 |

### Palette entry vs its canvas icon (selected rows; full match column)
| Palette entry (kind) | Palette icon | Canvas icon | Match? | Notes |
|---|---|---|---|---|
| Templates 1.12 / 1.14 / bypass / other | `RadioTower`/`Globe2`/`GitBranch`/`Blocks` | (loads many nodes) | n/a | templateIcon :55-60; `Blocks` used nowhere else |
| settings-log / -experimental | `Braces` / `FlaskConical` | `Braces` | log Y / exp N | exp settings node still shows `Braces` :49 |
| dns-hub | `Globe2` | dns=`Globe2` | Y | |
| dns-rule | `GitBranch` | dns-rule=`GitBranch` | Y | |
| dns-fakeip (FakeIP) | `Blocks` | (no node / dns-server=`Server`) | N | `Blocks` not in any node/port map |
| dns-legacy / -hosts / -tcp / -udp / -resolved | `Server` | dns-server=`Server` | Y | |
| dns-local (Local Server) | `Globe2` | dns-server=`Server` | **N** | palette Globe2 ≠ canvas Server |
| dns-tls | `Shield` | dns-server=`Server` | **N** | + Shield collides w/ proxies/cert |
| dns-quic | `Plug` | dns-server=`Server` | **N** | |
| dns-https / -h3 / -mdns | `Globe2` | dns-server=`Server` | **N** | |
| dns-dhcp | `Network` | dns-server=`Server` | **N** | + Network collides w/ outbound/http-client |
| dns-fakeip-server | `Blocks` | dns-server=`Server` | **N** | |
| dns-tailscale | `Waypoints` | dns-server=`Server` | **N** | Waypoints collides w/ endpoint |
| inbound-direct | `Cable` | inbound=`RadioTower` | **N** | |
| inbound-mixed / -tun | `RadioTower` | inbound=`RadioTower` | Y | |
| inbound-socks | `Network` | inbound=`RadioTower` | **N** | |
| inbound-http / -naive / -cloudflared | `Globe2` | inbound=`RadioTower` | **N** | |
| inbound-shadowsocks/-vmess/-trojan/-shadowtls/-vless/-anytls | `Shield` | inbound=`RadioTower` | **N** | |
| inbound-hysteria/-tuic/-hysteria2 | `Plug` | inbound=`RadioTower` | **N** | |
| inbound-redirect / -tproxy | `GitBranch` | inbound=`RadioTower` | **N** | + GitBranch collides w/ route/dns-rule |
| direct (Direct out) | `Cable` | outbound/direct=`CheckCircle2` | **N** | palette Cable ≠ canvas validity glyph |
| block | `Ban` | outbound/block=`Ban` | Y | |
| socks (out) | `Network` | outbound→`Shield` | **N** | |
| http-out | `Globe2` | outbound→`Shield` | **N** | |
| ss/vmess/trojan/shadowtls/vless/anytls -out | `Shield` | outbound→`Shield` | Y | but all identical to each other |
| naive-out | `Globe2` | outbound→`Shield` | **N** | |
| wireguard-out | `Waypoints` | outbound→`Shield` | **N** | |
| hysteria/tuic/hysteria2 -out | `Plug` | outbound→`Shield` | **N** | |
| tor-out | `Network` | outbound→`Shield` | **N** | |
| ssh-out | `Server` | outbound→`Shield` | **N** | + Server collides dns-server/service |
| dns-out | `Globe2` | outbound→`Shield` | **N** | |
| selector | `Shuffle` | outbound/selector=`Shuffle` | Y | |
| urltest | `Shuffle` | outbound/urltest=`Database` | **N** | palette Shuffle (=selector) ≠ canvas Database |
| route (Route Hub) | `GitBranch` | route=`Route` | **N** | palette GitBranch ≠ canvas Route icon |
| route-rule / rule-action | `GitBranch` | route-rule=`GitBranch` | Y | |
| route-geoip / -geosite | `Globe2` | (rule-set/route-rule) | varies | |
| rule-set-remote/-local/-inline/etc | `Layers3` | rule-set=`Layers3` | Y | |
| service-derp/-resolved/-ssm/-ccm/-ocm | `Server` | service=`Server` | Y | but identical to dns-server |
| service-hysteria-realm | `Plug` | service=`Server` | **N** | |
| endpoint-wireguard / -tailscale | `Waypoints` | endpoint=`Waypoints` | Y | |
| certificate-provider* | `KeyRound` | certificate-provider=`Shield` | **N** | palette KeyRound ≠ canvas Shield |
| http-client | `Globe2` | http-client=`Network` | **N** | |

### Port-icon inventory (13 ids, `portIconMap` :68-82)
`ban` Ban, `database` Database, `git-branch` GitBranch, `globe` Globe2, `layers` Layers3, `network` Network, `radio` RadioTower, `route` Route, `server` Server, `settings` Settings2, `shield` Shield, `shuffle` Shuffle, `waypoints` Waypoints. Every glyph is a per-endpoint literal `icon` (`portRelationRegistry.ts:91-115`); there is no rule that an edge's two ends, or two ports referencing the same kind, share an icon (see `_RELATIONSHIPS.md` addendum :194-207). `Settings2` is port-only; the canvas/palette use plain `settings`→`Braces`.

## Duplicates (same icon for different things)
- **`GitBranch` = route-rule AND dns-rule** — `SbcNode.tsx:39` & `:42`. A user dragging from a route-rule vs a dns-rule sees the same glyph; the two lanes (traffic routing vs name resolution) are unrelated. Also reused by 5 palette entries (route hub, redirect/tproxy inbounds, headless/pre-match) — `Palette.tsx:81,145,146,178,179,180,187,226`.
- **`Server` = dns-server AND service** — `SbcNode.tsx:41` & `:44`. On canvas a DNS server and a DERP/SSM/CCM service are indistinguishable; both also collide with `ssh-out` palette (`Palette.tsx:169`).
- **`Network` = outbound(generic node-icon path is unused) AND http-client** — `SbcNode.tsx:45` & `:48`. http-client and the `outbound` kind icon are identical; `Network` is *also* the port glyph for ~6 outbound input ports (`portRelationRegistry.ts:93,95,106,108,115...`) and palette socks/tor (`Palette.tsx:155,168`).
- **`Shield` = certificate-provider AND fallback for 16 proxy outbound types** — `SbcNode.tsx:47` & `:57`. A cert-provider node and every vless/vmess/trojan/ss/hysteria/tuic/etc outbound share one glyph. Palette adds Shield to 6 inbounds + 6 outbounds + TLS (`Palette.tsx:88,134-143,157-167,217`).
- **`Database` = urltest node AND `urltest-group` port** — `SbcNode.tsx:56`, `portRelationRegistry.ts:104`. (At least internally consistent, but "Database" is wrong for latency testing — see below.)
- **`Globe2` overloaded** — dns kind (`SbcNode.tsx:40`), plus 9 palette entries spanning DNS servers, http/naive inbounds, http/dns outbounds, geoip/geosite (`Palette.tsx:80,84,90,91,94,118,133,137,147,156,160,170,181,182,218,219`). Dilutes the "DNS hub" meaning.
- **`Waypoints` = endpoint kind AND dns-tailscale/cert-tailscale/wireguard-out palette** — `SbcNode.tsx:43`; `Palette.tsx:95,112,123,124,161,223,232`. Endpoint nodes and a WireGuard *outbound* look the same.

## Wrong or unintuitive (icon != meaning)
- **`direct → CheckCircle2`** — `SbcNode.tsx:53`. `CheckCircle2` is ALSO the node **validity/status** glyph (`SbcNode.tsx:386` status row, `:413` status pill, `:435` primary button). A Direct outbound therefore looks permanently "validated/OK", and the title-bar icon (`:289`) duplicates the green check shown for a valid node. Pure semantic collision with a status signal.
- **`urltest → Database`** — `SbcNode.tsx:56` (+ port `:104`). URLTest picks the lowest-latency outbound; `Database` implies storage/persistence. No relation to latency or selection.
- **`outboundIcon` fallback `Shield` for 16 proxy types** — `SbcNode.tsx:57`. vless, vmess, trojan, shadowsocks, hysteria, hysteria2, tuic, anytls, shadowtls, naive, ssh, tor, http, socks, wireguard, dns all render identically. Users cannot tell protocols apart on the canvas — the single most damaging issue for someone wiring proxies. (`Shield` also = certificate-provider, doubling the clash.)
- **ALL inbounds → `RadioTower`** — `SbcNode.tsx:37` via `getNodeIcon` ignoring `type` (`:84-86`). 18 inbound protocols (direct/socks/http/ss/vmess/trojan/vless/tuic/hysteria*/anytls/shadowtls/naive/tun/redirect/tproxy/mixed/cloudflared) are one glyph on the canvas — the inbound-side twin of the Shield problem.
- **ALL dns-servers → `Server`, ALL services → `Server`** — `:41`,`:44`. fakeip vs tls vs tailscale dns-servers, and DERP vs SSM vs CCM services, are indistinguishable, and dns-server == service.
- **`certificate-provider → Shield`** — `:47`. Shield reads as "secure proxy", not "issues/stores certificates"; collides with the proxy fallback. (Palette already uses the better `KeyRound`/`FileKey2` — `Palette.tsx:105,110-113`.)
- **`route-rule`/`dns-rule` → `GitBranch`** — `:39`,`:42`. `GitBranch` connotes VCS branching; acceptable as "branch/condition" but it is the duplicate above and competes with `Route`(:38) which is the more correct routing glyph.
- **Template `Blocks` / FakeIP `Blocks`** — `Palette.tsx:59,82,93`. `Blocks` (building blocks) is generic filler and appears on unrelated things (a template fallback AND FakeIP DNS).

## Palette <-> Canvas mismatches
Every node whose palette icon != its canvas `getNodeIcon` result (because the canvas ignores `type`). Grouped:
- **DNS servers** (canvas always `Server`): dns-local `Globe2`, dns-tls `Shield`, dns-quic `Plug`, dns-https `Globe2`, dns-h3 `Globe2`, dns-mdns `Globe2`, dns-dhcp `Network`, dns-fakeip-server `Blocks`, dns-tailscale `Waypoints`. (legacy/hosts/tcp/udp/resolved already `Server` = match.)
- **Inbounds** (canvas always `RadioTower`): direct `Cable`, socks `Network`, http `Globe2`, shadowsocks/vmess/trojan/shadowtls/vless/anytls `Shield`, hysteria/tuic/hysteria2 `Plug`, naive `Globe2`, redirect/tproxy `GitBranch`, cloudflared `Globe2`. (mixed/tun `RadioTower` = match.)
- **Outbounds** (canvas `Shield`/`CheckCircle2`/`Database` per type): direct `Cable`→`CheckCircle2`, socks `Network`→`Shield`, http-out `Globe2`→`Shield`, naive-out `Globe2`→`Shield`, wireguard-out `Waypoints`→`Shield`, hysteria/tuic/hysteria2-out `Plug`→`Shield`, tor-out `Network`→`Shield`, ssh-out `Server`→`Shield`, dns-out `Globe2`→`Shield`, urltest `Shuffle`→`Database`. (block, selector, ss/vmess/trojan/shadowtls/vless/anytls-out happen to match.)
- **Others**: route hub `GitBranch`→`Route`; certificate-provider* `KeyRound`→`Shield`; http-client `Globe2`→`Network`; service-hysteria-realm `Plug`→`Server`; FakeIP `dns-fakeip` `Blocks`→(no node).

Root cause: palette author chose distinct per-protocol icons, but `getNodeIcon` throws `type` away for non-outbound kinds — so the palette's good choices never reach the canvas.

## Recommendations (per node + ports)
Strategy: (1) make `getNodeIcon` consult `type` for inbound/dns-server/service so the palette's per-type icon is honoured on the canvas (the palette already has near-correct picks); (2) replace the 4 status/duplicate clashes; (3) use a real brand SVG only where an unambiguous official logo exists (WireGuard, Tor, Tailscale, Shadowsocks, TUIC, sing-box has its own logo for the app, not per-type). Brand marks must be added as new `.svg` assets (none exist today) — flag as "brand SVG".

| Node | Issue | Recommended icon | Why | Surfaces |
|---|---|---|---|---|
| outbound/direct | clashes with validity `CheckCircle2` | `ArrowUpRight` (or `CornerUpRight`) | "send straight out", no status connotation | canvas(:53), palette `Cable`→align |
| outbound/urltest | `Database` = storage, wrong | `Gauge` (latency meter) | urltest = speed/latency pick | canvas(:56), port(:104), palette `Shuffle`→`Gauge` |
| outbound/selector | ok but == palette only | keep `Shuffle` (palette) / canvas already `Shuffle` | manual pick among members | align palette urltest off Shuffle |
| outbound/wireguard | `Shield` (indistinct) | **WireGuard brand SVG** | official, unmistakable logo exists | canvas, palette(:161 already Waypoints→swap), endpoint wg too |
| outbound/tor | `Shield` | **Tor brand SVG** (onion) | official logo | canvas, palette(:168 `Network`→brand) |
| outbound/shadowsocks + inbound ss | `Shield` | **Shadowsocks brand SVG** (paper plane) | official logo | canvas, palette(:134,157) |
| outbound/tuic | `Shield` | **TUIC brand SVG** if used, else `Zap` | TUIC has a logo; else QUIC=fast | canvas, palette(:165) |
| outbound/vless,vmess | `Shield` | `Feather` (V2Ray-family light proto) distinct from trojan | distinct functional, no official per-proto mark sing-box ships | canvas, palette |
| outbound/trojan | `Shield` | `Drama` (trojan-horse mask) or `VenetianMask` | "disguised" traffic, distinct | canvas, palette(:159) |
| outbound/hysteria,hysteria2 | `Shield` | `Rabbit` (fast/brutal) or `Zap` | speed proto; pick one shared-family glyph | canvas, palette(:162,166) |
| outbound/anytls | `Shield` | `Lock` | TLS-everything, distinct from generic Shield | canvas, palette(:167) |
| outbound/shadowtls | `Shield` | `LockKeyhole` | TLS camouflage | canvas, palette(:163) |
| outbound/naive | `Shield`(canvas)/`Globe2`(palette) | `Chrome` or `Globe` | naive = HTTP/2 CONNECT via browser stack | canvas, palette(:160) |
| outbound/http, socks | `Shield`/`Network` | `Globe2` (http), `Plug2` (socks) | functional, distinct from node Network | canvas, palette(:155,156) |
| outbound/ssh | `Shield` | `TerminalSquare` | SSH = shell, never Server | canvas, palette(:169 `Server`→Terminal) |
| outbound/dns | `Shield` | `Globe2` is taken → `Milestone`/`Signpost` | dns outbound forwards queries | canvas, palette(:170) |
| inbound (all) | one glyph `RadioTower` | per-type via palette: direct `LogIn`, socks `Plug2`, http `Globe2`, ss/vmess/.. brand or functional as above, tun `Network`?, redirect/tproxy `Spline` | honour `type`; tun keep `RadioTower`/`Antenna` | **canvas getNodeIcon**(:84-86), palette already distinct |
| dns-server (all) | one glyph `Server` | per-type: local `House`, tls `ShieldCheck`?→`LockKeyhole`, quic `Zap`, https/h3 `Globe2`, dhcp `Router`, fakeip `Ghost`, tailscale **Tailscale brand SVG**, resolved `Cpu` | honour `type`; reuse palette picks, fix FakeIP `Blocks`→`Ghost` | canvas getNodeIcon, palette(:82-96) |
| service (all) | == dns-server `Server` | per-type: derp `Waypoints`?→`Share2`, ssm-api `KeyRound`→`KeySquare`, ccm `MessageSquare`, ocm `Bot`, resolved `Cpu`, hysteria-realm `Castle` | distinguish from dns-server; honour `type` | canvas getNodeIcon, palette(:195-200) |
| dns (hub) | `Globe2` overloaded | keep `Globe2` but stop using Globe2 for individual servers | reserve Globe for the DNS hub | canvas(:40) |
| route (hub) | palette `GitBranch`≠canvas `Route` | use `Route` on both | `Route` is the routing glyph; free `GitBranch` for rules | palette(:178)→`Route` |
| route-rule | dup `GitBranch` w/ dns-rule | keep `GitBranch` (rule = branch/condition) | conventional for a match-rule | canvas(:39) |
| dns-rule | dup `GitBranch` w/ route-rule | `Filter` | a DNS rule filters queries; removes the dup | canvas(:42), palette(:81), port literals (:97,99,100,101,102) |
| certificate-provider | `Shield` clashes proxies | `FileKey2` (matches palette `KeyRound`/`FileKey2`) | cert issuance, not "secure" | canvas(:47), palette already `KeyRound` |
| http-client | `Network` dup w/ outbound | `Globe` or `BookOpen`? → `Cloud` | a remote HTTP fetcher | canvas(:48), palette(:118 already `Globe2`) |
| endpoint (wg/tailscale) | `Waypoints` shared w/ palette wg-out | wg endpoint **WireGuard SVG**, tailscale **Tailscale SVG**; generic `Waypoints` fallback | honour `type`; endpoints ARE wg/tailscale | canvas(:43 honour type), palette(:123,124) |
| settings | `Braces` ok | keep `Braces` (canvas), `Settings2` reserved for ports/inspector | fine | — |
| Templates | `Blocks` filler | `LayoutTemplate` | clearer "template" | palette(:59) |
| **Ports** | input glyph varies per-edge for same target kind (`_RELATIONSHIPS.md`:194-207) | derive input-port icon from the **referenced node-kind** (one icon per target kind) and share one icon across an edge's two ends | kills the "7 glyphs for one outbound" problem | `portRelationRegistry.ts` endpoint `icon` literals :91-115 |

Brand-SVG candidates (genuine official logos): **WireGuard**, **Tor**, **Shadowsocks**, **Tailscale**, and (if desired) **TUIC**/**Hysteria**. Everything else stays Lucide. sing-box itself has only an app logo (no per-type icons), so do NOT invent "sing-box" type marks.

## Verification
Target mapping is collision-free across node kinds when `getNodeIcon` honours `type`:
- Status glyph `CheckCircle2`/`CircleAlert` is reserved for validity (`SbcNode.tsx:386,413,435`) and used by **no** node type after `direct`→`ArrowUpRight`. ✔ (removes the one status collision)
- Routing lane: route hub `Route`, route-rule `GitBranch`, dns hub `Globe2`, dns-rule `Filter` — four distinct glyphs. ✔
- Outbound proxies: each of the 16 gets a unique brand-or-functional glyph (`ArrowUpRight`/`Ban`/`Shuffle`/`Gauge` for direct/block/selector/urltest + WireGuard/Tor/Shadowsocks/TUIC SVGs + Feather/Drama/Rabbit/Lock/LockKeyhole/Chrome/Globe2/Plug2/TerminalSquare/Signpost for the rest). No two share. ✔
- `Shield` is freed entirely (cert-provider→`FileKey2`); no node reuses it. ✔
- `Server` no longer means two kinds (dns-server→per-type house/lock/router/ghost/SVG; service→share2/key/message/bot/cpu/castle). ✔
- `Network` no longer dual (http-client→`Cloud`; outbound node-path icon is unused since outbounds go through `outboundIcon`). ✔
- `Waypoints` reserved for the endpoint generic fallback only; wireguard-out gets the WireGuard SVG (not Waypoints). ✔
- Ports: one icon per referenced kind removes the cross-edge inconsistency without colliding with node icons (ports are visually scoped to the handle). ✔
Result: **every node type maps to a unique icon, and no icon overlaps the validity/status glyph.**

## Findings (prioritized)
- **[P1]** 16 proxy outbound types all render `Shield` — indistinguishable on canvas. `SbcNode.tsx:57` (fallback). Biggest blocker for users wiring proxies.
- **[P1]** ALL 18 inbound types render `RadioTower`; `getNodeIcon` ignores `type`. `SbcNode.tsx:37,84-86`. Same indistinguishability on the inbound side.
- **[P1]** `direct → CheckCircle2` collides with the node validity glyph (status row/pill/primary). `SbcNode.tsx:53` vs `:386,413,435`. Direct nodes look permanently "validated".
- **[P1]** `Shield` is shared by certificate-provider AND the proxy fallback. `SbcNode.tsx:47,57`. A cert node looks like a proxy.
- **[P1]** `Server` shared by dns-server AND service (and ssh-out palette). `SbcNode.tsx:41,44`; `Palette.tsx:169`. Two unrelated kinds identical.
- **[P2]** `urltest → Database` (storage, not latency). `SbcNode.tsx:56`; port `portRelationRegistry.ts:104`.
- **[P2]** `GitBranch` dup: route-rule AND dns-rule. `SbcNode.tsx:39,42`.
- **[P2]** `Network` dup: outbound node-icon AND http-client. `SbcNode.tsx:45,48`.
- **[P2]** Palette↔canvas drift: ~40 entries whose palette icon ≠ canvas icon because `getNodeIcon` drops `type` (DNS servers, inbounds, most outbounds, route hub, cert-provider, http-client). `Palette.tsx` vs `SbcNode.tsx:84-86`. Notably `Local Server` Globe2→Server, FakeIP `Blocks` (in no node/port map), `urltest` Shuffle→Database, route hub GitBranch→Route.
- **[P2]** Cross-edge port-icon inconsistency: one outbound shows 7 different input glyphs for "referenced from upstream". `portRelationRegistry.ts:91-115`; see `_RELATIONSHIPS.md`:194-207.
- **[P2]** `Blocks` used as both a template fallback and FakeIP, semantically empty. `Palette.tsx:59,82,93`.

SUMMARY: 0 P0, 5 P1, 5 P2.
