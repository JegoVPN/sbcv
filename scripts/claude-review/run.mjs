#!/usr/bin/env node
// scripts/claude-review/run.mjs
// Pre-push commit review engine. See spec:
// docs/superpowers/specs/2026-05-28-claude-pre-push-review-gate-design.md

import { execSync } from "node:child_process";

const defaultRun = (cmd) => execSync(cmd, { encoding: "utf8" });

export function parseSeverities(stdout) {
  const lines = stdout.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const m = line.match(/^SEVERITY:(critical|major|minor)\b/);
    if (m) out.push(m[1]);
  }
  return out;
}

export function pickGoalDoc({ run = defaultRun } = {}) {
  try {
    const raw = run("git ls-files docs/goals/*.md").trim();
    if (!raw) return null;
    const files = raw.split(/\r?\n/).filter(Boolean);
    let best = { ts: -Infinity, file: null };
    for (const f of files) {
      const ts = parseInt(
        run(`git log -1 --format=%ct -- ${JSON.stringify(f)}`).trim(),
        10,
      );
      if (Number.isFinite(ts) && ts > best.ts) best = { ts, file: f };
    }
    return best.file;
  } catch {
    return null;
  }
}
