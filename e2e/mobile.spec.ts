import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("mobile shell — Check / Import / Export / node inspector flow", async ({ page }) => {
  await page.goto("/");

  // Mobile shell mounted, desktop shell not
  await expect(page.getByTestId("app-mobile")).toBeVisible();
  await expect(page.getByTestId("app-desktop")).toHaveCount(0);

  // Palette is hidden; only fit-view button in the bottom controls
  await expect(page.getByLabel("Node palette")).toHaveCount(0);
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await expect(page.locator(".react-flow__controls-button")).toHaveCount(1);

  // Status pill is interactive and Check button is reachable directly
  await expect(page.locator(".status-pill")).toBeVisible();
  await page.getByRole("button", { name: "Run check" }).click();
  await expect(page.locator(".status-pill")).toHaveText(/^valid$/i);

  // Menu sheet opens, target select + actions visible
  await page.getByTestId("mobile-menu-toggle").click();
  await expect(page.getByTestId("mobile-menu-sheet")).toBeVisible();
  await expect(page.getByLabel("Sing-box target")).toBeVisible();
  await expect(page.getByRole("button", { name: /Templates/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-menu-sheet")).toHaveCount(0);

  // Import a fixture from the menu
  await page.getByTestId("mobile-menu-toggle").click();
  await page.getByLabel("Import JSON file").setInputFiles("fixtures/stable/minimal.json");
  await expect(page.getByTestId("mobile-menu-sheet")).toHaveCount(0);

  // Tap a canvas node → inspector sheet opens with the compact Inspector
  await expect(page.getByTestId("node-route:main")).toBeVisible();
  await page.getByTestId("node-route:main").click();
  await expect(page.getByTestId("mobile-inspector-sheet")).toBeVisible();
  const inspector = page.getByTestId("node-inspector");
  await expect(inspector).toBeVisible();
  await expect(inspector).toHaveClass(/inspector--compact/);

  // Close via escape
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-inspector-sheet")).toHaveCount(0);
});
