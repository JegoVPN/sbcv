// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_STORAGE_KEY,
  __resetThemeForTests,
  setThemePreference,
} from "../src/state/useTheme";

/**
 * Truth table for the three-state theme store (T7). jsdom lacks matchMedia, so
 * it is mocked per test; the store must also survive its ABSENCE (defensive
 * branch) and throwing storage (Safari private mode → "system").
 */

function mockMatchMedia(prefersLight: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: prefersLight,
    media: "(prefers-color-scheme: light)",
    addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", (query: string) => {
    void query;
    return mql as unknown as MediaQueryList;
  });
  return {
    flip(next: boolean) {
      (mql as { matches: boolean }).matches = next;
      for (const fn of listeners) fn({ matches: next });
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useTheme truth table", () => {
  it("missing key resolves via system preference (light)", () => {
    mockMatchMedia(true);
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("missing key resolves via system preference (dark)", () => {
    mockMatchMedia(false);
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("stored light wins over a dark system", () => {
    mockMatchMedia(false);
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("stored dark wins over a light system", () => {
    mockMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("garbage stored value falls back to system", () => {
    mockMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, "blurple");
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("missing matchMedia resolves dark without throwing", () => {
    vi.stubGlobal("matchMedia", undefined);
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("throwing storage is treated as system", () => {
    mockMatchMedia(true);
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    __resetThemeForTests();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    spy.mockRestore();
  });

  it("setPreference persists, applies, and system clears the key", () => {
    mockMatchMedia(false);
    __resetThemeForTests();
    setThemePreference("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    setThemePreference("system");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });
});
