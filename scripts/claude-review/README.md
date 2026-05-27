# scripts/claude-review

Local Claude Code review wired into `.githooks/pre-push` stage 2, plus
GitHub issue-backed PR review records.

`pre-push` is still useful, but it is only the local fast gate:

- Stage 1 signature verification is mandatory.
- Stage 2 catches cheap/local blockers such as oversize commits and any
  Claude critical/major findings that finish before timeout.
- Stage 2 may fail open when Claude is unavailable or times out.

The persistent review record is the GitHub issue opened by `submit.mjs` or
`poll-and-submit.mjs`. Agents should inspect that issue for each PR and fix
actionable findings before merge. Timeout/pass/no-finding issues are
non-actionable records and may be closed with a short comment.

## One-time setup (per clone)

This repo ships hooks in `.githooks/` instead of the default `.git/hooks/`.
After cloning, run **once** on each machine / each clone:

```bash
git config core.hooksPath .githooks
```

Verify: `git config --get core.hooksPath` should print `.githooks`. Without
this, `git push` skips the review gate entirely (the hook file exists in
the repo but git doesn't see it).

## How it works

On `git push`:

1. **Stage 1** (existing): every commit in the push range is checked
   with `git verify-commit` (signature). Failure aborts the push.
2. **Stage 2** (this directory): `run.mjs` reviews every commit in the
   push range in parallel (cap 4). For each commit:
   - **Size pre-check**: if the commit's non-Markdown `insertions + deletions`
     exceeds **400 logical lines** (AGENTS.md #8 atomic budget), Claude is
     **not** invoked. The script emits a synthetic `SEVERITY:major` finding
     asking to split the commit. Rationale: large code commits both signal a
     #8 violation AND don't fit Claude's per-commit timeout. Markdown-heavy
     goal/spec/docs commits still go to Claude review instead of being blocked
     by this cheap code-size short-circuit.
   - **Claude review** (commits within budget): invoked via `claude --print`
     with `rubric.md` + `AGENTS.md` + commit diff + active goal doc. Four
     review dimensions: correctness, AGENTS.md non-negotiables (#1–#11),
     goal/spec drift (vs the most-recently-committed `docs/goals/*.md`),
     React/perf (when diff touches `src/**/*.{ts,tsx}` or `vite.config.ts`).

   Claude emits `SEVERITY:critical|major|minor` lines. Any **critical**
   or **major** finding (including the size pre-check) blocks the push when
   review finishes successfully before timeout.

For a brand-new remote branch, `.githooks/pre-push` computes the review range
from `merge-base <remote>/main HEAD` instead of the whole ancestor chain. This
keeps historical GitHub merge commits out of the local signature/review gate.

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
- single review subprocess exceeds 180s (killed)
- `claude --print` exits non-zero

The push proceeds; you'll see the warning in your terminal.

## Cost

`claude --print` runs against your local Claude Code subscription, so
there is **no per-token marginal cost**. The throughput limit is your
subscription's rate limit and session quota. `rubric.md` + `AGENTS.md`
sit at the prompt prefix to maximize prompt-cache hits across parallel
commit reviews.

## Unattended submit: one command opens PR + review issue

`submit.mjs` is the "one shot" entrypoint for finishing a branch. Run it from
the feature branch:

```bash
node scripts/claude-review/submit.mjs           # do it for real
node scripts/claude-review/submit.mjs --dry-run # print intentions only
```

What it does:

1. `git push -u origin HEAD` — with `SBC_SKIP_CLAUDE_REVIEW=1` so the pre-push
   hook does **not** double-review (submit runs the review explicitly below).
2. Detects an existing PR for the branch via `gh pr view`. If none, opens one
   with `gh pr create --fill` (uses recent commit messages).
3. Runs `node scripts/claude-review/run.mjs <merge-base>..HEAD` capturing the
   full review output.
4. Opens a GitHub issue titled `Review of PR #N: <title>` with the review as
   body, links back to the PR.
5. Comments the PR with the issue URL so the cross-link is visible from both
   directions.

Result: one command per PR. Per-PR review issue policy enforced. If the
scheduled poller is already active, do not also run this manually unless you
intend to create/refresh the review issue yourself.

Caveats:
- If `gh pr create --fill` fails (e.g. branch has no commits ahead of base),
  `submit` exits non-zero before opening any issue.
- If the review subprocess exits non-zero (critical/major findings), `submit`
  still opens the issue (the findings ARE the issue you want to track).
- `--dry-run` skips push / PR create / issue create but still computes branch,
  head sha, and prints intended command-lines.

## Fully autonomous: polled review across all open PRs

`poll-and-submit.mjs` is the "watch all PRs" entrypoint, intended for
a `/loop` schedule (e.g. every 30 min):

```bash
node scripts/claude-review/poll-and-submit.mjs
```

What it does each invocation:

1. `gh pr list --state open` — enumerate every open PR in the repo.
2. For each PR: `gh issue list --search '"Review of PR #N" in:title'`.
   If a matching issue already exists → **skip** (idempotent).
3. Otherwise: `git fetch origin pull/N/head:...` to pull commits, then
   run `run.mjs` on `merge-base..head`, capture output.
4. `gh issue create --title "Review of PR #N: <title>"` with the
   review as body. Cross-link by commenting the PR with the issue URL.

Properties:
- **Idempotent**: re-runs are no-ops for already-reviewed PRs.
  Re-pushing the PR head doesn't re-trigger; the existing issue
  stands until manually closed.
- **Fail-open**: a single PR errors → loop logs it and continues.
- **No human in the loop**: meant for an automated `/loop` cadence.

Operational rule for agents:

- Open the PR as soon as local checks and signed commit verification pass.
- Pull/list the PR review issue immediately after PR creation.
- Fix actionable active-goal findings before merge.
- Do not wait on unreliable GitHub Actions. Use local checks, relevant
  provider deployment status, commit verification, and the review issue gate.
- If the PR has a review issue already, use `SBC_SKIP_CLAUDE_REVIEW=1` for the
  final `main` push to avoid duplicate local Claude review while preserving
  signature verification.

Recommended cadence: every 30 min. Run cost = subscription quota per
unreviewed PR commit reviewed.

## Files

| File | Role |
|---|---|
| `rubric.md` | Static prompt: severity + 4 review dimensions + output contract |
| `run.mjs` | Review engine: spawn-per-commit, parse severities, exit non-zero on critical/major |
| `submit.mjs` | One-shot: push current branch + ensure PR + run review + open issue + cross-link |
| `poll-and-submit.mjs` | Autonomous: poll all open PRs, open review issue for any without one |
| `README.md` | This file |

Spec: `docs/superpowers/specs/2026-05-28-claude-pre-push-review-gate-design.md`
Plan: `docs/superpowers/plans/2026-05-28-claude-pre-push-review-gate.md`
