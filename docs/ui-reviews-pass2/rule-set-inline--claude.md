# rule-set-inline — pass2 review (claude)
<!-- reviewer: senior PM + principal FE; single source of truth: sing-box testing 1.14 -->

## Verdict (2-3 sentences)

The inline rule-set is in solid shape on three of four surfaces: it now has a dedicated Palette entry that creates the correct `type:"inline"` object, the canvas node titles by tag and correctly hides the remote-only download-detour port, and the upstream/downstream link model matches sing-box semantics exactly. The one real gap is the Right Inspector: `rules[]` (the only required inline field) is still edited as a single raw JSON blob with no per-rule/per-field structure, and that same `rules` array is rendered a second time by the Advanced-JSON catch-all, producing two competing editors. Several pass-1 P0/P1 items are now stale (Palette-creates-remote, download-detour port, silent JSON corruption, empty-rules diagnostic) — they have been fixed; the remaining issues are the unstructured editor, the duplicate editor, a missing required-`tag` diagnostic, and silent `rules[]` loss on type switch.

## 1. Left Palette

Present and correct. `Palette.tsx:185` defines `{ label: "Inline Rule Set", kind: "rule-set-inline", icon: Layers3, docsUrl: docs("rule-set/"), status: "setup" }` under the **Route** group — correct category and a sensible "Setup" action (opens canvas + Inspector). `useProjectStore.ts:746-748` maps `rule-set-inline` → `addRuleSet(config, "inline", …)`, and `commands.ts:695-700` seeds `{ type:"inline", tag, rules:[{ domain_suffix:["example.com"] }] }`, which round-trips and exports as a valid inline rule-set. The Docs link points at `rule-set/` (parent) rather than `rule-set/headless-rule/`, a minor doc-target nit. No version gate is applied, which is correct: `type:"inline"` is 1.10+ and every supported target (1.12/1.13/1.14) qualifies. Pass-1 P1-L1 ("Palette always creates remote") and P1-L2 ("no inline path") are now STALE/fixed — there are three separate entries (`rule-set-remote`/`-local`/`-inline`, Palette.tsx:183-185).

## 2. Canvas Node

Correct. `graph.ts:464-492` builds the node with `title: tag` (the user-visible name, not the literal kind/type) and `status` from `diagnosticStatus("/route/rule_set/${index}")`. Ports are derived from `portRelationRegistry` via `getPortSpecs`/`portEndpointsForNode` (SbcNode.tsx:94-108): for an inline node the **input** ports are `route-rule` ("Upstream Route rule set") and `dns-rule` ("Upstream DNS rule set"), and there are **no output ports** — the `download-detour` output is correctly suppressed because its source endpoint is gated to `nodeType:"remote"` (`portRelationRegistry.ts:111`) and `endpointMatchesNode` (`portRelationRegistry.ts:157-161`) rejects `inline`. This matches sing-box: a rule_set is *referenced by* route/dns rules and (for inline) has no outbound dependency. Pass-1 P1-C1 ("download-detour port shown for inline") and P2-C3 ("titlebar shows kind/type not tag") are now STALE/fixed.

Remaining: subtitle is the generic fallback. `graph.ts:474-479` returns `` `${ruleSet.type} rule-set` `` (i.e. `"inline rule-set"`) for inline; it does not surface the rule count, so the node gives no at-a-glance sense of size/content (P2). Pass-1 P2-C2 still applies.

## 3. Upstream/Downstream Links

Matches the official relationship model with no missing/extra/wrong links for inline:

- `route-rule-set` (`portRelationRegistry.ts:96`) — route-rule → rule-set, canonical `/route/rules/*/rule_set`. Correct (route rules reference the tag).
- `dns-rule-set` (`portRelationRegistry.ts:102`) — dns-rule → rule-set, canonical `/dns/rules/*/rule_set`. Correct (DNS rules reference the tag).
- `rule-set-download` (`portRelationRegistry.ts:111`) — rule-set(remote) → outbound, `/route/rule_set/*/download_detour`. Correctly scoped to `remote`, so it does NOT appear on inline.
- `referenceRegistry.ts:356-358` registers kind `rule-set` with reference paths `["/route/rules/*/rule_set", "/dns/rules/*/rule_set"]`, so rename/delete propagate to exactly the two referrers. Correct.

Note one taxonomy gap that is *out of scope for inline* but worth flagging: the upstream model also lets TUN `route_address_set[]` / `route_exclude_address_set[]` reference rule-set tags, and these are not in `referenceRegistry` rule-set paths (`referenceRegistry.ts:357-358`). This affects rename/delete propagation for any rule-set tag, not just inline; pass-1 raised the same TUN-reference point. Left as a cross-node P2 since the four-surface task here is inline-specific. The `download_detour` left-side input on the inline node is correctly absent.

## 4. Right Inspector (fields)

Inline writes exactly three official fields: `type`, `tag`, `rules[]` (each a headless rule). Inspector block at `Inspector.tsx:5265-5328`; identity/type at `Inspector.tsx:2094-2163`.

| Official field | Required | UI control | State |
|---|---|---|---|
| `type` (`"inline"`) | Required (doc shows "optional", value fixed) | Type `<select>` `CREATABLE_RULE_SET_TYPES` (`Inspector.tsx:2152-2159`, `protocols.ts:213`) | OK — switching to inline reseeds via `createRuleSet` (`commands.ts:962`) |
| `tag` | Required | Text input, rename-on-blur (`Inspector.tsx:2094-2106`) | Present but **no required marker / no empty-guard**; `renameTag` no-ops on blank (`commands.ts:976`) so an empty tag silently persists, and there is **no diagnostic** for missing/empty rule-set tag (`diagnostics.ts:1419-1491` checks url/format/path/empty-rules only) — P1 |
| `rules[]` (headless rules) | Required | Single raw JSON `<textarea>` (`InlineRuleSetEditor`, `Inspector.tsx:733-784`, `5320-5325`) | Functional and now parse-safe (rejects non-array, keeps last valid value, shows `role="alert"` error — `Inspector.tsx:763-781`), but **no structured per-rule add/remove, no per-field inputs, no version-gate hints** for the ~25 headless fields (`headless-rule.md`). P0 |
| `rules[]` — headless `query_type` | — | none (inside raw JSON) | not individually exposed |
| `rules[]` — headless `network`/`domain*`/`*_ip_cidr`/`port*`/`process*`/`package*`/`network_*`/`wifi_*`/`invert` | — | none (inside raw JSON) | not individually exposed; cf. route-rule/dns-rule inspectors which DO give structured controls + an "Advanced match fields" repeater (`Inspector.tsx:872+`, `RuleTables.tsx:111-153`) — reusable for inline |
| `rules[]` — logical (`type:"logical"`, `mode`, nested `rules[]`) | `mode` Required | none (inside raw JSON) | not exposed; no `and`/`or` builder |

Illegal-field handling: `format`/`url`/`path`/`update_interval`/`download_detour` are all hidden for inline (conditioned on `entity.type` at `Inspector.tsx:5267-5319`). Good. But because `rules` is **not** in `ruleSetHandledFields` (`Inspector.tsx:305`), `editableNonScalarFields` (`Inspector.tsx:322-330`) treats the `rules` array as an unhandled non-scalar and `AdvancedNonScalarFields` (`Inspector.tsx:5327`, `820-848`) renders a **second** "Rules" JSON editor below `InlineRuleSetEditor` — two editors writing the same field, one of which (the Advanced `JsonField`, `Inspector.tsx:794-818`) still silently stores the raw string on parse failure. P1.

## Findings (prioritized)

- **[P0]** `rules[]` — the only required inline payload — is editable only as a single freeform JSON textarea; no per-rule add/remove, no per-field controls for the ~25 headless match fields, no logical `and`/`or` builder, no version-gate hints. `src/components/Inspector.tsx:733-784`, `src/components/Inspector.tsx:5320-5325`. (Pass-1 P0-I1 still valid; reuse the existing route/dns rule editors at `src/components/Inspector.tsx:872+` / `src/components/RuleTables.tsx:111-153`.)
- **[P1]** Duplicate `rules` editor: `rules` is absent from `ruleSetHandledFields`, so `AdvancedNonScalarFields` renders a second JSON editor for the same array, and that second editor (`JsonField`) reintroduces silent string-on-parse-failure corruption. Add `"rules"` to `ruleSetHandledFields`. `src/components/Inspector.tsx:305`, `src/components/Inspector.tsx:5327`, `src/components/Inspector.tsx:794-818`.
- **[P1]** No diagnostic (and no UI required-marker) for missing/empty rule-set `tag`, although `tag` is `==Required==` upstream; an empty tag persists silently and breaks references. `src/domain/diagnostics.ts:1419-1491`, `src/components/Inspector.tsx:2094-2106`.
- **[P1]** Switching an inline rule-set to remote/local silently discards a non-empty `rules[]` with no warning/confirm/undo (and remote keeps `download_detour`, but inline rules are dropped). `src/domain/commands.ts:958-966`.
- **[P2]** Imported `rules` that is non-array or missing is coerced to `[]` and only produces the generic "empty rules" warning, not an error; since `rules` is required, a missing/invalid array should error, not warn. `src/domain/diagnostics.ts:1479-1490`.
- **[P2]** Canvas subtitle for inline is the generic `"inline rule-set"`; show rule count (e.g. `inline · N rules`). `src/canvas/graph.ts:474-479`.
- **[P2]** Palette inline Docs link targets `rule-set/` rather than `rule-set/headless-rule/`, where the rule fields are documented. `src/components/Palette.tsx:185`.

Pass-1 staleness: `docs/ui-reviews/rule-set-inline.md` and `docs/claude/rule-set-inline.md` predate fixes — now STALE are P1-L1, P1-L2 (Palette inline entry exists), P1-C1, P2-I5 (download-detour port gated off inline), P2-C3 (node titles by tag), P1-I2 (parse failure no longer corrupts the primary editor), and P1-I3 (empty-rules diagnostic exists at `diagnostics.ts:1479-1490`).

SUMMARY: 1 P0, 3 P1, 3 P2.
