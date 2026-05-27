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
