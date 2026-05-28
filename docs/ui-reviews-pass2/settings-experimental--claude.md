# settings-experimental — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)
The Experimental node is now near-complete: all 7 cache_file fields, all 8 active clash_api fields, and all 5 v2ray_api fields are exposed with correct controls (secret masked, download_detour as outbound select, channel/conditional gating), backed by real reference-cascade + diagnostics. Pass-1 (`docs/ui-reviews/settings-experimental.md`) is now overwhelmingly stale — nearly every P0/P1 it raised (external_ui_download_detour, external_ui, default_mode-as-select, V2Ray stats, store_rdrc/rdrc_timeout/store_dns, insecure-listen warning, build-tag banner, Plus-button gating) has shipped. Two real defects remain: the V2Ray build-tag name printed in the UI is wrong (`v2rayapi` vs upstream `with_v2ray_api`), and the `default_mode` 3-option select silently blanks/clobbers imported custom modes (the app's own templates write `"Enhanced"`).

## 1. Left Palette
Present and correct. `src/components/Palette.tsx:204-211` defines an "Experimental" group with 4 entries: parent `settings-experimental` (`FlaskConical`, status `setup`, docs `experimental/`) plus three sub-module pointers `experimental-cache-file` / `experimental-clash-api` / `experimental-v2ray-api` (status `inspector`, correct per-subdoc `docsUrl`). Singleton handling is correct: once `config.experimental` is non-empty the parent flips to `open` (Palette.tsx:305, `itemStatus` line 261) and clicking selects `settings:experimental` (Palette.tsx:451-457, 475). The 3 sub-pointers carry status `inspector` and are non-actionable (`canActivate` Palette.tsx:279-287) — they are documentation hints, not separate nodes, which matches the singleton model. **Pass-1 §"Left: Add Library" is stale** (it claims only one entry exists and sub-entries are "unimplemented").

## 2. Canvas Node
Rendered via `SETTINGS_NODE_IDS` loop in `src/canvas/graph.ts:171-191`: `kind:"settings"`, `type:"experimental"`, title `Experimental`, `compatible:[]`. Ports are correctly absent — `portEndpointsForNode("settings","experimental",…)` returns `[]` because the only `settings` endpoints in `portRelationRegistry.ts:115` are gated to `nodeType:"ntp"` (the NTP detour), so SbcNode renders no handles. The Plus button is now correctly hidden (`SbcNode.tsx:392` guards on `data.compatible.length > 0`) — **pass-1 F-CANVAS-2 (P1) is fixed/stale.** Remaining cosmetic issues: (a) canvas icon is `Braces` (`SbcNode.tsx:49` `iconMap.settings`, `getNodeIcon` line 84-86 has no experimental case) while the palette uses `FlaskConical` — mismatch; (b) the always-on primary button prints `{data.compatible.length || 1}` = "1" (`SbcNode.tsx:436`), a meaningless count for a settings node and redundant with the adjacent Settings2 open-inspector button (line 416-426). Subtitle is the generic `"global settings"` (graph.ts:184).

## 3. Upstream/Downstream Links
Relationship model is correct and complete.
- **referenceRegistry** (`src/domain/referenceRegistry.ts`) wires all three official tag references for rename/delete cascade: `outbound` → `/experimental/clash_api/external_ui_download_detour` and `/experimental/v2ray_api/stats/outbounds` (paths list line 334; mutators lines 170-174, 191-195); `inbound` → `/experimental/v2ray_api/stats/inbounds` (path line 328; mutators lines 136-138, 152-154). Renaming/deleting an outbound or inbound correctly rewrites/strips these.
- **portRelationRegistry** (`src/domain/portRelationRegistry.ts`): no experimental relation — correct. None of these references are traffic-chain edges; `clash_api.default_mode` is a value referenced by `clash_mode` rule items (not a node link), and stats lists are metadata, matching the upstream semantics. No canvas edge is expected or drawn.
- Missing/extra: none. `stats.users` correctly has no reference entry (they are protocol usernames, not node tags). **Pass-1's claim that these links were unwired is stale.**

## 4. Right Inspector (fields)
Branch: `Inspector.tsx:2313-2581` (`ref.kind==="settings" && ref.path==="experimental"`). Writes via `updateEntityField` settings branch (`commands.ts:893-898`), spreading the whole sub-object → round-trips as valid JSON. One row per official field:

| Official field | UI state |
| --- | --- |
| cache_file.enabled | ✅ toggle, ModuleCard gate (2324-2331) |
| cache_file.path | ✅ text, placeholder `cache.db` (2332-2339); writes `""` not `undefined` (noise, benign) |
| cache_file.cache_id | ✅ text (2340-2346); writes `""` (noise, benign) |
| cache_file.store_fakeip | ✅ toggle (2347-2354) |
| cache_file.store_rdrc | ✅ toggle (2361-2373); testing-only deprecation banner (2355-2360) |
| cache_file.rdrc_timeout | ✅ text/duration, shown only when store_rdrc (2374-2388) |
| cache_file.store_dns | ✅ toggle, gated `channel==="testing"` (2389-2403) |
| clash_api.external_controller | ✅ text, placeholder `127.0.0.1:9090` (2407-2416) |
| clash_api.external_ui | ✅ text (2436-2445) |
| clash_api.external_ui_download_url | ✅ text/URL (2446-2458) |
| clash_api.external_ui_download_detour | ✅ **outbound `<select>`** from `outboundTags(config)` (2459-2477) |
| clash_api.secret | ✅ masked `SensitiveTextField` (2417-2421) |
| clash_api.default_mode | ⚠️ `<select>` but only `rule`/`global`/`direct` lowercase + `(unset)` (2422-2435) — see P1 below |
| clash_api.access_control_allow_origin | ✅ CSV text under Advanced CORS (2481-2492); no `*`=all note |
| clash_api.access_control_allow_private_network | ✅ toggle under Advanced CORS (2493-2505) |
| clash_api deprecated (store_mode, store_selected, store_fakeip, cache_file, cache_id) | ✅ correctly absent from form; ❌ but no import-time migration/diagnostic (see P2) |
| v2ray_api.listen | ✅ text (2515-2521) |
| v2ray_api.stats.enabled | ✅ toggle (2522-2534) |
| v2ray_api.stats.inbounds | ✅ CSV text (2535-2548) — free text, not a multiselect, but round-trips + diagnosed |
| v2ray_api.stats.outbounds | ✅ CSV text (2549-2562) |
| v2ray_api.stats.users | ✅ CSV text, labeled "vmess/vless usernames" (2563-2576) |
| v2ray_api build-tag warning | ⚠️ banner present (2510-2514) but prints wrong tag `v2rayapi` (see P0) |

No invalid-JSON writes observed; no UI-only fields absent from the official model. Stats sub-fields are always visible (not hidden when `stats.enabled` is false) — acceptable.

## Findings (prioritized)
- **[P0] Wrong V2Ray build-tag name in UI** — `Inspector.tsx:2513` tells users to compile "with the `v2rayapi` tag", but the upstream build tag is `with_v2ray_api` (`docs/upstream/sing-box/testing/installation/build-from-source.md:57`). A user following this copy will produce a binary that still lacks V2Ray API. Fix the banner text to `with_v2ray_api`.
- **[P1] `default_mode` select drops/blanks custom Clash modes** — `Inspector.tsx:2422-2435` hardcodes only `rule`/`global`/`direct`. `default_mode` is a free-form string (custom Clash forks and this repo's own templates use `"Enhanced"`, `src/domain/templates.ts:867,918`). An imported config with such a value renders the `<select>` with no matching option (blank), and the first interaction overwrites the user's value. Add the current value as an option when it is non-empty and not in the list (or use a datalist/free-text input).
- **[P1] `default_mode` option casing diverges from upstream canonical** — upstream documents the default as capitalized `Rule` (`clash-api.md:102`); the select writes lowercase `rule`/`global`/`direct`. Clash matches `clash_mode` case-insensitively so it works, and it matches the rule-item casing used in templates, but `commands.ts:72` also seeds `default_mode:""` and the divergence is worth aligning (prefer capitalized to match the doc, or document the choice).
- **[P2] No migration/diagnostic for deprecated clash_api fields** — `store_mode`, `store_selected`, `store_fakeip`, `cache_file`, `cache_id` (deprecated 1.8.0, `clash-api.md:122-166`) are silently preserved if imported; `diagnostics.ts:1388-1416` checks clash_api but never flags these or migrates them to `cache_file.*`. Add a warning + migration hint.
- **[P2] Canvas icon mismatch** — palette uses `FlaskConical`, canvas node uses `Braces` (`SbcNode.tsx:49`; `getNodeIcon` line 84). Special-case `kind==="settings" && type==="experimental"`.
- **[P2] Meaningless primary-button count on settings node** — `SbcNode.tsx:436` prints `{data.compatible.length || 1}` = "1" and duplicates the adjacent open-inspector button; hide or relabel for `compatible.length===0`.
- **[P2] Generic subtitle** — `graph.ts:184` hardcodes `"global settings"`; `"cache / api / stats"` would communicate contents (pass-1 F-CANVAS-5, still valid).
- **[P2] Empty-string noise on export** — `path`/`cache_id`/`external_controller` write `""` rather than omitting (Inspector.tsx:2336,2344,2412); `ensureSettings` (`commands.ts:61-77`) also seeds empties. Harmless to sing-box (empty = default) but adds export clutter.

SUMMARY: 1 P0, 2 P1, 5 P2.
