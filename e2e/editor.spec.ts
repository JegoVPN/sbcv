import { expect, test } from "@playwright/test";

// The app boots with a non-empty default config, so importing prompts an overwrite confirm (A26).
test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
});

test("stable-first visual editor primary path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("sbcv", { exact: true })).toBeVisible();
  await expect(page.locator(".react-flow__attribution")).toHaveCount(0);
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

test("brand menu JSON viewer scrolls the canonical config", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("brand-menu-toggle").click();

  const brandLogoBox = await page.locator(".brand-mark").boundingBox();
  expect(brandLogoBox?.height).toBe(20);

  const brandMenuMetrics = await page.locator(".brand-menu").evaluate((menu) => {
    const menuLogo = menu.querySelector(".brand-menu__logo");
    const subtitle = menu.querySelector(".brand-menu__intro span");
    const staticHex = document.querySelector(".brand-mark .sbcv-logo__hexagon");
    const menuHex = menu.querySelector(".sbcv-logo__hexagon");
    const menuLink = menu.querySelector(".sbcv-logo__link");
    if (!menuLogo || !subtitle || !staticHex || !menuHex || !menuLink) return null;
    return {
      menuLogoHeight: menuLogo.getBoundingClientRect().height,
      menuLogoWidth: menuLogo.getBoundingClientRect().width,
      subtitleClientWidth: subtitle.clientWidth,
      subtitleScrollWidth: subtitle.scrollWidth,
      subtitleWhiteSpace: getComputedStyle(subtitle).whiteSpace,
      staticHexAnimation: getComputedStyle(staticHex).animationName,
      staticHexStroke: getComputedStyle(staticHex).stroke,
      menuHexAnimation: getComputedStyle(menuHex).animationName,
      menuHexStroke: getComputedStyle(menuHex).stroke,
      menuLinkAnimation: getComputedStyle(menuLink).animationName,
    };
  });
  expect(brandMenuMetrics).not.toBeNull();
  expect(brandMenuMetrics?.menuLogoHeight).toBe(45);
  expect(brandMenuMetrics?.menuLogoWidth).toBe(45);
  expect(brandMenuMetrics?.subtitleScrollWidth ?? 0).toBeLessThanOrEqual(brandMenuMetrics?.subtitleClientWidth ?? 0);
  expect(brandMenuMetrics?.subtitleWhiteSpace).toBe("nowrap");
  expect(brandMenuMetrics?.staticHexAnimation).toBe("none");
  expect(brandMenuMetrics?.staticHexStroke).toBe("rgb(199, 255, 0)");
  expect(brandMenuMetrics?.menuHexAnimation).toBe("none");
  expect(brandMenuMetrics?.menuHexStroke).toBe("rgb(89, 97, 106)");
  expect(brandMenuMetrics?.menuLinkAnimation).toBe("sbcv-logo-link");

  await page.getByRole("menuitem", { name: "View JSON" }).click();
  await expect(page.getByRole("dialog", { name: "Current JSON" })).toBeVisible();

  const scroller = page.locator(".json-viewer-editor .cm-scroller");
  const metrics = await scroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  const scrollTop = await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });
  expect(scrollTop).toBeGreaterThan(0);
});

test("selecting a node paints its first-degree edges in selection blue", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("node-route:main")).toBeVisible();

  // No selection → every edge is the default green, none highlighted.
  await expect(page.locator(".sbc-edge__path--highlighted")).toHaveCount(0);

  await page.getByTestId("node-route:main").click();

  // The route hub's first-degree edges (to its rules / final outbound) turn selection-blue.
  const highlighted = page.locator(".sbc-edge__path--highlighted");
  await expect(highlighted.first()).toBeVisible();
  expect(await highlighted.first().evaluate((el) => getComputedStyle(el).stroke)).toBe("rgb(45, 153, 255)");

  // An edge not incident to the route hub stays green (e.g. a selector→member edge).
  const plain = page.locator(".sbc-edge__path:not(.sbc-edge__path--highlighted)").first();
  await expect(plain).toBeVisible();
  expect(await plain.evaluate((el) => getComputedStyle(el).stroke)).toBe("rgb(199, 255, 0)");
});

test("a version-gated node shows a 'needs X' badge only on an older target", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Import JSON file").setInputFiles({
    name: "config.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ outbounds: [{ type: "naive", tag: "n", server: "1.2.3.4", server_port: 443 }] })),
  });
  const node = page.getByTestId("node-outbound:n");
  await node.waitFor({ state: "visible" });
  const badge = node.getByTestId("node-badge-version");

  // Default target is 1.13-stable; naive needs 1.13 → no version badge.
  await expect(badge).toHaveCount(0);

  // Switch to the 1.12 target → naive (needs 1.13) is now ahead of the target → badge appears.
  await page.getByLabel("Sing-box target").selectOption("1.12-stable");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/needs 1\.13/i);

  // Back to 1.13 → badge gone again.
  await page.getByLabel("Sing-box target").selectOption("1.13-stable");
  await expect(badge).toHaveCount(0);
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

test("semantic validation refresh does not snap an active node drag", async ({ page }) => {
  await page.goto("/");
  const route = page.getByTestId("node-route:main");
  const startBox = await route.boundingBox();
  if (!startBox) throw new Error("missing route node");

  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(".status-pill")).toHaveText(/^(checking|parsing json|running sing-box)/i);

  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(startBox.x + startBox.width / 2 + 120, startBox.y + startBox.height / 2 + 60, {
    steps: 8,
  });
  await page.waitForTimeout(360);

  const duringDragBox = await route.boundingBox();
  expect(duringDragBox).toBeTruthy();
  if (duringDragBox) {
    expect(duringDragBox.x - startBox.x).toBeGreaterThan(40);
    expect(duringDragBox.y - startBox.y).toBeGreaterThan(20);
  }

  await page.mouse.up();
});
