# inbound-shadowtls — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->
<!-- upstream: docs/upstream/sing-box/testing/configuration/inbound/shadowtls.md -->

## Verdict (2-3 sentences)
The node is in much better shape than pass-1 reported: the default scaffold is fixed (no spurious `password`, required `handshake` present), and the Inspector now has a real `version` select, a structured Users editor, and a Handshake dial card. The remaining gaps are version-gating and field coverage: `password` (v2), `strict_mode` (v3), `wildcard_sni` (v3) have no dedicated controls and aren't gated; `handshake_for_server_name` is only reachable as raw JSON that silently writes an invalid string on parse error; the Users editor shows for all versions; and there are still zero shadowtls semantic diagnostics. Palette, canvas node, and link model are all correct.

## 1. Left Palette
- Present and correct. `Palette.tsx:139` — `{ label: "ShadowTLS", kind: "inbound-shadowtls", icon: Shield, docsUrl: docs("inbound/shadowtls/"), status: "setup" }`. Sits in the "Inbounds" group, distinct from the "Outbounds" ShadowTLS at `Palette.tsx:163`.
- Label, icon (Shield), and docs URL all correct. `status: "setup"` renders a "Setup" pill; tooltip "Add ShadowTLS setup draft to canvas" (`Palette.tsx:270`) is accurate — clicking calls `createFromPalette` → `createInbound` (`commands.ts:196`).
- No target/version gating, which is fine: shadowtls is creatable on every channel (it is in `CREATABLE_INBOUND_TYPES`, `protocols.ts:77`). The protocol-version hazard copy that pass-1 wanted is an Inspector concern, not a palette concern.
- Pass-1 stale: pass-1 worried the entry might not actually add an object — it does.

## 2. Canvas Node
- Type mapping correct: `"inbound-shadowtls" → "shadowtls"` (`protocols.ts:57`); preferred tag `"st-in"` (`protocols.ts:179`); icon Shield via `outboundIcon`? no — inbound uses `iconMap.inbound` = RadioTower (`SbcNode.tsx:37`). Titlebar shows `inbound / shadowtls` (`SbcNode.tsx:291`); summary title = tag, subtitle = `"shadowtls inbound"` (`graph.ts:224-225`). Both correct.
- Ports correct per sing-box semantics. Right/output ports for an inbound resolve via `portEndpointsForNode("inbound", ...)`: `route` (decorative hub), `route-rule-match`, `dns-rule-match`, and `service` (SSM managed, gated to `nodeType: "shadowsocks"` at `portRelationRegistry.ts:113` so it does NOT show for shadowtls). Net visible right ports for shadowtls: Route hub + Route rule matcher + DNS rule matcher. No left/input ports. This is exactly right — a shadowtls inbound is only ever referenced by route/dns rules via `inbound[]`.
- Correctly NO port for `handshake` / `handshake.detour`. The handshake dial target is an embedded outbound-like object, not a tag reference to an outbound node, so it must not be a draggable edge. Pass-1's concern ("don't let users drag a route edge and overwrite handshake dial fields") is satisfied — handshake is Inspector-only. Good.
- No version/handshake summary chip on the card. Acceptable (Inspector concern); minor [P2] polish at most.

## 3. Upstream/Downstream Links
Official relationship model for an inbound: referenced by `route.rules[].inbound`, `dns.rules[].inbound`, and (shadowsocks-only) `services[].servers`. The embedded `handshake.detour` / `handshake_for_server_name.*.detour` may reference an outbound tag.

- `referenceRegistry.ts:327` inbound entry paths = `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds`. Correct for rename/delete cascade. shadowtls is correctly NOT special-cased (it is never an SSM managed target).
- `portRelationRegistry.ts:94,99` route-rule-inbound / dns-rule-inbound relations wire the matcher ports. Correct.
- Missing link [P2]: `handshake.detour` (and `handshake_for_server_name.*.detour`) are real outbound tag references but are NOT in `referenceRegistry` outbound paths (`referenceRegistry.ts:334`). If a user sets Handshake Detour to an outbound and later renames/deletes that outbound, the nested `handshake.detour` is neither rewritten nor cleared → dangling ref. The Inspector exposes this field (`Inspector.tsx:1471`), so the dangling-ref path is reachable. (Endpoints/dns-servers nest `detour` at top level and are covered; the shadowtls nesting under `handshake.*` is not.)
- No extra/wrong links. The link model is otherwise complete and correct.
- Pass-1 stale: pass-1 only described the model abstractly and flagged the handshake-vs-outbound confusion as the main risk; that risk is handled. The concrete `handshake.detour` rename gap is new here.

## 4. Right Inspector (fields)
Rendered under `ref.kind === "inbound"` (`Inspector.tsx:2583+`). Version select at `2871-2892`; structured Users editor at `3125-3236` (schema `INBOUND_USER_SCHEMAS.shadowtls`, `Inspector.tsx:552-558`); Handshake dial card via shared "dial" group (`sharedFieldRegistry.ts:175` → `Inspector.tsx:1467-1474`). `inboundHandledFields` (`Inspector.tsx:140-177`) includes `version`, `users`, `handshake` but NOT `password`, `strict_mode`, `wildcard_sni`, `handshake_for_server_name`.

| Official field | Version | UI state | Verdict |
|---|---|---|---|
| Listen Fields | all | Shared "Listen Fields" card (`sharedFieldRegistry.ts:170`, `Inspector.tsx:1431-1451`); listen/listen_port + bind_interface, tcp_fast_open, detour, etc. | OK |
| `version` | all | `<select>` 1/2/3, default-aware "(default — 3)" (`Inspector.tsx:2871-2892`); writes number; clears to undefined on blank | OK (label "(default — 3)" is wrong vs upstream default `1`, see P1) |
| `password` | v2 only | NO dedicated control; not in `inboundHandledFields`, so a string `password` falls into **Advanced fields** as a generic input (masked because name matches sensitive pattern, `Inspector.tsx:705`). Never shown/removed based on version. | Missing dedicated + not version-gated [P1] |
| `users[]` | v3 only | Structured repeater (name + masked password, add/remove) (`Inspector.tsx:3136-3234`). BUT renders for **any** version (schema keyed only on type), so v1/v2 wrongly show a Users editor. | Present but not version-gated [P1] |
| `users[].name` | v3 | text input (`Inspector.tsx:553`) | OK |
| `users[].password` | v3 | masked SensitiveTextField (`Inspector.tsx:555`, label "Password (v3)") | OK |
| `handshake` (==Required==) | all | Shared dial card: Handshake Server (text), Handshake Port (number), Handshake Detour (select outbounds), Connect Timeout (text) (`Inspector.tsx:1467-1474`). Default scaffold supplies `{server:"google.com",server_port:443}` (`commands.ts:204`). | Partial — required not enforced (P1); dial coverage thin (P2) |
| `handshake.server` | cond. | text (`Inspector.tsx:1469`) | OK |
| `handshake.server_port` | cond. | number (`Inspector.tsx:1470`) | OK |
| `handshake.*` dial fields | all | only `detour` + `connect_timeout` exposed; missing `domain_resolver`, `bind_interface`, `tcp_fast_open`, `network_strategy`, `fallback_delay`, etc. | Incomplete [P2] |
| `handshake_for_server_name` | v2/v3 | NOT in `inboundHandledFields` and is an object → falls into **Advanced JSON fields** via `AdvancedNonScalarFields`/`JsonField` (`Inspector.tsx:3238`, `820-848`). Raw JSON only; no per-SNI repeater; not version-gated. | Missing structured UI [P1]; invalid-JSON write [P1] |
| `strict_mode` | v3 only | NO dedicated control; not handled → boolean falls into **Advanced fields** checkbox (`Inspector.tsx:693`). Not version-gated. | Missing dedicated + not gated [P2] |
| `wildcard_sni` | v3 only (1.12+) | NO dedicated control; not handled → string falls into **Advanced fields** as free-text input (any value accepted). Should be `<select>` off/authed/all. Not version-gated. | Wrong control + not gated [P2] |

Sensitive masking: user passwords and any `password` field are masked (`Inspector.tsx:620-637,705`). Good.

## Findings (prioritized)

- [P1] `password` (v2) has no dedicated, version-gated control. It only surfaces in "Advanced fields" and is never hidden/removed when `version !== 2`. A v2 inbound's required credential is buried; switching to v1/v3 leaves a stray `password` in the JSON. `Inspector.tsx:140-177` (add `password` to handled set) + add a gated field near `Inspector.tsx:2871`.
- [P1] Users editor renders for every version. `INBOUND_USER_SCHEMAS.shadowtls` is keyed only on type, so the Users repeater shows for v1/v2 too, where `users[]` is illegal. Gate the block at `Inspector.tsx:3126` on `entity.version === 3` (and the default `version: 3` scaffold already supplies one user).
- [P1] `handshake_for_server_name` is only editable as raw JSON, and the editor silently writes an invalid string on parse failure. `JsonField` (`Inspector.tsx:807-816`) does `try { onChange(JSON.parse(...)) } catch { onChange(event.target.value) }` — a typo turns the map into a string that exports as invalid config with no error surfaced. Needs a per-SNI repeater (or at minimum a validated JSON field that retains last-good value), gated on v2/v3.
- [P1] `handshake` is documented `==Required==` but nothing enforces it. There is no diagnostic for a missing `handshake.server`/`server_port` (except when `wildcard_sni === "all"`). `diagnostics.ts` inbound loop (`diagnostics.ts:~575-590`) only checks TLS for `tlsRequiredInboundTypes`, which correctly excludes shadowtls — but no replacement handshake check exists. Add a shadowtls branch.
- [P1] No version/credential coherence diagnostics. Nothing warns when: `version===2` but `password` empty; `version===3` but `users` empty; `password` present with v1/v3; `users` present with v1/v2; `strict_mode`/`wildcard_sni`/`handshake_for_server_name` present with an incompatible version. `diagnostics.ts` has zero shadowtls-specific rules (grep: only outbound `tlsRequired`/`proxyOutbound` lists at `diagnostics.ts:507,521`).
- [P1] Version select default label is misleading. `Inspector.tsx:2886` shows "(default — 3)", but upstream default `version` is **1** (`shadowtls.md:57`). The scaffold uses 3 deliberately, but a blank select implies the engine default, which is 1. Either always write an explicit version or relabel to "(unset — engine default 1)".
- [P2] `wildcard_sni` should be a `<select>` off/authed/all, not a free-text Advanced field. Currently any string is accepted (`Inspector.tsx:705`/`715` fallthrough). Add a gated select near the version block.
- [P2] `strict_mode` should be a labeled, v3-gated checkbox rather than an Advanced field. Functional today (boolean → checkbox at `Inspector.tsx:693`) but undiscoverable and ungated.
- [P2] Handshake dial card omits most dial fields. Only `detour` + `connect_timeout` beyond server/port (`Inspector.tsx:1467-1474`); `domain_resolver` (increasingly important in 1.14), `bind_interface`, `tcp_fast_open`, `network_strategy`, `fallback_delay` are unreachable.
- [P2] `handshake.detour` (and per-SNI detours) are real outbound references but absent from `referenceRegistry` outbound paths (`referenceRegistry.ts:334`); renaming/deleting the target outbound leaves a dangling `handshake.detour`. The Handshake Detour select (`Inspector.tsx:1471`) makes this reachable.

### Pass-1 now stale
- Pass-1 "P0 — required handshake absent from default scaffold": FIXED. `commands.ts:196-205` now emits `handshake:{server:"google.com",server_port:443}`.
- Pass-1 "P0 — scaffold emits version-invalid combo (password + users with v3)": FIXED. Scaffold now emits only `version:3` + `users[]`, no `password` (`commands.ts:196-205`).
- Pass-1 "P1 — version is a plain number input": FIXED. Now a 1/2/3 `<select>` (`Inspector.tsx:2871-2892`).
- Pass-1 "P1 — users[] not reachable / suggest JSON field": SUPERSEDED. A structured repeater exists (`Inspector.tsx:3136-3234`); the live issue is it isn't version-gated.
- Pass-1 "P2 — address/auto_route shown for all inbounds": FIXED. Those fields are now `entityType === "tun"`-gated (`Inspector.tsx:2609-2627`), so they no longer appear for shadowtls.

SUMMARY: 0 P0, 6 P1, 4 P2.
