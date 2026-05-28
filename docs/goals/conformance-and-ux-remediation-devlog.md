# Conformance & UX Remediation — Dev Log

Living working journal for executing
[`conformance-and-ux-remediation.md`](conformance-and-ux-remediation.md). Update it **while** you
work, not after.

## How To Use

- **Running TODO** mirrors the Ordered Atomic Queue. Tick a box only when that atomic is merged and
  its issue gate has passed. Sub-bullets capture in-flight state for the atomic you are on.
- **Decision Log** is ADR-lite. Add an entry whenever you make a non-obvious call: a re-ordering, a
  scope cut, a finding re-classification, a divergence resolution. Newest at the bottom.
- **Milestone Notes** get one block per merged atomic (mirror the house style in
  `canvas-port-interaction-redesign-execution.md`: branch, what changed, frontend perf review,
  verification commands, official-check note) **plus the Codex review rounds (≤2) and their
  dispositions** — see the template at the bottom of this file.
- When a decision changes the queue, edit the goal doc too, then note the edit here.

## Running TODO

### Phase 0 — Guardrails (one PR)
- [x] A0 — guardrail tests W1–W5 + multi-edge-disconnect stub (`phase0-guardrail-tests`) — PR #36

### Phase 1 — Structural root-cause
- [x] A1 — shared TLS/multiplex/transport by direction (`shared-cards-by-direction`) — PR #37
- [x] A2a — rule-set local `format` inference + empty-group error + WireGuard/DERP-mesh required diagnostics, domain-only (`required-fields-diagnostics`) — PR #39
- [x] A2b — pre-export validation gate: confirm before downloading a config with error diagnostics (`required-markers-and-export-gate`) — PR #40
- [ ] A2c — deferred from A2a/A2b for per-finding upstream+fixture verification: presence diagnostics (inbound `listen` + credentials C0-16; dns-rule route/evaluate `server` C0-1, overlaps A10) **+ the paired required `aria-required`/`*` field markers**; may fold into A10/A20 (`required-presence-and-markers`)
- [x] A3 — JsonField parse safety + `rules` handled (`jsonfield-parse-safety`) — PR #38
- [ ] A4 — type-change normalizers + confirm + no blank kv rows (`type-change-safety`)
- [ ] A5 — wire `version` into `validateConfig` (`version-aware-gating`)
- [ ] A6 — referenceRegistry completeness + dial-detour guards (`reference-and-detour-guards`)
- [ ] A7 — endpoint outbound-half (`endpoint-outbound-half`) — high risk, after A6
- [ ] A8 — port icon from relation + dead-chip fix + multi-edge disconnect (`canvas-connect-legibility`)
- [ ] A8b — implement confirmed icon set (`../ui-icon-set.md`): shared registry + brand SVGs (`node-icon-distinctness`)
- [ ] A9 — warning glyph + `✓ N` relabel + edge-remove pointer-events (`validity-readability`)

### Phase 2 — Residual node P0/P1
- [ ] A10 — dns-rule server settable + evaluate/respond ordering (`dns-rule-server-and-ordering`)
- [ ] A11 — rule-set-inline structured editor (`rule-set-inline-editor`)
- [ ] A12 — rule-set-remote http_client object form (`rule-set-http-client`)
- [ ] A13 — ccm/ocm detour control (`ccm-ocm-detour`)
- [ ] A14 — endpoint-tailscale system_interface bool (`endpoint-tailscale-system-interface`)
- [ ] A15 — dns-server-tailscale accept_search_domain (`dns-server-tailscale-fields`)
- [ ] A16 — hub-route default_network_type (`hub-route-network-type`)
- [ ] A17 — inbound-redirect platform banner (`inbound-redirect-banner`)
- [ ] A18 — inbound-vless TLS default (`inbound-vless-tls-default`)
- [ ] A19 — settings-experimental label (`settings-experimental-label`)
- [ ] A20 — residual node P1 batch, per category (`residual-node-p1-<category>`)
- [ ] A21 — cloudflared testing inbound (`inbound-cloudflared-testing`)
- [ ] A22 — HTTP Client capability (`http-client-capability`)

### Phase 3 — UX comprehension
- [ ] A23 — palette usability (`palette-usability`)
- [ ] A24 — canvas connect/disconnect discoverability + edge legend (`canvas-connect-discoverability`)
- [ ] A25 — mobile build path (`mobile-build-path`)
- [ ] A26 — import safety + onboarding (`import-safety-and-onboarding`)
- [ ] A27 — template placeholder secrets (`template-placeholder-secrets`)

### Phase 4 — Polish
- [ ] A28 — diagnostics/labels polish (`diagnostics-labels-polish`)
- [ ] A29 — per-node P2 cleanup (`per-node-p2-cleanup`)

## Decision Log

### 2026-05-28 — Reconcile two reviews into one umbrella goal
- **Context:** Codex and Pass-2 reviewed the same codebase against sing-box upstream and overlap heavily.
- **Decision:** Build a single umbrella goal that cross-maps `C-id ↔ T/W/atomic`, then spawns one child
  goal per atomic; do not concatenate the reports or duplicate findings.
- **Reason:** Convergent findings are the highest-confidence work; the overlap is only useful once
  de-duplicated and ranked.
- **Affects:** all atomics.

### 2026-05-28 — Pass-2 five-phase backbone, convergence-first, Codex-grafted
- **Context:** Codex ships an 8-step plan; Pass-2 ships a 5-phase, test-first, 35-W-item plan.
- **Decision:** Use Pass-2's five phases as the spine (guardrails → structural → residual → UX →
  polish); order convergent findings first within a phase; graft Codex-unique items into the phase
  matching their don't-mix bucket.
- **Reason:** Pass-2's plan is the most granular and is test-first, which fits the repo's
  guardrail-then-fix discipline; nothing from Codex is dropped.
- **Affects:** queue ordering for all atomics.

### 2026-05-28 — Type-change: do both normalizer and confirm (A4)
- **Context:** Codex C0-3 wants central action-schema normalizers; Pass-2 T3/W7 wants a confirm +
  field preservation.
- **Decision:** Implement both in A4 — normalizer for correctness (no stale/invalid fields survive a
  type change) plus a confirm dialog for data-safety.
- **Reason:** They solve different problems (invalid export vs silent data loss) and are complementary.
- **Affects:** A4.

### 2026-05-28 — Split multi-edge disconnect (correctness) from disconnect discoverability (UX)
- **Context:** Codex C1-7/8/23 is a precise "removes the first edge, not the intended reference" bug;
  Pass-2 W30 is about making disconnect discoverable + an edge legend.
- **Decision:** Edge-specific multi-reference removal lands in A8 (canvas correctness); the
  discoverability affordance + legend lands in A24 (UX). A0 carries a failing stub for the former.
- **Reason:** Correctness vs polish is a don't-mix boundary.
- **Affects:** A0, A8, A24.

### 2026-05-28 — Docs in English to match repo house style
- **Context:** All existing `docs/goals/**` docs and both review reports are in English with English
  `C-/T-/W-` ids.
- **Decision:** Write this goal + devlog in English for consistency and workflow-fit; user-facing
  conversation stays in Simplified Chinese.
- **Reason:** The docs cross-reference English ids and feed an English review/issue workflow.
- **Affects:** documentation only.

### 2026-05-28 — Claude + Codex development with a 2-round Codex review gate
- **Context:** User directive: this program is built with Claude Code + Codex.
- **Decision:** Each atomic is implemented by Claude Code (test-first), then reviewed by Codex before
  merge. Cap at **two Codex review rounds**; after the second round, merge to `main` via PR. Findings
  not resolved within two rounds become a follow-up atomic, not a third round.
- **Reason:** Get a second-model review on every atomic while bounding the review loop so atomics
  still land promptly.
- **How to apply:** Per atomic — local checks → Codex review (≤2 rounds, fix actionable findings) →
  PR + merge → existing PR/main issue gates. Record the rounds in the milestone note below. Run
  `codex:setup` once to confirm the Codex CLI is ready.
- **Affects:** every atomic's review/merge step.

### 2026-05-28 — Codex split landed; created the confirmed icon-set doc; retargeted the goal
- **Context:** Codex split its review into 70 per-node/feature `<node>--codex.md` files; PR #32 carries
  the goal docs + the full codex review. The two icon audits + the confirmed v4 preview were ready.
- **Decision:** Created `docs/ui-icon-set.md` (final confirmed icon set, v4) as the A8b spec; retargeted
  the goal's "Before You Start" so each atomic reads both per-node files (`<node>--claude.md` +
  `<node>--codex.md`); A8b now points at the icon-set doc. Bundle goal docs + codex review + icon-set
  doc into PR #32 and **squash-merge** to `main`.
- **Reason:** Per-node codex files make per-atomic prep symmetric with pass-2; one confirmed icon doc
  feeds A8b; a single squash keeps `main` history clean.
- **How to apply:** `_icons-preview-v4.html` is the authoritative visual for exact glyphs — lift the
  proxy-protocol glyphs from there during A8b. Record any brand-SVG rejection or glyph change against
  `docs/ui-icon-set.md` here. Honor [[codex-review-gate]] and [[pr-over-commits]] for child atomics.
- **Affects:** A8b; the per-atomic reading workflow; the PR #32 merge.

### 2026-05-28 — Reconciliation-completeness audit: graft 4 unmapped Codex findings
- **Context:** A verification pass cross-checked every Codex `C-`/`IC-` id and Pass-2 `T-`/`W-`/atomic id
  against the Ordered Atomic Queue. All 35 W-items, 14 T-themes, 19 C0 P0s, the Pass-2 14-atomic queue,
  and the `IC-P*-*` icon findings were already mapped — but four Codex findings (`C1-1`, `C1-3`, `C1-6`,
  `C2-2`) had no row, silently breaking the "nothing from Codex is dropped" guarantee.
- **Decision:** Graft each into its exact-match atomic (no new atomics; the behavior was already covered
  by the row's W-item, only the `C-` id citation was missing):
  - `C1-1` (route-rule `bypass` must expose `outbound`/route-options) → **A20** (its W28 rule category
    already names "bypass-outbound select + resolve/route-options sub-fields").
  - `C1-3` (dns-rule compatible chip creates a DNS server but never connects it — missing
    `source.kind === "dns-rule"` branch in `createCompatible`) → **A8** (W16/T8 dead/no-op-chip cluster).
  - `C1-6` (hosts `predefined` + HTTPS/H3 header maps persist empty keys) → **A4** (W13 already scopes
    DoH-header/hosts empty-key prevention at the kv-repeater source).
  - `C2-2` (Service Inspector type dropdown still offers testing-only `hysteria-realm` on stable) →
    **A5** (channel/version-gating family; matches Codex exec-plan item 7). Its surface is
    `protocols.ts`/Inspector option gating, distinct from A5's `validateConfig` change — confirm at
    child-goal time whether it splits into a tiny follow-up.
- **Reason:** The umbrella goal's entire value is the traceable cross-map; an unmapped finding is a
  silent drop that no reader could trace by grepping its id.
- **How to apply:** Every Codex `C-` id is now greppable to exactly one atomic row. With `C2-2` homed,
  all `C2-*` ids are individually placed, so A28's "C2-* tail" was narrowed to "C2 label/copy residue."
- **Affects:** A4, A5, A8, A20, A28.

### 2026-05-28 — Split A2 into A2a (diagnostics) + A2b (markers + export gate)
- **Context:** A2 (`required-fields-and-export-gate`) is "Effort: L" and spans three concerns: domain
  diagnostics, component required-markers, and the export-UI gate.
- **Decision:** Split into **A2a** (diagnostics additions/upgrades + rule-set local `format` inference,
  `src/domain/diagnostics.ts` only) and **A2b** (`SharedFieldDefinition.required` + `aria-required`/`*`
  markers in `Inspector.tsx` + pre-export confirm gate in `TopBar.tsx`). Land A2a first so A2b's export gate
  has real error diagnostics to block on.
- **Reason:** (1) don't-mix bucket — domain/diagnostics vs component-render vs export-UI; (2) the
  `claude-review` pre-push gate budgets ~400 non-Markdown LOC per commit (AGENTS.md #8), and A2-as-one-commit
  would exceed it. Splitting keeps each atomic one-outcome and within the size budget.
- **Also:** A2a (as implemented) covers C0-19 (local rule-set `format`), C0-5 (empty selector/urltest
  group → error), C0-12 (WireGuard endpoint required fields), and C0-10 (DERP `mesh_with` server/port).
  The dns-rule route/evaluate `server` presence (C0-1) is deferred to A2c (overlaps A10's "evaluate hides
  server" C0-2 and the type-change scrub C0-3). The SSM-managed severity (C0-17) is left to A20, which
  owns the SSM mapping. The last-candidate-removal UI guard stays in A8.
- **Affects:** A2 (now A2a + A2b, + A2c for presence diagnostics deferred from A2a after implementation —
  inbound `listen`/credentials C0-16 and dns-rule route/evaluate `server` C0-1 need per-finding upstream +
  fixture verification; A2a shipped the low-false-positive subset: C0-19/C0-5/C0-12/C0-10); the umbrella A2
  row notes the split.

## Open Questions / Risks

- **Re-verify against HEAD.** Both reports and the `canvas-port-interaction-redesign-execution`
  atomics landed 2026-05-28. Some findings may already be partly fixed (reference/port registries,
  disconnect groundwork). Reproduce each finding on current `main` before implementing its child goal.
- **A7 (endpoint outbound-half)** is the single highest-risk atomic (touches reference resolution,
  ports, and connect handlers). Gate it behind a green `referenceRegistry`-completeness test (A0/A6).
- **A21 / A22 (cloudflared, HTTP Client):** unresolved product call — fully support the testing
  target now, or keep stable gated and ship docs-only? Decide before opening these child goals.
- **A20 batching:** keep strictly per node category; resist bundling to "save a PR."
- **Per-node `file:line` drift:** the cross-map's `C-/T-/W-` pairings are authoritative; the exact
  line numbers in the source reports may have drifted since 2026-05-28 — re-confirm when opening each
  child goal.
- **Official sing-box binaries:** if `sing-box-stable`/`sing-box-testing` are unavailable in the work
  environment, say so in the milestone note and distinguish browser semantic validation from official
  validation.

## Milestone Notes

One block per merged atomic. Template:

```md
### A<n> <slug> — <one-line outcome>
Status: implemented YYYY-MM-DD in `atomic/<branch>`; merged in PR #<n>.

- What changed: <bullet summary tied to the C-/T-/W- ids closed>.
- Frontend perf review (`vercel-react-best-practices`): <findings or "n/a — no src/components|state change">.
- Codex review:
  - Round 1: <findings → dispositions>.
  - Round 2 (if needed): <findings → dispositions, or "skipped — round 1 clean">.
  - Deferred to follow-up atomic: <none | A<x> tracking ...>.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test`, `pnpm build`, `pnpm e2e` (as applicable).
- Official check: `sing-box-stable/testing check` <ran on … | not run because …>.
```

### A0 phase0-guardrail-tests — Phase-0 guardrail suite (W1–W5 + multi-edge stub)
Status: implemented 2026-05-28 in `atomic/phase0-guardrail-tests`; merged in PR #36.

- What changed: tests + child goal doc only (`docs/goals/phase0-guardrail-tests.md`). Six guardrails turn
  each Phase-1 fix into a red→green target while keeping `pnpm test` green (red targets = `it.fails`; DOM
  guardrails = characterization that flips red on fix):
  - W1 `referenceRegistry` completeness on delete **and** rename for 5 code-verified refs (route-rule
    `resolve.server`, inbound `detour`, tun `route_address_set`, shadowtls `handshake.detour`, derp
    `mesh_with[].detour`; `_RELATIONSHIPS` rows 5/23/28/29/30) → A6.
  - W2 behavioral `createCompatible` coverage (16 dead chips: C1-9/12/15) → A8.
  - W3 shared TLS/multiplex card role-by-direction (C0-6/C0-7) → A1.
  - W4 `JsonField` parse safety (C0-18) → A3.
  - W5a `detour-target` input type guard for block/selector/urltest/dns (P2-f) → A6.
  - W5b warning-vs-valid node status glyph (T9/W10) → A9.
  - multi-edge aggregate-port disconnect characterization + `it.todo` (C1-7/8/23) → A8.
- Re-verify-against-HEAD: W5 dns-server-detour guard already landed in the canvas PR-7 atomic → shipped a
  green regression lock instead of a red target. Per-member selector disconnect already works from each
  member node's own input port; only the selector's aggregate output control is defective.
- Frontend perf review (`vercel-react-best-practices`): n/a — no `src/components`/`src/state` change.
- Codex review:
  - Round 1: 1 BLOCKER (W2 was a static handled-set mirror that wouldn't flip if A8 wired rather than
    pruned dead chips) + 3 SHOULD-FIX (W1 delete-only, W5a block-only, multi-edge brittle count assertion).
    All addressed: W2 → behavioral probe; W1 → rename cases; W5a → all four types; multi-edge → `it.todo`
    after discovering per-member disconnect already works.
  - Round 2: clean — findings resolved, no W2 false-positives, no new issues, `tsc` clean.
  - Deferred to follow-up atomic: none.
- Verification: `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm test`
  (602 passed | 15 expected fail | 1 todo), `pnpm build`. `pnpm e2e` not run (no interaction change).
- Official check: `sing-box-stable/testing check` not run because A0 changes tests + docs only, not
  bundled fixture/exported config output.

### A1 shared-cards-by-direction — Split shared TLS/multiplex cards by role
Status: implemented 2026-05-28 in `atomic/shared-cards-by-direction`; merged in PR #37.

- What changed (C0-6 / C0-7 / W6 / T1-T2): `sharedFieldDefinitions` now partitions the TLS and multiplex
  shared cards by role.
  - TLS server role = inbound + service; client role = outbound + **dns-server** (dns-server[tls/https/
    quic/h3] dials a DoT/DoH upstream as a client — verified against `dns/server/{tls,https,quic,http3}.md`).
    Server-only: key/key_path/client_authentication/certificate_provider/reality server handshake/
    private_key/short_id(list)/max_time_difference/ech.key/ech.key_path. Client-only: disable_sni/insecure/
    certificate_public_key_sha256/fragment*/record_fragment/utls/reality public_key+short_id(text)/ech
    client config.
  - Fixed `client_authentication` enum to `no/request/require-any/verify-if-given/require-and-verify`.
  - Multiplex protocol/max_connections/min_streams/max_streams gated to outbound; inbound keeps
    enabled/padding (+brutal).
  - naive (outbound) TLS narrowed (no enable toggle; scaffold seeds enabled:true); dropped `tuic` from
    `outboundUdpOverTcpTypes` (uses `udp_over_stream`).
  - Flipped the A0 W3 guardrail to assert by-direction; rewrote the app.test single-card test into
    server/client cases; updated the config-doc tuic line.
- Scope deferrals (don't-mix): v2ray-transport per-type gating + a `headers` map control is by-TYPE not
  by-direction and needs a new `SharedFieldKind` → follow-up atomic; additive missing TLS fields
  (kernel_tx/rx, handshake_timeout, client mTLS client_certificate/client_key, engine/spoof) → A20/W28.
- Frontend perf review (`vercel-react-best-practices`): pure derived-during-render data
  (`rerender-derived-state-no-effect`); no new subscriptions, hooks, waterfalls, or bundle deps; returns
  fresh arrays as before (stable keys, no added rerender). Pass.
- Codex review:
  - Round 1: 1 BLOCKER (server `reality.short_id` dropped — regression; restored as a `list`) + 3
    SHOULD-FIX (server `ech.key`/`ech.key_path` added to avoid a dead ECH toggle; redundant naive
    `tls.enabled` toggle removed; `tuic` removed from the udp-over-tcp owners string). All addressed.
  - Round 2: clean.
  - Deferred to follow-up atomic: none from review (scope deferrals above are queue items, not findings).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (602 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (13 passed, Chromium).
- Official check: `sing-box-stable/testing check` not run — A1 changes Inspector field-list logic, not
  bundled fixture/exported config output.

### Soft checkpoint after A1 (queue re-evaluation)
A1 landed the role-split inside `sharedFieldDefinitions` without changing the shared-group registry shape
(`sharedFieldRegistry.ts` group membership is unchanged; only the per-group field lists became
role-aware). No re-ordering of later rows is required: A2/A3 (required+export gate, JsonField) and A6
(referenceRegistry+detour guards) are independent of the TLS/multiplex field-list internals. v2ray-transport
per-type work was split out as a follow-up (recorded above). Proceeding to A2 + A3 per the near-term order.

### A3 jsonfield-parse-safety — JsonField never writes unparseable text
Status: implemented 2026-05-28 in `atomic/jsonfield-parse-safety`; merged in PR #38.

- What changed (C0-18 / T4 / W8): `JsonField` now keeps a local draft + parse-error state — on a parse
  failure it keeps the last valid value and shows a `role="alert"`, only calling `onChange` on a
  successful `JSON.parse`; empty input clears the field. A `lastEmittedRef` separates our own valid edits
  (no reset / no mid-edit reformat) from external value changes, and each `JsonField` is keyed by entity
  identity so an entity switch resets draft/error (no stale draft can land on the next entity even when
  both share an identical value). The route-rule and dns-rule logical-group "rules" editors now use the
  existing safe `InlineRuleSetEditor`; `"rules"` was added to `ruleSetHandledFields` to avoid a duplicate
  advanced-JSON editor. Flipped the A0 W4 guardrail to assert the safe behavior.
- Frontend perf review (`vercel-react-best-practices`): controlled-input local state (draft/error + a
  ref); no new store subscriptions, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: keep last-valid + role="alert" (implemented); follow-up — reset draft/error on entity switch
    (added `lastEmittedRef`).
  - Round 2: entity switch with byte-identical values still kept the stale draft → keyed `JsonField` by
    entity identity so React remounts on switch. Plus minors (empty-input clear, refKey hoist, key-order
    consistency) addressed.
  - Deferred to follow-up atomic: none.
- Pre-push gate note: the local `claude-review` pre-push hook reviews each commit in isolation against the
  AGENTS.md #8 atomic budget, so the intermediate round-1/round-2 fix commits (whose first commit still
  carried the pre-fix JsonField) were **squashed into one clean signed commit** before push; the squashed
  commit passed the gate.
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (604 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (port-click-redesign 6/6 on isolated re-run; one full-suite drag test
  was a headless flake — A3 changes no canvas code).
- Official check: `sing-box-stable/testing check` not run — A3 changes Inspector editor behavior, not
  bundled fixture/exported config output.

### A2a required-fields-diagnostics — flag more invalid configs before export (domain)
Status: implemented 2026-05-28 in `atomic/required-fields-diagnostics`; merged in PR #39.

- What changed (`src/domain/diagnostics.ts` + `tests/required-fields-diagnostics.test.ts`):
  - C0-19: local rule-set with no `format` and a non-inferable `path` (ext ≠ .json/.srs) → error
    (`rule-set-local-format-missing`); the local path is read as a filesystem path (no URL query/fragment
    stripping), distinct from the remote-url inference.
  - C0-5: empty selector/urltest `outbounds[]` group upgraded warning → error (`group-outbound-empty`).
  - C0-12: WireGuard endpoint requires `address`/`private_key`/≥1 `peers`; each peer requires
    `public_key`/`allowed_ips`.
  - C0-10: each DERP `mesh_with[]` peer requires `server` + numeric `server_port`.
- Scope: A2 was split (this devlog, 2026-05-28) into A2a (this) + A2b (markers + export gate) + A2c
  (deferred presence diagnostics). A2a shipped the low-false-positive subset; **A2c** still owns inbound
  `listen` + credential presence (C0-16) and dns-rule route/evaluate `server` (C0-1, overlaps A10).
- Frontend perf review: n/a — domain-only, no `src/components`/`src/state` change.
- Codex review:
  - Round 1: 1 should-fix (local `format` inference must not strip URL query/fragment from a filesystem
    path — fixed) + 1 nit (devlog C0-1 scope contradiction — fixed). All four diagnostics confirmed
    against sing-box testing 1.14 with no false positives (wireguard.md:56, selector.md:24, urltest.md:23,
    service/derp.md:96, rule-set/index.md).
  - Round 2: skipped — the two findings were trivial and locally verified by the passing test; the repo
    pre-push `claude-review` gate independently passed the squashed commit.
  - Deferred to follow-up atomic: A2c (presence diagnostics, above).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (613 passed | 15 expected fail | 1
  todo), `pnpm build`. No bundled fixture regressed from the new/upgraded diagnostics.
- Official check: `sing-box-stable/testing check` not run — A2a adds semantic diagnostics, not bundled
  fixture/exported config output.

### A2b required-markers-and-export-gate — pre-export validation gate (component)
Status: implemented 2026-05-28 in `atomic/required-markers-and-export-gate`; merged in PR #40.

- What changed (`src/components/TopBar.tsx` + `tests/export-gate.test.tsx` + `e2e/external-fixtures.spec.ts`):
  `exportConfig()` prompts a `window.confirm` when the config has error-level diagnostics and aborts the
  download on cancel (W9 pre-export gate). The gate reads semantic `diagnostics` (always current, never
  cleared mid-flight), not the combined pill status — closing the in-flight official-check race. Added an
  `export-button` testid; the external-fixtures e2e accepts the dialog so its round-trip still runs.
- Scope: A2b is the export gate only. Required-marker `aria-required`/`*` field hints were moved to A2c
  (they pair with the presence diagnostics A2c also owns).
- Frontend perf review (`vercel-react-best-practices`): adds a guard to an existing handler using
  already-subscribed `diagnostics`; no new subscriptions, waterfalls, or bundle deps. Pass.
- Codex review:
  - Round 1: 1 should-fix — gating on combined `status` could be raced by an in-flight official check
    (runOfficialCheck clears official diagnostics on start). Fixed by gating on semantic `diagnostics`.
  - Round 2: skipped — the fix directly implements the recommendation and is verified by unit + e2e; the
    repo pre-push `claude-review` gate passed the squashed commit.
  - Deferred to follow-up atomic: none (markers were a scope move to A2c, not a finding).
- Verification: `git diff --check`, `pnpm exec tsc -b`, `pnpm test` (616 passed | 15 expected fail | 1
  todo), `pnpm build`, `pnpm e2e` (external-fixtures + port-click specs 8 passed; an earlier port-click
  failure was a known headless-drag flake).
- Official check: `sing-box-stable/testing check` not run — A2b changes the export UI flow, not bundled
  fixture/exported config output.
