# outbound-selector — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

Upstream authority: `docs/upstream/sing-box/testing/configuration/outbound/selector.md`. Enumerated official surface = `type` (fixed `"selector"`), `tag`, **`outbounds` (Required, string[])**, `default` (string, empty ⇒ first candidate), `interrupt_exist_connections` (bool, inbound conns only). No dial/server/TLS fields. Runtime note: switching is Clash-API-only.

## Verdict (2-3 sentences)
The selector node is solid and the pass-1 docs are now largely STALE: every pass-1 P0 (candidate checklist, constrained `default`, rename/delete cascade of `default`, empty-candidates + invalid-default diagnostics) and most P1s are implemented and verified in code. Group-membership wiring is correct end-to-end: `outbounds[]` is authored via a self-excluding checklist, edges and ports model "consumes members"/"is a member", and tag rename/delete cascade through `referenceRegistry`. Remaining issues are minor UX/consistency: a positional "remove last member" port toggle, and the legacy comma-text fallback control still present in the tree.

## 1. Left Palette
Present and correct. `Palette.tsx:171` — `{ label: "Selector", kind: "selector", icon: Shuffle, docsUrl: docs("outbound/selector/"), ready: true }`. Category "Outbounds" is correct. `ready:true` ⇒ status resolves to `add` (`Palette.tsx:263`), label "Add", actionable (`Palette.tsx:280`). Docs link is correct. Kind `selector` → type `"selector"` via `OUTBOUND_PALETTE_TYPES` (`protocols.ts:20`) consumed by `outboundTypeForPaletteKind` (`useProjectStore.ts:772`). ADD creates skeleton `{ type:"selector", tag:"proxy", outbounds:[], default:undefined }` (`commands.ts:435`). No gating — correct (selector is not target-gated). Minor: the skeleton ships `default: undefined` explicitly (harmless; serializes away) and is not in singleton set (correct, selector is multi-instance).

## 2. Canvas Node
Title = tag; subtitle lists candidates `selector: a, b` when populated, else `selector outbound` (`graph.ts:396-403`). Icon `Shuffle` (`SbcNode.tsx:55`). Titlebar shows `outbound / selector` (`SbcNode.tsx:291`); no deprecated badge (correct). Status from `/outbounds/{index}` diagnostics (`graph.ts:404`).

Group-membership ports — CORRECT per sing-box semantics:
- Output `outbound-member` "Downstream candidate" is gated to `nodeType:"selector"` (`portRelationRegistry.ts:103`), so only a selector exposes the right-side member port. Edges to each candidate are built at `graph.ts:435-449` with target handle `selector-group`, source `outbound-member`.
- Input `selector-group` "Upstream Selector candidate" lets any outbound show it is consumed by a selector (`portRelationRegistry.ts:103`); connectedness keys off `outbound.type==="selector" && outbounds.includes(tag)` (`SbcNode.tsx:166-168`).
- Selector is itself referenceable: input ports `route` (final), `route-rule`, `dns-detour`, `detour-target`, `service-detour`, `rule-set-download`, and `selector-group`/`urltest-group` (nesting) all resolve for a selector node (`portRelationRegistry.ts:93,95,103,104,105,106,109-111`; connectedness `SbcNode.tsx:162-186`). Nesting (selector as a candidate of another group) is allowed — correct.

`default`→member is NOT modeled as a distinct edge/handle; it is implicit inside the member set. Acceptable since `default` must be one of `outbounds[]` and is validated in Inspector + diagnostics; a dedicated "default" edge would be redundant. Compatible quick-add chips for a group now list the full proxy set + Selector/URLTest (`graph.ts:405-428`) — pass-1 P1-C ("only SOCKS/Direct/Block") is STALE. Note the big `+` still creates only the first chip's type via `createCompatible` (`useProjectStore.ts:804`/`816-818`), but per-chip add covers the rest.

## 3. Upstream/Downstream Links
Matches the official relationship model.
- Member references `outbounds[]`: relation `selector` writable, canonicalPath `/outbounds/*/outbounds` (`portRelationRegistry.ts:103`). Connect via `connectSelectorCandidate` (`useProjectStore.ts:609-610`, `commands.ts:825-834`, idempotent). Disconnect-by-drag removes by tag value, not position (`commands.ts:1085-1092`).
- `default` → a member: enforced in Inspector (select limited to current candidates) and by diagnostic `selector-default-not-in-candidates` (`diagnostics.ts:605-614`). Toggling a candidate off auto-clears a now-invalid `default` (`Inspector.tsx:4092-4097`). Cascades on rename (`referenceRegistry.ts:162`) and delete (`referenceRegistry.ts:183`).
- Selector referenced BY others: `referenceRegistry.ts:333` declares outbound reference paths incl. `/route/final`, `/route/rules/*/outbound`, `/outbounds/*/outbounds`, `/outbounds/*/default`, `/outbounds/*/detour`, dns/service/rule-set/ntp/clash-api detours — rename/delete propagate to all. Graph draws route-final and route-rule edges into the selector (`graph.ts:306,324`).
- Missing/extra/wrong: none material. Only nuance — a selector can legally be a `detour` *target* of dial outbounds (input `detour-target` resolves), and the `outbound-detour` relation correctly EXCLUDES selector as a detour *source* (`portRelationRegistry.ts:106` `nodeTypeExcludes:["block","selector","urltest","dns"]`), which is correct (a selector has no dial detour of its own).

## 4. Right Inspector (fields)
Selector block at `Inspector.tsx:4081-4169`. `outboundHandledFields` includes `outbounds`, `default`, `interrupt_exist_connections` (`Inspector.tsx:183-185`), so none leak into Advanced JSON fields.

| Official field | Required | Control in UI | State |
|---|---|---|---|
| `type` (=selector) | yes | type `<select>` (shared outbound header) | OK; switch replaces skeleton, keeps only `detour` (`commands.ts:913-919`) — `outbounds`/`default`/`interrupt` dropped on type change (intentional, undocumented) |
| `tag` | yes | tag input + rename (`Inspector.tsx:2094-2103`) | OK; rename cascades to refs incl. `default` |
| `outbounds[]` | **yes** | self-excluding checkbox checklist of existing outbound tags, + read-only "(missing)" rows for stale tags (`Inspector.tsx:4099-4124`); options = `outboundTags(config, tagValue)` (`:4086`) | OK. Self-exclusion enforced. Empty-list hint shown (`:4102-4104`). Pass-1 P0-A STALE. |
| `default` | no | `<select>`: "First candidate" (empty⇒undefined) + each current candidate (`Inspector.tsx:4135-4156`) | OK. Constrained to members; can't author a non-member. Pass-1 P0-B STALE. |
| `interrupt_exist_connections` | no | first-class checkbox; emits `undefined` when false to keep JSON clean (`Inspector.tsx:4158-4168`) | OK. Pass-1 P1-A STALE. |

No invalid-JSON write path for these fields (all structured controls). No spurious server/dial/TLS fields render for `selector` (gated by `entityType` checks; dial group excluded — `sharedFieldRegistry` does not list selector for dial). Clash-API runtime caveat is NOT surfaced in the Inspector (pass-1 P1-E still open).

## Findings (prioritized)
- [P2] `outbound-member` port toggle removes the LAST member positionally and re-adds a hard-coded SOCKS when empty (`useProjectStore.ts:1242-1251`); with multiple members this is unpredictable. Drag-disconnect (`commands.ts:1085-1092`) and the Inspector checklist both remove correctly, so impact is low. Pass-1 P1-D is partially STALE (only the click-toggle, not disconnect, is positional).
- [P2] Legacy comma-separated text fallback for `outbounds` still exists in the JSX (`Inspector.tsx:4126-4133`). It is dead for selector/urltest (the checklist branch wins when `tagValue!==null`), but reachable for an untagged group and writes raw `fromList` strings with no self-exclusion. Remove or gate it out to avoid regressions.
- [P2] Selector `+` (big add) only creates the first compatible type (`useProjectStore.ts:804`,`816-818`); empty-state `outbound-member` toggle hard-codes `socks` (`useProjectStore.ts:1248`). Consider opening the member picker / using a neutral default. Cosmetic.
- [P2] No UI advisory that candidate switching needs Clash API at runtime (pass-1 P1-E). Config authoring is fully functional without it, so informational only.
- [P2] Type-switch silently discards `outbounds`/`default`/`interrupt_exist_connections` (`commands.ts:913-919`). Matches pass-1 note; consider a confirm/diagnostic. Low priority.

Pass-1 staleness summary: pass-1 P0-A, P0-B, P0-C, P0-D, P1-A, P1-B, P1-C are all now IMPLEMENTED and verified (`Inspector.tsx:4081-4168`, `diagnostics.ts:592-615`, `referenceRegistry.ts:162/183`, `graph.ts:405-428`). Pass-1 cited `commands.ts:984-987` / `:1064-1071` as not cascading `default` — that work moved to `referenceRegistry.ts` and is done. Only pass-1 P1-D (positional click-toggle) and P1-E (Clash banner) remain, both downgraded to P2.

SUMMARY: 0 P0, 0 P1, 5 P2.
