import { expect, test } from "@playwright/test";

// T7: the three-state theme mechanism, end to end. The suite-wide default is
// colorScheme: "dark" (playwright.config.ts) so every other spec keeps testing
// the dark theme; these tests opt into their own scheme/storage per case.

const LIGHT_APP_BG = "rgb(242, 244, 247)"; // --surface-app (light)
const DARK_APP_BG = "rgb(10, 13, 18)"; // --surface-app (dark)

async function appShellBg(page: import("@playwright/test").Page) {
  return page
    .locator(".app-shell")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

test("stored light preference wins before first paint (theme-init.js)", async ({ page }) => {
  await page.addInitScript(([key]) => {
    try {
      localStorage.setItem(key!, "light");
    } catch {
      /* ignore */
    }
  }, ["sbcv:theme"]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await appShellBg(page)).toBe(LIGHT_APP_BG);
});

test("no stored preference follows the system scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await appShellBg(page)).toBe(LIGHT_APP_BG);

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
  expect(await appShellBg(page)).toBe(DARK_APP_BG);
});

test("stored dark preference ignores a light system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(([key]) => {
    try {
      localStorage.setItem(key!, "dark");
    } catch {
      /* ignore */
    }
  }, ["sbcv:theme"]);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "light");
  expect(await appShellBg(page)).toBe(DARK_APP_BG);
});
