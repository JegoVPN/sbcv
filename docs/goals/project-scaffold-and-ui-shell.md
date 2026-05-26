# Project Scaffold And UI Shell

## Outcome

SBC has a runnable React/TypeScript app shell for the sing-box canvas editor: a dark canvas workspace, left palette, right Inspector, JSON/diagnostics area, and enough structure to support later domain-model and React Flow work.

## Scope

In scope:

- Create the frontend project scaffold.
- Add the baseline application shell.
- Establish package scripts for local development, typecheck, lint/build where supported by the chosen stack.
- Prepare empty extension points for domain config, canvas, Inspector, JSON preview, and diagnostics.
- Keep the UI aligned with the Higgsfield-style canvas reference without implementing full node behavior yet.

Out of scope:

- Full sing-box schema coverage.
- Real `sing-box check` integration.
- Route/DNS rule editors.
- Protocol-specific Inspector forms.
- Persistence, auth, collaboration, or cloud deployment.

## Source Docs

- [AGENTS.md](../../AGENTS.md)
- [SBC React Flow R&D Plan](../sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](../sing-box-config-doc-inventory.md)
- [Goal-Driven Development](../goal-driven-development.md)

## Optimal Path

- Architecture decision: scaffold a small React/TypeScript app first, with explicit placeholders for domain config, graph derivation, Inspector schemas, JSON preview, and diagnostics.
- Why this is the best path for SBC: it creates the real editor surface first while preserving the canonical JSON/domain-model constraint.
- Alternatives rejected: building schema coverage before a runnable shell, or creating a marketing/landing page before the editor.
- Risk controls: keep UI placeholders non-authoritative; do not let canvas state become config state; keep protocol-specific forms out of this goal.

## Implementation Plan

1. Choose and scaffold the app stack with React, TypeScript, and a package manager lockfile.
2. Add the first UI shell: top bar, canvas region, left palette, right Inspector, bottom JSON/diagnostics panel.
3. Add placeholder registries and directory structure for future `SingBoxConfig`, React Flow graph derivation, Inspector schemas, and validation.
4. Run available checks, review the shell against the goal docs, perform browser smoke/E2E verification, commit signed, push, and verify.

## Review Plan

- Confirm the first screen is the editor shell, not a landing page.
- Confirm the shell visually reserves Canvas, Palette, Inspector, JSON Preview, and Diagnostics.
- Confirm no code treats React Flow nodes as the source of truth.
- Confirm future domain/model/validation directories are placeholders only, without fake schema authority.
- Confirm README start instructions match the actual package scripts.

## E2E Plan

- User path: start the dev server, open the app, confirm the editor shell renders.
- Tooling: local dev server plus Browser/Playwright smoke check when the scaffold exists.
- Expected evidence: screenshot or automated assertion showing the shell regions are visible and non-overlapping.
- Fallback if full E2E is not possible: document the blocker and run the strongest available build/typecheck/static verification.

## Acceptance Criteria

- The app can run locally with one documented command.
- The first screen is the actual editor shell, not a marketing page.
- The shell has stable regions for Canvas, Palette, Inspector, JSON Preview, and Diagnostics.
- No feature treats React Flow nodes as the config source of truth.
- README documents how to start the app.
- Browser smoke/E2E verification passes or the blocker is explicitly documented.
- The commit is signed and GitHub Verified.

## Validation Matrix

| Case | Check |
| --- | --- |
| Markdown/docs | `git diff --check` |
| App scaffold | package install/build/typecheck once scaffold exists |
| Browser smoke | open the app and verify shell regions once scaffold exists |
| Commit | `git log --show-signature -1` and GitHub verification |

## Done Definition

- Implementation complete: app scaffold and shell are present.
- Review complete: shell and code structure checked against this goal and AGENTS.md.
- E2E/smoke complete: local app opened and shell verified.
- Docs updated: README includes accurate start command.
- Signed commit pushed: GitHub shows Verified.

## Notes And Deviations

- Date:
- Decision:
- Reason:
