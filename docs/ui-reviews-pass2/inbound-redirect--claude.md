# inbound-redirect — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

> Upstream truth: `docs/upstream/sing-box/testing/configuration/inbound/redirect.md` + `docs/upstream/sing-box/testing/configuration/shared/listen.md`.
> The redirect inbound has ZERO protocol-specific fields. Its entire writable surface = `type` + `tag` + Listen Fields.
> Official Listen Fields (14 active): `listen` (==Required==), `listen_port`, `bind_interface` (1.12), `routing_mark` (1.12, Linux), `reuse_addr` (1.12), `netns` (1.12, Linux), `tcp_fast_open`, `tcp_multi_path`, `disable_tcp_keep_alive` (1.13), `tcp_keep_alive` (1.13, default 5m), `tcp_keep_alive_interval` (default 75s), `udp_fragment`, `udp_timeout` (default 5m), `detour`. Plus 5 deprecated (`sniff`, `sniff_override_destination`, `sniff_timeout`, `domain_strategy`, `udp_disable_domain_unmapping`) — must NOT be exposed.
> Platform: upstream says verbatim "Only supported on **Linux and macOS**."

## Verdict (2-3 sentences)
The node is in much better shape than pass-1 claimed: all 14 listen fields are now editable, `address`/`auto_route` are correctly gated to `tun` only, and a platform banner exists — so three of pass-1's findings (P0 phantom fields, P1 six missing listen fields, P1 "setup blocks creation") are now STALE. The remaining real defects are correctness-of-copy and gating: the Inspector renders TWO redirect platform banners and BOTH wrongly state "Linux only" when upstream explicitly includes macOS, and there is still no semantic diagnostic, so the canvas node and Palette never reflect the platform constraint. Ports, links, and the JSON scaffold are all correct.

## 1. Left Palette
`Palette.tsx:145` — `{ label: "Redirect (Linux only)", kind: "inbound-redirect", icon: GitBranch, docsUrl: docs("inbound/redirect/"), status: "setup" }`.
- Present, correct group ("Inbounds"), correct docs URL. `inbound-redirect → "redirect"` mapping is correct (`protocols.ts:63`, `:84`).
- `status: "setup"` IS actionable: `canActivate` allows `setup` (`Palette.tsx:281-282`) and `createFromPalette` runs `addInbound(config, "redirect", "redirect-in")` and selects the new node (`useProjectStore.ts:733-737`). So pass-1's P1 "setup blocks node creation" is **STALE** — clicking adds a working scaffold.
- Label text "Redirect (Linux only)" is **wrong**: upstream is "Linux and macOS." Should read "Linux / macOS only." (P2)
- `icon: GitBranch` is shared with TProxy + route nodes; cosmetic only.

## 2. Canvas Node
Generic inbound rendering; for tag `redirect-in` → node id `inbound:redirect-in`.
- Title = tag (`graph.ts:224`); subtitle = `"redirect inbound"` (`graph.ts:225`); titlebar = `"inbound / redirect"` (`SbcNode.tsx:291`). Pass-1's claim that it "renders `tag ?? ref.kind`" with no type is **STALE** — type is shown in subtitle, pill (`SbcNode.tsx:408-411`) and titlebar.
- Status from diagnostics scoped to `/inbounds/{index}` (`graph.ts:226`, `diagnosticStatus`). Because no redirect platform diagnostic exists, status is always `valid` — no platform signal on canvas (see P1 below).
- Ports (output) resolve via `portEndpointsForNode("inbound","redirect","output")` → `route` (decorative), `route-rule-match`, `dns-rule-match`. The `service`/SSM port is gated to `type==="shadowsocks"` (`portRelationRegistry.ts:113`), so redirect correctly does NOT get it. No input ports. **Correct** per sing-box semantics (inbound is a source; referenced by route/dns rules).
- `compatible: ["Route"]` (`graph.ts:227`) — fine.

## 3. Upstream/Downstream Links
Official relationship model for a redirect inbound: it is *referenced by* (a) `route.rules[].inbound`, (b) `dns.rules[].inbound`; its listen `detour` *references* another inbound tag; and v2ray-api stats may list it.
- `portRelationRegistry.ts:94` `route-rule-inbound` (`/route/rules/*/inbound`) — present, correct.
- `portRelationRegistry.ts:99` `dns-rule-inbound` (`/dns/rules/*/inbound`) — present, correct.
- `portRelationRegistry.ts:91`/`:100` decorative `inbound→route`/`inbound→dns-query` — fine.
- `referenceRegistry.ts:326-331` inbound paths: `/route/rules/*/inbound`, `/dns/rules/*/inbound`, `/services/*/servers`, `/experimental/v2ray_api/stats/inbounds` — rename/remove coverage correct for those.
- **MISSING link: inbound `detour` (inbound→inbound).** The Inspector exposes "Inbound Detour" as a select over inbound tags (`Inspector.tsx:1449`, `sharedFieldDefinitions` listen group), and upstream `detour` "connections will be forwarded to the specified inbound." But there is NO `referenceRegistry` path for `/inbounds/*/detour` and NO `portRelationRegistry` relation — so renaming a target inbound tag will NOT update a `detour` that points at it, and the canvas draws no edge for it. (P2 — node-wide, not redirect-specific, but reachable from this Inspector.)
- No extra/wrong links for redirect.

## 4. Right Inspector (fields)
For `ref.kind==="inbound"`, `sharedGroupsForEntity` pushes only `["listen"]` (redirect ∈ `CREATABLE_INBOUND_TYPES`; not in tls/quic/multiplex/transport/nested-dial sets) — `sharedFieldRegistry.ts:170-175`. Correct. Listen card fields from `sharedFieldDefinitions("listen", …)` `Inspector.tsx:1435-1450`.

| Official field | Req | UI control | State |
|---|---|---|---|
| `listen` | ✅ | text (`:1436`) | Present. **No required marker / no empty-value validation** (P1) |
| `listen_port` | | number (`:1437`) | OK |
| `bind_interface` | | text (`:1438`) | OK ("1.12+") |
| `routing_mark` | | text (`:1439`) | OK; int-or-hex accepted as text. "(Linux)" labeled |
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
- `address` + `auto_route` render ONLY for `entityType==="tun"` (`Inspector.tsx:2609-2627`). For redirect they are absent. Pass-1 P0 "address/auto_route spuriously rendered" is **STALE / RESOLVED**.
- `inboundHandledFields` includes all listen fields + `address`/`auto_route` (`Inspector.tsx:140-177`), so `AdvancedScalarFields`/`AdvancedNonScalarFields` show nothing spurious for a clean redirect scaffold. Any unknown imported scalar falls into the Advanced accordion with type-correct controls — acceptable.
- Tag rename input (`:2094-2107`) and Type `<select>` over `CREATABLE_INBOUND_TYPES` (`:2113-2119`) present.

Platform banners for redirect (the core defect):
- Banner #1 (`Inspector.tsx:2591-2595`): "redirect inbound only works on **Linux** (iptables REDIRECT)… refuse to start on **macOS**/Windows/Android/iOS."
- Banner #2 (`Inspector.tsx:2962-2967`, `tproxy || redirect`): "Linux-only inbound… will not bind on **macOS**/Windows/iOS."
- Both render simultaneously for redirect (duplicate), and **both contradict upstream**, which states redirect IS supported on macOS. This is actively misleading copy. (P0)

## Findings (prioritized)

- **[P0] Inspector platform banners are factually wrong for redirect.** Upstream: "Only supported on Linux **and macOS**." Both banners say Linux-only and explicitly exclude macOS. `src/components/Inspector.tsx:2591-2595` and `src/components/Inspector.tsx:2962-2967`. Fix copy to "Linux / macOS only (iptables REDIRECT / pf)"; this is distinct from tproxy (which IS Linux-only) so redirect must not be lumped into the shared `tproxy || redirect` banner.
- **[P0] Duplicate platform banner for redirect.** `entityType==="redirect"` triggers the dedicated banner at `Inspector.tsx:2591` AND the shared `tproxy || redirect` banner at `Inspector.tsx:2962`. Remove one (and once split from tproxy, the shared one should be tproxy-only).
- **[P1] No semantic diagnostic for the redirect platform constraint.** `src/domain/diagnostics.ts` has no redirect/tproxy entry (precedent exists at `:224` for resolved-service-linux). Result: canvas node status (`graph.ts:226`) and Palette show no platform hazard; only the Inspector (already-open) warns. Add a `warning` diagnostic at `/inbounds/{index}` for `type==="redirect"` noting Linux/macOS-only.
- **[P1] `listen` is ==Required== upstream but unmarked/unvalidated.** Listen card renders it as a plain optional text field (`Inspector.tsx:1436`); no required marker and no diagnostic flags an empty `listen`. Add a required indicator and an error-level diagnostic for missing `listen` on inbounds.
- **[P2] Palette label says "Redirect (Linux only)" — should be "Linux / macOS".** `src/components/Palette.tsx:145`.
- **[P2] `detour` (inbound→inbound) is not tracked for rename/remove and draws no canvas edge.** Inspector exposes it (`Inspector.tsx:1449`) but there is no `/inbounds/*/detour` path in `src/domain/referenceRegistry.ts:326-331` nor a relation in `src/domain/portRelationRegistry.ts`. Renaming the target inbound orphans the reference.
- **[P2] Type-switch drops all user-edited listen fields.** `changeEntityType` for inbound fully replaces the entity with a fresh scaffold preserving only `tag` (`src/domain/commands.ts:908-911`), unlike outbound/dns-server/service which preserve `detour`/`listen`/`listen_port` (`:913-955`). Switching to/from redirect silently discards `listen_port`/`detour`/etc.
- **[P2] Missing default-value placeholders** for `tcp_keep_alive` (5m), `tcp_keep_alive_interval` (75s), `udp_timeout` (5m) in the listen card (`Inspector.tsx:1445-1448`). Minor UX; values are documented defaults.

Stale pass-1 items (now fixed in code): P0 "address/auto_route spuriously rendered" (now `tun`-gated, `Inspector.tsx:2609`); P1 "six listen fields missing" (all 14 present, `Inspector.tsx:100-115` + `:1435-1450`); P1 "status:setup blocks node creation" (setup is actionable + creates scaffold, `useProjectStore.ts:733-737`). Pass-1's canvas claim "renders tag ?? ref.kind" is also stale.

SUMMARY: 2 P0, 2 P1, 4 P2.
