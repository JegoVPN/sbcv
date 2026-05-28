# outbound-socks — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `socks` outbound is now in strong shape across all four surfaces: Palette `ready`, canvas node shows tag + `socks server:port`, the full upstream/downstream relationship model is wired in both registries, and the Inspector exposes every official field (server, server_port, SOCKS version, username, password, network, udp_over_tcp, and the complete dial group) with sensible control types, port-default placeholder, masked password, and error-level diagnostics for missing server / bad port. Pass-1 (`docs/ui-reviews/outbound-socks.md`) is now almost entirely STALE: its two P0s (fields absent from new nodes; no first-class controls) and its P1 (no server diagnostic) are all resolved in code. Remaining issues are minor correctness/UX nits (password shown even on SOCKS4/4a, UoT version written as a string instead of an integer, redundant explicit `version:"5"` write).

## 1. Left Palette

- Entry present: `{ label: "SOCKS", kind: "socks", icon: Network, docsUrl: docs("outbound/socks/"), ready: true }` — `src/components/Palette.tsx:155`, inside the **Outbounds** group (correct category).
- `ready: true` → `itemStatus` returns `"add"` (`Palette.tsx:263`), button label/title = "Add" / "Add SOCKS to canvas". Click → `createFromPalette("socks")` (`Palette.tsx:472-475`) → `addOutbound(config, "socks", "proxy-out")` (`useProjectStore.ts:889`/`1032`). Correct default-action.
- Docs link `outbound/socks/` matches the official doc. Not gated. No taxonomy issue.
- Kind→type mapping correct: `OUTBOUND_PALETTE_TYPES.socks = "socks"` (`src/domain/protocols.ts:4`); `socks` is in `CREATABLE_OUTBOUND_TYPES` (`protocols.ts:27`). Preferred tag `proxy-out` (`protocols.ts:149`).

## 2. Canvas Node

- Title bar shows `outbound / socks` (kind/type) — `src/components/SbcNode.tsx:291`. Icon for non direct/block/selector/urltest outbound is the generic `Shield` (`SbcNode.tsx:52-57`).
- `title` = tag; `subtitle` = `socks <server>:<server_port>` via the `outbound.server` branch — `src/canvas/graph.ts:395-403`. So server:port IS surfaced (pass-1 "no socks-specific canvas rendering" is stale).
- `status` derives from diagnostics for `/outbounds/{index}` (`graph.ts:404`) → a node with empty/missing server or bad port renders red `error` (see §Findings, diagnostics).
- `compatible: []` for a non-group socks (`graph.ts:405-428`) → no big `+` add affordance and no hover `+` chips. Correct: a leaf proxy has no obvious next object. Only selector/urltest get the candidate add-list.
- Ports (from `portRelationRegistry` via `portEndpointsForNode`, `SbcNode.tsx:94-108`):
  - Input ports for `outbound/socks`: Upstream Route final, Upstream Rule outbound, Upstream Selector candidate, Upstream URLTest candidate, Upstream DNS detour target, Upstream Dial detour target (shared `detour-target`, covers other-outbound + endpoint + ntp referrers), Upstream service detour target, Upstream Rule Set download detour. All correct per sing-box semantics.
  - Output port: `dial-detour` — `outbound-detour` source endpoint excludes only `["block","selector","urltest","dns"]` (`portRelationRegistry.ts:106`), so socks correctly gets exactly one Dial-detour output. No TLS/transport/multiplex ports appear (socks has none). Correct.

## 3. Upstream/Downstream Links

Relationship model fully matched in `src/domain/portRelationRegistry.ts` and `src/domain/referenceRegistry.ts`:

- Referenced-by (inputs): route final `route-final` (`portRelationRegistry.ts:93`), route rule outbound `route-rule` (:95), selector `selector` (:103), urltest `urltest` (:104), dns server detour `dns-server-detour` (:105), other-outbound dial detour + endpoint dial detour + ntp detour all via `detour-target` (`outbound-detour` :106, `endpoint-detour` :108, `settings-ntp-detour` :115), service detour `service-detour-ccm/ocm` (:109-110), rule-set download `rule-set-download` (:111). 
- Its own dial detour output: `outbound-detour` source `dial-detour` → `/outbounds/*/detour` (:106). Correct.
- `referenceRegistry` outbound entry rename/remove cascades to every site: `/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, `/dns/servers/*/detour`, `/endpoints/*/detour`, `/services/*/detour`, `/route/rule_set/*/download_detour`, `/ntp/detour`, clash `external_ui_download_detour`, v2ray stats (`referenceRegistry.ts:333-336`, impl 157-197). Complete.
- Inspector dial `Detour` is an outbound `<select>` (not raw text): `sharedFieldDefinitions` dial group, `Inspector.tsx:1478`, options = `outboundTags(config, self)` (:1426). Pass-1 P0 "Dial detour must use a select, not raw tag text" is RESOLVED.

Missing/extra/wrong links: **none found.**

## 4. Right Inspector (fields)

Outbound render branch begins `Inspector.tsx:2120`; shared cards rendered once at `Inspector.tsx:5343` via `sharedGroupsForEntity` → for socks returns `["dial","udp-over-tcp"]` (`sharedFieldRegistry.ts:178-185`, socks in `outboundDialTypes` :150 and `outboundUdpOverTcpTypes` :155).

| Official field | Required | UI state | Control | Notes |
|---|---|---|---|---|
| `server` | yes | Exposed (`Inspector.tsx:3376-3384`) | text | Rendered when `"server" in entity`; seeded `127.0.0.1` so always shown. No `*`/required marker on the label; empty value caught by diagnostic. |
| `server_port` | yes | Exposed (`Inspector.tsx:3385-3413`) | number | Default/placeholder 1080 for socks; writes only when `>0`; sub-1/non-numeric → cleared and flagged by diagnostic. No required marker. |
| `version` | no (def `5`) | Exposed (`Inspector.tsx:4068-4079`) | select `5`/`4a`/`4` | "SOCKS Version" label (disambiguated from UoT). Defaults display to `5`; writes string. Always persists even when `5` (no empty/default option) → minor noise. |
| `username` | no | Exposed (`Inspector.tsx:3451-3457`) | text | Shown for `["http","socks","naive"]`; empty → `undefined`. Correct (applies to all SOCKS versions). |
| `password` | no (SOCKS5 only) | Exposed (`Inspector.tsx:3458-3464`) | SensitiveTextField (masked) | Shown for socks (gate excludes only naive). Masked + reveal toggle (`SensitiveTextField` :639). NOT gated on version → shown even for SOCKS4/4a where it is meaningless (see P2). |
| `network` | no (def both) | Exposed (`Inspector.tsx:3415-3427`) | select | Options `""`→"tcp + udp (both)" / `tcp` / `udp`; empty → `undefined`. Correct enum + default semantics. |
| `udp_over_tcp` | no (bool\|obj) | Exposed (shared card; `Inspector.tsx:1589-1593`) | toggle + select | "UDP over TCP" ModuleCard: Enabled (boolean → `udp_over_tcp.enabled`) + Version select `1`/`2` (→ `udp_over_tcp.version`). Always emits object form (never the bare `false`), which is valid. Version written as STRING, upstream wants integer (see P1). |
| dial fields | no | Exposed (shared "Dial Fields"-style card; `Inspector.tsx:1476-1500`) | mixed | Complete vs `shared/dial.md`: detour(select), bind_interface, inet4/inet6_bind_address, bind_address_no_port, routing_mark, reuse_addr, netns, connect_timeout, tcp_fast_open, tcp_multi_path, disable_tcp_keep_alive, tcp_keep_alive, tcp_keep_alive_interval, udp_fragment, domain_resolver(select), network_strategy, network_type, fallback_network_type, fallback_delay, domain_strategy(deprecated). |

- `version`/`username`/`password`/`network`/`udp_over_tcp` are all in `outboundHandledFields` (`Inspector.tsx:178-240`, esp. 190-199) → they do NOT double-render under Advanced scalar fields. No invalid-JSON write path: every socks field uses a typed control (select/number/masked-text/toggle), no raw-JSON textarea. UI fields with no official-model backing: **none** for socks.
- Type switch via `changeEntityType` (`Inspector.tsx:2121`); tag references are preserved by `referenceRegistry` on rename/remove. No TLS/transport/multiplex controls leak into socks (those gate on type lists that exclude socks — e.g. `Inspector.tsx:3467` password-only list, tls/transport groups in `sharedFieldRegistry.ts:151-154`). Pass-1 P0 "must not inherit TLS/transport/multiplex" RESOLVED.

## Findings (prioritized)

- **[P1] `udp_over_tcp.version` written as string, upstream requires integer.** Shared select `coerceSharedFieldValue` returns the raw string for `kind:"select"` (`src/components/Inspector.tsx:1631`), so the UoT Version control (`Inspector.tsx:1592`) persists `udp_over_tcp.version: "2"` instead of `2`. `shared/udp-over-tcp.md` defines version as integer `1`/`2`. sing-box may reject or mis-handle the quoted value on export. Coerce numeric-enum selects to `Number(...)` for this path. (Affects all UoT owners, surfaced here on socks.)

- **[P2] `password` shown for SOCKS4/4a where it has no meaning.** `Inspector.tsx:3458-3464` renders the Password field for socks regardless of `version`. Upstream: `password` is "SOCKS5 password"; SOCKS4/4a use only `username`. Gate the field on `version !== "4" && version !== "4a"`, or relabel "Password (SOCKS5 only)". Pass-1 raised this as P0; with first-class controls now present it is a low-severity polish item.

- **[P2] SOCKS Version select always writes an explicit value (incl. the default `5`).** `Inspector.tsx:4073` does `updateField(ref, "version", event.target.value)` with no `|| undefined` and no empty/"(default)" option. Selecting `5` writes `version: "5"`, adding noise vs. the doc default (SOCKS5 when omitted). Optional: add a `""`→"5 (default)" option and drop the key when default, matching how `network` handles its default.

- **[P2] Required fields `server`/`server_port` lack a visible required marker in the Inspector.** Labels at `Inspector.tsx:3378` and `:3399` are plain "Server"/"Port"; correctness is enforced only by the diagnostic (`src/domain/diagnostics.ts:534-553`). Add a `*`/required affordance for parity with the upstream `==Required==` markers.

Notes on stale pass-1 items (now resolved, no action): first-class `version`/`username`/`password`/`network` controls exist (`Inspector.tsx:3415-3466`, `4068-4079`); they are in `outboundHandledFields` (`Inspector.tsx:190-199`); the missing-server / invalid-port diagnostics exist as **errors** for all proxy outbounds incl. socks (`diagnostics.ts:499-553`), plus a domain-without-resolver warning (`diagnostics.ts:441-452`); dial detour uses an outbound select (`Inspector.tsx:1478`); no TLS/transport/multiplex leakage.

SUMMARY: 0 P0, 1 P1, 3 P2.
