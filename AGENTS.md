# SBC Agents Guide

SBC is a sing-box configuration builder. The product goal is a React Flow visual editor backed by a canonical sing-box JSON/domain model.

## Source Of Truth

Read these before changing product behavior, schema, validation, or node UI:

- [SBC React Flow R&D Plan](docs/sbc-react-flow-rd-plan.md)
- [sing-box Config Document Inventory](docs/sing-box-config-doc-inventory.md)
- [Goal-Driven Development](docs/goal-driven-development.md)

The canvas is never the config source file. `SingBoxConfig` / domain model is the source of truth; React Flow nodes and edges are a derived editing view.

## Non-Negotiables

1. **Canonical config first**: all edits go through domain commands that update canonical JSON/domain state. Do not derive final `config.json` from React Flow node data.
2. **stable-first**: default templates, export, fixtures, and blocking validation target sing-box stable. testing is explicit opt-in.
3. **Different binaries**: stable configs are checked with `sing-box-stable`; testing configs are checked with `sing-box-testing`.
4. **Document traceability**: every schema field, node type, Inspector field, and fixture must map to an entry in `docs/sing-box-config-doc-inventory.md`.
5. **Rules are ordered tables**: `route.rules` and `dns.rules` are ordered lists. The canvas may visualize references, but it must not be the ordering source.
6. **Tag references are explicit**: tag rename, delete, connect, and disconnect must update references through tested domain commands.
7. **Signed commits only**: commits must be signed and pass this repo's `pre-push` signature verification.
8. **Small atomics**: one concern per commit. Prefer changes under 400 logical lines; split larger work.
9. **No silent validation gaps**: if `sing-box check` cannot run, state that clearly in the final answer and keep schema/semantic validation separate from official validation.
10. **No unrelated cleanup**: do not refactor unrelated files while implementing a goal.

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
- Preserve existing user changes; never discard unrelated work.

Before committing:

- Run `git diff --check`.
- Run available project tests/checks. If the project has no test harness yet, say so.
- For config fixtures, run the matching `sing-box-stable check` or `sing-box-testing check` once binaries are available.
- Inspect the diff for scope creep.

After committing:

- Push to `origin main` unless the user asks for a branch/PR.
- Verify the pushed commit is GitHub Verified when GitHub access is available.

## Autonomous `/goal` Execution

A `/goal` should be one line:

```txt
/goal <target outcome> --spec <docs/path.md>
```

The method lives here:

1. Read the spec path, this guide, and the source-of-truth docs.
2. Create or update a goal R&D doc under `docs/` if the goal is larger than one atomic.
3. Break the goal into 1-3 near-term atomics; do not pre-plan a long queue.
4. Implement one atomic at a time.
5. Run checks, commit signed, push, verify.
6. Record deviations from the spec in the goal R&D doc.
7. Continue until the goal is complete or a real blocker appears.

Stop and ask the user before:

- changing the product source-of-truth model away from canonical JSON/domain state;
- deleting user data, secrets, or irreversible project history;
- bypassing stable validation;
- making a direction decision not settled by the spec;
- adding a dependency that materially changes the stack.

At each milestone, report:

- what changed;
- checks run and their result;
- known deviations or unresolved risks;
- the next atomic.

## Repository Notes

- Current repo: `JegoVPN/SBC`.
- Default branch: `main`.
- Commit author/signing identity: `JegoVPN`.
- Local `pre-push` hook verifies every pushed commit signature.

