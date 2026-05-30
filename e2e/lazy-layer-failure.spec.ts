import { expect, test } from "@playwright/test";

// R2 — a failed dynamic import for a lazy layer must NOT clear #root (the blank/black-screen bug). The
// LazyLayerBoundary catches it and shows a recoverable, closable error; the app stays usable.

test("a failed mobile node-sheet chunk shows a recoverable error, not a blank app", async ({ page }) => {
  // Abort the lazy MobileNodeSheet module fetch (Vite dev serves it by module name).
  await page.route(/MobileNodeSheet/, (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  // Trigger the lazy node sheet → its chunk fetch is aborted.
  await page.getByTestId("mobile-add-node").click();

  // The failure is caught in-slot: a recoverable error is shown and #root is NOT cleared.
  await expect(page.getByTestId("lazy-layer-error")).toBeVisible();
  await expect(page.locator("#root")).not.toBeEmpty();

  // Closing dismisses the failed layer and the app stays usable.
  await page.getByTestId("lazy-layer-error").getByRole("button", { name: /close/i }).click();
  await expect(page.getByTestId("lazy-layer-error")).toHaveCount(0);
  await expect(page.getByTestId("mobile-add-node")).toBeVisible();
});
