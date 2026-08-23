import { expect, test } from "@playwright/test";

test("network namespaces are testing-gated and editable on the canvas", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });

  await page.goto("/");
  await page.getByRole("button", { name: /^Library \d+$/ }).click();
  await page.getByRole("button", { name: "Network Namespaces 3", exact: true }).click();

  await expect(page.getByRole("button", { name: "Default: Needs 1.14", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Unshare: Needs 1.14", exact: true })).toBeDisabled();

  await page.getByLabel("Sing-box target").selectOption("1.14-testing");
  await page.getByRole("button", { name: "Add Default", exact: true }).click();

  const node = page.getByTestId("node-network-namespace:netns");
  await expect(node).toBeVisible();
  await expect(page.getByLabel("Node inspector")).toBeVisible();
  await expect(page.locator(".status-pill")).toHaveText(/^invalid$/i);

  await page.getByRole("textbox", { name: "Path (required)", exact: true }).fill("/run/netns/blue");
  await expect(node).toContainText("/run/netns/blue");
  await expect(page.locator(".status-pill")).toHaveText(/^valid$/i);

  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("unshare");
  await expect(page.getByRole("textbox", { name: "PID File", exact: true })).toBeVisible();
  await expect(page.getByText("Rootless creation requires unprivileged user namespaces to be enabled.")).toBeVisible();
  await expect(node).toContainText("rootless namespace");
  await expect(consoleErrors).toEqual([]);
});
