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
