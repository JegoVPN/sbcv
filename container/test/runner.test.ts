import { describe, expect, it } from "vitest";

import { classify, redactSensitive } from "../src/runner.js";

describe("redactSensitive", () => {
  it("redacts password fields", () => {
    expect(redactSensitive("password=secret123")).toBe("password=<redacted>");
  });

  it("redacts uuid fields", () => {
    expect(redactSensitive("uuid: abcd-efgh")).toBe("uuid=<redacted>");
  });

  it("keeps unrelated text intact", () => {
    expect(redactSensitive("server reachable on 1.2.3.4")).toBe("server reachable on 1.2.3.4");
  });
});

describe("classify", () => {
  const base = { stdout: "", stderr: "", durationMs: 0, timedOut: false };

  it("returns invalid when timed out", () => {
    expect(classify({ ...base, exitCode: null, timedOut: true })).toBe("invalid");
  });

  it("returns invalid on non-zero exit", () => {
    expect(classify({ ...base, exitCode: 1 })).toBe("invalid");
  });

  it("returns warning when output mentions deprecated", () => {
    expect(classify({ ...base, exitCode: 0, stderr: "field x is deprecated" })).toBe("warning");
  });

  it("returns warning when output mentions 'will be removed'", () => {
    expect(classify({ ...base, exitCode: 0, stderr: "field x will be removed" })).toBe("warning");
  });

  it("returns valid on clean zero exit", () => {
    expect(classify({ ...base, exitCode: 0, stdout: "config valid" })).toBe("valid");
  });
});
