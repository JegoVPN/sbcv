# rule-set-local — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The `rule-set` / `type:local` node is now in good shape: a dedicated palette entry creates a correctly-typed local node, the factory emits exactly the four official fields (`type`/`tag`/`format`/`path`), the canvas node shows the path as subtitle with correct input ports, the download-detour output port is now gated to `remote`, and a `rule-set-local-missing-path` error diagnostic exists. Both pass-1 P0s (stray download-detour port; missing path diagnostic) are now STALE — they have been fixed. Remaining issues are minor: TUN `route_address_set`/`route_exclude_address_set` rule-set references are unmodeled, and the `format` optional-by-extension behavior is neither hinted nor diagnostically validated for local.

## 1. Left Palette

- Present and correct. `src/components/Palette.tsx:184` — `{ label: "Local Rule Set", kind: "rule-set-local", icon: Layers3, docsUrl: docs("rule-set/"), status: "setup" }`. Sits in the "Route" group alongside dedicated `rule-set-remote` (`:183`) and `rule-set-inline` (`:185`) entries.
- `createFromPalette` maps `kind === "rule-set-local"` to `ruleSetType = "local"` (`src/state/useProjectStore.ts:744-745`) and calls `addRuleSet(config, "local", preferredRuleSetTag("local"))` (`:750`), then selects the new node. Correct — no longer "always remote".
- Status `setup` ("Add … setup draft to canvas") is reasonable; docsUrl points at `rule-set/` (the index that documents local). Category/label correct vs taxonomy.
- **Pass-1 STALE:** docs/claude + docs/ui-reviews/rule-set-local.md both claim a single unified `rule-set` palette entry that "always creates remote" (P1 there). That is no longer true — discrete local/remote/inline entries exist and route to the right type.

## 2. Canvas Node

- Title/type: rendered from `kind: "rule-set"` + `type: ruleSet.type` (`src/canvas/graph.ts:471-472`). Icon `Layers3` (`SbcNode.tsx:46`).
- Subtitle: `graph.ts:475-479` shows `ruleSet.path` for local (falls back to `"local rule-set"` only when path is absent/non-string). Correct.
- Status badge: `diagnosticStatus("/route/rule_set/${index}", diagnostics)` (`graph.ts:480`) — picks up the missing-path error (see §4/Findings). Correct path.
- Input ports (left): `route-rule` and `dns-rule` both resolve for `kind: "rule-set"` via relations `route-rule-set` (`portRelationRegistry.ts:96`) and `dns-rule-set` (`:102`). Correct — a local rule-set is referenced by route AND dns rules.
- Output port (right): the `rule-set-download` relation's rule-set endpoint is `nodeType: "remote"` (`portRelationRegistry.ts:111`). `endpointMatchesNode` (`:157-161`) rejects it when the node type is `local`, so `getPortSpecs("rule-set","local","output")` returns no download-detour port. **Pass-1 P0 (SbcNode.tsx:169 stray port) is STALE / fixed.**
- Compatible "+" create button: no `createTarget` resolves for a local rule-set output (the only rule-set output relation is remote-gated), so the node has no spurious create affordance. Acceptable.

## 3. Upstream/Downstream Links

Official model: a rule-set is referenced by route rules and dns rules via `rule_set` (array). (TUN `route_address_set`/`route_exclude_address_set` also name rule-set tags — tun.md:479-505, 489 "the specified rule-sets".)

- `portRelationRegistry.ts:96` `route-rule-set` → `/route/rules/*/rule_set` — correct, writable, array-aware (`isPortConnected` handles array/scalar at `SbcNode.tsx:191-201`).
- `portRelationRegistry.ts:102` `dns-rule-set` → `/dns/rules/*/rule_set` — correct.
- `referenceRegistry.ts:356-361` rule-set paths `["/route/rules/*/rule_set", "/dns/rules/*/rule_set"]` with `replaceRuleSetRefs`/`removeRuleSetRefs` (`:279-295`) — rename/delete propagate to both route and dns rules. Correct.
- `rule-set-download` relation (`:111`) is correctly remote-only and irrelevant to local.
- **MISSING link (P2):** TUN `route_address_set` / `route_exclude_address_set` reference rule-set tags but are NOT in `referenceRegistry` rule-set paths. The Inspector exposes them as free-text on the TUN node (`Inspector.tsx:2675-2695`, placeholder "cn-ips, geosite-cn"), yet renaming/deleting a rule-set tag will NOT update those TUN fields, and the rule-set node has no port/edge representing this reference. This is a relationship-model gap (applies to local rule-sets used as IP-CIDR address sets).
- No extra/wrong links for local. `domain_resolver`/`http_client` propagation touches `route.rule_set[]` (`referenceRegistry.ts:201,214,233,248,299,309`) but those are remote/inline concerns; harmless for local since local entities never carry those fields.

## 4. Right Inspector (fields)

Inspector rule-set block: `src/components/Inspector.tsx:5265-5328`. Tag header `:2094-2107`; Type select `:2152-2159`.

| Official field (type:local) | Required | UI control | Default | Required marker | Validation | State |
|---|---|---|---|---|---|---|
| `type` | yes (`local`) | `<select>` of `CREATABLE_RULE_SET_TYPES = ["remote","local","inline"]` (`Inspector.tsx:2153-2158`, `protocols.ts:213`); switch via `changeEntityType` → `createRuleSet(nextType, tag)` (`commands.ts:958-965`) | `local` (from factory `commands.ts:702-708`) | n/a (always set) | type-switch resets entity & drops remote-only fields; only re-adds `download_detour` for remote (`commands.ts:963-964`) | Correct |
| `tag` | yes | text `<input>` with `renameTag` round-trip on blur (`Inspector.tsx:2097-2105`) | `local-rules`/unique (`addRuleSet` via `preferredRuleSetTag`/`getUniqueTag`, `commands.ts:689`) | no explicit "*" marker | dup-tag rejected in `renameTag` (`commands.ts:976-978`); empty tag has no node-level diagnostic | Exposed; minor: no required marker |
| `format` | yes (`source`/`binary`; optional when path ext is `.json`/`.srs`) | `<select>` source/binary, shown for local (`Inspector.tsx:5267-5277`) | falls back to `"source"` display; factory writes `"source"` (`commands.ts:706`) | no marker | always written; NO extension-inference hint and NO "missing format" diagnostic for local (remote has one at `diagnostics.ts:1434-1446`) | Exposed; gap below |
| `path` | yes | text `<input>`, shown for local (`Inspector.tsx:5311-5318`) | `"./rules.json"` (factory `commands.ts:707`) | no marker | empty path → `rule-set-local-missing-path` error (`diagnostics.ts:1467-1477`); no path-format/extension validation; no file picker | Exposed + diagnosed |

Writes use `updateField(ref, key, rawString)` (plain string assignment) for both `path` and `format` — no JSON parsing, so no invalid-JSON write risk. Unhandled/foreign fields fall through to `AdvancedScalarFields`/`AdvancedNonScalarFields` with `ruleSetHandledFields` (`Inspector.tsx:305,5326-5327`), which lists `tag,type,format,url,path,update_interval,download_detour,http_client` — so a stray remote-only field on a local entity would surface as an "advanced" field rather than being silently hidden. No UI fields are exposed that are absent from the official local model.

- **Pass-1 STALE:** docs/claude/rule-set-local.md P0 "no semantic diagnostic for missing/empty path" — fixed (`diagnostics.ts:1467-1477`). Its P0 "download-detour port" — fixed (see §2).

## Findings (prioritized)

- **[P2]** TUN `route_address_set` / `route_exclude_address_set` rule-set references are unmodeled. They are editable free-text on the TUN inspector (`src/components/Inspector.tsx:2675-2695`) and are valid sing-box rule-set references (tun.md:489), but `src/domain/referenceRegistry.ts:356-361` omits `/inbounds/*/route_address_set` and `/inbounds/*/route_exclude_address_set`, so rename/delete of a local rule-set tag silently desyncs these TUN fields, and the canvas shows no edge/port for the link.
- **[P2]** `format` optional-by-extension behavior is invisible for local. The select always shows/writes `source` and there is no hint that `.json`⇒source / `.srs`⇒binary is inferred (`src/components/Inspector.tsx:5267-5277`), nor any local-side "missing/mismatched format" diagnostic — unlike remote (`src/domain/diagnostics.ts:1434-1446`). A user pointing `path` at `*.srs` while the UI shows `source` gets a misleading-but-not-flagged mismatch.
- **[P2]** No "required" affordance for `tag`/`format`/`path` in the Inspector (no asterisk/aria-required), and empty `tag` produces no node-level diagnostic for rule-sets (`src/components/Inspector.tsx:2094-2107`, `:5265-5318`). Cosmetic/clarity only; empty path is already caught.
- **[P2]** `path` input is a bare text field with no placeholder once empty and no path/extension validation beyond the missing-path error (`src/components/Inspector.tsx:5311-5318`). Consider a placeholder (`./rules.json`) and a soft warning when the extension is neither `.json` nor `.srs` and `format` is unset.

SUMMARY: 0 P0, 0 P1, 4 P2.
