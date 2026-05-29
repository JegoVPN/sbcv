# Per-Node Copy Accuracy Audit (L2-audit)

Agent-driven sweep (2026-05-29, 3 parallel auditors) comparing the editor's user-facing copy — node
subtitles (`src/canvas/graph.ts`), Inspector field labels/hints/banners (`src/components/Inspector.tsx`),
shared-field cards (`src/domain/sharedFieldRegistry.ts`), and Palette labels/status
(`src/components/Palette.tsx`) — against the committed upstream docs
`docs/upstream/sing-box/testing/configuration/**` (testing = 1.14). Only inaccurate/misleading copy is
listed (style nits omitted). Fixes land as `L2-fix-*` slices (Phase 2 of the UX-language goal).

## HIGH — wrong/misleading (some produce invalid configs)

| # | file:line | area | current | upstream truth | fix |
|---|---|---|---|---|---|
| H1 | Inspector.tsx ~4849/4856 + commands.ts ~593 + diagnostics.ts | endpoint/wireguard **peer** | labels "Server"/"Port" writing keys `server`/`server_port` | `endpoint/wireguard.md` peer object uses **`address`** + **`port`** | relabel + write `address`/`port`; fix the scaffold seed + add/adjust peer validation. **Produces invalid exports.** |
| H2 | Inspector.tsx ~1287-1300 | route-rule → route-options → Network Strategy | select offers `default/hybrid/fallback/wifi/cellular/ethernet` | `network_strategy` accepts ONLY `default/hybrid/fallback`; `wifi/cellular/ethernet` are `network_type` values | restrict to `default/hybrid/fallback` (reuse `networkStrategyOptions`). **Writes an invalid value.** |
| H3 | Inspector.tsx ~3120-3131 | shadowsocks **inbound** method `<select>` | includes a legacy stream-cipher optgroup (aes-*-ctr/cfb, rc4-md5, chacha20-ietf, xchacha20) | `inbound/shadowsocks.md` lists only `none` + AEAD + 2022; stream ciphers are **outbound-only** | drop the stream-cipher options from the INBOUND list. **Inbound rejects them.** |
| H4 | Inspector.tsx ~3707/3725 | hysteria v1 (outbound) Up/Down Mbps | placeholder "empty = no rate limit" | `outbound/hysteria.md` → `up_mbps`/`down_mbps` are **Required** | placeholder "required (Mbps)". |
| H5 | Inspector.tsx ~2773 (inbound) / ~3594 (outbound) | hysteria v1 deprecation banner | "Hysteria v1 is deprecated upstream / official docs recommend migrating" | hysteria is **absent from `deprecated.md`**; docs use `material/new-box`, no deprecation | soften to a recommendation ("Hysteria2 recommended for new deployments"); drop the false "deprecated upstream". |
| H6 | Palette.tsx ~317 (`deprecatedKinds`) | hysteria outbound palette pill | marked "Legacy / deprecated by sing-box" | not deprecated upstream (see H5) | remove `hysteria-out` from `deprecatedKinds`. (Optionally ADD `dns-out`/`wireguard-out`, which ARE removed-in-1.13.) |
| H7 | Inspector.tsx ~3071 (inbound) / ~3480 (outbound) | shadowtls Version select | empty option labeled `(default — 3)` | `shadowtls.md` version table marks **`1`** as default | relabel `(default — 1)` (or drop the annotation). |
| H8 | Inspector.tsx ~4597 | dns/tailscale `accept_default_resolvers` hint | "forward queries to MagicDNS chain" | enables **fallback** to non-Tailscale default resolvers; off → NXDOMAIN for non-Tailscale domains (MagicDNS always used) | reword to the fallback semantics. |
| H9 | Inspector.tsx ~1774 + graph.ts ~864 | rule-set (remote) `download_detour` | no deprecation signal | `rule-set/index.md`: `download_detour` **deprecated 1.14 → use `http_client`** (removed 1.16) | add a deprecation banner when `download_detour` is set, pointing to `http_client`. |

## MED — imprecise / incomplete (selected)
- Inspector.tsx ~4285 tuic 0-RTT hint says "weaker forward secrecy" → upstream: "vulnerable to replay attacks".
- Inspector.tsx ~3588 block-outbound banner "imports still round-trip" → `block` was **removed in 1.13** (fails check on the targeted channel).
- naive outbound missing a platform-support banner (Apple/Android/Windows/`libcronet` Linux only).
- Inspector.tsx ~4447 local `prefer_go` hint "bypasses platform-native DNS" overstates (Android platform + macOS DHCP still apply).
- Inspector.tsx ~4480 resolved `accept_default_resolvers` bare label (no hint, unlike the tailscale one).
- Inspector.tsx ~4915/4487/5065 tailscale/derp "stock release binaries omit … support" — unverified categorical claim; soften to "requires the `with_tailscale` build tag".
- Inspector.tsx ~4691 dhcp interface placeholder "auto (system default)" — `auto` is the legacy address form, not a valid value for the structured server.
- Inspector.tsx ~1446 dns reject `no_drop` "(only return)" — vague; the 50-triggers/30s throttle is undocumented in the UI.
- Inspector.tsx ~1415/1416 dns `evaluate`/`respond` actions have no hint (evaluate: top-level only, needs server, doesn't terminate; respond: requires a preceding evaluate or errors).
- Inspector.tsx ~1647 dial `Domain Strategy (deprecated 1.12+)` → **removed in 1.14**; gate it off on testing.
- Inspector.tsx ~1644 dial `Network Type`/`Fallback Network` lists have no value/platform hint (`wifi/cellular/ethernet/other`; Android/Apple + auto_detect_interface only).
- Inspector.tsx ~1170/1394 route/dns rule "Rule Set" match field label is ambiguous with the rule-set entity → "Match rule-set".
- Inspector.tsx ~2540 `store_rdrc`→`store_dns` banner conflates two distinct caches (store_rdrc caches rejected responses).
- Inspector.tsx ~2696 V2Ray API banner asserts exact tag `with_v2ray_api` not named in the cited doc.
- V2Ray transport card flattens per-type fields (ws `max_early_data`, grpc `permit_without_stream`, http `host` as list) → only via Advanced JSON.

## Structural gaps (missing controls, not wrong copy — out of L2 strict remit)
- TLS 1.13/1.14 fields (`engine`, `handshake_timeout`, `spoof`/`spoof_method`, `kernel_tx/rx`, `client_certificate*`), route-options `tls_spoof*`/`tls_record_fragment`/`udp_connect`/`udp_timeout`, ACME 1.14 fields, mDNS dedicated branch — only reachable via Advanced JSON.

## Verified accurate (large set) — omitted; see the audit agent reports in the PR thread.
