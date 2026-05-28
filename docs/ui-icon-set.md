# SBC Final Confirmed Icon Set (v4)

This is the confirmed target icon set for the sing-box visual editor, reconciling the two
independent icon audits and the confirmed v4 preview. It is the implementation spec for atomic
**A8b** (and the shared icon-registry atomics) in
[`goals/conformance-and-ux-remediation.md`](goals/conformance-and-ux-remediation.md).

**Sources of truth**

- **Visual (authoritative for the exact glyph):** `docs/ui-reviews-pass2/_icons-preview-v4.html`
  (the confirmed v4 preview). Where this doc and the preview disagree, the preview wins.
- **Rationale / per-node recommendation:** `docs/ui-reviews-pass2/_ICONS.md`.
- **Cross-surface + port-vocabulary semantics:** `docs/ui-reviews-codex/icon-semantics-audit.md`
  (`IC-*` findings).

Icon names below are `lucide-react` exports unless marked **BRAND SVG** (a new monochrome `.svg`
asset for an official protocol logo). The repo ships no custom SVGs today.

## Icon-System Rules

1. **One shared registry across every surface.** The same `{kind, type}` must resolve to the same
   icon on the node card, in the Palette, in the compatible/chip picker, and in the Inspector header.
   Today `getNodeIcon` ignores `type` for non-outbound kinds and four surfaces keep separate maps
   (`_ICONS.md` drift; `IC-P1-3`). Fix: a single `iconRegistry` consumed by `SbcNode`, `Palette`,
   `ChipPickerPopover`, and `Inspector`; `getNodeIcon(kind, type)` honours `type`.
2. **Status glyphs are reserved.** `CheckCircle2` (valid), `CircleAlert`/`TriangleAlert` (error/warning)
   are status affordances only and must never be a node identity icon. This is why `direct` moves off
   `CheckCircle2`.
3. **Brand SVG only where an official logo exists.** Confirmed brand marks: **WireGuard, Tailscale,
   Tor, Shadowsocks, TUIC, Hysteria**. Add them as small monochrome `.svg` components with a stable
   `aria-label`, behind a one-time license/bundle-size review. Everything else stays Lucide with
   **direct imports** (no `lucide-react` namespace import, no oversized payloads). Do not invent
   per-type "sing-box" marks.
4. **Port icons derive from the referenced node-kind.** One icon per target kind, shared across an
   edge's two ends, instead of per-endpoint literals (`IC-P2-5`, `_RELATIONSHIPS` addendum). Expand
   `PortIconId` for high-frequency relations (see Port table).
5. **Relation-removal icon is consistent.** Port disconnect and edge remove use the **same** unlink
   metaphor (`X` / unlink), with a clear tooltip. Node deletion stays `Trash2` so deleting a resource
   stays visually distinct from removing a relation (`IC-P2-6`).

## Node Card Icons

`getNodeIcon(kind, type)` must honour `type`. Cells marked "per v4 preview" are confirmed as a
distinct per-protocol glyph in `_icons-preview-v4.html`; take the exact Lucide name from the preview
during A8b (the audits did not pin a single Lucide name for those and v4 finalised them).

### Outbound

| type | Icon | Replaces |
|---|---|---|
| direct | `arrow-up-right` | `CheckCircle2` (status clash) |
| block | `ban` | (keep) |
| selector | `shuffle` | (keep) |
| urltest | `gauge` | `Database` (storage metaphor) |
| http | `earth` (Globe) | `Shield` |
| socks | `network` | `Shield` |
| ssh | `square-terminal` | `Shield`/`Server` |
| dns | `signpost` | `Shield` |
| anytls / shadowtls | `shield-check` | `Shield` (TLS family; differentiate per preview) |
| shadowsocks | **Shadowsocks BRAND SVG** | `Shield` |
| tor | **Tor BRAND SVG** | `Shield` |
| wireguard | **WireGuard BRAND SVG** | `Shield` |
| tuic | **TUIC BRAND SVG** | `Shield` |
| hysteria / hysteria2 | **Hysteria BRAND SVG** | `Shield` |
| vmess / vless / trojan / naive | distinct functional glyph — per v4 preview | `Shield` |

### Inbound (`getNodeIcon` currently collapses all 18 to `RadioTower`)

| type | Icon | Replaces |
|---|---|---|
| direct | `log-in` | `RadioTower` |
| socks | `network` | `RadioTower` |
| http / naive | `earth` | `RadioTower` |
| redirect / tproxy | `spline` | `RadioTower` |
| shadowsocks | **Shadowsocks BRAND SVG** | `RadioTower` |
| shadowtls / anytls | `shield-check` | `RadioTower` |
| tun / mixed | `RadioTower` (keep — true "listener/hub") | — |
| cloudflared | per v4 preview (Cloudflare-family) | `RadioTower` |
| vmess / vless / trojan / hysteria* / tuic | per v4 preview (match outbound family) | `RadioTower` |

### DNS server (currently all `Server`)

| type | Icon | Replaces |
|---|---|---|
| local | `house` | `Server` |
| dhcp | `router` | `Server` |
| fakeip | `ghost` | `Server` (and Palette `Blocks`) |
| resolved | `cpu` | `Server` |
| tailscale | **Tailscale BRAND SVG** | `Server` |
| tls / quic | `shield-check` / per preview | `Server` |
| https / h3 | `earth` | `Server` |
| tcp / udp / legacy / hosts | `server-cog` / per preview | `Server` |

### Service (currently all `Server`, identical to dns-server)

| type | Icon | Replaces |
|---|---|---|
| derp | `share2` | `Server` |
| ssm-api | `key-square` | `Server` |
| ccm | `message-square` | `Server` |
| ocm | `bot` | `Server` |
| resolved | `cpu` | `Server` |
| hysteria-realm | `castle` | `Server` |

### Hubs, rules, resources

| node | Icon | Replaces |
|---|---|---|
| route (hub) | `route` | align Palette `GitBranch`→`route` |
| route-rule | `git-branch` | (keep — match/branch) |
| dns (hub) | `earth` (Globe) | reserve Globe for the hub only |
| dns-rule | `filter` | `GitBranch` (removes the route-rule dup) |
| rule-set (all) | `layers` | (keep) |
| endpoint/wireguard | **WireGuard BRAND SVG** | `Waypoints` |
| endpoint/tailscale | **Tailscale BRAND SVG** | `Waypoints` |
| certificate-provider | `file-key2` | `Shield` (+ stop `Braces` in Inspector) |
| http-client | `cloud-download` | `Network` |
| settings/log | `scroll-text` | per preview |
| settings/experimental | `flask-conical` | `Braces` |
| settings (other) | `cog` | (keep family) |

## Port / Relation Icons

Derive from the **referenced node-kind** (rule 4); expand the vocabulary so distinct relations read
distinctly (`IC-P2-5`). Confirmed additions present in v4:

| Relation | Icon |
|---|---|
| NTP detour | `clock` |
| ordered route/DNS rule | `list-ordered` |
| certificate-provider endpoint / cert ref | `file-key2` (ACME variant `file-badge2`) |
| URLTest candidate | `gauge` |
| outbound detour / dial | `corner-down-right` / `arrow-left-right` (per preview) |
| route final / resolve target | `target` / `crosshair` (per preview) |
| selector/urltest group member | `split` |
| Tailscale / WireGuard refs | matching **BRAND SVG** |

Keep the test that ports never blindly copy node icons; add exact-id assertions for the rows above.

## Status & Removal Icons

- Valid: `CheckCircle2`. Warning: `TriangleAlert` (amber). Error: `CircleAlert`. (Reserved — see A9.)
- Relation removal (port + edge): one unlink/`X` metaphor with tooltip.
- Node/resource deletion: `Trash2` only.

## Collision Guarantee

Per `_ICONS.md` verification, once `getNodeIcon` honours `type`: every node type maps to a unique
icon, `Shield`/`Server`/`Network`/`GitBranch`/`CheckCircle2` no longer double-book, and no node icon
collides with the status glyph. Confirm against `_icons-preview-v4.html` while implementing.

## Implementation (atomic A8b + icon-registry atomics)

1. Add `src/canvas/iconRegistry.ts` (static direct imports; resolvers for node, palette, picker,
   inspector, and port icons). `getNodeIcon(kind, type)` honours `type`.
2. Move `SbcNode`, `Palette`, `ChipPickerPopover`, `Inspector` onto the registry.
3. Replace the misleading icons above (outbound `Shield` fallback, URLTest `Database`,
   cert-provider `Shield`/`Braces`, http-client `Network`, generic endpoint `Waypoints`).
4. Add the brand SVGs (WireGuard, Tailscale, Tor, Shadowsocks, TUIC, Hysteria) **after** a
   license/bundle-size review; if any logo is rejected, use a distinct functional Lucide glyph and
   record the deviation in the program devlog.
5. Expand `PortIconId` and derive port icons from the referenced kind.
6. Tests: registry consistency across node card / Palette / picker / Inspector; ports never copy node
   icons and assert exact ids for the relation rows above; browser smoke on Direct, URLTest,
   SOCKS/HTTP, WireGuard/Tailscale endpoint, Certificate Provider, HTTP Client, Service.

## Notes

- This doc captures the **confirmed** target. The per-protocol proxy glyphs marked "per v4 preview"
  are finalised in `_icons-preview-v4.html`; lift the exact Lucide name from there during A8b rather
  than re-deriving it.
- Record any brand-SVG rejection or glyph change against this set in
  [`goals/conformance-and-ux-remediation-devlog.md`](goals/conformance-and-ux-remediation-devlog.md).
