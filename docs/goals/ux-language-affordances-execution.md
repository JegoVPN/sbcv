# UX Language, Node-Copy Accuracy & Affordances — Execution Plan

Run with:

```txt
/goal execute the UX language & affordances queue (L0–…) --spec docs/goals/ux-language-affordances-execution.md
```

Follow-on goal after **Conformance & UX Remediation** (A0–A29, complete — see
[`conformance-and-ux-remediation-devlog.md`](conformance-and-ux-remediation-devlog.md)). That goal closed
the correctness/conformance gaps and made the icon set faithful to the confirmed v4 set
(`docs/ui-reviews-pass2/_icons-preview-v4.html`). This goal is the remaining **UX-quality** backlog that
was deferred there, reorganized into one plan because it is too large to do piecemeal.

It collects three buckets the user explicitly scoped:
1. **Unified UX language** — copy/labels/badges, planned holistically (not one string at a time).
2. **Per-node copy accuracy** — audit every node's text against upstream sing-box docs.
3. **Affordance infrastructure** — toast/notification + undo, then the flows that need them.
…plus a **mechanical-cleanup** bucket (export noise, import normalization, subtitles, touch targets).

## Process (inherited from the prior goal — non-negotiable)

- **Canonical config is the source of truth.** React Flow nodes/edges + Inspector stay derived.
- **One atomic = one outcome.** Respect don't-mix buckets (copy vs behavior, infra vs feature, domain vs
  component, stable vs testing-gated). Slice large atomics; queue the tails.
- **Test-first.** A failing test before the change; migrate existing tests to the new correct behavior.
- **Land via squash PR, never direct push to `main`.** PR gate + main issue gate must be clean.
- **One-pass expert review before merge.** Dispatch a single senior Claude Code reviewer subagent (Agent
  tool) whose expertise best matches the atomic; apply its actionable findings in-pass, then merge.
- **Frontend gate** (`vercel-react-best-practices`) for any `src/components/**` or `src/state/**` diff.
- **Re-verify against HEAD** before each atomic. `tsc -b` + `pnpm test` + `pnpm build` + `pnpm e2e` green.
- **Devlog every atomic** in the Running TODO + a milestone note below.
- **Upstream truth:** sing-box docs in `.tmp/sing-box-docs/{stable,testing}/docs/configuration/**`
  (stable = 1.13, testing = 1.14). Conformance copy follows testing 1.14; gate version-specific text.

## Decisions (locked with the user, 2026-05-29)

- **D1 — Unify ALL language, don't patch strings ad hoc.** Phase 1 produces a single voice + terminology
  + badge-vocabulary spec first; every copy change conforms to it. (User: "需要继续深入整体规划，统一所有语言".)
- **D2 — `testing/gated` ≠ `legacy/deprecated`; they must read differently.** The user prefers the
  **legacy treatment as the quality bar** (a clear, *colored* badge — the orange `LEGACY` chip), while
  `gated`/`testing` is a distinct, muted state. A node is gated because the build target doesn't support
  it yet (creatable on the right target); a node is legacy because sing-box deprecated it. Different
  cause → different word + different color. Eliminate redundancy where a label already says the state
  (e.g. `Hysteria Realm (1.14 testing)` + a `GATED` badge double-states it).
- **D3 — Drop build-tag suffixes from palette labels.** `(with_tailscale)`, `(with_tor)` etc. are noise
  in the label; if surfaced at all, move to a tooltip/secondary line, not the primary name.
- **D4 — Keep the "docs-only" / legacy palette rows (former 1c).** 1.12 build stays online to help users
  check, and users pick whichever version they want. **Future:** per-version nodes / version-aware
  judgements — *shelved, revisit later.* Do NOT remove these rows now.
- **D5 — Node-copy accuracy is an agent-driven audit** against the upstream `.md` docs (per node
  kind/type), producing a findings table, then sliced fixes.
- **D6 — Toast + Undo are net-new infrastructure** and get their own phase/plan section here.
- **D7 — Export cleanup must keep the JSON sing-box-usable.** Trim only provably-inert noise
  (empty strings/arrays the schema treats as absent); never strip a semantically-meaningful empty.
  Verify round-trip + that a representative cleaned config still parses/loads.
- **D8 — A8b-brands already fixed the "WireGuard/Tailscale identical icon" bug** (PR #86): the palette
  routes icons through the same registry (`paletteIcon → getNodeIcon`), so both surfaces now show the
  real distinct brand logos. (The user's screenshot was pre-deploy.) No action needed beyond verifying
  on the live site after the Cloudflare deploy.

## Phases & Atomic Queue

Phase 4 (mechanical cleanups) is **greenlit to run first / in parallel** — it needs no wording decisions.
Phase 1 must produce its language spec (L1-vocab) before its copy atomics. Phases run roughly 4 → 1 → 2
→ 3, but Phase 4 can interleave.

### Phase 1 — Unified UX language (bucket 1)
- [ ] L1-vocab — **the language spec**: a canonical voice + terminology glossary + badge vocabulary
  table (state name, when it applies, word, color/treatment) honoring D2. The artifact every later copy
  atomic conforms to. Lives in a new `docs/ui-language.md`. (planning atomic — no runtime change)
- [ ] L1-badges — re-label + re-treat the palette status badges per L1-vocab (Add / Setup→? / Table→? /
  Inspector→? / Docs→? / Gated→? / Pending→? / Legacy / Open). Migrate the ~15 `name:"Setup X"` test
  assertions. De-duplicate the `(1.14 testing)`-label-plus-`GATED`-badge double-statement (D2).
- [ ] L1-buildtags — drop `(with_tailscale)`/`(with_tor)` suffixes from palette labels (D3); if useful,
  surface the build tag as a tooltip/secondary line.
- [ ] L1-brandbtn — fix the brand-logo button label `"sbcv.app — return to home"`: `goHome` only
  deselects + closes the global panel + re-fits the canvas (no navigation, no reset). Relabel to match
  (e.g. "Reset view" / "Deselect & fit").
- [ ] L1-target-glossary — target/channel/version tooltip (what stable 1.13 vs testing 1.14 means).
- [ ] L1-diag-hierarchy — diagnostics read message-first, code secondary (human-readable hierarchy).
- [ ] L1-roundtrip-copy — a one-line "import→export normalizes fields" note where round-trip matters.

### Phase 2 — Per-node copy accuracy audit (bucket 1d / D5)
- [ ] L2-audit — agent-driven sweep: for each node kind/type, compare title / subtitle / field labels /
  hints against the upstream `.md` (`.tmp/sing-box-docs/**`). Output a findings table (node → wrong
  copy → upstream-correct copy → severity). No runtime change.
- [ ] L2-fix-* — apply corrections, sliced per node group (inbound / outbound / dns / endpoint / service
  / route / rule-set / settings). One PR per group.

### Phase 3 — Affordance infrastructure (bucket 2 / D6)
- [ ] L3-toast-infra — a minimal toast/notification host (store slice + a portal component, a11y-live).
- [ ] L3-undo-infra — an undo/history snapshot stack in the store (bounded; snapshots the canonical
  config at mutation boundaries).
- [ ] L3-import-feedback — import success/error toast (uses L3-toast-infra).
- [ ] L3-import-undo — one-tap undo after an import overwrite (uses L3-undo-infra; pairs with the
  existing A26 import-confirm).
- [ ] L3-invalid-drop — invalid drag-drop feedback toast (uses L3-toast-infra).
- [ ] L3-rightclick-disconnect — (optional) right-click an edge/port to disconnect (context menu).
- [ ] L3-drag-affordance — (optional) clearer in-drag visual hint (CSS/interaction).

### Phase 4 — Mechanical cleanups (bucket 3 — greenlit, no wording) 
- [x] L4-export-noise — the DOWNLOAD (`createConfigExport` only — not the editable draft) prunes inert
  empty-string/empty-array object keys; keeps empty objects/`false`/`0`/`null` and never drops array
  elements. Verified semantics-preserving (identical diagnostics) + idempotent across all ≥200 fixtures.
  **D7 honored.** — PR #93
- [x] L4-dial-network-type — A16-norm-rest: coerce legacy raw-string `network_type` /
  `fallback_network_type` on outbounds/endpoints (dial group) at import (same shape as A16-norm). — PR #90
- [ ] L4-dial-network-type-2 — extend the same coercion to the remaining `kind:"list"` network-type
  carriers (dns-servers, ntp settings, http_clients, shadowtls nested dial) (L4-dial-network-type
  review follow-up)
- [x] L4-rule-field-scrub — A10d-rest: scrub the *unambiguously* action-exclusive rule fields on import
  (dns/route reject-only `method`/`no_drop`; dns predefined-only `rcode`/`answer`/`ns`/`extra`). Shared
  route-options fields (`override_*`/`network_*`) intentionally NOT scrubbed — valid on
  route/bypass/route-options. — PR #92
- [x] L4-subtitle-degeneric — settings node subtitles carry real info (route/dns hubs already show rule
  counts; notices already informative — only the four settings nodes were generic). — PR #91
- [x] L4-mobile-touch — mobile controls meet a ≥36px touch-target minimum: the mobile topbar status
  pill was 30px (brand/icon-buttons already 36px) → bumped to 36px. — PR #99
- [x] L4-mobile-palette-defer — A25-rest: App now `lazy`-loads the desktop Palette, so it code-splits
  into its own 19KB chunk (was in the main bundle); the mobile shell never renders it (lazy via
  MobileNodeSheet on demand), so mobile no longer downloads it on first load. — PR #100

## Running TODO
Mirror of the queue above; tick as merged. (Populated during execution.)

## Decision Log
(Append dated entries as decisions are made during execution.)

## Milestone Notes

### L4-dial-network-type dial-network-type-import-normalize (domain) — PR #90
Status: implemented 2026-05-29 in `atomic/dial-network-type-import-normalize`; merged in PR #90.
- What changed: A16-norm coerced the route `default_network_type` / `default_fallback_network_type`
  legacy raw-string → `[string]` on import. This extends the same coercion to the dial-group siblings
  `network_type` / `fallback_network_type` on outbounds and endpoints (they render through the same
  `kind:"list"` control and had the same legacy-string strand). Generalized the A16-norm helper into
  `coerceStringList(record, key)` (drops `RouteConfig` import); `normalizeConfig` now runs it over the
  route defaults plus each outbound/endpoint. Non-string values pass through untouched.
- Tests: `tests/dial-network-type-import-normalize.test.ts` (outbound/endpoint network_type +
  fallback_network_type string→array, empty→[], array + non-string passthrough, route regression guard).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, no blockers, no should-fix.
  Confirmed the helper rename is behavior-preserving, the clone (not input) is mutated, no item shape
  throws (array items survive the object guard but only string values are rewritten), `RouteConfig`
  import removal is safe, and — per sing-box docs — `network_type` is always `string[]` (1.11+), never
  legitimately a bare string, so arrayifying is always correct. Two NITs, both non-blocking: redundant
  `as Record` casts (left as explicit-boundary); the same `kind:"list"` control also renders on
  dns-servers/ntp/http_clients/shadowtls nested dial → queued as L4-dial-network-type-2.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (852), `pnpm build`, `pnpm e2e` (14).

### L4-subtitle-degeneric settings-node-subtitle (canvas) — PR #91
Status: implemented 2026-05-29 in `atomic/settings-node-subtitle`; merged in PR #91.
- What changed: all four settings nodes (log/ntp/certificate/experimental) showed the same generic
  "global settings" subtitle. New `settingsSubtitle(path, entity)` helper gives each real info: log →
  `log level <level>` / `logging disabled`; ntp → `time sync · <server>`; certificate → `certificate
  store · <store>` / `TLS certificates`; experimental → the enabled subsystems joined (`Clash API ·
  V2Ray API · cache file`). Falls back to a meaningful per-section label, never "global settings" for
  the known paths. (route/dns hubs already show `N ordered rules`; notice nodes already informative.)
- Tests: `tests/settings-node-subtitle.test.tsx` (log level, log disabled, ntp server, experimental
  subsystems, certificate fallback, ntp-empty fallback).
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean. Verified the field names
  against the upstream sing-box docs (log `level`/`disabled`, ntp `server`, certificate `store`,
  experimental `clash_api`/`v2ray_api`/`cache_file` objects), the guarded cast, the single subtitle
  consumer, and idiom-consistency with the sibling helpers. Applied both optional nits in-pass: typed
  the param `path: SettingsPath` (makes the `"global settings"` fallback provably-unreachable / catches a
  future typo'd path) and added an ntp-empty fallback test.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (858), `pnpm build`, `pnpm e2e` (14).

### L4-rule-field-scrub rule-action-field-scrub (domain) — PR #92
Status: implemented 2026-05-29 in `atomic/rule-action-field-scrub`; merged in PR #92.
- What changed: extends the A10d import-boundary scrub (server/outbound) to the other *unambiguously*
  action-exclusive rule-output fields, verified against the sing-box 1.14 `rule_action` docs: dns &
  route reject-only `method`/`no_drop`; dns predefined-only `rcode`/`answer`/`ns`/`extra`. A stale
  `{action:"route", rcode:"…"}` etc. was invisible on every surface yet re-exported; now scrubbed.
  `normalizeDnsRule`/`normalizeRouteRule` (run on both add/update and import via A10d) gained a shared
  `dropRuleKeys(rule, keys)` that drops only present keys and keeps the no-op identity fast-path.
- **Deliberately NOT scrubbed (D7 spirit — don't drop valid config):** the route-options fields
  (`override_address`/`override_port`/`network_strategy`/`network_type`/`tls_*`/`udp_*`) are valid on
  `route`, `bypass`, AND `route-options` actions, so they are shared, not exclusive. Sniff/resolve
  action fields likewise left (entangled). Conservative scope = only the provably-exclusive fields.
- Tests: `tests/rule-action-field-scrub.test.ts` (dns reject/predefined scrub + retention, route
  reject scrub + retention, shared-route-options-kept, cross-field reject-keeps-method-drops-rcode,
  no-re-export); A10d + bypass regressions green.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean, no blockers/should-fix.
  Rigorously verified field-exclusivity against the upstream 1.14 docs — `method`/`no_drop` reject-only
  (both dns+route), `rcode`/`answer`/`ns`/`extra` predefined-only (dns); critically confirmed the bare
  output names don't collide with the `response_*`-prefixed dns *match* fields (so no match condition is
  scrubbed), and the shared route-options fields are correctly left. Verified no add/update regression
  (templates/Inspector/store never set an output field on a mismatched action). Applied the one optional
  nit in-pass (cross-field reject-keeps-method-but-drops-stale-rcode test). Logical sub-rule recursion
  remains an explicit future follow-up (matches A10d).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (867), `pnpm build`, `pnpm e2e` (14).

### L4-export-noise export-prune-empty (domain) — PR #93
Status: implemented 2026-05-29 in `atomic/export-prune-empty`; merged in PR #93.
- What changed: the downloaded config (`createConfigExport` only) now recursively drops object keys
  whose value is an empty string `""` or empty array `[]` — sing-box treats both as absent, so the file
  is cleaner with identical meaning. Conservative per D7: keeps empty objects (`clash_api:{}` etc.),
  `false`, `0`, `null`, and never drops array *elements* (only object keys). `pruneExportNoise` operates
  on a fresh copy (no input mutation). Applied ONLY to the download — the editable live JSON draft
  (`stringifyConfig`/`jsonDraft`) is untouched, so in-editor fidelity is preserved.
- D7 verification: changed the external-fixtures round-trip assertion from byte-identity
  (`exportedRoundTrip === config`) to the stronger, meaning-focused pair — re-imported export yields
  **identical diagnostics** (semantics preserved) AND re-export is **byte-stable** (idempotent, no
  progressive loss). All ≥200 real fixtures pass both. (The old byte-identity also OOM'd on large-config
  diffs; the diagnostics/idempotency compare is small.)
- Tests: `tests/export-prune-empty.test.ts` (drop empties; keep 0/false/{}/non-empty; deep nested prune;
  never drop array elements; diagnostics-preserving round-trip; no input mutation) + the updated
  external-fixtures corpus check.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix.
  Ran an exhaustive D7 audit against `.tmp/sing-box-docs/**`: no field treats `""`/`[]` as distinct from
  absent. Checked the scariest candidates — auth `users:[]` ("no auth if empty"), `sniffer:[]` ("all
  sniffers"), `cipher_suites:[]`/`alpn:[]` ("safe default"/"not negotiated"), clash `access_control_
  allow_origin:[]` ("* if empty"), `certificate.store`/`derp.home` — all default to permissive/safe ==
  absent; the genuinely-distinct behaviors use non-empty literal sentinels (`"none"`/`"blank"`/`"deny"`)
  which are never pruned. No preserve-list needed. Confirmed no input mutation, array-elements never
  dropped, draft path untouched, and that diagnostics-equivalence + idempotency soundly replaces
  byte-identity (does not mask a regression).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (873), `pnpm build`, `pnpm e2e` (14).

### L4-mobile-touch (canvas CSS) — PR #99
Status: implemented 2026-05-29 in `atomic/mobile-touch-targets`; merged in PR #99.
- What changed: audited mobile interactive controls — the mobile brand button, the topbar icon buttons
  (Add/Check/Menu), and the menu-field selects/row-buttons are already ≥36px; the one violator was the
  mobile topbar status/check pill (`.mobile-topbar__center .status-pill`) at `min-height:30px`. Bumped
  to 36px (font-size 11px kept — legibility ≠ tap target).
- Tests: new e2e in `mobile.spec.ts` (390×844) asserting the mobile topbar controls (status pill, brand,
  add-node, run-check, menu) all have `boundingBox().height ≥ 36`. (jsdom can't compute layout, so e2e.)
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix/
  nits. Confirmed isolation (only the mobile rule changed; desktop `.status-pill` untouched), the audit
  (no other in-scope mobile control <36px), valid + non-flaky selectors, and no layout break (pill now
  matches the 36px brand/icon row).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (874), `pnpm build`, `pnpm e2e` (16).

### L4-mobile-palette-defer (code-split) — PR #100. **Phase 4 core complete (6/6).**
Status: implemented 2026-05-29 in `atomic/mobile-palette-defer`; merged in PR #100.
- What changed: `App.tsx` now `React.lazy`-loads the desktop `Palette` (Suspense fallback = an
  `aria-hidden` layout placeholder). The bundler splits it into `Palette-*.js` (19KB / 5KB gzip) — it
  was previously bundled into the main entry. The mobile shell never renders `<Palette/>` (the node-add
  path lazy-loads it via `MobileNodeSheet` on demand), so mobile's first load no longer ships the
  Palette chunk. Main `index` chunk dropped ~9KB.
- Test migration: lazy-loading made 6 desktop tests that synchronously queried the Palette fail (the
  first such test per file, since vitest isolates module graphs and `React.lazy` resolves on a
  microtask). Migrated each to `await screen.findByLabelText("Node palette")` / `await findByRole(...)`
  — the correct pattern for lazy content. The Suspense fallback is `aria-hidden` (no "Node palette"
  label) so those awaits resolve only on the real Palette.
- Tests: full suite 874 green; `editor.spec.ts` (Playwright auto-waits on the now-lazy palette) green.
- Expert review (one pass): a senior reviewer subagent. Verdict APPROVE, clean — no blockers/should-fix.
  Verified the named-export lazy form + Suspense (wraps only Palette), the aria-hidden fallback (no label
  collision), that mobile renders no Palette + no other static importer (chunk truly split), the
  test-migration soundness, and — checking all 29 App-rendering test files — that no unmigrated test is
  left flaky. e2e safe (Playwright auto-waits). One nit: unused `data-testid="palette-loading"` (kept as
  harmless instrumentation).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (874), `pnpm build` (Palette chunk
  split confirmed), `pnpm e2e` (16; one unrelated drag-path flake, 7/7 on isolated re-run).
