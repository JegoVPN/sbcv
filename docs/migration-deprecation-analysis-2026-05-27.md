<!-- Status: analysis (2026-05-27). Cross-references sing-box upstream migration docs (`.tmp/sing-box-docs/{testing,stable}/docs/migration.md`) against the 66 editable nodes. Identifies deprecated fields, their replacements, and whether our code handles them. -->

# Migration Deprecation Analysis — 1.12 / 1.13 / 1.14

Source: `.tmp/sing-box-docs/testing/docs/migration.md` (most complete; includes 1.14 + back-versions). `1.13.0` has **no migrations of its own** — it inherits the 1.12 changes. 1.10 / 1.11 migrations are also included where the deprecated form is still commonly imported by users of the current app.

For each deprecation, this doc records:

- **Deprecated form** — the legacy field/structure
- **Replacement** — the new form
- **Affected nodes** — which of our 66 editable nodes carry this surface
- **Code state today** — present banner / diagnostic / Palette badge / scaffold behaviour
- **Gap** — what's still missing

This complements [editable-node-ui-deep-pass-code-audit-2026-05-27.md](editable-node-ui-deep-pass-code-audit-2026-05-27.md). When a gap below is closed, drop the row.

## 1.14.0 Deprecations

### 1.14-A — Inline ACME → certificate provider — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** `tls.acme { domain, email, ... }` inside any TLS-enabled inbound / outbound / service / dns-server.
- **Replacement:** `tls.certificate_provider: { type: "acme", ... }` inline, or a tagged entry in top-level `certificate_providers[]` referenced by tag string.
- **Affected nodes (every TLS-enabled surface):** inbound — trojan, naive, vless, vmess, anytls, hysteria, hysteria2, tuic, shadowtls; outbound — trojan, naive, vless, vmess, anytls, hysteria, hysteria2, tuic, shadowtls; service — derp, hysteria-realm; dns-server — tls, https, quic, h3; settings — certificate.
- **Code state today:** `tls-acme-deprecated` warning emitted from `diagnostics.ts` (channel-gated to testing). Inspector now also shows an inline `PlatformBanner` with `kind="deprecated"` whenever any entity carries `tls.acme` as an object — covers every TLS-enabled surface in one place.
- **Regression tests:** `tests/domain.test.ts` (diagnostic) + `tests/app.test.tsx` (banner — "shows an inline deprecation banner when tls.acme is set on an inbound").
- **Remaining:** one-click "Convert to certificate_provider" migration — UX nice-to-have.

### 1.14-B — Address filter fields → response matching in DNS rules — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** DNS rules using `ip_cidr` / `ip_is_private` (without `match_response: true`); also the legacy `rule_set_ip_cidr_accept_empty` rule item; also a DNS rule that references a rule-set containing only `ip_cidr` items.
- **Replacement:** Use the new `evaluate` action to fetch a response, then a follow-up rule with `match_response: true` to address-match.
- **Affected nodes:** rule-dns-rule (the matcher itself), rule-set-inline (when the inline rule-set is `ip_cidr`-only and referenced from a DNS rule).
- **Code state today:** ✅ `dns-rule-legacy-address-filter-deprecated` warning now fires whenever a DNS rule carries `ip_cidr` (non-empty array) or `ip_is_private` without `match_response: true`. Channel-agnostic (deprecated since 1.14, applies to anyone running ≥1.14).
- **Regression test:** `tests/domain.test.ts` — "emits dns-rule-legacy-address-filter-deprecated when ip_cidr is used without match_response".
- **Remaining (UX nice-to-haves):** `evaluate` action sub-form in Inspector + `match_response` toggle + rule-set-only-ip_cidr cross-reference detection.

### 1.14-C — `dns.independent_cache` removed (cache is always per-transport) — ✅ DIAGNOSTIC LANDED earlier

- **Deprecated:** `dns.independent_cache: true` (any value).
- **Replacement:** Remove the field. The new cache automatically keys by transport name.
- **Affected nodes:** hub-dns.
- **Code state today:** ✅ Already covered — `diagnostics.ts:254` `"deprecated-dns-independent-cache"` warns under testing channel.
- **Remaining (UX nice-to-have):** No automatic strip on import — field still round-trips. A Quick-fix "Remove deprecated field" affordance + Inspector inline banner are nice but not blocking.

### 1.14-D — `cache_file.store_rdrc` → `store_dns` — ✅ DIAGNOSTIC + BANNER LANDED earlier

- **Deprecated:** `experimental.cache_file.store_rdrc`.
- **Replacement:** `experimental.cache_file.store_dns`.
- **Affected nodes:** settings-experimental.
- **Code state today:** ✅ Already covered — `diagnostics.ts:987` `"cache-file-store-rdrc-deprecated"` warning, plus `Inspector.tsx:2064` Banner `"store_rdrc is deprecated in sing-box 1.14 testing. Migrate to store_dns…"`.
- **Remaining (UX nice-to-have):** No auto-migrate button — banner only educates.

### 1.14-E — `ip_version` / `query_type` behaviour change — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Not a removal**, but a semantic shift: these fields now take effect on **every** DNS evaluation (formerly only client-facing ones). Mixing with legacy address-filter fields or `rule_set_ip_cidr_accept_empty` will be **rejected at startup**.
- **Affected nodes:** rule-dns-rule, rule-set-inline, hub-route (`resolve` route rule action), endpoint-wireguard, endpoint-tailscale, outbound-socks (SOCKS4 only), service-derp, service-resolved.
- **Code state today:** ✅ `dns-rule-mixed-legacy-and-modern-conflict` error now fires when a DNS rule combines `ip_version` / `query_type` AND any of `ip_cidr` / `ip_is_private` / `rule_set_ip_cidr_accept_empty`. Hard error since sing-box rejects at startup.
- **Regression test:** `tests/domain.test.ts` — "emits dns-rule-mixed-legacy-and-modern-conflict for mixed ip_cidr + ip_version rule".
- **Remaining (UX nice-to-have):** Surface the conflict inline in the rule editor.

## 1.12.0 Deprecations

### 1.12-A — New DNS server format (string `address` → typed `server`) — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** `dns.servers[].address: "<schema>://..."` (e.g. `"tcp://1.1.1.1"`, `"https://1.1.1.1/dns-query"`, `"dhcp://auto"`, `"fakeip"`, `"rcode://refused"`).
- **Replacement:** `dns.servers[]` with explicit `type` discriminator + `server` / `interface` / etc. plus a top-level `dns.rules[]` with `action: "predefined"` for the old `rcode://` case.
- **Affected nodes:** every dns-server node (local, hosts, udp, tcp, tls, https, quic, h3, dhcp, fakeip, resolved, tailscale). Also any historical config that uses `address_resolver` or top-level `strategy` per server.
- **Code state today:** ✅ The editor already uses the new `type`-based format (`commands.ts createDnsServer` emits the new shape). New diagnostic `dns-server-legacy-address-deprecated` warns whenever any `dns.servers[]` entry carries a schema-prefixed `address` (regex `^[a-z0-9+]+://`). The top-level `dns.fakeip` legacy form was already covered by `legacy-fakeip-deprecated`. Together those cover the imported-legacy-config case the audit called out.
- **Regression test:** `tests/domain.test.ts` — "emits dns-server-legacy-address-deprecated when address uses tcp://...".
- **Remaining (UX nice-to-haves):** (1) Auto-migrate `rcode://` form into a `predefined` DNS rule on import. (2) `commands.ts:636` dns-server-https scaffold cleanup — see audit row [dns-server-https].

### 1.12-B — Outbound DNS rule items → `domain_resolver` — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** DNS rules using `outbound: <tag>` to route outbound traffic-originated queries to a specific DNS server.
- **Replacement:** Put `domain_resolver` on the outbound itself (dial field), or set `route.default_domain_resolver` globally.
- **Affected nodes:** rule-dns-rule (deprecated matcher), every outbound (`domain_resolver` is now a dial field on each), hub-route (`default_domain_resolver`).
- **Code state today:** ✅ `dns-rule-outbound-matcher-deprecated` warning now fires whenever a DNS rule sets `outbound: <tag>` (any value, including the empty string). Migration text suggests `domain_resolver` per-outbound or `route.default_domain_resolver`. `sharedFieldRegistry.ts` already declares `domain_resolver` as a dial field; the hub-route shared `default_domain_resolver` exists. Inline migration is fully accessible from the rule and outbound editors.
- **Regression test:** `tests/domain.test.ts` — "emits dns-rule-outbound-matcher-deprecated when a DNS rule uses outbound: matcher".
- **Remaining (UX nice-to-have):** One-click "Move to outbound.domain_resolver" affordance.

### 1.12-C — Outbound `domain_strategy` → `domain_resolver` — ✅ CLOSED 2026-05-27

- ~~**Code state today:** `Inspector.tsx:1375` labels the field "Domain Strategy (deprecated 1.12+)" but does not emit a diagnostic and does not block writes.~~ Now emits `dial-domain-strategy-deprecated` (warning) from `diagnostics.ts` for every dial-using surface: outbounds, dns-servers, endpoints, ntp.
- **Deprecated:** `outbound.domain_strategy: "prefer_ipv4" | ...` in any outbound's dial fields.
- **Replacement:** `outbound.domain_resolver: { server, strategy }`.
- **Affected nodes (now covered by diagnostic):** every outbound and any dial-using surface (also dns-server with type `udp` / `tcp` / `tls` / `https` / `quic` / `h3`, endpoint-wireguard, endpoint-tailscale, settings-ntp dial).
- **Regression test:** `tests/domain.test.ts` — "warns on deprecated dial.domain_strategy across outbound / dns-server / endpoint / ntp".
- **Remaining:** UI banner inline next to the field, and a one-click migration into `domain_resolver` — both UX nice-to-haves, not blockers.

## 1.11.0 Deprecations (still affect imports / current 66 nodes)

### 1.11-A — `outbound: "block"` → `route.rules[].action: "reject"` — ✅ CLOSED 2026-05-27

- **Deprecated:** Adding a `{ type: "block", tag: "..." }` outbound and referencing it from route rules.
- **Replacement:** Drop the outbound; set `action: "reject"` on the route rule.
- **Affected nodes:** outbound-block, rule-route-rule (the consumer side).
- **Code state today:** Palette already marks `block` as `deprecated`. Inspector shows a deprecation banner. **Now also**: `outbound-block-deprecated` warning emitted from `diagnostics.ts` for any outbound with `type === "block"`. The project default config (`STABLE_TUN_SPLIT_CONFIG`) modernized — `block` outbound removed and its route rule migrated to `{ action: "reject" }`, so first-load is warning-free.
- **Regression test:** `tests/domain.test.ts` — "warns on deprecated outbound type=block (1.11-A)".

### 1.11-B — Legacy `dns` outbound → `action: "hijack-dns"` rule — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** `{ type: "dns", tag: "dns" }` outbound + `protocol: "dns"` rule with `outbound: "dns"`.
- **Replacement:** A route rule with `action: "hijack-dns"`.
- **Affected nodes:** Not a first-class node in our 66-set (we don't have an editable `outbound-dns` kind), but **the import path may still receive it**.
- **Code state today:** ✅ `outbound-dns-legacy-deprecated` warning now fires for any outbound with `type === "dns"`, with migration text pointing at the `hijack-dns` route action.
- **Regression test:** `tests/domain.test.ts` — "emits outbound-dns-legacy-deprecated + outbound-wireguard-legacy-deprecated".
- **Remaining (UX nice-to-have):** Auto-convert legacy `outbound.type === "dns"` to a `hijack-dns` rule on import.

### 1.11-C — Legacy inbound `sniff` / `sniff_timeout` / `domain_strategy` → route actions — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** Setting `sniff: true`, `sniff_timeout`, `sniff_override_destination`, `domain_strategy` directly on **any** inbound.
- **Replacement:** Add corresponding `route.rules` with `inbound: "<tag>"`, `action: "sniff"` or `action: "resolve"`.
- **Affected nodes:** every inbound (17 nodes).
- **Code state today:** `inbound-legacy-sniff-deprecated` and `inbound-legacy-domain-strategy-deprecated` warnings emitted from `diagnostics.ts` whenever any inbound carries the deprecated fields. Fires regardless of channel (these were deprecated in 1.11 and we support 1.12+ everywhere).
- **Regression test:** `tests/domain.test.ts` — "warns on legacy inbound sniff / domain_strategy (1.11-C)".
- **Remaining:** "Convert to route rule" one-click affordance — UX nice-to-have.

### 1.11-D — Direct outbound `override_address` / `override_port` → route-options action — ✅ DIAGNOSTIC + SUB-FORM LANDED earlier

- **Deprecated:** `outbound: { type: "direct", override_address, override_port }`.
- **Replacement:** A route rule with `action: "route-options"` or `action: "route"` carrying the same fields.
- **Affected nodes:** outbound-direct (also conceptually inbound-direct since `override_address`/`override_port` exist there too — see audit row [inbound-direct] which flags missing UI).
- **Code state today:** ✅ Already covered — `diagnostics.ts:595` `"direct-override-deprecated"` warning, plus `route-options` action sub-form now exists in the rule-route-rule Inspector (fixed 2026-05-27), giving the deprecation a concrete migration target.
- **Remaining (UX nice-to-have):** One-click "Move override to route rule" affordance.

### 1.11-E — WireGuard outbound → endpoint — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** `outbound: { type: "wireguard", ... }` (top-level WireGuard).
- **Replacement:** `endpoints: [{ type: "wireguard", peers: [...], address: [...], ... }]`.
- **Affected nodes:** endpoint-wireguard (the replacement node — we already only edit the new form; no `outbound-wireguard` kind in our 66 set).
- **Code state today:** ✅ `outbound-wireguard-legacy-deprecated` warning now fires for any outbound with `type === "wireguard"`, pointing the user at the new `endpoints[]` form.
- **Regression test:** `tests/domain.test.ts` — "emits outbound-dns-legacy-deprecated + outbound-wireguard-legacy-deprecated".
- **Remaining (UX nice-to-have):** Auto-migrate legacy `outbound.type === "wireguard"` to an endpoint on import.

## 1.10.0 Deprecations (TUN address fields)

### 1.10-A — TUN `inet4_address` / `inet6_address` → `address[]` — ✅ DIAGNOSTIC LANDED 2026-05-27

- **Deprecated:** `tun.inet4_address`, `tun.inet6_address`, `tun.inet4_route_address`, `tun.inet6_route_address`, `tun.inet4_route_exclude_address`, `tun.inet6_route_exclude_address`.
- **Replacement:** Single arrays: `address[]`, `route_address[]`, `route_exclude_address[]`.
- **Affected nodes:** inbound-tun.
- **Code state today:** ✅ Inspector renders only the new `address[]` / `route_address[]` / `route_exclude_address[]` arrays, and `createInbound("tun")` scaffold now seeds dual-stack `["172.19.0.1/30", "fdfe:dcba:9876::1/126"]` (audit row [inbound-tun] fix). New diagnostic `tun-legacy-address-fields-deprecated` warns when any of the six legacy split keys appear on a tun inbound (so imports of pre-1.10 configs flag the legacy shape instead of silently dropping fields).
- **Regression test:** `tests/domain.test.ts` — "emits tun-legacy-address-fields-deprecated when tun uses inet4_address".
- **Remaining (UX nice-to-have):** Auto-migrate on import (split keys → unified array).

## Conflict Heat Map — Which Nodes Need Work

Nodes ranked by number of migration-related gaps (higher = more migration debt to repair).

| Rank | Node | Open migration gaps |
| --- | --- | --- |
| 1 | rule-dns-rule | 1.14-B (legacy address filter), 1.14-E (semantic shift), 1.12-B (outbound matcher), + `evaluate` action sub-form missing |
| 2 | hub-dns | 1.14-C (banner not surfaced in Inspector), 1.14-E (mixed-legacy diagnostic missing) |
| 3 | every TLS-enabled inbound/outbound/service/dns-server (~20 nodes) | 1.14-A (inline ACME deprecated, no diagnostic anywhere) |
| 4 | every outbound (18) + dial-using dns-server (8) | 1.12-C (domain_strategy deprecated, only label hint — no diagnostic) |
| 5 | outbound-block + rule-route-rule | 1.11-A (no diagnostic), 1.11-D (route-options sub-form missing) |
| 6 | every inbound (17) | 1.11-C (legacy sniff/domain_strategy on inbounds, no diagnostic) |
| 7 | settings-experimental | 1.14-D (auto-migrate button missing) — banner already shown |
| 8 | inbound-tun | 1.10-A (import-time auto-migrate missing, scaffold IPv4-only) |
| 9 | dns-server-https | 1.12-A (scaffold still emits illegal `address` field) |
| 10 | rule-set-inline | 1.14-B (DNS rule referencing ip_cidr-only inline rule-set) |

## Recommended Repair Order

Independent of the audit doc; both should be done.

1. **1.12-C `domain_strategy` deprecation diagnostic** — one PR touches `diagnostics.ts` only, closes a P1 on every outbound + dns-server dial surface (~24 nodes).
2. **1.14-A inline ACME deprecation diagnostic + banner** — one PR, closes a missing-warning gap on ~20 nodes.
3. **1.11-C legacy inbound `sniff` / `domain_strategy` diagnostic** — one PR, closes on 17 inbound nodes.
4. **1.11-A `outbound-block-deprecated` diagnostic** — small.
5. **1.12-A `importJson` auto-migrate legacy DNS `address` strings** + fix `dns-server-https` scaffold — one PR, in `useProjectStore.ts:importJson` + `commands.ts:636`.
6. **1.14-B `evaluate` action sub-form + `dns-rule-legacy-address-filter-deprecated` diagnostic** — bigger; needed for full 1.14 compatibility.
7. **1.14-E mixed-legacy-modern startup-conflict diagnostic** — lighter than (6), but blocks user-shipped 1.14 configs.
8. **1.10-A import-time TUN auto-migrate + dual-stack default scaffold** — small.
9. **1.11-B / 1.11-E import-time auto-migrate** (legacy `dns` and `wireguard` outbounds) — small.

All except (8) and (9) are pure additions; (6) is the largest because it requires a new action sub-form. Done together they close most of the deprecation cliff between 1.11 imports and 1.14 exports.

## Out of Scope

- **1.9.5 / 1.9.0 / 1.8.0** changes — already absorbed by the codebase years ago; no current node carries the legacy form.
- **GeoIP / Geosite → rule-set migration** (1.8.0) — already handled; we don't expose the legacy `geoip:cn` syntax outside `rule-set-remote`.
- Pre-1.8 migrations — not relevant.
