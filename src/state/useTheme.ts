import { useSyncExternalStore } from "react";

/**
 * Three-state theme store (T7, docs/goals/light-mode-theming-execution.md):
 * preference = "system" | "light" | "dark", resolved = "light" | "dark".
 *
 * Mirrors the useViewport.ts house pattern: module-level matchMedia singleton +
 * listener Set + useSyncExternalStore, defensive about missing matchMedia
 * (jsdom) and throwing storage (Safari private mode → treated as "system").
 * public/theme-init.js applies the same truth table before first paint; this
 * store re-applies it on changes and keeps <meta name="theme-color"> in sync.
 *
 * App.tsx mounts useTheme() permanently — the system-preference listener must
 * outlive lazily-mounted consumers like the JSON viewer dialog.
 */

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "sbcv:theme";

// Browser-UI colors per resolved theme (= --surface-app values).
const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: "#090b0f",
  light: "#f2f4f7",
};

const themeListeners = new Set<() => void>();
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryListening = false;
let storageListening = false;
let systemPrefersLight = false;

function canUseMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function readStoredPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

let preference: ThemePreference = readStoredPreference();

function getMediaQueryList() {
  if (!canUseMatchMedia()) return null;
  if (!mediaQueryList) {
    mediaQueryList = window.matchMedia("(prefers-color-scheme: light)");
    systemPrefersLight = mediaQueryList.matches;
  }
  return mediaQueryList;
}

function resolveTheme(): ResolvedTheme {
  if (preference === "light" || preference === "dark") return preference;
  getMediaQueryList();
  return systemPrefersLight ? "light" : "dark";
}

function applyResolvedTheme() {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme();
  const root = document.documentElement;
  if (resolved === "light") root.setAttribute("data-theme", "light");
  else root.removeAttribute("data-theme");
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  for (const meta of metas) {
    if (preference === "system") {
      // System mode: restore the media-paired defaults so the BROWSER picks.
      const media = meta.getAttribute("media") ?? "";
      meta.setAttribute(
        "content",
        media.includes("light") ? THEME_COLORS.light : THEME_COLORS.dark,
      );
    } else {
      meta.setAttribute("content", THEME_COLORS[resolved]);
    }
  }
}

function notifyThemeListeners() {
  applyResolvedTheme();
  for (const listener of themeListeners) listener();
}

function onSystemSchemeChange(event: MediaQueryListEvent) {
  systemPrefersLight = event.matches;
  if (preference === "system") notifyThemeListeners();
}

function onStorageEvent(event: StorageEvent) {
  if (event.key !== THEME_STORAGE_KEY) return;
  preference = readStoredPreference();
  notifyThemeListeners();
}

function subscribeTheme(listener: () => void) {
  const mql = getMediaQueryList();
  if (mql && !mediaQueryListening) {
    mql.addEventListener("change", onSystemSchemeChange);
    mediaQueryListening = true;
  }
  if (typeof window !== "undefined" && !storageListening) {
    window.addEventListener("storage", onStorageEvent);
    storageListening = true;
  }
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
    if (themeListeners.size === 0) {
      if (mediaQueryList && mediaQueryListening) {
        mediaQueryList.removeEventListener("change", onSystemSchemeChange);
        mediaQueryListening = false;
      }
      if (typeof window !== "undefined" && storageListening) {
        window.removeEventListener("storage", onStorageEvent);
        storageListening = false;
      }
    }
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return preference;
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try {
    if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage unavailable (private mode): the in-memory preference still works
    // for this session; it just won't persist.
  }
  notifyThemeListeners();
}

export function useTheme(): {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
} {
  const pref = useSyncExternalStore(
    subscribeTheme,
    getPreferenceSnapshot,
    getServerPreferenceSnapshot,
  );
  return { preference: pref, resolved: resolveTheme(), setPreference: setThemePreference };
}

// Test-only escape hatch: re-read storage and re-resolve (jsdom remounts).
export function __resetThemeForTests() {
  preference = readStoredPreference();
  mediaQueryList = null;
  mediaQueryListening = false;
  systemPrefersLight = false;
  applyResolvedTheme();
}
