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
- [ ] A0 — guardrail tests W1–W5 + multi-edge-disconnect stub (`phase0-guardrail-tests`)

### Phase 1 — Structural root-cause
- [ ] A1 — shared TLS/multiplex/transport by direction (`shared-cards-by-direction`)
- [ ] A2 — required markers + pre-export gate + local rule-set `format` (`required-fields-and-export-gate`)
- [ ] A3 — JsonField parse safety + `rules` handled (`jsonfield-parse-safety`)
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

_(No atomics merged yet.)_
