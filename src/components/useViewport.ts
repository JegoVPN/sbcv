import { useSyncExternalStore } from "react";

const MOBILE_QUERY = "(max-width: 768px)";
const viewportListeners = new Set<() => void>();
let mediaQueryList: MediaQueryList | null = null;
let mediaQueryListening = false;
let currentIsMobile = false;
let matchMediaRef: typeof window.matchMedia | null = null;

function canUseMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function getMediaQueryList() {
  if (!canUseMatchMedia()) return null;
  const currentMatchMedia = window.matchMedia;
  if (!mediaQueryList || matchMediaRef !== currentMatchMedia) {
    if (mediaQueryList && mediaQueryListening) {
      mediaQueryList.removeEventListener("change", onViewportChange);
      mediaQueryListening = false;
    }
    matchMediaRef = currentMatchMedia;
    mediaQueryList = currentMatchMedia(MOBILE_QUERY);
    currentIsMobile = mediaQueryList.matches;
  }
  return mediaQueryList;
}

function notifyViewportListeners() {
  for (const listener of viewportListeners) listener();
}

function onViewportChange(event: MediaQueryListEvent) {
  currentIsMobile = event.matches;
  notifyViewportListeners();
}

function subscribeViewport(listener: () => void) {
  const mql = getMediaQueryList();
  if (!mql) return () => {};

  viewportListeners.add(listener);
  if (!mediaQueryListening) {
    mql.addEventListener("change", onViewportChange);
    mediaQueryListening = true;
  }

  return () => {
    viewportListeners.delete(listener);
    if (viewportListeners.size === 0 && mediaQueryListening) {
      mql.removeEventListener("change", onViewportChange);
      mediaQueryListening = false;
    }
  };
}

function getViewportSnapshot() {
  const mql = getMediaQueryList();
  if (!mql) return false;
  currentIsMobile = mql.matches;
  return currentIsMobile;
}

function getServerViewportSnapshot() {
  return false;
}

export function useViewport(): { isMobile: boolean } {
  const isMobile = useSyncExternalStore(subscribeViewport, getViewportSnapshot, getServerViewportSnapshot);
  return { isMobile };
}
