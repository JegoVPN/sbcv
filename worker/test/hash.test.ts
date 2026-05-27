import { describe, expect, it } from "vitest";

import { cacheKey, normalize } from "../src/hash.js";

describe("normalize", () => {
  it("sorts object keys deterministically", () => {
    expect(normalize({ b: 1, a: 2 })).toEqual({ a: 2, b: 1 });
  });

  it("recursively normalizes nested objects", () => {
    expect(normalize({ outer: { z: 1, a: { y: 2, x: 1 } } })).toEqual({
      outer: { a: { x: 1, y: 2 }, z: 1 },
    });
  });

  it("preserves array order", () => {
    expect(normalize([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it("passes primitives through", () => {
    expect(normalize("x")).toBe("x");
    expect(normalize(42)).toBe(42);
    expect(normalize(null)).toBe(null);
  });
});

describe("cacheKey", () => {
  it("returns the same hash for semantically equal configs", async () => {
    const a = await cacheKey({
      target: "1.13 stable",
      config: { x: 1, y: { b: 2, a: 1 } },
      validatorVersion: "v1",
    });
    const b = await cacheKey({
      target: "1.13 stable",
      config: { y: { a: 1, b: 2 }, x: 1 },
      validatorVersion: "v1",
    });
    expect(a).toBe(b);
  });

  it("differs when target changes", async () => {
    const a = await cacheKey({ target: "1.13 stable", config: {}, validatorVersion: "v1" });
    const b = await cacheKey({ target: "1.14 testing", config: {}, validatorVersion: "v1" });
    expect(a).not.toBe(b);
  });

  it("differs when validator version changes", async () => {
    const a = await cacheKey({ target: "1.13 stable", config: {}, validatorVersion: "v1" });
    const b = await cacheKey({ target: "1.13 stable", config: {}, validatorVersion: "v2" });
    expect(a).not.toBe(b);
  });

  it("produces a 64-char hex string", async () => {
    const out = await cacheKey({ target: "1.13 stable", config: {}, validatorVersion: "v1" });
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });
});
