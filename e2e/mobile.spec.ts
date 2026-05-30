import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

// The app boots with a non-empty default config, so importing prompts an overwrite confirm (A26).
test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
});

test("mobile shell — Check / Import / Export / node inspector flow", async ({ page }) => {
  await page.goto("/");

  // Mobile shell mounted, desktop shell not
  await expect(page.getByTestId("app-mobile")).toBeVisible();
  await expect(page.getByTestId("app-desktop")).toHaveCount(0);

  // Palette is hidden; only fit-view button in the bottom controls
  await expect(page.getByLabel("Node palette")).toHaveCount(0);
  await expect(page.locator(".react-flow__minimap")).toHaveCount(0);
  await expect(page.locator(".react-flow__attribution")).toHaveCount(0);
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

test("mobile + opens a populated add-node sheet (palette not hidden away)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-mobile")).toBeVisible();

  // Tapping the topbar "+" opens the node sheet, which reuses the desktop Palette. Regression: the
  // mobile @media `.palette{display:none}` (which hides the desktop side palette) also collapsed this
  // reused copy to 0×0, so the sheet opened empty and the "+" looked broken.
  await page.getByTestId("mobile-add-node").click();
  const sheet = page.getByTestId("mobile-node-sheet");
  await expect(sheet).toBeVisible();

  const palette = sheet.getByLabel("Node palette");
  await expect(palette).toBeVisible();
  const box = await palette.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(0);

  // Its actual controls render and are reachable.
  await expect(sheet.getByPlaceholder("Search config")).toBeVisible();
});

test("mobile topbar controls meet the 36px touch-target minimum (L4)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-mobile")).toBeVisible();
  await expect(page.getByTestId("mobile-validation-group")).toBeVisible();
  const controls = [
    page.getByTestId("brand-home"),
    page.getByRole("button", { name: "Run check" }),
    page.locator(".mobile-topbar .status-pill"),
    page.getByTestId("mobile-add-node"),
    page.getByTestId("mobile-menu-toggle"),
  ];
  for (const control of controls) {
    const box = await control.first().boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(36);
  }
});

test("mobile topbar groups validation action with validation status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-mobile")).toBeVisible();

  const metrics = await page.locator(".mobile-topbar").evaluate((topbar) => {
    const boxFor = (selector: string) => {
      const element = topbar.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      brand: boxFor('[data-testid="brand-home"]'),
      validation: boxFor('[data-testid="mobile-validation-group"]'),
      run: boxFor(".mobile-validation-run"),
      status: boxFor(".mobile-validation-status"),
      add: boxFor('[data-testid="mobile-add-node"]'),
      menu: boxFor('[data-testid="mobile-menu-toggle"]'),
    };
  });

  expect(metrics.brand).not.toBeNull();
  expect(metrics.validation).not.toBeNull();
  expect(metrics.run).not.toBeNull();
  expect(metrics.status).not.toBeNull();
  expect(metrics.add).not.toBeNull();
  expect(metrics.menu).not.toBeNull();
  expect(metrics.brand!.right).toBeLessThan(metrics.validation!.left);
  expect(metrics.run!.right).toBeLessThanOrEqual(metrics.status!.left + 1);
  expect(metrics.validation!.right).toBeLessThan(metrics.add!.left);
  expect(metrics.add!.right).toBeLessThan(metrics.menu!.left);
  expect(metrics.validation!.width).toBeGreaterThan(metrics.add!.width);
});
