import { describe, expect, it } from "vitest";

import { parseOptionalNumber, parseOptionalPort } from "../src/components/inspector/helpers";

// R3 — shared optional-number/port parsing. A bare Number(raw) writes 0 on clear and NaN on intermediate
// input; these parsers prune to undefined instead, and ports enforce 1..65535 integers.

describe("R3 — parseOptionalNumber", () => {
  it("clears to undefined (not 0) on empty/whitespace", () => {
    expect(parseOptionalNumber("")).toBeUndefined();
    expect(parseOptionalNumber("   ")).toBeUndefined();
  });
  it("never returns NaN for intermediate/invalid input", () => {
    for (const raw of ["-", ".", "1e", "abc", "1.2.3", "--5"]) {
      expect(parseOptionalNumber(raw)).toBeUndefined();
    }
  });
  it("keeps real numbers, including 0 and negatives and fractionals", () => {
    expect(parseOptionalNumber("0")).toBe(0);
    expect(parseOptionalNumber("100")).toBe(100);
    expect(parseOptionalNumber("-5")).toBe(-5);
    expect(parseOptionalNumber("1.5")).toBe(1.5);
  });
});

describe("R3 — parseOptionalPort", () => {
  it("accepts integer ports 1..65535", () => {
    expect(parseOptionalPort("1")).toBe(1);
    expect(parseOptionalPort("443")).toBe(443);
    expect(parseOptionalPort("65535")).toBe(65535);
  });
  it("rejects out-of-range / non-integer / empty / invalid → undefined", () => {
    for (const raw of ["", "0", "65536", "-1", "44.5", "abc", "1e", "   "]) {
      expect(parseOptionalPort(raw)).toBeUndefined();
    }
  });
  it("accepts exponent notation that resolves to a valid integer port (1e3 → 1000)", () => {
    expect(parseOptionalPort("1e3")).toBe(1000);
  });
});
