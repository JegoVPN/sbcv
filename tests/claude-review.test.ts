import { describe, expect, it } from "vitest";
import { parseSeverities } from "../scripts/claude-review/run.mjs";

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
