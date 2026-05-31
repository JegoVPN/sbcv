import { describe, expect, it } from "vitest";

import { isValidTarget, resolveTarget, SUPPORTED_TARGETS } from "../src/targets.js";

describe("targets", () => {
  it("lists three supported targets", () => {
    expect(SUPPORTED_TARGETS).toEqual(["1.12 Legacy", "1.13 stable", "1.14 testing"]);
  });

  it("isValidTarget rejects unknown values", () => {
    expect(isValidTarget("random")).toBe(false);
    expect(isValidTarget(undefined)).toBe(false);
    expect(isValidTarget(1)).toBe(false);
  });

  it("isValidTarget accepts each supported target", () => {
    for (const target of SUPPORTED_TARGETS) {
      expect(isValidTarget(target)).toBe(true);
    }
  });

  it("resolveTarget maps to the correct binary name", () => {
    expect(resolveTarget("1.12 Legacy").binary).toBe("sing-box-1.12");
    expect(resolveTarget("1.13 stable").binary).toBe("sing-box-stable");
    expect(resolveTarget("1.14 testing").binary).toBe("sing-box-testing");
  });

  it("resolveTarget points binaryPath inside the per-version directory", () => {
    // The binary must be invoked from its own directory so the naive outbound
    // can dlopen the sibling libcronet sidecar (see install-binaries.sh).
    for (const target of SUPPORTED_TARGETS) {
      const spec = resolveTarget(target);
      expect(spec.binaryPath.endsWith(`${spec.binary}/sing-box`)).toBe(true);
    }
  });
});
