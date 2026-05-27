#!/usr/bin/env node
// scripts/claude-review/run.mjs
// Pre-push commit review engine. See spec:
// docs/superpowers/specs/2026-05-28-claude-pre-push-review-gate-design.md

import { execFileSync, execSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const TIMEOUT_MS = 180_000;
const CONCURRENCY = 4;
const SIZE_BUDGET = 400; // AGENTS.md #8 small-atomic budget (logical lines)

const defaultGit = (args, options = {}) =>
  execFileSync("git", args, { encoding: "utf8", ...options });

export function parseSeverities(stdout) {
  const lines = stdout.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^SEVERITY:(critical|major|minor)\b/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function parseShortstat(out) {
  const ins = out.match(/(\d+)\s+insertion/);
  const del = out.match(/(\d+)\s+deletion/);
  return (ins ? parseInt(ins[1], 10) : 0) + (del ? parseInt(del[1], 10) : 0);
}

export function isSizeBudgetedPath(path) {
  return !path.endsWith(".md");
}

export function parseBudgetedNumstat(out) {
  return out.split(/\r?\n/).reduce((total, line) => {
    if (!line.trim()) return total;
    const [rawAdded, rawDeleted, ...pathParts] = line.split("\t");
    const path = pathParts.join("\t");
    if (!path || !isSizeBudgetedPath(path)) return total;
    const added = rawAdded === "-" ? 0 : parseInt(rawAdded, 10);
    const deleted = rawDeleted === "-" ? 0 : parseInt(rawDeleted, 10);
    return total + (Number.isFinite(added) ? added : 0) + (Number.isFinite(deleted) ? deleted : 0);
  }, 0);
}

export function pickGoalDoc({ git = defaultGit } = {}) {
  try {
    const raw = git(["ls-files", "docs/goals/*.md"]).trim();
    if (!raw) return null;
    const files = raw.split(/\r?\n/).filter(Boolean);
    let best = { ts: -Infinity, file: null };
    for (const f of files) {
      const ts = parseInt(
        git(["log", "-1", "--format=%ct", "--", f]).trim(),
        10,
      );
      if (Number.isFinite(ts) && ts > best.ts) best = { ts, file: f };
    }
    return best.file;
  } catch {
    return null;
  }
}

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
        resolveOnce({
          sha,
          stdout,
          severities: [],
          error: `claude exited ${code}; stderr: ${stderr.slice(0, 400)}`,
        });
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
    const raw = defaultGit(["rev-list", "--reverse", ...args]).trim();
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

  process.stderr.write(
    `claude-review: reviewing ${shas.length} commit(s) with concurrency ${CONCURRENCY}\n`,
  );

  const results = await pmap(shas, CONCURRENCY, async (sha) => {
    const numstat = defaultGit(["show", "--numstat", "--format=", sha]);
    const size = parseBudgetedNumstat(numstat);
    if (size > SIZE_BUDGET) {
      const subject = defaultGit(["log", "-1", "--format=%s", sha]).trim();
      const stdout = [
        `## Review for ${sha.slice(0, 8)} — ${subject}`,
        ``,
        `Size pre-check: ${size} non-Markdown LOC exceeds AGENTS.md #8 budget (~${SIZE_BUDGET}). Short-circuiting before Claude (large code commits both signal a #8 violation and exceed the per-commit review timeout).`,
        ``,
        `SEVERITY:major — commit size ${size} non-Markdown LOC exceeds AGENTS.md #8 atomic budget (~${SIZE_BUDGET}); split into smaller atomics before pushing.`,
        `SUMMARY: 0 critical, 1 major, 0 minor.`,
        ``,
      ].join("\n");
      return { sha, stdout, severities: ["major"], error: null };
    }
    const commitMsg = defaultGit(["log", "-1", "--format=%B", sha]);
    const commitDiff = defaultGit(["show", "--stat", "-p", sha], {
      maxBuffer: 32 * 1024 * 1024,
    });
    const prompt = buildPrompt({ rubric, agentsMd, commitMsg, commitDiff, goalDoc });
    return reviewCommit(sha, prompt);
  });

  for (const r of results) {
    process.stderr.write(`\n${"=".repeat(60)}\n`);
    if (r.stdout) process.stderr.write(r.stdout + "\n");
    if (r.error) process.stderr.write(`claude-review: ${r.sha.slice(0, 8)}: ${r.error}\n`);
  }
  process.stderr.write(`${"=".repeat(60)}\n`);

  const blockers = results.flatMap((r) =>
    (r.severities || []).filter((s) => s === "critical" || s === "major"),
  );
  if (blockers.length > 0) {
    process.stderr.write(`\nclaude-review: ${blockers.length} blocking finding(s) — push aborted.\n`);
    process.stderr.write("To bypass: SBC_SKIP_CLAUDE_REVIEW=1 git push\n");
    return 1;
  }
  process.stderr.write(`\nclaude-review: all ${shas.length} commit(s) passed.\n`);
  return 0;
}

// CLI entry — only when invoked directly, not when imported by tests.
const invokedDirect =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirect) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`claude-review: unexpected error: ${err.message}\n`);
      process.exit(0); // fail-open on internal errors
    });
}
