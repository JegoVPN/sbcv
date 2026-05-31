# SBC Agents Guide

SBC is a sing-box configuration builder. The product goal is a React Flow visual editor backed by a canonical sing-box JSON/domain model.

## Source Of Truth

Read these before changing product behavior, schema, validation, or node UI:

- [SBC React Flow R&D Plan](docs/sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](docs/sing-box-config-doc-inventory.md)
- [sing-box Canvas Configuration Guide](docs/sing-box-canvas-configuration-guide.md)
- [sing-box Config Capability Audit](docs/sing-box-config-capability-audit.md)
- [Goal-Driven Development](docs/goal-driven-development.md)
- `vercel-react-best-practices` skill when writing, reviewing, or refactoring React/Next.js code.

The canvas is never the config source file. `SingBoxConfig` / domain model is the source of truth; React Flow nodes and edges are a derived editing view.

## Non-Negotiables

1. **Canonical config first**: all edits go through domain commands that update canonical JSON/domain state. Do not derive final `config.json` from React Flow node data.
2. **stable-first**: default templates, export, fixtures, and blocking validation target sing-box stable. testing is explicit opt-in.
3. **Different binaries**: stable configs are checked with `sing-box-stable`; testing configs are checked with `sing-box-testing`.
4. **Document traceability**: every schema field, node type, Inspector field, and fixture must map to an entry in `docs/sing-box-config-doc-inventory.md`.
5. **Rules are ordered tables**: `route.rules` and `dns.rules` are ordered lists. The canvas may visualize references, but it must not be the ordering source.
6. **Tag references are explicit**: tag rename, delete, connect, and disconnect must update references through tested domain commands.
7. **Small atomics**: one concern per commit. Prefer changes under 400 logical lines; split larger work.
8. **No silent validation gaps**: if `sing-box check` cannot run, state that clearly in the final answer and keep schema/semantic validation separate from official validation.
9. **No unrelated cleanup**: do not refactor unrelated files while implementing a goal.
10. **React performance discipline**: all frontend work follows the **Frontend Skill Gate** below — apply `vercel-react-best-practices` in the same session.
11. **No local paths or environment in public history**: never paste absolute local paths, usernames, or environment variables (e.g. a full `PATH="/Users/..."`) into commit messages, PR titles/descriptions, comments, or milestone reports. Record the bare command only — write `pnpm release:check`, not `PATH="/Users/<you>/..." pnpm release:check`. Such data leaks into public history and cannot be fully scrubbed afterward.

## Frontend Skill Gate

Any change touching frontend implementation, architecture, UI tests, or frontend review must use the `vercel-react-best-practices` skill in the same session. This is a hard gate for `src/**/*.tsx`, UI-facing `src/**/*.ts`, `src/styles.css`, React Flow canvas code, component/Playwright tests, and build/bundle config.

- **Before editing:** load the skill; identify the atomic's performance risks (bundle size, rerender scope, expensive derived state, async/data waterfalls); keep transient hover/drag/canvas state out of broad canonical config subscriptions.
- **Before done:** review the diff against the skill; defer heavy or optional editors where practical; prefer narrow Zustand selectors and memoized derived graph data over broad rerender paths; record intentional deviations in the goal doc or milestone report.

## Development Protocol

Before editing:

- Read this file and the relevant docs above.
- Identify the active goal or task.
- Define the atomic scope: files allowed, expected behavior, tests/checks.
- Check current worktree state with `git status --short --branch`.

During implementation:

- Keep config/domain logic separate from canvas layout.
- Add or update docs when behavior, schema, or validation policy changes.
- Prefer registry-driven node/schema/form additions over ad hoc component branching.
- For frontend/React work, follow the **Frontend Skill Gate** above (apply `vercel-react-best-practices`).
- Preserve existing user changes; never discard unrelated work.

Before committing:

- Run `git diff --check`.
- Run available project tests/checks. If the project has no test harness yet, say so.
- For config fixtures, run the matching `sing-box-stable check` or `sing-box-testing check` once binaries are available.
- Inspect the diff for scope creep.

After committing:

- For PR work, push the branch and open the PR immediately after local checks pass.
- Do not wait on GitHub Actions before opening, advancing, or merging a PR. Deployment is Cloudflare Workers Builds via Cloudflare's own GitHub integration (see `docs/cloudflare-deployment.md`), so GitHub Actions checks such as `release-check` are neither deployment nor merge gates, and `main` has no branch protection. Rely on local required checks, local E2E/smoke verification, and Cloudflare's build/deploy status.
- Push to `origin main` after merge unless the user asks otherwise.
- Run the post-merge GitHub issue gate before the next atomic PR: list open issues, resolve actionable review issues for the active goal, and record unrelated/blocked/unavailable cases.

## Autonomous `/goal` Execution

A `/goal` should be one line:

```txt
/goal <target outcome> --spec <docs/path.md>
```

The method lives here:

1. Read the spec path, this guide, and the source-of-truth docs.
2. Create or update a goal R&D doc under `docs/goals/` for the full end-to-end path.
3. Define the optimal path: architecture choice, implementation order, review gate, E2E gate, and done definition.
4. Break the goal into 1-3 near-term atomics; do not pre-plan a long queue.
5. Implement one atomic at a time.
6. Run checks, commit, push, verify.
7. After merge or push to `main`, run the post-merge GitHub issue gate before starting the next atomic.
8. Review the implementation against the goal doc and source-of-truth docs.
9. Run E2E or smoke verification that proves the user-facing outcome works.
10. Record deviations from the spec in the goal R&D doc.
11. Continue until the goal is complete or a real blocker appears.

A goal is not complete just because code was written. It is complete only when the researched approach, implementation, review, E2E verification, docs, and push are all done or explicitly marked not applicable with a reason.

Stop and ask the user before:

- changing the product source-of-truth model away from canonical JSON/domain state;
- deleting user data, secrets, or irreversible project history;
- bypassing stable validation;
- making a direction decision not settled by the spec;
- adding a dependency that materially changes the stack.

At each milestone, report:

- what changed;
- checks run and their result;
- review/E2E status;
- GitHub issue-gate result after merge/push to `main`;
- known deviations or unresolved risks;
- the next atomic.

## Repository Notes

- Current repo: `JegoVPN/sbcv`.
- Default branch: `main`.
- Commit author identity: `JegoVPN`.
