# scripts/claude-review

Local Claude Code review wired into `.githooks/pre-push` stage 2.

## How it works

On `git push`:

1. **Stage 1** (existing): every commit in the push range is checked
   with `git verify-commit` (signature). Failure aborts the push.
2. **Stage 2** (this directory): `run.mjs` reviews every commit in the
   push range in parallel (cap 4), via `claude --print`. Each commit's
   review applies four dimensions from `rubric.md`:
   - correctness
   - AGENTS.md non-negotiables (#1–#11)
   - goal/spec drift (against the most-recently-committed `docs/goals/*.md`)
   - React/perf (when the diff touches `src/**/*.{ts,tsx}` or `vite.config.ts`)

   Claude emits `SEVERITY:critical|major|minor` lines. Any **critical**
   or **major** finding blocks the push.

## Bypass (when you mean it)

```bash
# Skip Claude review only; signature verify still runs.
SBC_SKIP_CLAUDE_REVIEW=1 git push

# Skip ALL pre-push hooks (signature too). Avoid unless hotfix.
git push --no-verify
```

## When Claude is unavailable

The hook fails **open** with an explicit stderr notice (per
AGENTS.md #9: no silent validation gaps) in these cases:
- `claude` CLI not on PATH
- single review subprocess exceeds 90s (killed)
- `claude --print` exits non-zero

The push proceeds; you'll see the warning in your terminal.

## Cost

`claude --print` runs against your local Claude Code subscription, so
there is **no per-token marginal cost**. The throughput limit is your
subscription's rate limit and session quota. `rubric.md` + `AGENTS.md`
sit at the prompt prefix to maximize prompt-cache hits across parallel
commit reviews.

## Files

| File | Role |
|---|---|
| `rubric.md` | Static prompt: severity + 4 review dimensions + output contract |
| `run.mjs` | Engine: spawn-per-commit, parse severities, exit non-zero on critical/major |
| `README.md` | This file |

Spec: `docs/superpowers/specs/2026-05-28-claude-pre-push-review-gate-design.md`
Plan: `docs/superpowers/plans/2026-05-28-claude-pre-push-review-gate.md`
