import { expect, test } from "@playwright/test";

// The app boots with a non-empty default config, so importing prompts an overwrite confirm (A26).
test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
});

test("imported config renders experimental settings node and diagnostics focus it", async ({
  page,
}) => {
  await page.goto("/");

  await page.setInputFiles(
    'input[aria-label="Import JSON file"]',
    "e2e/fixtures/experimental-rdrc.json",
  );

  await expect(page.getByTestId("node-settings:experimental")).toBeVisible();

  await page.getByLabel("Sing-box target").selectOption("1.14-testing");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(".status-pill")).toHaveText(/warning|invalid|valid/i, {
    timeout: 15000,
  });

  await page.locator(".status-pill").click();
  await expect(page.locator(".diagnostics-popover")).toBeVisible();

  const rdrcRow = page
    .locator(".diagnostics-popover__item-button")
    .filter({ hasText: "cache-file-store-rdrc-deprecated" });
  await expect(rdrcRow).toHaveCount(1);

  const targetNode = page.getByTestId("node-settings:experimental");
  const beforeBox = await targetNode.boundingBox();
  await rdrcRow.click();
  await expect(page.locator(".diagnostics-popover")).toHaveCount(0);
  await expect(targetNode).toBeVisible();
  await page.waitForTimeout(400);
  const afterBox = await targetNode.boundingBox();
  expect(beforeBox).toBeTruthy();
  expect(afterBox).toBeTruthy();
  if (beforeBox && afterBox) {
    const moved =
      Math.abs(beforeBox.x - afterBox.x) > 5 || Math.abs(beforeBox.y - afterBox.y) > 5;
    expect(moved, "canvas should pan to focus the targeted node").toBeTruthy();
  }
});
