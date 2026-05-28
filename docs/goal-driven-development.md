# Goal-Driven Development

This document defines how SBC goals are prepared and executed. It is intentionally lighter than the Hirona workflow because this repo is still early-stage, but each goal must still close the full loop: research, implementation, review, E2E verification, docs, signed commit, and push.

## Goal Format

A goal should be short and point to a spec:

```txt
/goal Build the stable-first sing-box schema registry --spec docs/schema-registry-goal.md
```

Good goals name an outcome, not a vague activity:

- Good: `Build import/export for stable sing-box configs`
- Good: `Implement Route Rules table backed by canonical JSON`
- Weak: `Work on canvas`
- Weak: `Improve schema`

## Completion Standard

A goal is expected to represent one complete end-to-end research and development pass. The agent should choose the best path available from the source docs and local codebase, then carry the work through review and E2E verification.

A goal is done only when all of these are true:

- The source docs and local constraints were read.
- The chosen approach is documented as the optimal path for this repo.
- The implementation is complete for the stated scope.
- The diff has been reviewed against the goal doc, AGENTS.md, and source-of-truth docs.
- A PR was opened promptly after local checks, and the PR's Claude review issue was inspected or its absence was recorded.
- E2E or smoke verification proves the intended user-facing path works.
- Missing checks are explicitly called out with reasons.
- The final commit is signed, pushed, and verified on GitHub when available.
- The post-merge issue gate has passed before the next atomic begins.

For docs-only goals, E2E can be replaced by a traceability review: every claim must map to a source document or local policy. For app goals, E2E means opening/running the app path and verifying the workflow, not only passing typecheck.

For frontend goals, implementation and review must apply the `vercel-react-best-practices` skill in the same session. The goal is not review-complete until the frontend diff has been checked for bundle size, rerender scope, derived-state cost, async/data waterfalls, and unnecessary global subscriptions.

## Goal R&D Doc Template

Create one doc per non-trivial goal:

```txt
docs/goals/<slug>.md
```

Use this structure:

```md
# <Goal Name>

## Outcome

One paragraph describing what is true when the goal is done.

## Scope

- In scope:
- Out of scope:

## Source Docs

- AGENTS.md
- docs/sbc-react-flow-rd-plan.md
- docs/sing-box-config-doc-inventory.md
- sing-box stable/testing docs used by this goal

## Optimal Path

- Architecture decision:
- Why this is the best path for SBC:
- Alternatives rejected:
- Risk controls:

## Implementation Plan

1. Atomic 1
2. Atomic 2
3. Atomic 3

## Review Plan

- Self-review focus:
- Source-of-truth checks:
- Diff scope checks:
- Design/UX checks if UI is touched:
- Frontend skill gate if UI is touched: `vercel-react-best-practices`

## E2E Plan

- User path:
- Tooling:
- Expected evidence:
- Fallback if full E2E is not possible:

## Acceptance Criteria

- Observable behavior
- Tests/checks
- Docs updates

## Validation Matrix

| Case | Check |
| --- | --- |
| stable config | `sing-box-stable check` |
| testing config | `sing-box-testing check` |
| app code | project tests/typecheck once available |

## Done Definition

- Implementation complete:
- Review complete:
- E2E/smoke complete:
- Docs updated:
- Signed commit pushed:

## Notes And Deviations

- Date:
- Decision:
- Reason:
```

## Atomic Rules

Each atomic should have:

- one owner;
- one clear outcome;
- a small file scope;
- matching tests/checks;
- a signed commit.
- a post-merge issue gate: list open GitHub issues after merge/push to `main`, resolve active-goal review issues, and record the result before starting the next atomic.

## Post-Merge Issue Gate

Claude Code review can open GitHub issues after an atomic PR is opened or deployed. Do not treat GitHub Actions as a reliable review or deployment gate; do not wait on them when local checks and the relevant provider deployment signal are enough. Deployment runs on Cloudflare Workers Builds, not GitHub Actions; an `UNSTABLE` PR state caused by a pending Actions check (e.g. `release-check`) is not a reason to delay a merge.

### PR Issue Gate

Immediately after opening an atomic PR:

1. List open issues and search for `Review of PR #<number>` in the title.
2. If the scheduled review poller has already opened the issue, inspect it before merging.
3. If the review issue has actionable active-goal findings, fix them in the same PR or a small follow-up commit before merging.
4. If the review issue only contains timeout, fail-open, or `0 critical, 0 major, 0 minor` output, comment that it is non-actionable and close it.
5. If no review issue exists yet, record that the poller has not created it. Do not run a duplicate local `poll-and-submit.mjs` while the scheduled poller is active unless the user explicitly asks.

### Main Issue Gate

Before starting the next atomic PR after merge or push to `main`:

1. List current open GitHub issues for the repository.
2. Identify issues opened by Claude Code review or issues clearly related to the just-merged PR / active goal.
3. Resolve actionable active-goal issues before continuing. Use a small follow-up atomic if needed.
4. If an issue is unrelated, blocked, or intentionally deferred, record that reason in the milestone report.
5. If GitHub issue access is unavailable, report it explicitly; do not silently skip the gate.

### Issue Classification

- Active-goal issue: title/body references the current PR, the just-merged PR, current branch, or the current goal doc.
- Actionable issue: contains a concrete bug, regression, missing test, policy violation, or required follow-up.
- Non-actionable issue: only records timeout/fail-open, duplicate review output, or a passing review with no findings.
- Unrelated issue: belongs to a different PR/workstream. Record it and continue unless the user redirects the work.
- Deferred issue: real but outside the active atomic. Link it in the milestone report and make it the next atomic only if it blocks the current goal.

Avoid mixing these in one atomic:

- schema registry and canvas UI;
- visual polish and domain behavior;
- stable support and testing-gated fields;
- refactor and feature work;
- docs cleanup and runtime logic.

## Required Goal Checks

Until the app scaffold exists:

- `git diff --check`
- Markdown/readability review
- traceability review against source docs
- commit signature verification

Once the app exists:

- package manager install/build check
- TypeScript check
- React implementation/review against `vercel-react-best-practices` in the same work session
- unit tests for domain commands
- round-trip tests for config fixtures
- E2E/smoke test for the user path covered by the goal
- `sing-box-stable check` for stable fixtures
- `sing-box-testing check` for testing fixtures

## First Goals Queue

Recommended order:

1. [Stable-First SBC Visual Editor Release](goals/stable-first-sbc-visual-editor-release.md).
2. Project scaffold and baseline UI shell.
3. Stable-first `SingBoxConfig` type and top-level normalize/import/export.
4. Config document inventory to schema registry seed.
5. Domain command layer for create/rename/delete/connect.
6. React Flow derived graph for inbounds, route, outbounds, selector, URLTest.
7. Inspector panel for selected node.
8. Route Rules table.
9. DNS Server nodes and DNS Rules table.
10. Stable/testing binary validation service.

Do not start deep protocol form coverage before import/export, domain commands, and stable validation are working.
