// Pre-paint theme bootstrap (T7). Loaded as a blocking classic script from
// index.html <head> BEFORE the stylesheet — an inline script would be blocked
// by the production CSP (script-src 'self', no 'unsafe-inline'; public/_headers).
// Shares the truth table with src/state/useTheme.ts: stored "light"/"dark"
// wins, anything else follows prefers-color-scheme.
(function () {
  var stored = null;
  try {
    stored = localStorage.getItem("sbcv:theme");
  } catch (e) {
    /* storage unavailable: fall through to system */
  }
  var light;
  if (stored === "light") light = true;
  else if (stored === "dark") light = false;
  else {
    light =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
  }
  if (light) document.documentElement.setAttribute("data-theme", "light");
})();
