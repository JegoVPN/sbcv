import { describe, expect, it } from "vitest";

import { isValidTarget, SUPPORTED_TARGETS } from "../src/targets.js";

describe("targets", () => {
  it("matches the three targets shipped by the container", () => {
    expect(SUPPORTED_TARGETS).toEqual(["1.12 Legacy", "1.13 stable", "1.14 testing"]);
  });

  it("rejects unknown or missing values", () => {
    expect(isValidTarget("")).toBe(false);
    expect(isValidTarget("1.13")).toBe(false);
    expect(isValidTarget(null)).toBe(false);
    expect(isValidTarget(undefined)).toBe(false);
    expect(isValidTarget(1.13)).toBe(false);
  });

  it("accepts each canonical target", () => {
    for (const target of SUPPORTED_TARGETS) {
      expect(isValidTarget(target)).toBe(true);
    }
  });
});
