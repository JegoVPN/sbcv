import { expect, test } from "@playwright/test";

test("stable-first visual editor primary path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("sbcv.app", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Node palette")).toBeVisible();
  await expect(page.getByLabel("Sing-box target")).toHaveValue("1.13-stable");
  await expect(page.getByLabel("Node inspector")).toHaveCount(0);
  await expect(page.getByTestId("node-route:main")).toBeVisible();
  await page.getByTestId("node-route:main").click();
  await expect(page.getByLabel("Node inspector")).toBeVisible();
  await expect(page.getByLabel("Rules, JSON, and diagnostics")).toHaveCount(0);
  await expect(page.getByLabel("Route rules")).toBeVisible();

  await page.getByLabel("Route rule 1 domain suffix").fill("sg");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  // Pill cycles through phase labels while both legs run; accept any of them.
  await expect(page.locator(".status-pill")).toHaveText(/^(checking|parsing json|running sing-box)/i);
  await expect(page.locator(".status-pill")).toHaveText(/^valid$/i);
  await expect(page.locator(".topbar")).not.toContainText(/Checked \d/);

  await page.getByLabel("Import JSON file").setInputFiles("fixtures/stable/minimal.json");
  await expect(page.getByLabel("Node inspector")).toHaveCount(0);
  await page.getByTestId("node-route:main").click();

  await expect(page.getByTestId("node-route:main")).toBeVisible();
  await expect(page.getByTestId("node-outbound:direct")).toBeVisible();
});

test("manual zoom is preserved after dragging a node", async ({ page }) => {
  await page.goto("/");
  const canvasBox = await page.getByLabel("SBC visual canvas").boundingBox();
  if (!canvasBox) throw new Error("missing canvas");

  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(120);
  const viewport = page.locator(".react-flow__viewport");
  const transformAfterZoom = await viewport.evaluate((element) => getComputedStyle(element).transform);

  const routeBox = await page.getByTestId("node-route:main").boundingBox();
  if (!routeBox) throw new Error("missing route node");

  await page.mouse.move(routeBox.x + routeBox.width / 2, routeBox.y + routeBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(routeBox.x + routeBox.width / 2 + 80, routeBox.y + routeBox.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(220);

  await expect(viewport).toHaveCSS("transform", transformAfterZoom);
});
