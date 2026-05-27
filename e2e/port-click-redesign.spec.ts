import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function importInlineConfig(page: Page, config: unknown) {
  await page.goto("/");
  await page.getByLabel("Import JSON file").setInputFiles({
    name: "config.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(config, null, 2)),
  });
  await page.locator(".sbc-node-shell").first().waitFor({ state: "visible" });
}

async function exportedConfig(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("missing export path");
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

async function dragHandle(page: Page, fromSelector: string, to: { x: number; y: number }) {
  const fromBox = await page.locator(fromSelector).boundingBox();
  if (!fromBox) throw new Error(`missing handle ${fromSelector}`);
  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

test("desktop empty-drop opens chip picker and chip creates canonical route final", async ({ page }) => {
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });

  const targetPort = page.locator('[data-testid="node-outbound:direct"] [data-port-type="route"]');
  await expect(targetPort).not.toHaveClass(/is-compatible/);

  const canvasBox = await page.getByLabel("SBC visual canvas").boundingBox();
  if (!canvasBox) throw new Error("missing canvas");
  await dragHandle(
    page,
    '[data-testid="node-route:main"] [data-port-type="outbound"] .sbc-handle--source',
    { x: canvasBox.x + canvasBox.width * 0.72, y: canvasBox.y + canvasBox.height * 0.38 },
  );

  await expect(page.locator(".react-flow__connection-path")).toBeVisible();
  await expect(targetPort).toHaveClass(/is-compatible/);
  await page.mouse.up();

  const picker = page.getByRole("dialog", { name: "Compatible nodes" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "SOCKS", exact: true }).click();

  await expect(page.getByTestId("node-outbound:proxy-out")).toBeVisible();
  const config = await exportedConfig(page);
  expect(config.route.final).toBe("proxy-out");
});

test("desktop direct drop connects existing target without picker", async ({ page }) => {
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });

  const targetBox = await page
    .locator('[data-testid="node-outbound:direct"] [data-port-type="route"] .sbc-handle--source')
    .boundingBox();
  if (!targetBox) throw new Error("missing direct target handle");
  await dragHandle(
    page,
    '[data-testid="node-route:main"] [data-port-type="outbound"] .sbc-handle--source',
    { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 },
  );
  await page.mouse.up();

  await expect(page.getByRole("dialog", { name: "Compatible nodes" })).toHaveCount(0);
  const config = await exportedConfig(page);
  expect(config.route.final).toBe("direct");
});

test("invalid drop cancels without mutation", async ({ page }) => {
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });
  const before = await exportedConfig(page);
  const invalidPort = page.locator('[data-testid="node-outbound:direct"] [data-port-type="dns-detour"]');
  const targetBox = await invalidPort.locator(".sbc-handle--target").boundingBox();
  if (!targetBox) throw new Error("missing invalid target handle");

  await dragHandle(
    page,
    '[data-testid="node-route:main"] [data-port-type="outbound"] .sbc-handle--source',
    { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 },
  );
  await expect(invalidPort).not.toHaveClass(/is-compatible/);
  await page.mouse.up();

  await expect(page.getByRole("dialog", { name: "Compatible nodes" })).toHaveCount(0);
  expect(await exportedConfig(page)).toEqual(before);
});

test("connected-handle disconnect removes only the relation", async ({ page }) => {
  await importInlineConfig(page, {
    route: { final: "direct" },
    outbounds: [{ type: "direct", tag: "direct" }],
  });

  await page.getByTestId("node-outbound:direct").hover();
  await page.getByRole("button", { name: "Disconnect Upstream Route final for direct" }).click();

  const config = await exportedConfig(page);
  expect(config.route.final).toBeUndefined();
  expect(config.outbounds).toEqual([{ type: "direct", tag: "direct" }]);
});
