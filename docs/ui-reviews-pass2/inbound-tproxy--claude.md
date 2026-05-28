# inbound-tproxy — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

> Upstream truth: `docs/upstream/sing-box/testing/configuration/inbound/tproxy.md` + `docs/upstream/sing-box/testing/configuration/shared/listen.md`.
> The tproxy inbound has exactly ONE protocol-specific field: `network` (one of `tcp`/`udp`; empty = both). Its full writable surface = `type` + `tag` + Listen Fields + `network`.
> Official Listen Fields (14 active): `listen` (==Required==), `listen_port`, `bind_interface` (1.12), `routing_mark` (1.12, Linux; int OR hex string), `reuse_addr` (1.12), `netns` (1.12, Linux), `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive` (1.13), `tcp_keep_alive` (1.13, default 5m), `tcp_keep_alive_interval` (default 75s), `udp_fragment`, `udp_timeout` (default 5m), `detour`. Plus 5 deprecated (`sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping`) — must NOT be exposed.
> Platform: upstream says verbatim "Only supported on **Linux**." (Unlike redirect, which also allows macOS — so tproxy's Linux-only copy is CORRECT.)

## Verdict (2-3 sentences)
This node is in far better shape than pass-1 reported: a Linux-only platform banner exists, all 14 listen fields are editable, `network` has a dedicated tcp/udp/both `<select>`, `detour` is a select, `routing_mark` is text, and `address`/`auto_route` are correctly gated to `tun` only — so SEVEN of pass-1's findings are now STALE. The remaining real defects are duplication and validation: `network` renders twice (dedicated select + Advanced-fields fallback), two platform banners stack for tproxy, `listen` is `==Required==` upstream yet unmarked/unvalidated, and there is still no semantic diagnostic so the canvas/Palette never reflect the Linux constraint. Ports and the JSON scaffold are correct.

## 1. Left Palette
`Palette.tsx:146` — `{ label: "TProxy (Linux only)", kind: "inbound-tproxy", icon: GitBranch, docsUrl: docs("inbound/tproxy/"), status: "setup" }`.
- Present, correct group ("Inbounds"), correct docs URL. `inbound-tproxy → "tproxy"` mapping correct (`protocols.ts:64`, `:85`).
- `status: "setup"` IS actionable: `canActivate` allows `setup` (`Palette.tsx:281-282`); click runs `createFromPalette("inbound-tproxy")` → `addInbound(config, "tproxy", "tproxy-in")`. Pass-1's premise that the entry needed a platform gate to block creation is moot — and a "(Linux only)" label suffix is already present, so pass-1 P0 "no platform indicator in Palette" is **STALE**.
- `icon: GitBranch` is shared with `inbound-redirect` + route nodes; cosmetic only.

## 2. Canvas Node
Generic inbound rendering; tag `tproxy-in` → node id `inbound:tproxy-in`.
- Title = tag (`graph.ts:224`); subtitle = `"tproxy inbound"` (`graph.ts:225`); titlebar = `"inbound / tproxy"` (`SbcNode.tsx:291`); type pill (`SbcNode.tsx:408-411`). Type is clearly shown.
- Status from diagnostics scoped to `/inbounds/{index}` (`graph.ts:226`). No tproxy diagnostic exists, so status is always `valid` — no platform/`network` signal on canvas (see P1 below). Subtitle does NOT summarize `network` mode.
- Output ports via `portEndpointsForNode("inbound","tproxy","output")` → `route` (decorative), `route-rule-match`, `dns-rule-match` (`SbcNode.tsx:94-108`, `portRelationRegistry.ts:91`/`94`/`99`/`100`). The SSM `service` port is gated to `type==="shadowsocks"` (`portRelationRegistry.ts:113`), so tproxy correctly does NOT get it. No input ports. **Correct** per sing-box semantics (inbound is a traffic source, referenced by route/dns rules).
- `compatible: ["Route"]` (`graph.ts:227`) — fine.

## 3. Upstream/Downstream Links
Official relationship model: a tproxy inbound is *referenced by* (a) `route.rules[].inbound`, (b) `dns.rules[].inbound`; its listen `detour` *references* another inbound tag; and v2ray-api stats may list it.
- `portRelationRegistry.ts:94` `route-rule-inbound` (`/route/rules/*/inbound`) — present, correct.
- `portRelationRegistry.ts:99` `dns-rule-inbound` (`/dns/rules/*/inbound`) — present, correct.
- `portRelationRegistry.ts:91`/`:100` decorative `inbound→route` / `inbound→dns-query` — fine.
- `referenceRegistry.ts:326-331` inbound paths: `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` — rename/remove coverage correct for those.
- **MISSING link: inbound `detour` (inbound→inbound).** The Inspector exposes "Inbound Detour" as a select over inbound tags (`Inspector.tsx:1449`), matching upstream `detour` ("connections will be forwarded to the specified inbound"). But there is NO `/inbounds/*/detour` path in `referenceRegistry.ts:326-331` and NO `portRelationRegistry` relation — so renaming the target inbound will NOT update a `detour` pointing at it, and the canvas draws no edge. (P2 — node-wide gap, reachable from this Inspector.)
- No extra/wrong links for tproxy.

## 4. Right Inspector (fields)
For `ref.kind==="inbound"`, `sharedGroupsForEntity` pushes only `["listen"]` (tproxy ∈ `CREATABLE_INBOUND_TYPES`; not in tls/quic/multiplex/transport/nested-dial sets) — `sharedFieldRegistry.ts:170-176`. Correct. Listen card from `sharedFieldDefinitions("listen", …)` `Inspector.tsx:1435-1450`. Protocol field `network` rendered by a dedicated tproxy block `Inspector.tsx:2968-2980`.

| Official field | Req | UI control | State |
|---|---|---|---|
| `network` | | `<select>` both/tcp/udp (`:2968-2980`, `entityType==="tproxy"`) | Present + correct options; writes `entity.network`. **BUT also rendered again in Advanced fields** — `"network"` is NOT in `inboundHandledFields` (`:140-177`), so `editableScalarFields` re-emits it (`:314-319`, `:686`, `:3237`) whenever set → duplicate control (P1) |
| `listen` | ✅ | text (`:1436`) | Present. **No required marker / no empty-value validation** (P1) |
| `listen_port` | | number (`:1437`) | OK |
| `bind_interface` | | text (`:1438`) | OK ("1.12+") |
| `routing_mark` | | text (`:1439`) | OK; int-or-hex accepted as text; "(Linux)" labeled |
| `reuse_addr` | | boolean (`:1440`) | OK |
| `netns` | | text (`:1441`) | OK; "(Linux, 1.12+)" |
| `tcp_fast_open` | | boolean (`:1442`) | OK |
| `tcp_multi_path` | | boolean (`:1443`) | OK |
| `disable_tcp_keep_alive` | | boolean (`:1444`) | OK ("1.13+") |
| `tcp_keep_alive` | | text (`:1445`) | OK; no `5m` default placeholder (P2) |
| `tcp_keep_alive_interval` | | text (`:1446`) | OK; no `75s` default placeholder (P2) |
| `udp_fragment` | | boolean (`:1447`) | OK |
| `udp_timeout` | | text (`:1448`) | OK; no `5m` default placeholder (P2) |
| `detour` | | select over inbound tags (`:1449`) | Present; control correct, but rename-safety gap (see §3 P2) |
| deprecated ×5 | | — | Correctly NOT in listen card |

Non-listen handling:
- `address` + `auto_route` render ONLY for `entityType==="tun"` (`Inspector.tsx:2609-2627`). Absent for tproxy. Pass-1 P2 "address/auto_route shown for tproxy" is **STALE / RESOLVED**.
- Template scaffold (`commands.ts:262-268`) sets `listen: "127.0.0.1"`, `listen_port: 2080`, and does NOT set `network` (defaults to both). Pass-1's complaint that the stub hard-codes `network: "tcp"` is **STALE** — it is no longer set.
- Tag rename input + Type `<select>` over `CREATABLE_INBOUND_TYPES` present (`:2113-2119`).

Platform banners for tproxy:
- Banner #1 (`Inspector.tsx:2597-2602`, `entityType==="tproxy"`): "TProxy inbound only works on Linux (iptables TPROXY)…". **Correct.**
- Banner #2 (`Inspector.tsx:2962-2967`, `tproxy || redirect`): "Linux-only inbound… will not bind on macOS/Windows/iOS." **Correct for tproxy** (the macOS exclusion is wrong only for redirect).
- Both render simultaneously → duplicate banner (P2). Copy is accurate, so this is cosmetic, not a P0 (contrast redirect, where the copy is factually wrong).

## Findings (prioritized)

- **[P1] `network` renders twice for tproxy.** A node with `network` set shows the dedicated select (`src/components/Inspector.tsx:2968-2980`) AND an "Network" entry in the Advanced-fields accordion, because `"network"` is missing from `inboundHandledFields` (`src/components/Inspector.tsx:140-177`) and `editableScalarFields` therefore re-emits it (`src/components/Inspector.tsx:314-319` via `:3237`). Two controls edit the same key — confusing and error-prone. Fix: add `"network"` to `inboundHandledFields`. (Same latent issue exists for `direct`'s network select at `:2981`.)
- **[P1] `listen` is `==Required==` upstream but unmarked/unvalidated.** Listen card renders it as a plain optional text field (`src/components/Inspector.tsx:1436`); no required indicator, and `src/domain/diagnostics.ts` has no error for an empty `listen` on inbounds (the only `listen` checks at `:292-300` are CCM-service-specific). Add a required marker + an error-level diagnostic for missing inbound `listen`.
- **[P1] No semantic diagnostic for the Linux-only constraint.** `src/domain/diagnostics.ts` has no tproxy/redirect entry (precedent exists at `:222-224` `resolved-service-linux-only`). Result: canvas node status (`src/canvas/graph.ts:226`) and the Palette show no platform hazard; only the already-open Inspector warns. Add a `warning` diagnostic at `/inbounds/{index}` for `type==="tproxy"`.
- **[P2] Duplicate platform banner for tproxy.** `entityType==="tproxy"` triggers the dedicated banner at `src/components/Inspector.tsx:2597` AND the shared `tproxy || redirect` banner at `src/components/Inspector.tsx:2962`. Both are accurate but redundant — remove one (recommend keeping a single tproxy-only banner once the shared one is split from redirect).
- **[P2] `detour` (inbound→inbound) is not tracked for rename/remove and draws no canvas edge.** Inspector exposes it (`src/components/Inspector.tsx:1449`) but there is no `/inbounds/*/detour` path in `src/domain/referenceRegistry.ts:326-331` nor a relation in `src/domain/portRelationRegistry.ts`. Renaming the target inbound orphans the reference; the relationship is invisible on canvas.
- **[P2] Type-switch drops all user-edited listen fields + `network`.** `changeEntityType` for inbound fully replaces the entity, preserving only `tag` (`src/domain/commands.ts:908-911`), unlike outbound/dns-server/service which preserve `detour`/`listen`/`listen_port` (`:912-957`). Switching to/from tproxy silently discards `listen`, `listen_port`, `detour`, `network`, etc.
- **[P2] Missing default-value placeholders** for `tcp_keep_alive` (5m), `tcp_keep_alive_interval` (75s), `udp_timeout` (5m) in the listen card (`src/components/Inspector.tsx:1445-1448`). Minor UX; these are documented defaults.

Stale pass-1 items (now fixed in code): P0 "no Linux platform gate anywhere" (banner exists, `Inspector.tsx:2597`; Palette label "(Linux only)" `Palette.tsx:146`); P0 "`detour` absent from Inspector" (now a select, `Inspector.tsx:1449`); P1 "`network` falls to Advanced raw text" (now a dedicated select, `Inspector.tsx:2968`); P1 "5 listen fields missing" (all 14 present, `Inspector.tsx:100-115` + `:1435-1450`); P1 "`routing_mark` rendered as number" (now text, `Inspector.tsx:1439`); P1 "template hard-codes `network:tcp`" (no longer set, `commands.ts:262-268`); P2 "address/auto_route shown for tproxy" (now `tun`-gated, `Inspector.tsx:2609`).

SUMMARY: 0 P0, 3 P1, 4 P2.
