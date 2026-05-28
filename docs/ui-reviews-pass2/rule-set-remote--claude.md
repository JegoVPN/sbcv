# rule-set-remote — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The remote rule-set node is in good shape and almost all pass-1 P0/P1 items are now fixed: there are three distinct palette entries (remote/local/inline), and diagnostics now cover missing `url`, missing `format`, missing `download_detour` outbound, and the 1.14 `download_detour` deprecation. Two real correctness gaps remain: TUN `route_address_set` / `route_exclude_address_set` reference rule-set tags but are NOT registered in `referenceRegistry`, so renaming/deleting a rule-set silently breaks TUN, and the inline-object form of `http_client` is destroyed by the tag-only `<select>`. A secondary concern: per upstream testing 1.14, `download_detour` is now **deprecated** and `http_client` is the canonical field — the canvas still surfaces only a `download_detour` port and the Inspector exposes `download_detour` unconditionally with no deprecation banner.

## 1. Left Palette

- Three explicit entries exist (`Palette.tsx:183-185`): `rule-set-remote`, `rule-set-local`, `rule-set-inline`, all `status:"setup"`, icon `Layers3`, category **Route**. This resolves pass-1 **P1-E** (single ambiguous "Rule Set" entry) — that finding is now STALE.
- `createFromPalette` maps `rule-set-remote` → `addRuleSet(config,"remote",…)` correctly (`useProjectStore.ts:741-752`). The created object (`commands.ts:710-716`) is a valid remote skeleton: `type/tag/format:"source"/url placeholder/update_interval:"1d"`.
- `docsUrl` points at `rule-set/` index (covers all 3 types), not a remote anchor — acceptable, minor.
- Correctly placed under "Route", not its own taxonomy. No gating issues. Verdict: correct.

## 2. Canvas Node

- Node built in `graph.ts:463-505` (gated by `visualizeRuleSets`). Title = tag; subtitle = `url` for remote (`graph.ts:474-479`) — informative; long URLs truncate with no tooltip (minor, pass-1 noted).
- Ports are now registry-driven via `getPortSpecs` → `portRelationRegistry` (`SbcNode.tsx:94-108`), not hand-coded. Pass-1's hand-coded port snippets are STALE.
  - Left/input (referenced-by): `route-rule` and `dns-rule` rule-set inputs (`portRelationRegistry.ts:96,102`) — correct: route/dns rules reference rule_set via `/…/rules/*/rule_set`.
  - Right/output: single `download-detour` → outbound, source `typeFilter:"remote"` (`portRelationRegistry.ts:111`) — correct for stable semantics; edge drawn only when `download_detour` set (`graph.ts:493-503`).
- GAP: no `http_client` representation on canvas. Since `http_client` (1.14) replaces `download_detour` and can itself carry a dial detour to an outbound, a remote node using `http_client` shows no outbound relationship. The `download-detour` port is also not channel-gated, so on testing it advertises a deprecated field as the only download path. (P1)

## 3. Upstream/Downstream Links

Official relationship model: (a) route rules & dns rules reference a rule-set tag via `rule_set[]`; (b) TUN inbound `route_address_set[]` / `route_exclude_address_set[]` reference rule-set tags; (c) `download_detour` → outbound tag (deprecated 1.14); (d) `http_client` string → top-level `http_clients[]` tag, and an inline `http_client` object may carry a dial detour → outbound.

| Link | Registry state | Verdict |
|---|---|---|
| route-rule → rule-set | `portRelationRegistry.ts:96`; ref path `/route/rules/*/rule_set` (`referenceRegistry.ts:358`) | OK |
| dns-rule → rule-set | `portRelationRegistry.ts:102`; ref path `/dns/rules/*/rule_set` (`referenceRegistry.ts:358`) | OK |
| rule-set → outbound (`download_detour`) | `portRelationRegistry.ts:111`; ref path `/route/rule_set/*/download_detour` (`referenceRegistry.ts:334`) | OK (but not channel-gated) |
| rule-set → http-client (`http_client` tag) | ref path `/route/rule_set/*/http_client` (`referenceRegistry.ts:364`); rename/remove handled (`referenceRegistry.ts:300,310`) | OK |
| TUN `route_address_set` → rule-set | **MISSING** from `referenceRegistry` rule-set paths (`referenceRegistry.ts:357-361`) | **WRONG/MISSING (P0)** |
| TUN `route_exclude_address_set` → rule-set | **MISSING** from `referenceRegistry` rule-set paths | **WRONG/MISSING (P0)** |

The TUN address-set fields are editable (`Inspector.tsx:2676-2696`, list inputs labelled "rule-set tags") but are not declared anywhere as rule-set references, so `renameTag`/`deleteEntity` on a rule-set leaves TUN pointing at a stale/missing tag with no diagnostic. No canvas port models this link either (pass-1 listed it as expected; still absent). No extra/spurious links found.

## 4. Right Inspector (fields)

Rendered in `Inspector.tsx:5265-5328`; `http_client` via shared card (`sharedFieldRegistry.ts:203`, `Inspector.tsx:1596-1600`). `ruleSetHandledFields` (`Inspector.tsx:305`) keeps known keys out of Advanced; unknown keys fall through to `AdvancedScalar/NonScalarFields` (`Inspector.tsx:5326-5327`).

| Official field (type:remote) | Required | UI control | State |
|---|---|---|---|
| `type` | Req | type `<select>` remote/local/inline (`Inspector.tsx:2152-2159`, `CREATABLE_RULE_SET_TYPES` protocols.ts:213) | OK; switching type drops url/update_interval/http_client (only download_detour kept, commands.ts:962-964) |
| `tag` | Req | tag rename input (`Inspector.tsx:2095-2106`); duplicate-tag error covers rule_set (`diagnostics.ts:25-34`, indexes.ts:67) | OK; no required marker, blank tag not flagged |
| `format` | Req* | `<select>` source/binary (`Inspector.tsx:5268-5277`) | OK; `missing-format` error when blank & url ext not json/srs (`diagnostics.ts:1433-1446`) — pass-1 P1-C STALE |
| `url` | Req | text input (`Inspector.tsx:5281-5287`) | OK; `rule-set-remote-missing-url` error (`diagnostics.ts:1424-1432`) — pass-1 P0-B STALE |
| `update_interval` | Opt (def 1d) | text input (`Inspector.tsx:5288-5294`) | Exposed; no duration-format validation (minor) |
| `http_client` (1.14) | Opt | shared `<select>` of `http_clients[]` tags (`Inspector.tsx:1596-1600`) | String/tag form OK; **inline object form data-loss** (see P0); not channel-gated (shown on stable) |
| `download_detour` (DEPRECATED 1.14) | Opt | outbound `<select>` (`Inspector.tsx:5295-5308`) | Exposed unconditionally; missing-outbound error + testing-deprecation warning in diagnostics (`diagnostics.ts:1447-1465`) but **no inline UI banner**; pass-1 P0-A & P1-A STALE |

No UI fields absent from the official model. No invalid-JSON writes from the normal fields. `path`/`rules` correctly hidden for remote.

## Findings (prioritized)

- **[P0] TUN `route_address_set` / `route_exclude_address_set` not registered as rule-set references.** `referenceRegistry.ts:357-361` lists only `/route/rules/*/rule_set` and `/dns/rules/*/rule_set`. The TUN fields edited at `Inspector.tsx:2676-2696` hold rule-set tags, so `renameTag`/`deleteEntity` (driven by the registry) silently desyncs TUN. Fix: add `*/route_address_set` and `*/route_exclude_address_set` (or the inbound-scoped paths) to the rule-set registry entry, and ensure `replaceRuleSetRefs`/`removeRuleSetRefs` cover list-valued fields. Also add a `missing-rule-set` diagnostic for these TUN fields (none today).

- **[P0] `http_client` inline-object form is destroyed by the tag `<select>`.** Upstream allows `http_client` to be a string OR an object (`http-client.md:9-28`). The control is `kind:"select"` (`Inspector.tsx:1596-1600`); `SharedFieldControl` renders `value={String(value ?? "")}` (`Inspector.tsx:1669`), so an object shows as "None", and any change writes a plain string — clobbering the object. Fix: detect `typeof http_client === "object"` and render a read-only/JSON fallback (or structured editor) instead of overwriting. (Pass-1 P1-B; still valid, now P0 because it is a silent destructive write, not just "not editable".)

- **[P1] `download_detour`/`http_client` channel handling on Inspector + canvas.** Per testing 1.14 `download_detour` is deprecated and `http_client` is canonical. (a) Inspector shows `download_detour` for all channels with no deprecation banner — only a diagnostic fires (`diagnostics.ts:1457-1465`); add an inline `PlatformBanner kind="deprecated"` near `Inspector.tsx:5295-5308` on `channel==="testing"`. (b) The canvas exposes only a `download-detour` port (`portRelationRegistry.ts:111`), not channel-gated, with no `http_client`-based outbound link; consider gating/relabelling on testing.

- **[P1] `http_client` shared card not channel-gated for rule-set.** `sharedFieldRegistry.ts:203` pushes `"http-client"` unconditionally, unlike `route` which gates on `channel==="testing"` (`sharedFieldRegistry.ts:206`). `http_client` is testing-only (1.14+), so stable-channel users see/edit a field their target rejects, and there is no diagnostic for a rule-set referencing `http_client` on stable (`stable-version-gated-http-clients` at `diagnostics.ts:1158` only fires when top-level `http_clients[]` exist). Gate the group on testing and/or add a stable-channel diagnostic.

- **[P2] No validation that `http_client` string references an existing `http_clients[]` tag.** A dangling `http_client:"foo"` produces no diagnostic (grep confirms no such check in `diagnostics.ts`). Add a `missing-rule-set-http-client` error mirroring `missing-route-rule-set`.

- **[P2] Minor polish.** `update_interval` has no duration-format validation (`Inspector.tsx:5288-5294`); type-switch drops `url`/`update_interval`/`http_client` silently (`commands.ts:962-964`); long URL subtitle has no tooltip (`graph.ts:474-479`); blank `tag` has no required marker (`Inspector.tsx:2095-2106`).

SUMMARY: 2 P0, 3 P1, 2 P2.
