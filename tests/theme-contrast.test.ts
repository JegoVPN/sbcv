import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Theme contrast guard (T6, docs/goals/light-mode-theming-execution.md).
 *
 * Parses the :root (dark) and [data-theme="light"] token tables out of
 * src/styles.css and asserts WCAG contrast on an explicit fg/bg pair list, in
 * BOTH themes. rgba() foregrounds/backgrounds are alpha-composited onto their
 * pair's opaque background first. Thresholds: 4.5 (text), 3 (UI/large).
 *
 * The pair list is part of the test: minting a fg-like token without
 * registering a pair here should fail review, not slip through. Shadows,
 * scrims, gradients, vendor-bridge and theme-invariant logo tokens are exempt
 * by construction (never listed).
 *
 * Known dark-side debt is pinned at its measured value (see DARK_DEBT):
 * these pairs predate the theme work; T6 must not regress them further and
 * the light table must clear the full threshold.
 */

const css = readFileSync("src/styles.css", "utf8");

function parseTable(headRe: RegExp): Map<string, string> {
  const table = new Map<string, string>();
  const m = headRe.exec(css);
  if (!m) return table;
  const open = css.indexOf("{", m.index);
  let depth = 1;
  let i = open + 1;
  while (i < css.length && depth > 0) {
    const ch = css.charAt(i);
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  const body = css.slice(open + 1, i - 1).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const decl of body.split(";")) {
    const mm = decl.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+)$/);
    if (mm && mm[1] && mm[2]) table.set(mm[1], mm[2].trim());
  }
  return table;
}

const dark = parseTable(/(^|\n)\s*:root\s*\{/);
const lightOverrides = parseTable(/(^|\n)\s*\[data-theme="light"\]\s*\{/);
const light = new Map(dark);
for (const [k, v] of lightOverrides) light.set(k, v);

type RGB = [number, number, number];

function resolve(table: Map<string, string>, name: string, depth = 0): string {
  const raw = table.get(name);
  if (!raw || depth > 8) return raw ?? "";
  return raw.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_, n) => resolve(table, n, depth + 1));
}

function parseColor(value: string): { rgb: RGB; alpha: number } | null {
  const hex = value.match(/^#([0-9a-fA-F]{3,8})$/);
  if (hex && hex[1]) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { rgb, alpha };
  }
  const fn = value.match(/^rgba?\(([^)]*)\)$/);
  if (fn && fn[1]) {
    const parts = fn[1].split(",").map((x) => parseFloat(x));
    if (parts.length >= 3 && parts.every((x) => !Number.isNaN(x))) {
      return { rgb: [parts[0]!, parts[1]!, parts[2]!] as RGB, alpha: parts[3] ?? 1 };
    }
  }
  return null;
}

function composite(fg: { rgb: RGB; alpha: number }, bg: RGB): RGB {
  if (fg.alpha >= 1) return fg.rgb;
  return fg.rgb.map((c, i) => Math.round(c * fg.alpha + bg[i]! * (1 - fg.alpha))) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: RGB, bg: RGB): number {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

// [fg token, bg token, threshold] — threshold 4.5 = body text, 3 = UI/large/indicator.
const PAIRS: Array<[string, string, number]> = [
  // core text ladder on the main surfaces
  ["--text-primary", "--surface-card", 4.5],
  ["--text-secondary", "--surface-card", 4.5],
  ["--text-tertiary", "--surface-card", 4.5],
  ["--text-muted", "--surface-card", 4.5],
  ["--text-muted", "--surface-app", 4.5],
  ["--text-dim", "--surface-card", 3],
  ["--text-disabled", "--surface-card", 3],
  ["--text-primary", "--surface-input", 4.5],
  ["--text-primary", "--surface-field-input", 4.5],
  ["--text-secondary", "--surface-pill", 4.5],
  ["--text-muted", "--surface-overlay-modal", 4.5],
  ["--text-secondary", "--surface-rule-summary", 4.5],
  ["--text-panel-header", "--surface-glass-panel", 4.5],
  // controls
  ["--text-primary", "--surface-control", 4.5],
  ["--text-primary", "--surface-hover", 4.5],
  ["--text-primary", "--surface-pill-control", 4.5],
  ["--text-inverse", "--surface-inverse", 4.5],
  // brand / status accents as foregrounds
  ["--accent-brand-fg", "--surface-card", 4.5],
  ["--accent-brand-fg", "--surface-pill", 4.5],
  ["--text-on-brand", "--accent-brand-fill", 4.5],
  ["--text-on-warn", "--accent-warn-fill", 4.5],
  ["--text-on-danger", "--accent-danger-fill", 4.5],
  ["--accent-warn-fg", "--surface-card", 4.5],
  ["--accent-danger-fg", "--surface-card", 4.5],
  ["--accent-info-fg", "--surface-card", 4.5],
  ["--accent-danger-icon", "--surface-card", 3],
  ["--text-danger-soft", "--surface-card", 3],
  ["--accent-success-fg", "--surface-overlay-modal", 4.5],
  ["--status-checking-fg", "--status-checking-bg", 4.5],
  ["--accent-legacy-fg", "--surface-glass-palette", 3],
  ["--text-gated-dim", "--surface-glass-palette", 3],
  // badges (fg on tinted badge surface)
  ["--accent-warn-fg", "--surface-warn-badge", 3],
  ["--accent-platform-fg", "--surface-platform-badge", 4.5],
  ["--accent-gated-fg", "--surface-gated-badge", 4.5],
  // banners
  ["--text-banner-platform", "--surface-banner-platform", 4.5],
  ["--text-banner-build", "--surface-banner-build", 4.5],
  ["--text-danger-soft", "--surface-banner-deprecated", 4.5],
  ["--text-banner-channel", "--surface-banner-channel", 4.5],
  // canvas / edges / selection (UI indicators on the canvas surface)
  ["--edge-default", "--surface-canvas", 3],
  ["--edge-highlight", "--surface-canvas", 3],
  ["--edge-selected", "--surface-canvas", 3],
  ["--edge-dangling", "--surface-canvas", 3],
  ["--edge-invalid", "--surface-canvas", 3],
  ["--edge-connection", "--surface-canvas", 3],
  ["--selection", "--surface-canvas", 3],
  ["--focus-ring", "--surface-app", 3],
  ["--focus-ring", "--surface-card", 3],
  ["--port-fg", "--port-bg", 4.5],
  ["--logo-stroke", "--logo-plate", 3],
  ["--accent-info-fg", "--port-bg", 3],
  // toasts
  ["--text-primary", "--surface-overlay-modal", 4.5],
  ["--accent-brand-fg", "--surface-chip", 4.5],
  ["--status-error-icon-toast", "--surface-overlay-modal", 3],
  ["--status-info-icon-toast", "--surface-overlay-modal", 3],
  // reveal ghost control
  ["--text-tertiary", "--surface-ghost", 4.5],
];

// Dark-side pairs that measured below threshold BEFORE the theme work (pinned;
// must not regress; the light table has no such allowance).
const DARK_DEBT = new Map<string, number>([
  ["--accent-danger-fg/--surface-card", 4.2],
  ["--text-dim/--surface-card", 3.4],
  ["--text-disabled/--surface-card", 3.4],
  ["--text-on-danger/--accent-danger-fill", 3.9],
  ["--text-danger-soft/--surface-banner-deprecated", 4.4],
  ["--accent-danger-icon/--surface-card", 2.9],
  ["--text-gated-dim/--surface-glass-palette", 2.9],
  ["--status-info-icon-toast/--surface-overlay-modal", 2.9],
]);

function check(theme: Map<string, string>, name: "dark" | "light"): string[] {
  const failures: string[] = [];
  // Resolve a token via fallbacks to an opaque RGB by compositing onto a base.
  const appBase = parseColor(resolve(theme, "--surface-app"))?.rgb ?? [0, 0, 0];
  const toOpaque = (token: string, base: RGB): RGB | null => {
    const parsed = parseColor(resolve(theme, token));
    if (!parsed) return null;
    return composite(parsed, base);
  };
  for (const [fgTok, bgTok, threshold] of PAIRS) {
    const bg = toOpaque(bgTok, appBase);
    if (!bg) {
      failures.push(`${name}: cannot parse bg ${bgTok}`);
      continue;
    }
    const fg = toOpaque(fgTok, bg);
    if (!fg) {
      failures.push(`${name}: cannot parse fg ${fgTok}`);
      continue;
    }
    const r = ratio(fg, bg);
    const debtKey = `${fgTok}/${bgTok}`;
    const min =
      name === "dark" && DARK_DEBT.has(debtKey) ? DARK_DEBT.get(debtKey)! : threshold;
    if (r < min) {
      failures.push(
        `${name}: ${fgTok} on ${bgTok} = ${r.toFixed(2)} < ${min} (${resolve(theme, fgTok)} on ${resolve(theme, bgTok)})`,
      );
    }
  }
  return failures;
}

describe("theme contrast guard", () => {
  it("light table exists and overrides color-scheme", () => {
    expect(lightOverrides.size, "[data-theme=\"light\"] token table is missing").toBeGreaterThan(50);
    expect(css).toMatch(/\[data-theme="light"\]\s*\{\s*color-scheme:\s*light/);
  });

  it("logo stroke/idle are theme invariants; the plate may retheme (user re-ruling)", () => {
    for (const t of ["--logo-stroke", "--logo-idle"]) {
      expect(lightOverrides.has(t), `${t} must not appear in the light table`).toBe(false);
    }
  });

  it("every registered fg/bg pair clears its WCAG threshold in both themes", () => {
    const failures = [...check(dark, "dark"), ...check(light, "light")];
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
