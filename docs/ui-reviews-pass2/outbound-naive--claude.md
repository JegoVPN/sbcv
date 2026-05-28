# outbound-naive — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The task hint ("naive may be inbound-only") is **wrong for this channel**: `docs/upstream/sing-box/testing/configuration/outbound/naive.md` exists and documents a real `naive` outbound (since sing-box 1.13.0), so `outbound-naive` is a legitimate node. The node is in much better shape than pass-1 implies — `tls` is now seeded, `username`/`password`/`extra_headers`/`quic_congestion_control` are first-class, server/port/TLS have blocking diagnostics, and ports come from the authoritative `portRelationRegistry` (all correct for naive). The two real remaining gaps are (P1) the shared TLS group over-exposes ~20 fields the NaiveProxy outbound silently ignores (doc allows only `server_name`/`certificate`/`certificate_path`/`ech`), and (P2) there is no platform/build-variant warning and no first-class `quic` toggle.

## 1. Left Palette

`Palette.tsx:160` — `{ label: "Naive", kind: "naive-out", icon: Globe2, docsUrl: docs("outbound/naive/"), status: "setup" }`. Category **Outbounds** is correct; naive is a real outbound type (`OUTBOUND_PALETTE_TYPES["naive-out"]="naive"`, `protocols.ts:9`; in `CREATABLE_OUTBOUND_TYPES`, `protocols.ts:32`). `docsUrl` resolves to the correct upstream path. `status:"setup"` is acceptable (matches every other proxy outbound, e.g. trojan/vless). No default-action or gating bug. Pass-1 had **No findings** here and that remains correct.

## 2. Canvas Node

- Title/subtitle (`graph.ts:395`,`401-403`): title = tag, subtitle = `naive <server>:<server_port>` (e.g. `naive 127.0.0.1:443`) when `server` set, else `naive outbound`. Correct.
- Status badge driven by `diagnosticStatus("/outbounds/<i>")` (`graph.ts:404`) — turns red when the naive-specific server/port/TLS diagnostics fire (see §Findings). Good.
- `compatible: []` for non-group outbounds (`graph.ts:428`), so the node-level `+` button is **gated off** (`SbcNode.tsx:392` renders only when `compatible.length>0`). **Pass-1's finding "the `+` button is visible and clickable but does nothing" is now STALE** — the affordance no longer renders for naive.
- Ports are per-port +/Trash buttons sourced from `portEndpointsForNode` (`SbcNode.tsx:277-278,94-108,308-382`); see §3. Correct shape for naive.
- Minor: titlebar shows raw `outbound / naive` (`SbcNode.tsx:291`) and the primary pill prints `{compatible.length || 1}` = `1` for naive (`SbcNode.tsx:436`) — a meaningless count. Cosmetic only (shared across all leaf outbounds). [P2]

## 3. Upstream/Downstream Links

For `outbound`/type=`naive`, `portRelationRegistry.ts` yields exactly the correct endpoint set (naive is excluded only from group/`outbound-member` outputs, included everywhere a dialed outbound belongs):

Inputs (things that may target a naive outbound):
- `route` route-final — `portRelationRegistry.ts:93`
- `route-rule` rule outbound — `:95`
- `selector-group` selector candidate — `:103`
- `urltest-group` urltest candidate — `:104`
- `dns-detour` DNS server detour — `:105`
- `detour-target` dial-detour target (outbound/endpoint/ntp) — `:106,108,115`
- `service-detour` (ccm/ocm) — `:109,110`
- `rule-set-download` download_detour — `:111`

Output (things a naive outbound may point to):
- `dial-detour` (its own Dial-Fields `detour`) — `:106`, whose source `nodeTypeExcludes:["block","selector","urltest","dns"]` correctly **includes** naive.

`outbound-member` outputs (`:103-104`) are correctly **excluded** (nodeType `selector`/`urltest` only) — naive cannot be a group. `referenceRegistry.ts` rename/remove correctly covers naive's participation as a generic outbound tag (route rules `:159,180`; selector/urltest members + `default` + `detour` `:160-164,181-184`; dns/endpoint/service/rule-set/ntp detours `:165-169,186-190`). **No missing, extra, or wrong links.** This matches the upstream model exactly (naive has Dial Fields, is referenceable as any outbound). Pass-1's prose port list is still accurate but predates the registry-driven rendering.

## 4. Right Inspector (fields) (table: one row per official field -> UI state)

Source of truth = `outbound/naive.md` fields. State verified in `Inspector.tsx` / `commands.ts` / `sharedFieldRegistry.ts`.

| Official field | UI state | Where |
|---|---|---|
| `type` | Type selector (CREATABLE list incl. naive) | protocols.ts:32 |
| `tag` | Tag field | Inspector tag control |
| `server` (Required) | First-class text; blocking diag if empty | Inspector.tsx:~3378; diagnostics.ts:534-543 |
| `server_port` (Required) | First-class number, default placeholder 443; blocking diag if out of range | Inspector.tsx:3385-3414 (`naive:443` @3391); diagnostics.ts:544-553 |
| `username` | First-class text input | Inspector.tsx:3449-3457 |
| `password` | First-class `SensitiveTextField` (masked); no double-render (username block skips it for naive) | Inspector.tsx:3458-3473 |
| `insecure_concurrency` (int) | NOT first-class; surfaces in Advanced only if already present (not in `outboundHandledFields`) | Inspector.tsx:178-240,686 |
| `extra_headers` (object) | First-class key/value repeater (add/rename/remove) | Inspector.tsx:3806-3864; handled @225 |
| `udp_over_tcp` (bool/obj) | Shared "UDP over TCP" group: enabled + version(1/2) | sharedFieldRegistry.ts:155,184; Inspector.tsx:1589-1593 |
| `quic` (bool) | **No first-class toggle anywhere**; only Advanced if pre-existing | (absent — confirmed no `updateField(ref,"quic")`) |
| `quic_congestion_control` | First-class select bbr/bbr2/cubic/reno (always shown, even when quic off) | Inspector.tsx:3720-3736; handled @228 |
| `tls` (Required; only `server_name`/`certificate`/`certificate_path`/`ech`) | Shared TLS group renders the **full generic TLS schema** (~25 fields incl. `insecure`,`alpn`,`min/max_version`,`disable_sni`,`cipher_suites`,`utls`,`reality`,`certificate_provider`,`key`/`key_path`); seeded `tls:{enabled:true,server_name:""}`; blocking diag if `enabled!=true` | sharedFieldRegistry.ts:151,180; Inspector.tsx:1502-1547; commands.ts:341; diagnostics.ts:555-570 |
| Dial Fields | Shared "dial" group (detour tag-select, binds, timeouts, etc.) | sharedFieldRegistry.ts:150,179 |

Net: every official field is reachable; only `quic` and `insecure_concurrency` lack discoverable controls, and the TLS group is far wider than the protocol honors.

## Findings (prioritized)

- **[P1] TLS group over-exposes fields NaiveProxy ignores.** `Inspector.tsx:1502-1547` renders the full generic TLS schema for all `outboundTlsTypes` (`sharedFieldRegistry.ts:151` includes `naive`). The upstream doc (`outbound/naive.md:104-112`) states the naive outbound TLS supports **only** `server_name`, `certificate`, `certificate_path`, `ech`; `insecure`/`alpn`/`min_version`/`max_version`/`utls`/`reality`/`certificate_provider`/`key*` are silently dropped by the Chromium/QUICHE stack, and self-signed certs defeat the protocol. Setting them produces config that looks honored but is not. Fix: type-narrow the `group==="tls"` definition for `kind==="outbound" && type==="naive"` to the 4 allowed paths (+`enabled`), or emit a diagnostic. (Pass-1 rated this P0; downgraded because it produces ignored-but-not-rejected config, not a startup failure.) Pass-1's sibling findings "`certificate` missing" and "`ech` not rendered" are now **STALE** — both exist at `Inspector.tsx:1519` and `:1539-1542`.

- **[P2] No platform / build-variant warning.** Upstream (`outbound/naive.md:29-49`) restricts the naive outbound to Apple/Android/Windows and specific Linux libcronet builds. No diagnostic or Inspector note conveys this (`diagnostics.ts` only warns about `resolved` platform, `:224`). A user on a stock Linux build gets a config that fails at runtime with no hint. Pass-1 rated this P0; downgraded since it is an environment caveat, not an invalid-config emission. Fix: add an info diagnostic for `outbound.type==="naive"` near `diagnostics.ts:555`.

- **[P2] No first-class `quic` toggle; `quic_congestion_control` shown unconditionally.** `quic` (bool, "use QUIC instead of HTTP/2") has no control and is absent from `outboundHandledFields` (`Inspector.tsx:178-240`), so it is only editable via Advanced when already present. Meanwhile the congestion-control select (`:3720-3736`) renders even when `quic` is off/unset, where it has no effect. Fix: add a `quic` boolean for naive and gate the congestion-control select behind it.

- **[P2] `insecure_concurrency` not first-class.** Number field reachable only via AdvancedScalarFields if pre-seeded (`Inspector.tsx:686`,`314-320`). Round-trips on import; just undiscoverable for new nodes. Optional: add labeled number input + hint that >0 weakens traffic-analysis resistance.

- **[P2] Cosmetic canvas labels.** Raw `outbound / naive` titlebar (`SbcNode.tsx:291`) and `{compatible.length || 1}`→`1` pill (`SbcNode.tsx:436`); shared across leaf outbounds, not naive-specific.

### Where pass-1 is now stale
- "[P0] `tls` not seeded" — **FIXED**: `commands.ts:333-342` seeds `tls:{enabled:true,server_name:""}` (+ `username`/`password`).
- "[P0] `extra_headers` completely invisible" — **FIXED**: key/value repeater at `Inspector.tsx:3806-3864`.
- "[P1] username/password only in Advanced" — **FIXED**: first-class at `Inspector.tsx:3449-3473` (password masked).
- "[P1] `quic_congestion_control` plain text / no enum" — **FIXED**: select at `Inspector.tsx:3720-3736`.
- "[P1] `ech` / `certificate` missing from TLS" — **FIXED**: present at `Inspector.tsx:1519,1539-1542`.
- "[P0] required server/port/TLS need first-class validation" — **LARGELY ADDRESSED**: blocking diagnostics at `diagnostics.ts:534-570`.
- "[P0] canvas `+` does nothing" — **STALE**: button gated off for naive (`SbcNode.tsx:392`).
- Pass-1 also asserted "stable = testing, identical, no testing additions" (`docs/claude/outbound-naive.md:9-11`) — inaccurate vs the upstream file, which carries the 1.13 "since" banner + platform/build table; treat the upstream doc, not that pointer, as truth.

SUMMARY: 0 P0, 1 P1, 4 P2.
