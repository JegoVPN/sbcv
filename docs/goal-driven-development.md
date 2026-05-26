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
- E2E or smoke verification proves the intended user-facing path works.
- Missing checks are explicitly called out with reasons.
- The final commit is signed, pushed, and verified on GitHub when available.

For docs-only goals, E2E can be replaced by a traceability review: every claim must map to a source document or local policy. For app goals, E2E means opening/running the app path and verifying the workflow, not only passing typecheck.

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
- unit tests for domain commands
- round-trip tests for config fixtures
- E2E/smoke test for the user path covered by the goal
- `sing-box-stable check` for stable fixtures
- `sing-box-testing check` for testing fixtures

## First Goals Queue

Recommended order:

1. Project scaffold and baseline UI shell.
2. Stable-first `SingBoxConfig` type and top-level normalize/import/export.
3. Config document inventory to schema registry seed.
4. Domain command layer for create/rename/delete/connect.
5. React Flow derived graph for inbounds, route, outbounds, selector, URLTest.
6. Inspector panel for selected node.
7. Route Rules table.
8. DNS Server nodes and DNS Rules table.
9. Stable/testing binary validation service.

Do not start deep protocol form coverage before import/export, domain commands, and stable validation are working.
