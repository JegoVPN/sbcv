import { describe, expect, it } from "vitest";
// @ts-expect-error Review script is a Node ESM helper without TS declarations.
import * as claudeReview from "../scripts/claude-review/run.mjs";

const {
  buildPrompt,
  isSizeBudgetedPath,
  parseBudgetedNumstat,
  parseSeverities,
  parseShortstat,
  pickGoalDoc,
} = claudeReview;

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

describe("pickGoalDoc", () => {
  it("returns most-recently-committed goal doc by git log -ct", () => {
    const calls: string[][] = [];
    const git = (args: string[]) => {
      calls.push(args);
      if (args.join(" ") === "ls-files docs/goals/*.md") {
        return "docs/goals/alpha.md\ndocs/goals/beta.md\n";
      }
      if (args.includes("docs/goals/alpha.md")) return "1700000000\n";
      if (args.includes("docs/goals/beta.md")) return "1700001000\n";
      throw new Error("unexpected: " + args.join(" "));
    };
    expect(pickGoalDoc({ git })).toBe("docs/goals/beta.md");
    expect(calls.length).toBe(3);
  });

  it("passes goal doc paths as git argv instead of shell fragments", () => {
    const calls: string[][] = [];
    const suspicious = "docs/goals/foo$(echo injected).md";
    const git = (args: string[]) => {
      calls.push(args);
      if (args[0] === "ls-files") return `${suspicious}\n`;
      if (args[0] === "log") return "1700000000\n";
      throw new Error("unexpected: " + args.join(" "));
    };

    expect(pickGoalDoc({ git })).toBe(suspicious);
    expect(calls[1]).toEqual(["log", "-1", "--format=%ct", "--", suspicious]);
  });

  it("returns null when no goal docs are tracked", () => {
    const git = (args: string[]) => (args[0] === "ls-files" ? "" : "");
    expect(pickGoalDoc({ git })).toBeNull();
  });

  it("returns null when git ls-files throws", () => {
    const git = () => {
      throw new Error("not a git repo");
    };
    expect(pickGoalDoc({ git })).toBeNull();
  });
});

describe("parseShortstat", () => {
  it("sums insertions + deletions from git --shortstat output", () => {
    const out = " 8 files changed, 945 insertions(+), 196 deletions(-)";
    expect(parseShortstat(out)).toBe(1141);
  });

  it("handles insertions only", () => {
    const out = " 1 file changed, 50 insertions(+)";
    expect(parseShortstat(out)).toBe(50);
  });

  it("handles deletions only", () => {
    const out = " 1 file changed, 30 deletions(-)";
    expect(parseShortstat(out)).toBe(30);
  });

  it("returns 0 for empty input", () => {
    expect(parseShortstat("")).toBe(0);
  });

  it("handles singular forms (1 insertion / 1 deletion)", () => {
    const out = " 1 file changed, 1 insertion(+), 1 deletion(-)";
    expect(parseShortstat(out)).toBe(2);
  });
});

describe("parseBudgetedNumstat", () => {
  it("counts non-Markdown changed lines only", () => {
    const out = [
      "10\t2\tsrc/domain/commands.ts",
      "700\t40\tdocs/superpowers/specs/plan.md",
      "5\t1\tscripts/claude-review/run.mjs",
    ].join("\n");

    expect(parseBudgetedNumstat(out)).toBe(18);
  });

  it("ignores binary rows and markdown paths", () => {
    const out = [
      "-\t-\tpublic/logo.png",
      "20\t0\tREADME.md",
      "3\t4\t.githooks/pre-push",
    ].join("\n");

    expect(parseBudgetedNumstat(out)).toBe(7);
  });

  it("classifies markdown files as outside the size budget", () => {
    expect(isSizeBudgetedPath("docs/goals/canvas.md")).toBe(false);
    expect(isSizeBudgetedPath("src/domain/commands.ts")).toBe(true);
  });
});

describe("buildPrompt", () => {
  it("includes rubric, AGENTS.md, optional goal doc, commit message, and diff", () => {
    const prompt = buildPrompt({
      rubric: "rubric text",
      agentsMd: "agents text",
      commitMsg: "feat: add thing\n\nbody",
      commitDiff: "diff --git a/file b/file",
      goalDoc: { path: "docs/goals/goal.md", content: "goal text" },
    });

    expect(prompt).toContain("rubric text");
    expect(prompt).toContain("agents text");
    expect(prompt).toContain("docs/goals/goal.md");
    expect(prompt).toContain("goal text");
    expect(prompt).toContain("feat: add thing");
    expect(prompt).toContain("diff --git a/file b/file");
  });
});
