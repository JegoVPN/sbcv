import { expect, test } from "@playwright/test";

// R1 — .field--checklist fieldsets must NOT inherit the .field two-column grid (which collapsed nested
// inputs, e.g. the TUN Platform HTTP Proxy server_port to ~30px). Real-browser layout assertions —
// jsdom cannot catch this.

test("TUN Platform HTTP Proxy fields are usable (field--checklist not collapsed)", async ({ page }) => {
  await page.goto("/");
  // The default boot config has a tun inbound (tag "tun-in").
  await page.getByTestId("node-inbound:tun-in").click();

  const fieldset = page.getByTestId("tun-platform-http-proxy");
  await expect(fieldset).toBeVisible();
  await fieldset.scrollIntoViewIfNeeded();

  // The server_port number input must have a usable width, not the ~30px collapse.
  const portInput = fieldset.getByRole("spinbutton");
  const box = await portInput.boundingBox();
  expect(box, "server_port input should be laid out").not.toBeNull();
  expect(box!.width).toBeGreaterThan(80);

  // No horizontal overflow inside the fieldset.
  const overflow = await fieldset.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  // And it is actually editable by pointer/keyboard.
  await portInput.fill("8080");
  await expect(portInput).toHaveValue("8080");
});

// R1b — inspector control fonts are pinned to ~14px and don't inherit the (larger) inspector/mobile font,
// so input/select values no longer render bigger + heavier than their labels (the reported screenshot).
const computedFontSize = (locator: import("@playwright/test").Locator) =>
  locator.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

for (const view of [
  { name: "desktop", width: 1280, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`inspector input/select font is pinned (~14px), not oversized — ${view.name}`, async ({ page }) => {
    await page.setViewportSize({ width: view.width, height: view.height });
    await page.goto("/");
    await page.getByTestId("node-inbound:tun-in").click();

    const input = page.getByTestId("tun-mtu").locator("input");
    const select = page.getByTestId("tun-stack-field").locator("select");
    const inputFs = await computedFontSize(input);
    const selectFs = await computedFontSize(select);

    // Pinned to the 14px label scale (not the larger inherited inspector font), on both viewports.
    expect(inputFs, "input value font-size").toBeGreaterThanOrEqual(13);
    expect(inputFs).toBeLessThanOrEqual(15);
    expect(selectFs, "select value font-size").toBeGreaterThanOrEqual(13);
    expect(selectFs).toBeLessThanOrEqual(15);
  });
}
