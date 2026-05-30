import { expect, test } from "@playwright/test";

// V2 — export hard gate, end-to-end in a real browser. A config with an error-level semantic diagnostic
// (here an invalid shadowsocks `method` enum, caught by V1) is structurally invalid and the Export
// button is disabled outright — there is no path to download a structurally-invalid config.

test.beforeEach(async ({ page }) => {
  // Importing over the non-empty default config prompts an overwrite confirm (A26).
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
});

test("a structurally-invalid config disables Export (no path to download)", async ({ page }) => {
  await page.goto("/");

  // The default boot config is valid → Export is enabled.
  await expect(page.getByTestId("export-button")).toBeEnabled();

  // Import a config with an invalid enum value → Export hard-disables.
  await page.setInputFiles('input[aria-label="Import JSON file"]', "e2e/fixtures/structural-error.json");
  await expect(page.getByTestId("export-button")).toBeDisabled();

  // The status pill surfaces the blocking error.
  await page.locator(".status-pill").click();
  await expect(page.locator(".diagnostics-popover")).toBeVisible();
  await expect(
    page.locator(".diagnostics-popover__item-button").filter({ hasText: "enum-invalid" }),
  ).toHaveCount(1);
});
