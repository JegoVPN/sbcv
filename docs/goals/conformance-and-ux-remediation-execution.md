# Conformance & UX Remediation — Execution Plan

Run with:

```txt
/goal execute the conformance & UX remediation queue (A0–A29) --spec docs/goals/conformance-and-ux-remediation-execution.md
```

This is the **execution goal** for the queue planned in
[`conformance-and-ux-remediation.md`](conformance-and-ux-remediation.md). The umbrella goal builds and
maintains the cross-mapped Ordered Atomic Queue (planning); **this goal lands it**, one atomic PR at a
time, until every row is merged or explicitly deferred. The shared TODO / decision / milestone journal
is [`conformance-and-ux-remediation-devlog.md`](conformance-and-ux-remediation-devlog.md).

This doc does **not** restate the queue. A0–A29 definitions, the `C-/T-/W-` cross-map, child-goal
slugs, don't-mix buckets, and near-term order live in the umbrella doc; the devlog's Running TODO is the
progress source of truth. This doc defines only **how the queue is executed**.

## Target Outcome

Every row A0–A29 (+A8b) is merged to `main` via a small, test-first, signed atomic PR — or explicitly
marked not-applicable / deferred with a recorded reason. When done, the umbrella goal's Done Definition
holds: no node / shared card / import path can export an invalid sing-box config; rename/delete/
type-change leave no dangling tag references; desktop and mobile both have a discoverable
add → connect → validate path; every fix traces back to its `C-/T-/W-` ids.

## Source Docs

- Planning: [`conformance-and-ux-remediation.md`](conformance-and-ux-remediation.md) (queue + cross-map).
- Per-finding evidence: `docs/ui-reviews-codex/**` (`<node>--codex.md`) and `docs/ui-reviews-pass2/**`
  (`<node>--claude.md`). Read **both** per-node files for the node an atomic touches.
- Workflow: [`../goal-driven-development.md`](../goal-driven-development.md) (atomic rules, PR + main
  issue gates).
- Frontend gate: `vercel-react-best-practices`.
- Upstream truth: sing-box **testing 1.14** (`docs/upstream/sing-box/testing/**`) for conformance.

## Non-Negotiables

Inherited from the umbrella goal; the execution-critical ones:

- **Canonical config is the source of truth.** React Flow nodes/edges and Inspector views stay derived.
- **One atomic = one outcome.** Respect the don't-mix buckets (schema vs canvas, visual polish vs
  domain behavior, stable vs testing-gated, refactor vs feature, docs vs runtime).
- **Test-first.** A red guardrail / unit / e2e test before the fix; pair each guardrail with its fix.
- **Land via PR (squash), not direct push to `main`.**
- **Frontend gate.** Any diff touching `src/components/**` or `src/state/**` is not review-complete
  until checked against `vercel-react-best-practices`.
- **Expert review gate before merge — one pass.** Dispatch a single senior Claude Code reviewer
  subagent (via the Agent tool) whose expertise best matches the atomic; fix its actionable findings,
  then merge. No multi-round loop.
- **Re-verify against HEAD** before implementing each atomic.

## Run Protocol — continuous-autonomous with checkpoints

Cadence: run atomics back-to-back **without pausing**, EXCEPT at the checkpoints below. Follow the
umbrella's order:

> **A0 → A1 → (A2, A3) → A4, A5, A6 → A7 → A8, A8b, A9 → Phase 2 → Phase 3 → Phase 4.**

### The atomic loop (repeat per row)

1. **Open** — read the two per-node reports for the node(s) this atomic touches
   (`<node>--codex.md` + `<node>--claude.md`) and the matching `C-/T-/W-` rows.
2. **Re-verify against HEAD** — confirm the finding still reproduces on current `main`. If a prior PR
   (e.g. the `canvas-port-interaction-redesign-execution` atomics) already fixed it, mark it
   not-applicable with a reason in the devlog and skip.
3. **Test-first (red)** — write the failing guardrail / unit / component / e2e test that encodes the
   outcome. For Phase 0 (A0) these are the W1–W5 guardrails + the multi-edge-disconnect stub.
4. **Implement (green)** — minimal change to pass; stay inside the atomic's don't-mix bucket.
5. **Local checks** — `git diff --check`, `pnpm exec tsc -b --pretty false`, `pnpm test`, `pnpm build`,
   and `pnpm e2e` where interaction changed. Frontend diffs → `vercel-react-best-practices` review.
6. **Expert review gate (one pass)** — dispatch a single senior Claude Code reviewer subagent (via the
   Agent tool) whose expertise best fits the atomic: a React / frontend-performance reviewer applying
   `vercel-react-best-practices` for `src/components/**` or `src/state/**` diffs; a domain-correctness
   reviewer (schema / diagnostics / commands / reference registry vs sing-box upstream) for domain
   diffs; pick the closest match per atomic. Give it the diff + the atomic's intended outcome and its
   `C-/T-/W-` ids. Fix the actionable findings from that one pass, then merge — no second round. A
   finding that shows the atomic's own outcome is *not met* is a failed step 3/4 (test not green), not a
   deferral — fix it or hit a Stop Condition; do not merge. Non-blocking findings become a follow-up
   atomic.
7. **PR → `main`** — squash-merge, one atomic per PR.
8. **Issue gates** — PR issue gate immediately after opening; main issue gate before the next atomic
   (per `goal-driven-development.md`). UNSTABLE from a pending GitHub Actions check is **not** a merge
   blocker (deploy is Cloudflare, not Actions).
9. **Devlog** — tick the Running TODO box and add the milestone note (branch, what changed, frontend
   perf review, **the reviewer used + its findings + dispositions**, verification commands,
   official-check note).
10. **Next atomic** — unless a checkpoint below says stop.

### Checkpoints

**Soft (report + continue; record the call in the devlog):**

- **After A1 lands** — re-evaluate the queue against the actual code; A1/A6's structural shape can
  re-order later rows. Reflect any change back into the umbrella doc + devlog before continuing.
- **End of each Phase** — post a short progress report.

**Hard (STOP and wait for the user's confirmation before starting the atomic):**

- **A7** (endpoint outbound-half) — the single highest-risk atomic; touches reference resolution,
  ports, and connect handlers. Confirm it lands after A6 and after a green `referenceRegistry`-
  completeness test.
- **A21 / A22** (cloudflared / HTTP Client) — open product decision: fully support the testing target
  now, or keep stable-gated and ship docs-only. Present the options + the reviews' lean ("support
  testing or document the gate clearly," not "enable on stable").

At a hard checkpoint: write the risk + options to the devlog, report, and **pause — do not proceed on a
default**. Wait for the user.

## Stop Conditions (abort the run and report)

- Local checks / build fail repeatedly and the cause is outside the current atomic's scope.
- The atomic's own outcome cannot be met — its red test will not go green without a queue change.
- An atomic requires re-ordering or scope-changing the queue → update the umbrella doc + devlog first,
  then resume.

Review findings do **not** abort the run: per step 6, a non-blocking finding from the review pass is
deferred to a follow-up atomic and the run proceeds. `sing-box` binary unavailability is **not** a
stop either — it is handled in the Validation Matrix (record + degrade to browser semantic validation).

## Validation Matrix

Reuse the umbrella's Validation Matrix (lint `git diff --check`, types `tsc -b`, unit/component
`pnpm test`, build `pnpm build`, interaction `pnpm e2e`, config-doc coverage `pnpm audit:config-docs`,
`sing-box-stable check` / `sing-box-testing check`). **Add round-trip fixture tests whenever an atomic
changes config import/export or fixtures** (per `goal-driven-development.md`). Per atomic, prove the
specific user-facing path it claims (docs-only rows fall back to a traceability review). If
`sing-box-stable` / `sing-box-testing` are unavailable, record it and distinguish browser semantic
validation from official validation — do not silently skip the official check.

## Definition of Done (this execution goal)

- Every A0–A29 (+A8b) row merged via PR with a passing PR + main issue gate, or explicitly
  deferred / not-applicable with a reason recorded in the devlog.
- The umbrella goal's Done Definition holds.
- The devlog has one milestone note per merged atomic, each recording its Codex review rounds.

## Notes And Deviations

Record any cadence / scope / order deviation in the devlog with a date and reason, then reflect any
queue change back into the umbrella doc.
