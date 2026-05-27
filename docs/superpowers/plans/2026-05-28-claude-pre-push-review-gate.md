# Claude pre-push commit review gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a local Claude Code review into the existing `pre-push` hook so every commit being pushed gets reviewed in parallel, with critical/major findings blocking push.

**Architecture:** Shell `pre-push` hook delegates to a Node ESM script (`scripts/claude-review/run.mjs`) that spawns `claude --print` per commit in parallel (concurrency 4), parses `SEVERITY:` lines from each stdout, blocks push on any critical/major.

**Tech Stack:** Node 22 (ESM), vitest, POSIX shell, `claude` CLI (user's local Claude Code subscription).

**Reference spec:** `docs/superpowers/specs/2026-05-28-claude-pre-push-review-gate-design.md`

---

## File map

| Path | Purpose |
|---|---|
| `scripts/claude-review/rubric.md` | Static prompt: severity definitions + 4 review dimensions + output format contract |
| `scripts/claude-review/run.mjs` | Review engine: parse args, gather commits, spawn claude per commit, aggregate severity |
| `scripts/claude-review/README.md` | Operator-facing docs: how it works, env vars, bypass, cost |
| `.githooks/pre-push` | Existing signature verifier; modified to call run.mjs in stage 2 |
| `tests/claude-review.test.ts` | Vitest unit tests for pure helpers (severity parser, goal-doc picker, prompt builder) |

---

## Task 1: rubric.md (static prompt)

**Files:**
- Create: `scripts/claude-review/rubric.md`

- [ ] **Step 1: Create the rubric file**

Write `scripts/claude-review/rubric.md` with this exact content:

````markdown
# Claude Pre-Push Commit Review Rubric

You are reviewing a single git commit for the sbc-ui project (a sing-box configuration visualizer). Your output drives a pre-push hook: any **critical** or **major** finding blocks the push.

## Output format (REQUIRED — script parses this)

```
## Review for <sha-short> — <commit subject>

<analysis in markdown — be concise>

SEVERITY:critical — <one line, cite file:line and rule when relevant>
SEVERITY:major    — <...>
SEVERITY:minor    — <...>
SUMMARY: <N> critical, <M> major, <K> minor.
```

Rules:
- One finding per line, prefix `SEVERITY:` flush-left at column 0.
- No `SEVERITY:` substring anywhere else in your output (it would be parsed as a finding).
- Omit lines for severity levels with zero findings.
- Always end with the `SUMMARY:` line, even when zero findings (`SUMMARY: 0 critical, 0 major, 0 minor.`).

## Severity definitions

- **critical** — Violates an AGENTS.md non-negotiable; introduces a security flaw; breaks a canonical config invariant; obvious functional regression.
- **major** — Violates documented convention; obvious logic bug; scope creep (commit contains unrelated changes); crosses atomic boundary; broken test or removed coverage without justification.
- **minor** — Naming / comment / style nit; readability suggestion; opportunistic cleanup idea.

## Review dimensions

Run dimensions 1, 2, 3 always. Run 4 only when the diff touches relevant files.

### 1. Correctness
- Logic bugs, unhandled branches, missing error paths, resource leaks.
- Type-safety holes in TS files.
- Off-by-one, async race, null/undefined deref.

### 2. AGENTS.md compliance
AGENTS.md is supplied below. Cite the rule number in findings (e.g., `AGENTS.md #10: unrelated cleanup`).

Pay special attention to:
- #1 canonical config is source of truth (canvas data is not).
- #2 stable-first (default templates / fixtures / blocking validation target stable, not testing).
- #4 document traceability (schema fields, node types, fixtures map to doc inventory).
- #6 tag references go through tested domain commands.
- #7 signed commits (already enforced by pre-push stage 1; flag any tampering).
- #8 small atomics (~400 logical lines, one concern per commit).
- #10 no unrelated cleanup (flag diffs spanning unrelated areas).
- #11 React perf discipline (handled in dimension 4 below).

### 3. Goal/spec drift
If an "Active goal doc" block is provided below, check that this commit:
- Stays within the goal's declared scope.
- Advances a declared milestone or fix item.
- Does not regress an explicit non-negotiable from the goal doc.

If no goal doc is provided, skip this dimension. Do not invent drift findings without a goal doc.

### 4. React / performance (vercel-react-best-practices)
Apply ONLY when the diff touches `src/**/*.{ts,tsx}` or `vite.config.ts`. Otherwise skip.
- Bundle size: new heavy imports? lazy-loadable editors not lazy-loaded?
- Rerender scope: broad Zustand subscriptions on hover/drag/transient canvas state?
- Expensive derived state: unmemoized, recomputed every render?
- Async/data waterfalls: serialized fetches that should parallelize?
- Direct imports preferred over barrel re-exports for tree-shaking.

For doc-only, scripts-only, or test-only commits: skip this dimension.

## Discipline

- Cite real findings against real lines. No hypotheticals.
- A typo in a comment is `minor`, not `major`.
- "Could be refactored" without a concrete defect is not a finding.
- Empty findings are fine. Emit `SUMMARY: 0 critical, 0 major, 0 minor.` and stop.
````

- [ ] **Step 2: Verify file exists**

Run: `ls -la scripts/claude-review/rubric.md && wc -l scripts/claude-review/rubric.md`
Expected: file listed, ~70 lines.

- [ ] **Step 3: Commit**

```bash
git add scripts/claude-review/rubric.md
git commit -m "$(cat <<'EOF'
feat(claude-review): add static review rubric

Defines severity levels (critical/major/minor), output contract
(SEVERITY:/SUMMARY: lines parsed by run.mjs), and the 4 review
dimensions: correctness, AGENTS.md compliance, goal-doc drift,
vercel-react-best-practices.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: parseSeverities (TDD)

**Files:**
- Create: `scripts/claude-review/run.mjs` (minimal — just the export)
- Create: `tests/claude-review.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/claude-review.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseSeverities } from "../scripts/claude-review/run.mjs";

describe("parseSeverities", () => {
  it("extracts severities in order, ignoring non-line-start matches", () => {
    const stdout = [
      "## Review for abc123 — foo",
      "",
      "Some analysis. SEVERITY:critical mentioned inline does NOT count.",
      "",
      "SEVERITY:critical — broken canonical config (AGENTS.md #1)",
      "SEVERITY:minor — typo in comment",
      "SUMMARY: 1 critical, 0 major, 1 minor.",
    ].join("\n");
    expect(parseSeverities(stdout)).toEqual(["critical", "minor"]);
  });

  it("returns empty array when only SUMMARY present", () => {
    expect(parseSeverities("SUMMARY: 0 critical, 0 major, 0 minor.")).toEqual([]);
  });

  it("handles CRLF line endings", () => {
    const stdout = "SEVERITY:major — bad\r\nSEVERITY:minor — meh\r\nSUMMARY: 0 critical, 1 major, 1 minor.";
    expect(parseSeverities(stdout)).toEqual(["major", "minor"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/claude-review.test.ts`
Expected: FAIL with "Cannot find module '../scripts/claude-review/run.mjs'".

- [ ] **Step 3: Write minimal implementation**

Create `scripts/claude-review/run.mjs`:

```javascript
#!/usr/bin/env node
// scripts/claude-review/run.mjs
// Pre-push commit review engine. See spec:
// docs/superpowers/specs/2026-05-28-claude-pre-push-review-gate-design.md

export function parseSeverities(stdout) {
  const lines = stdout.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^SEVERITY:(critical|major|minor)\b/);
    if (m) out.push(m[1]);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/claude-review.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/claude-review/run.mjs tests/claude-review.test.ts
git commit -m "$(cat <<'EOF'
feat(claude-review): add parseSeverities with tests

Extracts SEVERITY:(critical|major|minor) at line-start from Claude
review stdout. Hook uses the result to decide whether to block push.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: pickGoalDoc (TDD)

**Files:**
- Modify: `scripts/claude-review/run.mjs` (add `pickGoalDoc` export)
- Modify: `tests/claude-review.test.ts` (add pickGoalDoc tests)

- [ ] **Step 1: Write the failing test**

Append to `tests/claude-review.test.ts`:

```typescript
import { pickGoalDoc } from "../scripts/claude-review/run.mjs";

describe("pickGoalDoc", () => {
  it("returns most-recently-committed goal doc by git log -ct", () => {
    const calls: string[] = [];
    const run = (cmd: string) => {
      calls.push(cmd);
      if (cmd === "git ls-files docs/goals/*.md") {
        return "docs/goals/alpha.md\ndocs/goals/beta.md\n";
      }
      if (cmd.includes("alpha.md")) return "1700000000\n";
      if (cmd.includes("beta.md")) return "1700001000\n";
      throw new Error("unexpected: " + cmd);
    };
    expect(pickGoalDoc({ run })).toBe("docs/goals/beta.md");
    expect(calls.length).toBe(3);
  });

  it("returns null when no goal docs are tracked", () => {
    const run = (cmd: string) => (cmd === "git ls-files docs/goals/*.md" ? "" : "");
    expect(pickGoalDoc({ run })).toBeNull();
  });

  it("returns null when git ls-files throws", () => {
    const run = () => { throw new Error("not a git repo"); };
    expect(pickGoalDoc({ run })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/claude-review.test.ts`
Expected: `pickGoalDoc` tests FAIL (`pickGoalDoc is not a function`).

- [ ] **Step 3: Implement pickGoalDoc**

Append to `scripts/claude-review/run.mjs`:

```javascript
import { execSync } from "node:child_process";

const defaultRun = (cmd) => execSync(cmd, { encoding: "utf8" });

export function pickGoalDoc({ run = defaultRun } = {}) {
  try {
    const raw = run("git ls-files docs/goals/*.md").trim();
    if (!raw) return null;
    const files = raw.split(/\r?\n/).filter(Boolean);
    let best = { ts: -Infinity, file: null };
    for (const f of files) {
      const ts = parseInt(run(`git log -1 --format=%ct -- ${JSON.stringify(f)}`).trim(), 10);
      if (Number.isFinite(ts) && ts > best.ts) best = { ts, file: f };
    }
    return best.file;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/claude-review.test.ts`
Expected: all 6 tests pass (3 parseSeverities + 3 pickGoalDoc).

- [ ] **Step 5: Commit**

```bash
git add scripts/claude-review/run.mjs tests/claude-review.test.ts
git commit -m "$(cat <<'EOF'
feat(claude-review): pickGoalDoc via git history recency

Selects the goal doc with the latest commit timestamp under
docs/goals/. Returns null when none tracked or git unavailable
(callers skip the goal-drift review dimension).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: buildPrompt + reviewCommit + pmap + main

**Files:**
- Modify: `scripts/claude-review/run.mjs` (add orchestration + CLI entry)

- [ ] **Step 1: Append helpers and main**

Append to `scripts/claude-review/run.mjs`:

```javascript
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const TIMEOUT_MS = 90_000;
const CONCURRENCY = 4;

export function buildPrompt({ rubric, agentsMd, commitMsg, commitDiff, goalDoc }) {
  const parts = [
    rubric,
    "\n\n---\n\n## AGENTS.md (project rubric context)\n\n",
    agentsMd,
  ];
  if (goalDoc) {
    parts.push(
      "\n\n---\n\n## Active goal doc (",
      goalDoc.path,
      ")\n\n",
      goalDoc.content,
    );
  }
  parts.push(
    "\n\n---\n\n## Commit to review\n\n### Message\n\n```\n",
    commitMsg.trim(),
    "\n```\n\n### Diff\n\n```\n",
    commitDiff,
    "\n```\n",
  );
  return parts.join("");
}

async function pmap(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, worker));
  return out;
}

function reviewCommit(sha, prompt) {
  return new Promise((resolveOnce) => {
    const child = spawn("claude", ["--print"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolveOnce({ sha, stdout: "", severities: [], error: `timeout after ${TIMEOUT_MS / 1000}s` });
    }, TIMEOUT_MS);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolveOnce({ sha, stdout: "", severities: [], error: `spawn failed: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolveOnce({ sha, stdout, severities: [], error: `claude exited ${code}; stderr: ${stderr.slice(0, 400)}` });
        return;
      }
      resolveOnce({ sha, stdout, severities: parseSeverities(stdout), error: null });
    });
    child.stdin.end(prompt);
  });
}

function claudeOnPath() {
  try {
    execSync("command -v claude", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main(args) {
  if (process.env.SBC_SKIP_CLAUDE_REVIEW === "1") {
    process.stderr.write("claude-review: skipped via SBC_SKIP_CLAUDE_REVIEW=1\n");
    return 0;
  }
  if (!claudeOnPath()) {
    process.stderr.write("claude-review: CLI not found, skipping (AGENTS.md #9: explicit gap)\n");
    return 0;
  }
  if (args.length === 0) {
    process.stderr.write("claude-review: no push range given, skipping\n");
    return 0;
  }

  let shas;
  try {
    const raw = execSync(`git rev-list --reverse ${args.join(" ")}`, { encoding: "utf8" }).trim();
    shas = raw ? raw.split(/\r?\n/) : [];
  } catch (err) {
    process.stderr.write(`claude-review: git rev-list failed: ${err.message}\n`);
    return 0;
  }
  if (shas.length === 0) {
    process.stderr.write("claude-review: no commits in push range, skipping\n");
    return 0;
  }

  const rubricPath = resolve(__dirname, "rubric.md");
  const agentsPath = resolve(REPO_ROOT, "AGENTS.md");
  if (!existsSync(rubricPath) || !existsSync(agentsPath)) {
    process.stderr.write("claude-review: rubric.md or AGENTS.md missing, skipping\n");
    return 0;
  }
  const rubric = readFileSync(rubricPath, "utf8");
  const agentsMd = readFileSync(agentsPath, "utf8");

  const goalPath = pickGoalDoc();
  const goalDoc = goalPath
    ? { path: goalPath, content: readFileSync(resolve(REPO_ROOT, goalPath), "utf8") }
    : null;
  if (!goalPath) {
    process.stderr.write("claude-review: no committed goal doc, skipping drift check\n");
  } else {
    process.stderr.write(`claude-review: using goal doc ${goalPath}\n`);
  }

  process.stderr.write(`claude-review: reviewing ${shas.length} commit(s) with concurrency ${CONCURRENCY}\n`);

  const results = await pmap(shas, CONCURRENCY, async (sha) => {
    const commitMsg = execSync(`git log -1 --format=%B ${sha}`, { encoding: "utf8" });
    const commitDiff = execSync(`git show --stat -p ${sha}`, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    const prompt = buildPrompt({ rubric, agentsMd, commitMsg, commitDiff, goalDoc });
    return reviewCommit(sha, prompt);
  });

  for (const r of results) {
    process.stderr.write(`\n${"=".repeat(60)}\n`);
    if (r.stdout) process.stderr.write(r.stdout + "\n");
    if (r.error) process.stderr.write(`claude-review: ${r.sha.slice(0, 8)}: ${r.error}\n`);
  }
  process.stderr.write(`${"=".repeat(60)}\n`);

  const blockers = results.flatMap((r) => (r.severities || []).filter((s) => s === "critical" || s === "major"));
  if (blockers.length > 0) {
    process.stderr.write(`\nclaude-review: ${blockers.length} blocking finding(s) — push aborted.\n`);
    process.stderr.write("To bypass: SBC_SKIP_CLAUDE_REVIEW=1 git push\n");
    return 1;
  }
  process.stderr.write(`\nclaude-review: all ${shas.length} commit(s) passed.\n`);
  return 0;
}

// CLI entry — only when invoked directly, not when imported by tests
const invokedDirect = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirect) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`claude-review: unexpected error: ${err.message}\n`);
      process.exit(0); // fail-open on internal errors
    });
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `pnpm vitest run tests/claude-review.test.ts`
Expected: all 6 tests still pass (CLI entry guard prevents test-time execution).

- [ ] **Step 3: Smoke test — skip env var**

Run: `SBC_SKIP_CLAUDE_REVIEW=1 node scripts/claude-review/run.mjs HEAD~1..HEAD`
Expected: exit 0, stderr contains `claude-review: skipped via SBC_SKIP_CLAUDE_REVIEW=1`.

Capture exit code: `echo $?` → `0`.

- [ ] **Step 4: Smoke test — no push range**

Run: `node scripts/claude-review/run.mjs`
Expected: exit 0, stderr contains `claude-review: no push range given`.

- [ ] **Step 5: Commit**

```bash
git add scripts/claude-review/run.mjs
git commit -m "$(cat <<'EOF'
feat(claude-review): main orchestrator with parallel review

Adds buildPrompt, reviewCommit (spawn claude --print with 90s timeout),
pmap (concurrency-4 semaphore), and main: detects claude CLI, loads
rubric + AGENTS.md + goal doc, reviews each sha in the push range,
and exits 1 on any critical/major. Fail-open on missing CLI, timeout,
or non-zero claude exit (loud stderr per AGENTS.md #9).

SBC_SKIP_CLAUDE_REVIEW=1 bypasses without touching signature verify.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: pre-push hook wire-up

**Files:**
- Modify: `.githooks/pre-push`

- [ ] **Step 1: Read current hook**

Run: `cat .githooks/pre-push`
Expected: shell script with signature verification while-loop.

- [ ] **Step 2: Replace hook with stage-2-enabled version**

Overwrite `.githooks/pre-push` with this exact content:

```sh
#!/usr/bin/env sh
set -eu

zero_sha="0000000000000000000000000000000000000000"

ranges=""

while read -r local_ref local_sha remote_ref remote_sha; do
  if [ "$local_sha" = "$zero_sha" ]; then
    continue
  fi

  if [ "$remote_sha" = "$zero_sha" ]; then
    range="$local_sha"
  else
    range="$remote_sha..$local_sha"
  fi

  # Stage 1: signature verification
  for commit in $(git rev-list "$range"); do
    if ! git verify-commit "$commit" >/dev/null 2>&1; then
      echo "pre-push: commit $commit is not signed or failed signature verification" >&2
      echo "pre-push: fix it with a signed commit before pushing $local_ref -> $remote_ref" >&2
      exit 1
    fi
  done

  ranges="$ranges $range"
done

# Stage 2: Claude pre-push review (one node invocation, all ranges)
if [ -n "$ranges" ]; then
  # shellcheck disable=SC2086
  exec node scripts/claude-review/run.mjs $ranges
fi
```

- [ ] **Step 3: Verify executable bit**

Run: `ls -l .githooks/pre-push`
Expected: starts with `-rwxr-xr-x` (executable). If not, run `chmod +x .githooks/pre-push`.

- [ ] **Step 4: Smoke test — feed stdin manually**

Simulate "push of new commit on existing branch" (remote_sha = parent so only the new commit is in range):

```bash
HEAD_SHA=$(git rev-parse HEAD)
PARENT_SHA=$(git rev-parse HEAD~1)
echo "refs/heads/test $HEAD_SHA refs/heads/test $PARENT_SHA" | SBC_SKIP_CLAUDE_REVIEW=1 .githooks/pre-push
echo "exit=$?"
```

Expected: stage 1 verifies just the HEAD commit's signature; stage 2 prints `claude-review: skipped via SBC_SKIP_CLAUDE_REVIEW=1`; `exit=0`.

> NOTE: do NOT use `remote_sha=0000...` for smoke testing here — that triggers verification of every commit reachable from HEAD (entire main history), and unsigned ancestors would fail stage 1.

- [ ] **Step 5: Commit**

```bash
git add .githooks/pre-push
git commit -m "$(cat <<'EOF'
feat(pre-push): add stage 2 Claude review after signature verify

Existing signature verification loop unchanged; collects ranges
across all refs and exec's node scripts/claude-review/run.mjs once
at the end. Push aborts on any critical/major finding; fail-open
on Claude unavailability (loud stderr per AGENTS.md #9).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: README + end-to-end live verify

**Files:**
- Create: `scripts/claude-review/README.md`

- [ ] **Step 1: Write README**

Create `scripts/claude-review/README.md`:

```markdown
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
```

- [ ] **Step 2: End-to-end live test (optional but recommended)**

If `claude` CLI is available and you have spare session quota, simulate a real push of just this branch's commits (everything since main):

```bash
HEAD_SHA=$(git rev-parse HEAD)
BASE_SHA=$(git merge-base HEAD origin/main)
echo "refs/heads/test $HEAD_SHA refs/heads/test $BASE_SHA" | .githooks/pre-push
echo "exit=$?"
```

Expected outputs (the spec/plan/code commits in this branch should all be benign):
- stderr shows `claude-review: reviewing N commit(s) with concurrency 4`
- stderr shows `claude-review: using goal doc docs/goals/...` (or `no committed goal doc, skipping drift check`)
- One review block per commit, each ending with `SUMMARY: ...`
- Final line: `claude-review: all N commit(s) passed.` and `exit=0`

If you see `claude-review: CLI not found`: install Claude Code or expect fail-open. Verify exit=0 anyway.

- [ ] **Step 3: Commit README**

```bash
git add scripts/claude-review/README.md
git commit -m "$(cat <<'EOF'
docs(claude-review): operator README

How the hook stages compose, bypass env var, fail-open behavior,
cost (subscription not API), file roles.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist

After all tasks done:

- [ ] `pnpm vitest run tests/claude-review.test.ts` passes (6 tests).
- [ ] `git log --oneline` shows: spec → rubric → parseSeverities → pickGoalDoc → main → pre-push → README (7 commits since branching from main).
- [ ] `.githooks/pre-push` is executable.
- [ ] `node scripts/claude-review/run.mjs` (no args) exits 0 with a "no push range" notice.
- [ ] `SBC_SKIP_CLAUDE_REVIEW=1 node scripts/claude-review/run.mjs HEAD~1..HEAD` exits 0 with skip notice.
- [ ] Each commit subject is signed (`git log --show-signature -1` shows `Good signature`).

## Open work after this branch lands

- Open PR `worktree-docs+claude-pre-push-review-gate-spec → main`.
- Real-world burn-in: on the next 3–5 atomic PRs you push from main work, observe Claude's severity calibration and adjust `rubric.md` if false-positive rate is annoying.
