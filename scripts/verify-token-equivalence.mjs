#!/usr/bin/env node
/**
 * verify-token-equivalence.mjs — mechanical proof that a tokenization atomic
 * left dark-mode rendering pixel-identical (T-P1 acceptance, see
 * docs/goals/light-mode-theming-execution.md → Process).
 *
 * Both sides (BASE = pre-atomic ref, WORK = working tree) are independently:
 *   1. stripped of comments,
 *   2. parsed for their own `:root` custom-property tables,
 *   3. var()-resolved to literal values until a fixed point (nested vars and
 *      function-embedded vars like rgba(var(--x-rgb), 0.34) included),
 *   4. stripped of the token-definition lines themselves and of
 *      [data-theme...] override blocks (theme tables are additive, not part of
 *      the dark render),
 *   5. whitespace/hex-case normalized,
 * then diffed line-by-line. Exit 0 = zero diff (plus exemptions verified).
 *
 * Usage: node scripts/verify-token-equivalence.mjs [baseRef]   (default: main)
 *
 * EXEMPTIONS: declarations that may legitimately APPEAR during P1 — each must
 * resolve to the exact literal it replaces elsewhere. Anything else that
 * appears or disappears is a failure.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FILE = "src/styles.css";
const baseRef = process.argv[2] ?? "main";

// Added declarations allowed by the goal doc, with the value they must resolve to.
const EXEMPT_ADDED = [
  // T2: CSS takes ownership of the SbcvLogo plate fill (presentation attribute
  // stays in TSX as fallback) — must resolve to the attribute's value.
  { needle: /^\.sbcv-logo__hexagon\{fill:([^;}]+);?\}$/, expect: "#0d1116" },
];
// Removed declarations allowed by the goal doc (orphan var cleanup in T3 keeps
// the same resolved value, so it shows as a CHANGE not a removal — listed here
// for documentation only).

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function extractBlocks(css, headRe) {
  // Returns [{start, end}] spans of top-level blocks whose head matches headRe.
  const spans = [];
  const re = new RegExp(`(^|\\n)\\s*(${headRe.source})\\s*\\{`, "g");
  let m;
  while ((m = re.exec(css)) !== null) {
    const open = css.indexOf("{", m.index + m[1].length);
    let depth = 1;
    let i = open + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    spans.push({ start: m.index + m[1].length, open, end: i });
  }
  return spans;
}

function parseVarTable(css) {
  const table = new Map();
  for (const span of extractBlocks(css, /:root/)) {
    const body = css.slice(span.open + 1, span.end - 1);
    for (const decl of body.split(";")) {
      const mm = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/);
      if (mm) table.set(mm[1], mm[2].trim());
    }
  }
  return table;
}

function resolveVars(css, table) {
  let out = css;
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*?))?\s*\)/g, (whole, name, fallback) => {
      if (table.has(name)) {
        changed = true;
        return table.get(name);
      }
      if (fallback !== undefined) {
        changed = true;
        return fallback.trim();
      }
      return whole;
    });
    if (!changed) break;
  }
  return out;
}

function dropThemeBlocks(css) {
  let out = css;
  for (;;) {
    const spans = extractBlocks(out, /\[data-theme[^\]]*\][^{]*/);
    if (spans.length === 0) return out;
    const { start, end } = spans[0];
    out = out.slice(0, start) + out.slice(end);
  }
}

function normalize(css) {
  const noTheme = dropThemeBlocks(css);
  const table = parseVarTable(noTheme);
  const resolved = resolveVars(noTheme, table);
  const lines = [];
  // Re-serialize rule-by-rule: drop custom-property declarations, normalize ws.
  const flat = resolved
    .replace(/\s+/g, " ")
    .replace(/\s*([{};:,])\s*/g, "$1");
  for (const chunk of flat.split("}")) {
    if (!chunk.trim()) continue;
    const [selector, body = ""] = chunk.split("{");
    const decls = body
      .split(";")
      .map((d) => d.trim())
      .filter((d) => d && !d.startsWith("--"))
      .map((d) =>
        d
          .replace(/#([0-9a-fA-F]{3,8})\b/g, (m) => m.toLowerCase())
          .replace(/,(?=\S)/g, ", "),
      )
      // Stable-sort by property name: declaration order between DIFFERENT
      // properties is render-neutral, but same-property repeats (fallback
      // patterns) keep their relative order so override semantics survive.
      .map((d, i) => ({ d, i, prop: d.slice(0, d.indexOf(":")) }))
      .sort((a, b) => (a.prop < b.prop ? -1 : a.prop > b.prop ? 1 : a.i - b.i))
      .map((x) => x.d);
    if (decls.length === 0) continue;
    lines.push(`${selector.trim()}{${decls.join(";")}}`);
  }
  return lines;
}

const baseCss = execSync(`git show ${baseRef}:${FILE}`, { encoding: "utf8" });
const workCss = readFileSync(FILE, "utf8");

const baseLines = normalize(stripComments(baseCss));
const workLines = normalize(stripComments(workCss));

const baseSet = new Map(baseLines.map((l) => [l, (0) | 0]));
// Multiset diff by counting.
const count = (map, key, d) => map.set(key, (map.get(key) ?? 0) + d);
const delta = new Map();
for (const l of baseLines) count(delta, l, -1);
for (const l of workLines) count(delta, l, +1);

const removed = [];
const added = [];
for (const [line, c] of delta) {
  if (c < 0) for (let i = 0; i < -c; i += 1) removed.push(line);
  if (c > 0) for (let i = 0; i < c; i += 1) added.push(line);
}

const failures = [];
const unexplainedAdded = added.filter((line) => {
  for (const ex of EXEMPT_ADDED) {
    const m = line.match(ex.needle);
    if (m) {
      const value = (m[1] ?? "").replace(/;$/, "").trim().toLowerCase();
      if (value === ex.expect) return false;
      failures.push(`exempt-added resolved to "${value}", expected "${ex.expect}": ${line}`);
      return false;
    }
  }
  return true;
});

if (removed.length || unexplainedAdded.length || failures.length) {
  console.error(`✗ token-equivalence FAILED vs ${baseRef}`);
  for (const l of removed) console.error(`  - removed/changed: ${l}`);
  for (const l of unexplainedAdded) console.error(`  + added/changed:  ${l}`);
  for (const f of failures) console.error(`  ! ${f}`);
  console.error(
    `\n${removed.length} removed, ${unexplainedAdded.length} added (after exemptions). ` +
      "Every dark-mode declaration must resolve back to its pre-atomic literal.",
  );
  process.exit(1);
}
console.log(`✓ token-equivalence OK vs ${baseRef} (${workLines.length} normalized declarations identical)`);
