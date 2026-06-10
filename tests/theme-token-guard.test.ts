import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Theme-token guard (T-queue, docs/goals/light-mode-theming-execution.md).
 *
 * Scope: src/styles.css + src/**\/*.{ts,tsx}. Color literals may only live inside
 * the token-definition blocks (`:root { ... }` / `[data-theme...] { ... }`) of
 * styles.css; everywhere else they must be `var(--token)` references.
 *
 * TERMINAL STATE (T4): zero literals outside the token tables — offenders must
 * be exactly []. Ratchet history: pre-T1 = 391 → T1 = 301 → T2 = 151 → T3 = 65 → T4 = 0.
 *
 * In-scope allowlist (each entry must carry a reason):
 * - src/components/SbcvLogo.tsx fill="#0d1116" — logo plate is a theme INVARIANT
 *   (user ruling 2026-06-10); the CSS override token --logo-plate owns rendering,
 *   the attribute stays as a CSS-failure fallback. See goal doc, Out-of-scope #1.
 *
 * Out of scope by construction (not scanned): e2e/** assertion constants, docs/**,
 * index.html favicon data-URI (%23-encoded), public/theme-init.js first-paint
 * background (lands in T7, intentional literal).
 */


const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PERCENT23 = /%23[0-9a-fA-F]{3,8}\b/g;
// rgba(var(--x-rgb), a) is the sanctioned triplet-token form, not a literal.
const FUNCTIONAL = /\b(?:rgba?|hsla?)\((?!\s*var\()/g;
// Named colors only in CSS value position; `transparent`/`currentColor` are
// design values, not palette literals (audit ruling), so they are not flagged.
const NAMED_IN_VALUE = /:\s*[^;{}]*\b(?:white|black)\b/g;

const ALLOWLIST: Array<{ file: string; lineIncludes: string; reason: string }> = [
  {
    file: "src/components/SbcvLogo.tsx",
    lineIncludes: '#0d1116',
    reason: "logo plate = theme invariant (user ruling 2026-06-10); CSS --logo-plate owns it",
  },
];

function stripCssComments(css: string): string {
  // Preserve line count so reported line numbers stay real.
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

function stripTokenBlocks(css: string): string {
  // Blank out `:root { ... }` and `[data-theme...] { ... }` top-level blocks
  // (token definitions are the one legal home for literals), preserving lines.
  let out = css;
  const headRe = /(^|\n)\s*(:root|\[data-theme[^\]]*\])\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = headRe.exec(out)) !== null) {
    const open = out.indexOf("{", m.index + (m[1]?.length ?? 0));
    let depth = 1;
    let i = open + 1;
    while (i < out.length && depth > 0) {
      const ch = out.charAt(i);
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      i += 1;
    }
    const blanked = out.slice(open, i).replace(/[^\n]/g, " ");
    out = out.slice(0, open) + blanked + out.slice(i);
  }
  return out;
}

function scan(text: string, patterns: RegExp[], file: string): string[] {
  const offenders: string[] = [];
  const lines = text.split("\n");
  lines.forEach((line, idx) => {
    for (const re of patterns) {
      re.lastIndex = 0;
      if (re.test(line)) {
        const allowed = ALLOWLIST.some(
          (a) => file === a.file && line.includes(a.lineIncludes),
        );
        if (!allowed) offenders.push(`${file}:${idx + 1}: ${line.trim()}`);
        break;
      }
    }
  });
  return offenders;
}

describe("theme token guard (ratchet)", () => {
  it("no color literals outside the :root/[data-theme] token tables", () => {
    const files = execSync("git ls-files -z -- src", { encoding: "utf8" })
      .split("\0")
      .filter((f) => f === "src/styles.css" || /\.tsx?$/.test(f));

    const offenders: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      if (file === "src/styles.css") {
        const scannable = stripTokenBlocks(stripCssComments(raw));
        offenders.push(...scan(scannable, [HEX, PERCENT23, FUNCTIONAL, NAMED_IN_VALUE], file));
      } else {
        // TS/TSX: quoted hex or %23-encoded hex only (named colors are too
        // collision-prone in identifiers; audit confirms zero functional-color
        // literals in TS/TSX beyond the known three). Comments are stripped
        // first — PR/issue references like "#303" would otherwise false-match.
        const noComments = raw
          .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
          .replace(/(^|[^:])\/\/[^\n]*/g, (m, pre) => pre + " ".repeat(m.length - pre.length));
        offenders.push(...scan(noComments, [/["'`](?:[^"'`\n]*?)(#|%23)[0-9a-fA-F]{3,8}\b/g], file));
      }
    }

    expect(
      offenders,
      "color literals must live in the :root/[data-theme] token tables as var(--token) definitions — mint a token instead",
    ).toEqual([]);
  });
});
