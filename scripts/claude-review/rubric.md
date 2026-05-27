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
