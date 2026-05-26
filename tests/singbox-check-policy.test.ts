import { describe, expect, it } from "vitest";
// @ts-expect-error Policy script is a Node ESM validation helper without TS declarations.
import { assertCleanSingBoxCheck, evaluateSingBoxCheck, findSingBoxWarningLines } from "../scripts/singbox-check-policy.mjs";
// @ts-expect-error Policy script is a Node ESM validation helper without TS declarations.
import { binaryForDetectedVersion, binaryForFixturePath, targetBinaries } from "../scripts/singbox-target-policy.mjs";

describe("sing-box official check policy", () => {
  it("accepts a zero-exit check with clean output", () => {
    expect(evaluateSingBoxCheck({ status: 0, stdout: "", stderr: "" })).toEqual({
      ok: true,
      status: "pass",
      reason: "",
    });
  });

  it("rejects zero-exit checks that emit deprecation warnings", () => {
    const result = evaluateSingBoxCheck({
      status: 0,
      stderr: "WARN[0000] option route.geoip is deprecated and will be removed",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("warning");
    expect(result.reason).toContain("deprecated");
  });

  it("returns warning lines from mixed sing-box output", () => {
    expect(
      findSingBoxWarningLines(["INFO[0000] config loaded", "WARN[0000] legacy field will be removed", ""].join("\n")),
    ).toEqual(["WARN[0000] legacy field will be removed"]);
  });

  it("throws on non-zero or warning official checks", () => {
    expect(() =>
      assertCleanSingBoxCheck({
        binary: "sing-box-stable",
        file: "config.json",
        status: 1,
        stderr: "invalid route rule",
      }),
    ).toThrow(/failed/);

    expect(() =>
      assertCleanSingBoxCheck({
        binary: "sing-box-stable",
        file: "config.json",
        status: 0,
        stderr: "deprecated field",
      }),
    ).toThrow(/warning/);
  });

  it("maps supported SBC targets to the matching official binary only", () => {
    expect(targetBinaries).toEqual({
      "1.12-stable": "sing-box-1.12",
      "1.13-stable": "sing-box-stable",
      "1.14-testing": "sing-box-testing",
    });
    expect(binaryForDetectedVersion("1.11")).toBeNull();
    expect(binaryForDetectedVersion("1.12")).toBe("sing-box-1.12");
    expect(binaryForDetectedVersion("1.13")).toBe("sing-box-stable");
    expect(binaryForDetectedVersion("1.14")).toBe("sing-box-testing");
  });

  it("routes checked-in fixture files through their version-matched binary", () => {
    expect(binaryForFixturePath("fixtures/stable/template-1.12-legacy-mixed-split.json", "stable")).toBe("sing-box-1.12");
    expect(binaryForFixturePath("fixtures/stable/tun-route-selector.json", "stable")).toBe("sing-box-stable");
    expect(binaryForFixturePath("fixtures/testing/template-1.14-http-client.json", "testing")).toBe("sing-box-testing");
  });
});
