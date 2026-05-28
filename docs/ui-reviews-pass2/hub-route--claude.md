# hub-route — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

Major progress since pass-1: `route.final` is now a real Inspector select AND a writable canvas edge, the six interface/process scalars are exposed, `RouteConfig` is mostly typed, and testing-only fields (`find_neighbor`, `dhcp_lease_files`, `default_http_client`) are correctly channel-gated with matching diagnostics. The node is functional and round-trips most fields. Remaining defects: a duplicate-and-conflicting `default_network_strategy`/`default_network_type` control (hardcoded text vs dial-group list), `default_network_type` written as a string instead of `string[]` (invalid JSON), `default_domain_resolver` object-form unsupported, the Palette icon/label still wrong, and the canvas `compatible` list is fictional. Both pass-1 docs are now substantially stale (see notes inline).

## 1. Left Palette

- Present. `Palette.tsx:178` — `{ label: "Route Hub", kind: "route", icon: GitBranch, docsUrl: docs("route/"), ready: true }`. Correct group ("Route"), correct singleton handling.
- Singleton gating is now correct: `singletonsPresent` adds `"route"` when `config.route` exists (`Palette.tsx:306`), `itemStatus` returns `"open"` (`Palette.tsx:261`), label flips to "Open" (`statusLabel.open`, `Palette.tsx:249`), and clicking sets `selectedId = "route:main"` (`Palette.tsx:453-456,475`). **This fully resolves pass-1 P1 "label stays ADD" and P1 "selectedId not set" — both now STALE.**
- **[P2] Icon still `GitBranch`, not `Route`.** `Palette.tsx:178` uses `GitBranch`; canvas + Inspector use lucide `Route` (`SbcNode.tsx:38,76`, `Inspector.tsx:43`). Pass-1 called this "P0"; it is cosmetic, downgrade to P2. Still a real inconsistency.
- Creation is idempotent via `ensureRoute` (`commands.ts:86-91`): preserves existing `route`, only normalizes `rules` to an array. Good.

## 2. Canvas Node

- Title/subtitle: `graph.ts:247-262` — title `"Route"`, subtitle `` `${routeRules.length} ordered rules` ``. Titlebar shows `route / route` (`SbcNode.tsx:291`). Acceptable.
- Ports (derived from `portRelations` via `getPortSpecs`): input `inbound` (decorative, `portRelationRegistry.ts:91`); outputs `route-rule` (order-only, `:92`) and `outbound` (writable → `route.final`, `:93`). Matches the model: route contains rules and has a `final` detour.
- `final` edge is drawn and writable: `graph.ts:316-325` draws `edge:route-final:{tag}`; connecting the port calls `setRouteFinal` (`useProjectStore.ts:544-545`); disconnect clears it (`commands.ts:1061-1070`). **This resolves pass-1 P0 "final only via edge / no validation" partially and is now visualized correctly.**
- **[P1] `compatible` list is fictional.** `graph.ts:257` sets `compatible: ["Direct","Block","Selector","URLTest","SOCKS"]`. Any outbound type may be `final`; this list drives the node `+`/chip "create compatible" affordance (`SbcNode.tsx:392-405,441`) and misleads users into thinking only these 5 types are valid `final` targets. Pass-1 flagged this (P1) — still STANDING.
- **[P2] Rule-set containment not drawn from hub.** `route.rule_set[]` resources exist as nodes (`graph.ts:463-505`) but no edge ties them to `route:main`; only route-rule→rule-set edges are drawn. Acceptable per the model (rule_set is an unordered resource list), but the hub gives no visual that it *owns* them. Informational.
- **[P2] Order-only edge still draggable-looking.** `edge:route-rule-order:{N}` (`graph.ts:299`) is `order-only` and non-disconnectable (`relationIsDisconnectable` returns false for non-writable, `portRelationRegistry.ts:186-189`), but there is still no on-canvas affordance explaining that edge position ≠ rule priority. Pass-1 P0; the table is authoritative, so downgrade to P2.
- Missing-final diagnostic DOES surface on the node: `diagnostics.ts:48-57` emits `missing-route-final` at `/route/final`, and `diagnosticStatus("/route", …)` (`graph.ts:256`) turns the node red. **Pass-1 "no missing-tag diagnostic" is now STALE.**

## 3. Upstream/Downstream Links

Relationship model: `route.final` → one outbound/endpoint; route contains `rules[]` (order-only) and `rule_set[]`; `default_domain_resolver` → a DNS server; `default_http_client` → an http-client.

| Link | Registry state | Verdict |
|---|---|---|
| `route.final` → outbound | `portRelations` `route-final` writable, path `/route/final` (`portRelationRegistry.ts:93`); reference path `/route/final` under outbound kind (`referenceRegistry.ts:334`); rename `referenceRegistry.ts:158`, delete `:179` | Correct |
| route → `rules[]` | `route-rule-order` order-only (`portRelationRegistry.ts:92`) | Correct (order stays in array) |
| route-rule → rule-set | `route-rule-set` writable (`portRelationRegistry.ts:96`) | Correct |
| `default_domain_resolver` → dns-server | Tracked for rename/delete (`referenceRegistry.ts:228,243,340`) and Inspector select over dns-server tags (`Inspector.tsx:1459`) — but **NO canvas edge drawn** (graph.ts has zero `default_domain_resolver` edge) | **[P1] missing visual link** |
| `default_http_client` → http-client | Reference path `/route/default_http_client` (`referenceRegistry.ts:364`); rename/delete `:200,213,298,308`; Inspector select (`Inspector.tsx:1599`) | Correct (no edge, but http-client has no canvas node kind on the route lane — acceptable) |
| `route.final` → **endpoint** | Only outbound nodes accepted (`useProjectStore.ts:544`; reference path lists only outbound) | **[P2]** sing-box allows an endpoint tag as `final`; endpoints cannot be selected/linked as final. Minor. |

**Pass-1 stale:** pass-1 (`docs/ui-reviews/hub-route.md:58`) claims "the Inspector does not expose a `final` select field at all — set exclusively via canvas edge." That is now FALSE (`Inspector.tsx:1825-1838`).

## 4. Right Inspector (fields)

Route Inspector block: `Inspector.tsx:1823-1924` (hardcoded) + `SharedFieldCards` (`:5343`) rendering `sharedGroupsForEntity(route)` = `dial` always, `http-client`+`neighbor` when `channel==="testing"` (`sharedFieldRegistry.ts:204-207`).

| Official field | Type (upstream) | UI control | Verdict |
|---|---|---|---|
| `rules` | array | `RouteRulesTable` (`Inspector.tsx:1923`) | OK (table-owned) |
| `rule_set` | array | Palette adds; per-rule datalist; **no hub-level add/remove** | [P2] resource add still only via Palette |
| `final` | string (tag) | select over outbound tags, "First outbound" empty (`:1825-1838`) | OK |
| `auto_detect_interface` | bool | checkbox (`:1839-1848`) | OK; [P2] no platform label |
| `override_android_vpn` | bool | checkbox (`:1849-1858`) | OK; [P2] shown always (not gated on auto_detect; no Android-only label) |
| `default_interface` | string | text (`:1859-1868`) | OK; [P2] no conflict guard vs auto_detect / network_strategy |
| `default_mark` | int | number (`:1869-1885`) | OK |
| `find_process` | bool | checkbox (`:1886-1895`) | OK |
| `find_neighbor` | bool | checkbox via neighbor group (`:1615`), testing-gated | OK + diagnostic `diagnostics.ts:1244` |
| `dhcp_lease_files` | string[] | list via neighbor group (`:1616`), testing-gated | OK + diagnostic `:1253` |
| `default_http_client` | string (tag) | select via http-client group (`:1599`), testing-gated | OK + diagnostic `:1262` |
| `default_domain_resolver` | string **or object** | select over dns-server tags only (`:1459`) | **[P1] object form unsupported** — typing/import of object value cannot be edited; select can only write a string tag |
| `default_network_strategy` | string | **rendered TWICE**: hardcoded select (`:1896-1912`) AND dial group select (`:1460`) | **[P1] duplicate control** |
| `default_network_type` | **string[]** | hardcoded **text→string** (`:1913-1922`, reads `typeof===\"string\"`, writes raw string) AND dial group as `list` (`:1461`) | **[P0] wrong type + duplicate**: hardcoded writes an invalid JSON string to an array field |
| `default_fallback_network_type` | string[] | dial group `list` only (`:1462`) | OK |
| `default_fallback_delay` | duration | dial group text (`:1463`) | OK |
| `geoip` / `geosite` (removed 1.12) | — | not offered as route fields | OK (Palette "GeoIP/Geosite" entries are the rule-matcher sub-docs, not top-level `route.geoip`) |

Notes:
- **Pass-1 STALE**: pass-1 claimed `final`, all interface/process toggles, and platform fields were "absent from the Inspector" and that testing fields render "unconditionally." All are now present and gated (`Inspector.tsx:1823-1922`, `sharedFieldRegistry.ts:204-207`). Those pass-1 P0/P1 items are resolved.
- **Type-coverage gap (`types.ts:85-98`)**: `RouteConfig` types `default_network_type` as `string` (WRONG — should be `string[]`, drives the P0 above), and OMITS `default_fallback_network_type`, `default_fallback_delay`, `find_neighbor`, `dhcp_lease_files`, `default_http_client` (fall through to index signature).

## Findings (prioritized)

- **[P0] `default_network_type` written as a string into an array field.** `Inspector.tsx:1913-1922` renders a plain text input bound to `typeof entity.default_network_type === "string"` and writes the raw string; upstream `default_network_type` is `[]` (route/index.md:51, Dial `network_type`). Produces invalid JSON (`"default_network_type":"wifi"` instead of `["wifi"]`). Root cause partly `types.ts:95` typing it as `string`. Fix: delete the hardcoded control and rely on the dial-group `list` control (`Inspector.tsx:1461`); correct `types.ts:95` to `string[]`.
- **[P1] Duplicate `default_network_strategy` / `default_network_type` controls.** Hardcoded block (`Inspector.tsx:1896-1922`) renders both, and the route `dial` shared group (`Inspector.tsx:1460-1461`) renders them again. Two controls write the same path; the hardcoded strategy select also exposes wifi/cellular/ethernet which is correct, but the dial-group `networkStrategyOptions` only has default/hybrid/fallback (`Inspector.tsx:1363`) — inconsistent option sets. Remove the hardcoded pair.
- **[P1] `default_domain_resolver` object form unsupported.** `Inspector.tsx:1459` is select-only (string tag). Upstream allows object (Dial `domain_resolver`: `{ server, client_subnet, … }`). `types.ts:96` already types `string | Record<string,unknown>`, and `referenceRegistry.ts:228` handles object server refs, but the UI cannot create/edit the object and a select-write clobbers an imported object. Add a two-mode (tag vs object) control.
- **[P1] `default_domain_resolver` has no canvas link.** It is a DNS-server reference (`referenceRegistry.ts:340`) surfaced in the Inspector but draws no edge from `route:main` to the `dns-server:{tag}` node (absent in `graph.ts`). The relationship model says default_domain_resolver → a dns server; add a (decorative or writable) relation.
- **[P1] Canvas `compatible` list is fictional.** `graph.ts:257` constrains the hub's create-compatible affordance to 5 outbound types; any outbound/endpoint can be `final`. Misleading.
- **[P2] Palette icon mismatch.** `Palette.tsx:178` `GitBranch` vs canvas/Inspector `Route` (`SbcNode.tsx:76`, `Inspector.tsx:43`).
- **[P2] `RouteConfig` type omissions.** `types.ts:85-98` lacks `default_fallback_network_type`, `default_fallback_delay`, `find_neighbor`, `dhcp_lease_files`, `default_http_client`; and mistyped `default_network_type`.
- **[P2] No platform/conflict labels.** `auto_detect_interface` (Linux/Win/macOS), `override_android_vpn` (Android-only, only meaningful when auto_detect on), `default_mark` (Linux), `default_interface` (conflicts with `default_network_strategy`, ineffective under auto_detect) carry no scope/conflict hints in the Inspector (`:1839-1885`). `override_android_vpn` is shown unconditionally.
- **[P2] `final` accepts only outbounds, not endpoints.** `useProjectStore.ts:544`, select source `outboundTags` (`Inspector.tsx:1832`).
- **[P2] No hub-level `rule_set[]` add/remove surface.** Resources added only via Palette; route Inspector shows none.

SUMMARY: 1 P0, 5 P1, 5 P2.
