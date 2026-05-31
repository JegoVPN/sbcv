import { describe, expect, it } from "vitest";
import { parseOptionalInt, parseOptionalNumber, parseOptionalPort } from "../src/components/inspector/helpers";

// U2 — pin the contract of the shared optional-number parsers so later reuse (workers, ha_connections,
// counts, durations-in-seconds) cannot silently drift. parseOptionalInt is the new one; the other two
// are exercised here only to document the shared `Number()`-based coercion they all build on.

describe("parseOptionalInt — non-negative integer or undefined", () => {
  it("keeps a non-negative integer, including 0", () => {
    expect(parseOptionalInt("0")).toBe(0);
    expect(parseOptionalInt("25")).toBe(25);
    expect(parseOptionalInt("65535")).toBe(65535);
  });

  it("returns undefined for empty / whitespace-only input", () => {
    expect(parseOptionalInt("")).toBeUndefined();
    expect(parseOptionalInt("   ")).toBeUndefined();
  });

  it("returns undefined for non-numeric, negative, or fractional input", () => {
    expect(parseOptionalInt("abc")).toBeUndefined();
    expect(parseOptionalInt("-1")).toBeUndefined();
    expect(parseOptionalInt("2.5")).toBeUndefined();
  });

  it("does NOT bound the upper range (callers apply their own max, e.g. uint16)", () => {
    // The keepalive control clamps to <=65535 itself; the helper stays generic.
    expect(parseOptionalInt("99999")).toBe(99999);
  });

  it("inherits Number()-based coercion (consistent with parseOptionalNumber/Port)", () => {
    // Documented, intentional: scientific notation and surrounding whitespace are accepted as the
    // integer they evaluate to — the same coercion parseOptionalNumber/parseOptionalPort already use.
    expect(parseOptionalInt(" 5 ")).toBe(5);
    expect(parseOptionalInt("1e3")).toBe(1000);
    expect(parseOptionalNumber("1e3")).toBe(1000);
    expect(parseOptionalPort("1e3")).toBe(1000);
  });
});
