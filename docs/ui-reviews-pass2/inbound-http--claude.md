# inbound-http — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The HTTP inbound is now in solid shape: the two pass-1 P0s (users silently invisible, `set_system_proxy` leaking unlabeled) and the pass-1 P1 (`address`/`auto_route` wrongly shown) are all FIXED — there is a structured masked users editor, a labeled system-proxy toggle, full 14-field Listen card, and a near-complete TLS card. Remaining gaps are correctness/quality, not blockers: the upstream `listen ==Required==` constraint is neither marked nor validated, the system-proxy toggle drops the upstream platform/privilege warning + `tun.platform.http_proxy` alternative, and the shared TLS card exposes client-only fields (insecure, disable_sni, uTLS, reality public_key, fragment) on this server-side inbound. Pass-1's Inspector/canvas findings are largely stale.

## 1. Left Palette
- Present, correct category. `{ label: "HTTP", kind: "inbound-http", icon: Globe2, docsUrl: docs("inbound/http/"), status: "setup" }` — `src/components/Palette.tsx:133`.
- Taxonomy/label/docs correct. `inbound-http` → type `http` mapping is correct: `src/domain/protocols.ts:51` and listed in `CREATABLE_INBOUND_TYPES` (`src/domain/protocols.ts:72`).
- Default action `setup` → "Add … setup draft to canvas" and IS activatable (`canActivate` allows `setup`, `src/components/Palette.tsx:279-287`). So the node CAN be added — the pass-1 claim that "setup renders a non-clickable badge / cannot be dragged or clicked" is STALE. It does create a real inbound via `createFromPalette`.
- Minor: icon `Globe2` is shared with HTTP outbound / HTTP clients / several DNS servers — no listen-vs-connect differentiation (cosmetic).

## 2. Canvas Node
- Title bar shows `inbound / http`: `src/components/SbcNode.tsx:291`. Summary title = tag, subtitle = `"http inbound"`: `src/canvas/graph.ts:224-225`. Pass-1's "HTTP inbound indistinguishable from TUN/SOCKS / no protocol shown" is STALE — both the titlebar and the subtitle name the type.
- Node icon is generic `RadioTower` for every inbound kind (`iconMap.inbound`, `src/components/SbcNode.tsx:37`), which disagrees with the palette's `Globe2` for the same node — cosmetic inconsistency only.
- Ports (output, correct per sing-box): `route` (decorative hub), `route-rule-match`, `dns-rule-match` (`src/domain/portRelationRegistry.ts:91,94,99,100`). The shadowsocks-only `service` SSM port is correctly excluded for `http` (gated `nodeType:"shadowsocks"`, line 113). No input ports — correct, inbound is a source.
- `compatible: ["Route"]` → the big "+" creates a Route hub (`src/canvas/graph.ts:227`). Reasonable.
- No canvas display of `listen_port`/auth state (subtitle is just `"http inbound"`); minor P2 for telling multiple HTTP inbounds apart.

## 3. Upstream/Downstream Links
Official model: an HTTP inbound is referenced **by** route rules and DNS rules through their `inbound[]` fields; its `tls` is an embedded inbound TLS object (not a node); `users` are embedded; the Listen `detour` field may point to another (injectable) inbound.
- referenceRegistry inbound paths: `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` (`src/domain/referenceRegistry.ts:327-331`). Rename/delete fan-out correct.
- portRelationRegistry: `route-rule-inbound` and `dns-rule-inbound` writable matchers + decorative `inbound`/`dns-inbound-query` (`portRelationRegistry.ts:94,99,100,91`). Matches the official relationship model. No extra/wrong links.
- Missing (P2): the Listen-field **inbound→inbound `detour`** relationship is editable in the Inspector ("Inbound Detour" select, `Inspector.tsx:1449`) but has NO canvas port/edge and NO referenceRegistry entry, so renaming/deleting a target inbound will NOT update a referencing inbound's `detour`. Stale tag risk.
- Correct that `tls`/`users` are embedded (no node). The `certificate-provider` ref via `*/tls/certificate_provider` is wired (`referenceRegistry.ts:369-372`), good.

## 4. Right Inspector (fields)
One row per official field (Listen Fields + `users[]` + `tls` + `set_system_proxy`). Listen/TLS render via `SharedFieldCards` (`sharedGroupsForEntity` adds `listen`+`tls` for `http`, `src/domain/sharedFieldRegistry.ts:170-171,144`).

| Official field | UI state | Verdict |
|---|---|---|
| `tag` | text input, rename fan-out (`Inspector.tsx:2094-2106`) | OK |
| `type` | select of CREATABLE_INBOUND_TYPES (`:2112-2119`) | OK |
| `listen` (**Required**) | Listen card "Listen" text, **no required marker**, **no diagnostic** (`Inspector.tsx:1436`; diagnostics.ts has none) | P1 |
| `listen_port` | Listen card number (`:1437`) | OK |
| `bind_interface` (1.12) | text (`:1438`) | OK |
| `routing_mark` (Linux) | text, accepts int or `0x` hex (`:1439`) | OK |
| `reuse_addr` (1.12) | boolean (`:1440`) | OK |
| `netns` (Linux,1.12) | text (`:1441`) | OK |
| `tcp_fast_open` | boolean (`:1442`) | OK |
| `tcp_multi_path` | boolean (`:1443`) | OK |
| `disable_tcp_keep_alive` (1.13) | boolean (`:1444`) | OK |
| `tcp_keep_alive` (1.13) | text (`:1445`) | OK |
| `tcp_keep_alive_interval` | text (`:1446`) | OK |
| `udp_fragment` | boolean (`:1447`) | OK |
| `udp_timeout` | text (`:1448`) | OK |
| `detour` (→ inbound) | select of inbound tags (`:1449`) | OK (UI) / no rename-safety (see §3) |
| `users[]` (`username`/`password`) | structured repeater, Add/Remove, password masked via SensitiveTextField (`Inspector.tsx:3125-3236`, schema `:524-530`) | OK — pass-1 P0 FIXED |
| `set_system_proxy` | labeled boolean toggle for http/mixed/socks (`Inspector.tsx:2950-2961`) | P1 — see findings (no platform/privilege warning) — pass-1 P0 partly FIXED |
| `tls.enabled` | boolean (`:1510`) | OK |
| `tls.server_name` | text (`:1511`) | OK |
| `tls.alpn` | list (`:1514`) | OK |
| `tls.min/max_version` | select 1.0-1.3 (`:1515-1516`) | OK |
| `tls.cipher_suites` | list, free text (`:1517`) | OK (no enum picker; P2) |
| `tls.curve_preferences` (1.13) | list (`:1518`) | OK |
| `tls.certificate[]` | list/PEM (`:1519`) | OK |
| `tls.certificate_path` | text (`:1520`) | OK |
| `tls.key[]` (server) | list/PEM (`:1521`) | OK |
| `tls.key_path` (server) | text (`:1522`) | OK |
| `tls.client_authentication` (server,1.13) | select, but options `["","request","require",...]` — upstream is `request/require-any/verify-if-given/require-and-verify` (no bare `require`; missing `require-any`) (`:1524`) | P1 — wrong enum |
| `tls.client_certificate[] / _path[]` (server,1.13) | **absent** from card | P2 |
| `tls.client_certificate_public_key_sha256` (server,1.13) | **absent** | P2 |
| `tls.certificate_provider` (1.14, server) | select of provider tags only — upstream also allows an inline object (`:1525-1530`) | P2 |
| `tls.kernel_tx` / `kernel_rx` (1.13) | **absent** from card | P2 |
| `tls.handshake_timeout` (1.14) | **absent** from card | P2 |
| `tls.reality{}` (server: handshake/private_key/short_id/max_time_difference) | present, gated (`:1536-1546`) | OK |
| `tls.ech{}` (server: key/key_path) | **wrong shape** — card exposes `ech.config`/`config_path`/`query_server_name` (the **client/outbound** ECH fields); server ECH uses `key`/`key_path` (`:1539-1542` vs tls.md:597-611) | P1 |
| CLIENT-ONLY fields shown on this server inbound: `tls.disable_sni` (`:1512`), `tls.insecure` (`:1513`), `tls.certificate_public_key_sha256` (`:1523`), `tls.fragment`/`fragment_fallback_delay`/`record_fragment` (`:1531-1533`), `tls.utls.*` (`:1534-1535`), `tls.reality.public_key`/`short_id`-as-client (`:1537-1538`) | P1 — invalid for an inbound (server) |

Sensitive masking: passwords masked in the users editor; generic `SENSITIVE_FIELD_PATTERNS` covers password/secret/etc. TLS `key`/`private_key` in the shared card are plain text inputs (not masked) — P2.
Invalid-JSON writes: scalar/list/boolean fields coerce safely (`coerceSharedFieldValue`, `:1627`); no raw-JSON textarea is reachable for a default HTTP inbound, so the pass-1 "invalid JSON" risk does not apply here.

## Findings (prioritized)
- [P1] `listen` is upstream **==Required==** but the UI neither marks it required nor validates presence; a user can clear it and export a config sing-box will reject. `src/components/Inspector.tsx:1436`; no rule in `src/domain/diagnostics.ts` (only TUN address @ `:476-496`, outbound server/port @ `:532-571`).
- [P1] `set_system_proxy` toggle omits the upstream warnings: "Only supported on Linux/Android/Windows/macOS" and "on Android/Apple without privileges use `tun.platform.http_proxy` instead". Label says the platforms but gives no privilege caveat / alternative. `src/components/Inspector.tsx:2950-2961` (cf. http.md:39-47). Pass-1 P0 only partly resolved.
- [P1] Shared TLS card renders many **client-only** fields on an inbound (server) context: `disable_sni`, `insecure`, `certificate_public_key_sha256`, `fragment`/`record_fragment`, `utls.*`, reality `public_key`/`short_id`. Writing these into an inbound `tls{}` is invalid per tls.md (==Client only==). Gate the TLS card by `ref.kind`. `src/components/Inspector.tsx:1502-1546`.
- [P1] `tls.client_authentication` enum is wrong: UI offers `["","request","require","verify-if-given","require-and-verify"]` but upstream is `no/request/require-any/verify-if-given/require-and-verify` — `require-any` is missing and bare `require` is not a valid value. `src/components/Inspector.tsx:1524` (cf. tls.md:416-422).
- [P1] Server-side ECH uses the wrong fields: card shows `ech.config`/`ech.config_path`/`ech.query_server_name` (client/outbound shape); an inbound (server) ECH takes `ech.key`/`ech.key_path`. `src/components/Inspector.tsx:1539-1542` (cf. tls.md:597-611).
- [P2] Listen `detour` (inbound→inbound) has no canvas port and no referenceRegistry path, so renaming/deleting the target inbound leaves a stale `detour` tag. `src/components/Inspector.tsx:1449`; absent from `src/domain/referenceRegistry.ts:327-331` and `src/domain/portRelationRegistry.ts`.
- [P2] Inline ACME (`tls.acme{}`) is unsupported in the card — acceptable, and now justified: ACME inline is **deprecated in sing-box 1.14** in favor of `certificate_provider` (`docs/upstream/.../shared/tls.md:12,715-717`). `certificate_provider` is supported only as a tag select, not the inline-object form (`Inspector.tsx:1525-1530`).
- [P2] Server mTLS inputs `client_certificate[]`/`client_certificate_path[]`/`client_certificate_public_key_sha256`, plus `kernel_tx`/`kernel_rx` and `handshake_timeout`, are absent from the TLS card; only reachable via raw config. `src/components/Inspector.tsx:1502-1546`.
- [P2] Canvas icon for HTTP inbound is generic `RadioTower` (`SbcNode.tsx:37`) while palette uses `Globe2` (`Palette.tsx:133`); subtitle is a flat `"http inbound"` with no `listen_port`/auth hint (`graph.ts:225`).
- [P2] `tls.key`/`private_key` rendered as plain text in the shared TLS card (not masked); cipher_suites is free text rather than the documented enum. `src/components/Inspector.tsx:1517,1521`.

Where pass-1 is now stale: pass-1 P0 "users[] silently invisible" — FIXED (structured editor `Inspector.tsx:3125`); pass-1 P0 "set_system_proxy unlabeled in AdvancedScalarFields" — FIXED to a labeled toggle (`:2950`); pass-1 P1 "address/auto_route shown for HTTP" — FIXED, now gated to `entityType === "tun"` (`:2603-2627`); pass-1 P1 "Listen card missing 5 fields" — FIXED, all 14 present (`:1436-1449`); pass-1 P1 "TLS card missing key server fields" — FIXED (`key`/`key_path`/`certificate[]`/`key[]` all present). Pass-1's "palette setup is non-clickable" and "canvas node indistinguishable" claims are also stale.

SUMMARY: 0 P0, 5 P1, 4 P2.
