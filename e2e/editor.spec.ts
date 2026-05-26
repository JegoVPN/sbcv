import { expect, test } from "@playwright/test";

test("stable-first visual editor primary path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("SBC", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Node palette")).toBeVisible();
  await expect(page.getByLabel("Sing-box target")).toHaveValue("1.13-stable");
  await expect(page.getByLabel("Node inspector")).toHaveCount(0);
  await expect(page.getByTestId("node-route:main")).toBeVisible();
  await page.getByTestId("node-route:main").click();
  await expect(page.getByLabel("Node inspector")).toBeVisible();

  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await expect(page.getByLabel("Advanced JSON editor")).toHaveValue(/"route"/);

  await page.getByRole("button", { name: "Route Rules", exact: true }).click();
  await page.getByLabel("Route rule 1 domain suffix").fill("sg");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await expect(page.getByLabel("Advanced JSON editor")).toHaveValue(/"sg"/);

  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  await expect(page.getByText("Semantic validation passed.")).toBeVisible();

  await page.getByLabel("Import JSON file").setInputFiles("fixtures/stable/minimal.json");
  await expect(page.getByLabel("Node inspector")).toHaveCount(0);
  await page.getByTestId("node-route:main").click();
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  await expect(page.getByLabel("Advanced JSON editor")).toHaveValue(/"final": "direct"/);

  await expect(page.getByTestId("node-route:main")).toBeVisible();
  await expect(page.getByTestId("node-outbound:direct")).toBeVisible();
});
