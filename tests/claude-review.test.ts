import { describe, expect, it } from "vitest";
import { parseSeverities, pickGoalDoc } from "../scripts/claude-review/run.mjs";

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
    const run = () => {
      throw new Error("not a git repo");
    };
    expect(pickGoalDoc({ run })).toBeNull();
  });
});
