import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { validateConfig } from "../src/domain/diagnostics";
import { parseConfigJson } from "../src/domain/serialization";
// @ts-expect-error -- .mjs policy script has no type declarations
import { evaluateSingBoxCheck } from "../scripts/singbox-check-policy.mjs";

// ── Chain-diagnostics cross-check harness ────────────────────────────────────────────────────────
// Long-chain-diagnostics audit (project_long_chain_diagnostics_audit). For every config case dropped
// into CROSSCHECK_DIR (default `.audit/cases`), run BOTH:
//   (ours)   parseConfigJson(raw) -> validateConfig(config, channel, version)   — the app's authoring path
//   (theirs) sing-box check -c <raw bytes>                                       — the matched real binary
// across all three release targets, then classify any DISAGREEMENT. The point is to catch the
// "long-chain" failure shape from PR #303: a diagnostic that judged one field instead of the full
// cross-section reference / fallback chain, so it fires an ERROR the binary happily accepts (false
// positive) — or stays silent on a config the binary REJECTS (false negative).
//
// This file is excluded from the default `pnpm test` (see package.json) and run explicitly:
//   CROSSCHECK_DIR=.audit/cases/<chain> npx vitest run tests/chain-crosscheck.test.ts
// It always passes (probe mode); read CROSSCHECK_DIR/_report.json for the machine verdict. Set
// CROSSCHECK_STRICT=1 to additionally fail on any divergence.

type TargetSpec = {
  id: string;
  channel: "stable" | "testing";
  version: string;
  binary: string;
};

const ALL_TARGETS: TargetSpec[] = [
  { id: "1.12-stable", channel: "stable", version: "1.12", binary: "sing-box-1.12" },
  { id: "1.13-stable", channel: "stable", version: "1.13", binary: "sing-box-stable" },
  { id: "1.14-testing", channel: "testing", version: "1.14", binary: "sing-box-testing" },
];

const CASES_DIR = process.env.CROSSCHECK_DIR?.trim() || ".audit/cases";
const STRICT = process.env.CROSSCHECK_STRICT === "1";

function resolveCommand(command: string): string | null {
  const local = join(".tools", "bin", command);
  if (existsSync(local)) return local;
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  return result.stdout.trim() || command;
}

type Meta = { targets?: string[]; expect?: unknown; note?: string };

function readMeta(base: string): Meta {
  const metaPath = join(CASES_DIR, `${base}.meta.json`);
  if (!existsSync(metaPath)) return {};
  try {
    return JSON.parse(readFileSync(metaPath, "utf8")) as Meta;
  } catch {
    return {};
  }
}

type OursResult = {
  ran: boolean;
  error?: string;
  errorCount: number;
  warningCount: number;
  diagnostics: { level: string; code: string; path: string; message: string }[];
};

function runOurs(raw: string, target: TargetSpec): OursResult {
  try {
    const config = parseConfigJson(raw);
    const diags = validateConfig(config, target.channel, target.version);
    const semantic = diags.filter((d) => d.source !== "official");
    return {
      ran: true,
      errorCount: semantic.filter((d) => d.level === "error").length,
      warningCount: semantic.filter((d) => d.level === "warning").length,
      diagnostics: semantic.map((d) => ({ level: d.level, code: d.code, path: d.path, message: d.message })),
    };
  } catch (error) {
    return { ran: false, error: (error as Error).message, errorCount: 0, warningCount: 0, diagnostics: [] };
  }
}

type TheirsResult = { ran: boolean; verdict: "pass" | "reject" | "warn" | "skip"; reason: string };

function runTheirs(raw: string, target: TargetSpec): TheirsResult {
  const binary = resolveCommand(target.binary);
  if (!binary) return { ran: false, verdict: "skip", reason: `binary ${target.binary} not found` };
  const dir = mkdtempSync(join(tmpdir(), "sbc-xcheck-"));
  const file = join(dir, "config.json");
  try {
    writeFileSync(file, raw);
    const result = spawnSync(binary, ["check", "-c", file], { encoding: "utf8" });
    const evald = evaluateSingBoxCheck({ status: result.status, stdout: result.stdout, stderr: result.stderr });
    const verdict = evald.status === "pass" ? "pass" : evald.status === "warning" ? "warn" : "reject";
    return { ran: true, verdict, reason: evald.reason };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// The cross-validation verdict: where do OUR diagnostics and the REAL binary disagree?
function classify(ours: OursResult, theirs: TheirsResult): string {
  if (!ours.ran) return "OURS_THREW";
  if (!theirs.ran) return "BINARY_SKIPPED";
  if (theirs.verdict === "pass") {
    if (ours.errorCount > 0) return "BINARY_PASS_OURS_ERROR"; // false positive — strongest signal
    return "AGREE_PASS"; // ours may still warn; advisory warnings are allowed over a binary-pass
  }
  if (theirs.verdict === "reject") {
    if (ours.errorCount > 0) return "AGREE_REJECT";
    if (ours.warningCount > 0) return "BINARY_REJECT_OURS_WARN_ONLY"; // should likely be an error
    return "BINARY_REJECT_OURS_SILENT"; // false negative — strong signal
  }
  // theirs.verdict === "warn" (deprecation / soft warning from the binary)
  if (ours.errorCount + ours.warningCount > 0) return "AGREE_WARN";
  return "BINARY_WARN_OURS_SILENT"; // we miss a deprecation the binary flags (soft)
}

const DIVERGENCES = new Set([
  "BINARY_PASS_OURS_ERROR",
  "BINARY_REJECT_OURS_SILENT",
  "BINARY_REJECT_OURS_WARN_ONLY",
  "BINARY_WARN_OURS_SILENT",
  "OURS_THREW",
]);

describe("chain-crosscheck — our diagnostics vs the real sing-box binary", () => {
  if (!existsSync(CASES_DIR)) {
    it(`no cases dir (${CASES_DIR})`, () => {
      expect(true).toBe(true);
    });
    return;
  }

  const files = readdirSync(CASES_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".meta.json") && f !== "_report.json");
  const report: unknown[] = [];

  if (files.length === 0) {
    it(`no case files in ${CASES_DIR}`, () => {
      expect(true).toBe(true);
    });
  }

  for (const file of files) {
    const base = file.replace(/\.json$/, "");
    it(`${file}`, () => {
      const raw = readFileSync(join(CASES_DIR, file), "utf8");
      const meta = readMeta(base);
      const targets = meta.targets ? ALL_TARGETS.filter((t) => meta.targets!.includes(t.id)) : ALL_TARGETS;
      const rows = targets.map((target) => {
        const ours = runOurs(raw, target);
        const theirs = runTheirs(raw, target);
        const divergence = classify(ours, theirs);
        return { target: target.id, channel: target.channel, version: target.version, ours, theirs, divergence };
      });
      report.push({ case: file, note: meta.note, rows });

      // Human-readable trace (visible in vitest output).
      for (const row of rows) {
        const tag = DIVERGENCES.has(row.divergence) ? "⚠️ " : "   ";
        // eslint-disable-next-line no-console
        console.log(
          `${tag}${file} [${row.target}] ${row.divergence} | ours: ${row.ours.errorCount}E/${row.ours.warningCount}W (${row.ours.diagnostics.map((d) => d.code).join(",") || "-"}) | binary: ${row.theirs.verdict}${row.theirs.reason ? " — " + row.theirs.reason.slice(0, 160) : ""}`,
        );
      }

      if (STRICT) {
        const bad = rows.filter((r) => DIVERGENCES.has(r.divergence));
        expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
      }
    });
  }

  it("writes _report.json", () => {
    if (!existsSync(CASES_DIR)) mkdirSync(CASES_DIR, { recursive: true });
    const summary = {
      generatedFor: CASES_DIR,
      cases: report,
    };
    writeFileSync(join(CASES_DIR, "_report.json"), JSON.stringify(summary, null, 2));
    expect(existsSync(join(CASES_DIR, "_report.json"))).toBe(true);
  });
});
