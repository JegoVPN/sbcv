# inbound-hysteria — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The Hysteria v1 inbound is in good shape and almost every pass-1 P0/P1 is now STALE: TLS is in the default template and enforced by an `inbound-missing-tls` error, `users[]` is a structured masked editor (`name`/`auth_str`), the Listen card is the full 14-field set, the TLS card exposes server `certificate`/`key`/`key_path`, `address`/`auto_route` are gated to TUN, and an Inspector deprecation banner + `inbound-hysteria-v1-deprecated` warning exist. The real remaining gaps are correctness/quality: the `==Required==` bandwidth fields (`up`/`up_mbps`/`down`/`down_mbps`) and `obfs` have NO dedicated inbound controls (they leak into the generic "Advanced fields" accordion — the labeled `up_mbps`/`down_mbps`/`obfs` inputs at `Inspector.tsx:3474-3526` are in the **outbound** block only), bandwidth is never validated, the canvas node shows no deprecation badge, and `users.auth` (base64 form) is absent from the user schema.

## 1. Left Palette
- Present, correct category (Inbounds): `{ label: "Hysteria", kind: "inbound-hysteria", icon: Plug, docsUrl: docs("inbound/hysteria/"), status: "setup" }` — `src/components/Palette.tsx:138`.
- Mapping correct: `inbound-hysteria` → type `hysteria` (`src/domain/protocols.ts:56`) and present in `CREATABLE_INBOUND_TYPES` (`src/domain/protocols.ts:77`). Docs URL correct.
- Default action `setup` IS activatable (`canActivate` allows `setup`, `Palette.tsx:279-287`); clicking creates a real inbound via `createFromPalette`. Pass-1's claim that `setup` "suppresses ADD / cannot be dragged or clicked" is STALE.
- [P2] No "Legacy" badge in palette: `inbound-hysteria` is NOT in `deprecatedKinds` (only `hysteria-out` is, `Palette.tsx:252-256`), so it shows the "Setup" pill, not the "Legacy" pill the palette already supports for the deprecated v1 protocol. The matching `hysteria-out` outbound DOES get the Legacy pill — inconsistent. Pass-1's "no deprecation indicator" is partly stale (Inspector/diagnostics warn) but the palette gate is still missing.
- Minor: icon `Plug` shared with TUIC/Hysteria2 (cosmetic).

## 2. Canvas Node
- Title bar shows `inbound / hysteria` (`src/components/SbcNode.tsx:291`); summary title = tag, subtitle = `"hysteria inbound"` (`src/canvas/graph.ts:224-225`). Pass-1's "v1 and Hysteria2 visually indistinguishable / protocol not shown" is STALE.
- Ports (output, correct per sing-box): `route` (decorative hub), `route-rule-match`, `dns-rule-match` (`src/domain/portRelationRegistry.ts:91,94,99,100`). The shadowsocks-only `service` SSM port is correctly excluded (gated `nodeType:"shadowsocks"`, `portRelationRegistry.ts:113`). No input ports — correct, inbound is a source.
- `compatible: ["Route"]` → the node "+" creates a Route hub (`graph.ts:227`). Reasonable.
- [P1] No deprecation badge on the canvas node. `isDeprecated` is hard-coded to `data.kind === "outbound" && data.type === "block"` (`SbcNode.tsx:279`), so a Hysteria v1 inbound shows no titlebar "deprecated" badge even though the Inspector banner and `inbound-hysteria-v1-deprecated` diagnostic both flag it. Inconsistent signalling.
- [P2] Node icon is generic `RadioTower` (`iconMap.inbound`, `SbcNode.tsx:37`), disagreeing with palette `Plug` (cosmetic). Subtitle carries no bandwidth/user-count/TLS summary — minor.

## 3. Upstream/Downstream Links
Official model: a Hysteria inbound is referenced **by** route rules and DNS rules through their `inbound[]` fields; `tls` is an embedded inbound TLS object (NOT a node); `users[]` are embedded; the Listen `detour` field may point to another (injectable) inbound.
- referenceRegistry inbound paths: `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` (`src/domain/referenceRegistry.ts:327-331`). Rename/delete fan-out correct and complete for the canonical references.
- portRelationRegistry: writable `route-rule-inbound` (`/route/rules/*/inbound`) + `dns-rule-inbound` (`/dns/rules/*/inbound`) matchers, plus decorative `inbound`/`dns-inbound-query` (`portRelationRegistry.ts:94,99,100,91`). Matches the official relationship model. No extra/wrong links.
- `tls` correctly embedded (no standalone node); `certificate-provider` ref via `*/tls/certificate_provider` is wired (`referenceRegistry.ts:369-372`). Good.
- [P2] Missing inbound→inbound `detour` link: the Listen `detour` ("Inbound Detour" select, `Inspector.tsx:1449`) can point a Hysteria inbound at another injectable inbound, but there is NO canvas port/edge and NO referenceRegistry path for `/inbounds/*/detour`, so renaming/deleting the target inbound will NOT update/clean the referencing inbound's `detour` (stale-tag risk). Shared inbound gap, not hysteria-specific.

## 4. Right Inspector (fields)
Listen/TLS/QUIC render via `SharedFieldCards`; `sharedGroupsForEntity` adds `listen`+`tls`+`quic` for `hysteria` (`src/domain/sharedFieldRegistry.ts:170-172,144-145`). Inbound block is `Inspector.tsx:2583-3240`.

| Official field | UI state | Verdict |
|---|---|---|
| `tag` | text input + rename fan-out | OK |
| `type` | select of CREATABLE_INBOUND_TYPES | OK |
| Listen `listen` (**Required**) | Listen card "Listen" text, **no required marker / no diagnostic** (`Inspector.tsx:1436`) | P2 |
| Listen `listen_port` | number (`:1437`) | OK |
| Listen `bind_interface`/`routing_mark`/`reuse_addr`/`netns`/`tcp_fast_open`/`tcp_multi_path`/`disable_tcp_keep_alive`/`tcp_keep_alive`/`tcp_keep_alive_interval`/`udp_fragment`/`udp_timeout` | full 14-field Listen card (`listenSharedFields`, `Inspector.tsx:100-115`; group `:1431-1449`) | OK — pass-1 "missing 5 listen fields" STALE |
| Listen `detour` (→ inbound) | "Inbound Detour" select of inbound tags (`:1449`) | OK (UI) / no rename-safety (see §3) |
| `up` (string, **Required**) | NO dedicated control → falls to generic Advanced fields accordion as plain text; no Required marker, no unit-format hint (`AdvancedScalarFields`, `Inspector.tsx:675-731`; not in `inboundHandledFields` `:140-177`) | P1 |
| `up_mbps` (int, **Required**) | NO dedicated inbound control → Advanced fields number input, no Required marker (labeled `up_mbps` control at `:3474-3526` is **outbound-only**) | P1 |
| `down` (string, **Required**) | same as `up` | P1 |
| `down_mbps` (int, **Required**) | same as `up_mbps` | P1 |
| `obfs` (obfuscation password) | NO dedicated control → Advanced fields; rendered as **plain (unmasked) text** because `isSensitiveFieldName` has no "obfs" pattern (`Inspector.tsx:620-635,705-713`) | P2 |
| `users[]` | structured repeater, Add/Remove; `name` text + `auth_str` masked via SensitiveTextField (`Inspector.tsx:3125-3236`, schema `:597-603`) | OK — pass-1 "users silently invisible" STALE |
| `users.auth` (base64 alt) | absent from the hysteria schema (only `auth_str`); an imported user with `auth` shows Name only and the value persists invisibly | P2 |
| `tls` (**Required**) | TLS shared card: enabled, server_name, alpn, min/max_version, cipher_suites, curve_preferences, **certificate / certificate_path / key / key_path**, client_authentication, certificate_provider, reality/ech server fields (`Inspector.tsx:1502-1547`); enforced by `inbound-missing-tls` error (`diagnostics.ts:523-530,573-590`) | OK — pass-1 "template omits tls / no diagnostic / TLS missing key fields" all STALE. Minor: "Enabled" has no visual Required marker; client-only fields (insecure/disable_sni/utls/reality public_key/fragment) shown on this server inbound (P2, shared) |
| QUIC `initial_packet_size` / `disable_path_mtu_discovery` / `idle_timeout` / `keep_alive_period` | QUIC shared card (`quicSharedFields`, `Inspector.tsx:139`; group `:1550+`; gated for hysteria `sharedFieldRegistry.ts:145`) | OK |
| `recv_window_conn` (deprecated 1.14) | NO dedicated control → Advanced fields number input, no deprecation/migration note (not in `inboundHandledFields`) | P2 |
| `recv_window_client` (deprecated 1.14) | same | P2 |
| `max_conn_client` (deprecated 1.14) | same | P2 |
| `disable_mtu_discovery` (deprecated 1.14) | Advanced fields checkbox, no deprecation/migration note | P2 |
| `address` / `auto_route` | NOT shown for hysteria — gated to `entityType === "tun"` (`Inspector.tsx:2609`) | OK — pass-1 "shown for hysteria" STALE |

Notes: every Advanced-fields write is valid JSON (typed number/text/boolean by current value, `Inspector.tsx:692-726`); arrays/objects that fall through go to `AdvancedNonScalarFields` as a `JsonField` (`:820-848,3238`) rather than being dropped, so pass-1's "arrays silently dropped" mechanism is also STALE.

## Findings (prioritized)
- [P1] Required bandwidth fields have no dedicated inbound UI. `up`/`up_mbps`/`down`/`down_mbps` are `==Required==` (`docs/upstream/.../inbound/hysteria.md:43-66`) but for an inbound they only appear in the generic "Advanced fields" accordion with no Required marker and no unit-format hint; the labeled controls exist only in the outbound block. Add `entityType === "hysteria"` bandwidth inputs (mirroring `Inspector.tsx:3474-3526`) inside the inbound block and add the four keys to `inboundHandledFields` (`Inspector.tsx:140-177`).
- [P1] No bandwidth diagnostic. diagnostics.ts validates hysteria inbound TLS (`:573-590`), users (`:1603-1625`), and deprecation (`:911-919`), but never the required `up`/`down`/`up_mbps`/`down_mbps`; a Hysteria inbound with no bandwidth passes the UI Check yet sing-box rejects it. Add an `inbound-missing-bandwidth` error for `type === "hysteria"` when neither `up`/`up_mbps` (and neither `down`/`down_mbps`) is set (`src/domain/diagnostics.ts:910-919`).
- [P1] Canvas node shows no deprecation badge for Hysteria v1. `isDeprecated` is hard-coded to block-outbound only (`src/components/SbcNode.tsx:279`); extend it to flag `type === "hysteria"` (both kinds) so the canvas matches the Inspector banner + `inbound-hysteria-v1-deprecated` diagnostic.
- [P2] Palette "Legacy" pill missing. Add `"inbound-hysteria"` to `deprecatedKinds` (`src/components/Palette.tsx:252-256`) so the v1 inbound gets the same Legacy treatment as `hysteria-out`.
- [P2] `obfs` rendered unmasked. It is an obfuscation password but appears as plain text in Advanced fields; add `"obfs"` to the sensitive patterns or give it a dedicated masked inbound control (`src/components/Inspector.tsx:620-635`).
- [P2] `users.auth` (base64) not editable. Hysteria user schema exposes only `auth_str` (`src/components/Inspector.tsx:597-603`); add an `auth` field (mark sensitive) so imported base64 credentials are visible/editable.
- [P2] Deprecated QUIC-control fields lack migration hints. `recv_window_conn`/`recv_window_client`/`max_conn_client`/`disable_mtu_discovery` (deprecated 1.14, `docs/upstream/.../inbound/hysteria.md:94-118`) fall to Advanced fields with no note pointing to `stream_receive_window`/`connection_receive_window`/`max_concurrent_streams`/`disable_path_mtu_discovery` (`src/components/Inspector.tsx:140-177`).
- [P2] Listen `detour` inbound→inbound reference is not tracked. Add `/inbounds/*/detour` to the inbound entry in `referenceRegistry` (`src/domain/referenceRegistry.ts:327-331,123-155`) so rename/delete updates referencing inbounds; optionally surface a canvas edge.
- [P2] Listen `listen` ==Required== is neither marked nor validated (`src/components/Inspector.tsx:1436`; no diagnostic) — shared inbound gap.

SUMMARY: 0 P0, 3 P1, 6 P2.
