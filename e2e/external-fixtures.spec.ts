import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

type ManifestEntry = {
  id: string;
  source_repo: string;
  source_path: string;
  fixture_path: string;
  detected_version: string;
  channel: "stable" | "testing";
  counts_toward_200: boolean;
};

type SingBoxLikeConfig = {
  dns?: unknown;
  inbounds?: unknown[];
  outbounds?: unknown[];
  route?: unknown;
};

const manifest = JSON.parse(readFileSync("fixtures/external/manifest.json", "utf8")) as ManifestEntry[];

function requiredByPath(sourcePath: string) {
  const entry = manifest.find((item) => item.source_path === sourcePath && item.counts_toward_200);
  if (!entry) throw new Error(`Missing required external fixture: ${sourcePath}`);
  return entry;
}

function requiredById(id: string) {
  const entry = manifest.find((item) => item.id === id && item.counts_toward_200);
  if (!entry) throw new Error(`Missing required external fixture: ${id}`);
  return entry;
}

function firstMatching(label: string, predicate: (entry: ManifestEntry) => boolean) {
  const entry = manifest.find((item) => item.counts_toward_200 && predicate(item));
  if (!entry) throw new Error(`Missing representative external fixture: ${label}`);
  return entry;
}

function unique(entries: ManifestEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

const representativeFixtures = unique([
  requiredByPath("config_template/config_template_groups_rule_set_tun.json"),
  requiredByPath("config_template/config_template_groups_rule_set_tun_fakeip.json"),
  requiredByPath("config_template/config_template_no_groups_tun_VN.json"),
  requiredByPath("config_template/sb-config-1.14.json"),
  requiredById("kj163kj-singbox_proxy_config-v1.11.0-config_default.json-d99909d7"),
  requiredById("kj163kj-singbox_proxy_config-v1.11.0-config_default.json-ae1e5bcb"),
  requiredById("kj163kj-singbox_proxy_config-v1.12.0-config_default.json-4eabcbd7"),
  requiredById("kj163kj-singbox_proxy_config-v1.12.0-config_default.json-c0e0e934"),
  requiredById("kj163kj-singbox_proxy_config-v1.12.0-config_box_default.json-fda9f792"),
  requiredById("kj163kj-singbox_proxy_config-v1.12.0-config_box_default.json-e15c66e6"),
  firstMatching("stable 1.13 config", (entry) => entry.detected_version === "1.13"),
  firstMatching("legacy 1.11 with DNS rules", (entry) => entry.detected_version === "1.11" && entry.source_path.includes("dns")),
  firstMatching("legacy 1.12 with fakeip", (entry) => entry.detected_version === "1.12" && entry.source_path.toLowerCase().includes("fake")),
  firstMatching(
    "HideinOSS Android rule-set",
    (entry) => entry.source_repo.toLowerCase() === "hideinoss/sing-box-configuration-examples",
  ),
  firstMatching("FDuLo template", (entry) => entry.source_repo.toLowerCase() === "fdulo/sing-box-config_template"),
  firstMatching(
    "Qifei 1.12 template",
    (entry) => entry.source_repo.toLowerCase() === "qifei/trygit" && entry.detected_version === "1.12",
  ),
  firstMatching(
    "Se1Jaku sub-store template",
    (entry) => entry.source_repo.toLowerCase() === "se1jaku/sub-store-template",
  ),
  firstMatching("TooonyChen base config", (entry) => entry.source_repo.toLowerCase() === "tooonychen/sbsm"),
  firstMatching(
    "OFWH 1.13 profile",
    (entry) => entry.source_repo.toLowerCase() === "ofwh/profiles" && entry.detected_version === "1.13",
  ),
  firstMatching("TUN self-use example", (entry) => entry.source_path.toLowerCase().includes("tun")),
]);

function readFixture(entry: ManifestEntry) {
  return JSON.parse(readFileSync(entry.fixture_path, "utf8")) as SingBoxLikeConfig;
}

async function importFixture(page: Page, entry: ManifestEntry) {
  await page.goto("/");
  await page.getByLabel("Channel").selectOption(entry.channel);
  await page.getByLabel("Import JSON file").setInputFiles(path.join(process.cwd(), entry.fixture_path));
  await page.locator(".sbc-node-shell").first().waitFor({ state: "visible" });
}

async function firstInspectableNode(page: Page) {
  const selectors = [
    '[data-testid="node-route:main"]',
    '[data-testid="node-dns:main"]',
    '[data-testid^="node-outbound:"]',
    '[data-testid^="node-inbound:"]',
    ".sbc-node-shell",
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector);
    if ((await locator.count()) > 0) return locator.first();
  }
  throw new Error("No rendered SBC node found");
}

async function assertSelectedNodeAndInspector(page: Page) {
  const firstNode = await firstInspectableNode(page);
  await firstNode.click();

  await expect(firstNode.getByTestId("node-titlebar")).toBeVisible();
  await expect(firstNode.getByTestId("node-card")).toBeVisible();
  await expect(firstNode.getByTestId("node-left-ports")).toBeVisible();
  await expect(firstNode.getByTestId("node-right-ports")).toBeVisible();
  await expect(firstNode.getByTestId("node-bottom-toolbar")).toBeVisible();
  await expect(page.getByTestId("node-selection-corner")).toHaveCount(4);
  const titlebar = (await firstNode.getByTestId("node-titlebar").textContent()) ?? "";
  if (titlebar.startsWith("route /")) {
    await expect(firstNode.locator('[data-testid="node-left-ports"] [data-port-node-kind="inbound"]')).toBeVisible();
    await expect(firstNode.locator('[data-testid="node-right-ports"] [data-port-node-kind="route-rule"]')).toBeVisible();
    await expect(firstNode.locator('[data-testid="node-right-ports"] [data-port-node-kind="outbound"]')).toBeVisible();
  }

  const inspector = page.getByTestId("node-inspector");
  await expect(inspector).toBeVisible();
  await expect(inspector.getByTestId("inspector-header")).toBeVisible();
  await expect(inspector.getByTestId("inspector-primary-editor")).toBeVisible();

  const viewport = page.viewportSize();
  const box = await inspector.boundingBox();
  const canvasBox = await page.getByLabel("SBC visual canvas").boundingBox();
  expect(box?.x ?? 0).toBeGreaterThan((viewport?.width ?? 0) / 2);
  expect((box?.y ?? 999) - (canvasBox?.y ?? 0)).toBeLessThan(24);
}

test("representative external fixtures import, render, inspect, export, and re-import", async ({ page }) => {
  test.setTimeout(180_000);
  expect(representativeFixtures.length).toBeGreaterThanOrEqual(20);

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  for (const [index, entry] of representativeFixtures.entries()) {
    pageErrors.length = 0;
    consoleErrors.length = 0;
    const config = readFixture(entry);

    await importFixture(page, entry);

    if (Array.isArray(config.inbounds) && config.inbounds.length > 0) {
      expect(await page.locator('[data-testid^="node-inbound:"]').count()).toBeGreaterThan(0);
    }
    if (Array.isArray(config.outbounds) && config.outbounds.length > 0) {
      expect(await page.locator('[data-testid^="node-outbound:"]').count()).toBeGreaterThan(0);
    }
    if (config.route) {
      await expect(page.getByTestId("node-route:main")).toBeVisible();
      await page.getByRole("button", { name: "Route Rules", exact: true }).click();
      await expect(page.getByLabel("Route rules")).toBeVisible();
    }
    if (config.dns) {
      await expect(page.getByTestId("node-dns:main")).toBeVisible();
      await page.getByRole("button", { name: "DNS Rules", exact: true }).click();
      await expect(page.getByLabel("DNS rules")).toBeVisible();
    }

    await assertSelectedNodeAndInspector(page);

    if (index === 0) {
      await page.screenshot({ path: "test-results/sbc-selected-node-inspector.png" });
    }

    await page.getByRole("button", { name: "JSON", exact: true }).click();
    JSON.parse(await page.getByLabel("Advanced JSON editor").inputValue());

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const download = await downloadPromise;
    const exportedPath = await download.path();
    if (!exportedPath) throw new Error(`Export download path unavailable for ${entry.id}`);

    await page.getByLabel("Import JSON file").setInputFiles(exportedPath);
    await page.getByRole("button", { name: "JSON", exact: true }).click();
    JSON.parse(await page.getByLabel("Advanced JSON editor").inputValue());

    expect(pageErrors, `${entry.id} page errors`).toEqual([]);
    expect(consoleErrors, `${entry.id} console errors`).toEqual([]);
  }
});

test("selected node and floating inspector fit mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importFixture(page, requiredByPath("config_template/config_template_groups_rule_set_tun.json"));
  await page.getByLabel("Close inspector").click();
  const selectedNode = await firstInspectableNode(page);
  await selectedNode.click();

  await expect(selectedNode.getByTestId("node-titlebar")).toBeVisible();
  await expect(selectedNode.getByTestId("node-left-ports")).toBeVisible();
  await expect(selectedNode.getByTestId("node-right-ports")).toBeVisible();
  await expect(selectedNode.getByTestId("node-bottom-toolbar")).toBeVisible();
  await expect(page.getByTestId("node-inspector")).toBeVisible();
  await expect(page.getByTestId("inspector-primary-editor")).toBeVisible();
});
