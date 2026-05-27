import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewport } from "../src/components/useViewport";

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initialMatches,
    media: "(max-width: 768px)",
    onchange: null,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
    addListener: (cb: Listener) => listeners.add(cb),
    removeListener: (cb: Listener) => listeners.delete(cb),
    dispatchEvent: () => true,
  } as unknown as MediaQueryList & { __fire: (matches: boolean) => void };
  (mql as unknown as { __fire: (matches: boolean) => void }).__fire = (matches: boolean) => {
    (mql as unknown as { matches: boolean }).matches = matches;
    listeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockReturnValue(mql),
  });
  return mql as MediaQueryList & { __fire: (matches: boolean) => void };
}

afterEach(() => {
  // @ts-expect-error matchMedia is not part of jsdom by default
  delete window.matchMedia;
});

describe("useViewport", () => {
  it("returns isMobile=false when viewport is wider than 768px", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(false);
  });

  it("returns isMobile=true when viewport matches the mobile breakpoint", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(true);
  });

  it("flips when the media query change event fires", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(false);
    act(() => mql.__fire(true));
    expect(result.current.isMobile).toBe(true);
    act(() => mql.__fire(false));
    expect(result.current.isMobile).toBe(false);
  });

  it("returns false safely when matchMedia is unavailable", () => {
    const { result } = renderHook(() => useViewport());
    expect(result.current.isMobile).toBe(false);
  });
});
