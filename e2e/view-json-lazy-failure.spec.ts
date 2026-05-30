import { expect, test } from "@playwright/test";

// Bug: when the desktop "View JSON" lazy chunk fails to load, the LazyLayerBoundary error toast renders
// INSIDE the `.topbar` <header>, which is `pointer-events: none` (a transparent container whose only
// interactive children re-enable pointer events). The `.lazy-layer-error` toast did NOT re-enable
// `pointer-events: auto`, so it inherited `none`: the Retry / Close buttons were VISIBLE but unclickable —
// the failed panel could not be dismissed or retried. (The mobile path was unaffected because
// `.mobile-topbar` is `pointer-events: auto`; the existing lazy-layer-failure spec exercises only that
// path, so it never caught this.)

test("desktop View JSON lazy-chunk failure renders a CLICKABLE recoverable error (pointer-events)", async ({ page }) => {
  // Abort the lazy ConfigJsonViewerDialog module fetch (Vite dev serves it by module name).
  await page.route(/ConfigJsonViewerDialog/, (route) => route.abort());
  await page.goto("/");

  // Desktop View JSON lives in the brand menu.
  await page.getByTestId("brand-menu-toggle").click();
  await page.getByRole("menuitem", { name: /view json/i }).click();

  // The aborted chunk surfaces the in-slot recoverable error inside the pointer-events:none topbar.
  const errorToast = page.getByTestId("lazy-layer-error");
  await expect(errorToast).toBeVisible();

  // The actual bug: the Close button must RECEIVE the click (pointer-events). Before the fix this times
  // out — the toast inherits pointer-events:none from .topbar, so the click never lands on the button.
  await errorToast.getByRole("button", { name: /close/i }).click();
  await expect(errorToast).toHaveCount(0);
  // The app stays usable after dismissing.
  await expect(page.getByTestId("brand-menu-toggle")).toBeVisible();
});
