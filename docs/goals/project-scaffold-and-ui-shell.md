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

## Implementation Plan

1. Choose and scaffold the app stack with React, TypeScript, and a package manager lockfile.
2. Add the first UI shell: top bar, canvas region, left palette, right Inspector, bottom JSON/diagnostics panel.
3. Add placeholder registries and directory structure for future `SingBoxConfig`, React Flow graph derivation, Inspector schemas, and validation.
4. Run available checks, document missing checks, commit signed, push, and verify.

## Acceptance Criteria

- The app can run locally with one documented command.
- The first screen is the actual editor shell, not a marketing page.
- The shell has stable regions for Canvas, Palette, Inspector, JSON Preview, and Diagnostics.
- No feature treats React Flow nodes as the config source of truth.
- README documents how to start the app.
- The commit is signed and GitHub Verified.

## Validation Matrix

| Case | Check |
| --- | --- |
| Markdown/docs | `git diff --check` |
| App scaffold | package install/build/typecheck once scaffold exists |
| Commit | `git log --show-signature -1` and GitHub verification |

## Notes And Deviations

- Date:
- Decision:
- Reason:

