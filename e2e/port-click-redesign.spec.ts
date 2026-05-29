import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// The app boots with a non-empty default config, so importing prompts an overwrite confirm (A26).
test.beforeEach(async ({ page }) => {
  page.on("dialog", (dialog) => {
    void dialog.accept();
  });
});

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

// N1: ports are collapsed until revealed. Hover the source node to reveal its ports, then press its
// source handle to begin a connect-drag. The node stays "hovered" while dragging because the pressed
// handle is its descendant (mouseenter/leave + :hover are subtree-based), so the source port stays shown.
async function startPortDrag(page: Page, nodeTestId: string, portType: string) {
  await page.getByTestId(nodeTestId).hover();
  const handle = page
    .locator(`[data-testid="${nodeTestId}"] [data-port-type="${portType}"] .sbc-handle--source`)
    .first();
  const box = await handle.boundingBox();
  if (!box) throw new Error(`missing source handle ${nodeTestId}/${portType}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

test("desktop empty-drop opens chip picker and chip creates canonical route final", async ({ page }) => {
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });

  const targetPort = page.locator('[data-testid="node-outbound:direct"] [data-port-type="route"]');
  await expect(targetPort).not.toHaveClass(/is-compatible/);

  const canvasBox = await page.getByLabel("SBC visual canvas").boundingBox();
  if (!canvasBox) throw new Error("missing canvas");
  await startPortDrag(page, "node-route:main", "outbound");
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.38, { steps: 8 });

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

test("desktop empty-drop chip picker is bounded and clears the pending connection line", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await importInlineConfig(page, {
    dns: {
      rules: [{}],
      servers: [{ type: "https", tag: "remote-doh", server: "1.1.1.1" }],
    },
  });

  const canvasBox = await page.getByLabel("SBC visual canvas").boundingBox();
  if (!canvasBox) throw new Error("missing canvas");
  await startPortDrag(page, "node-dns:main", "dns-server");
  await page.mouse.move(canvasBox.x + canvasBox.width - 48, canvasBox.y + canvasBox.height - 24, { steps: 8 });
  await page.mouse.up();

  const picker = page.getByRole("dialog", { name: "Compatible nodes" });
  await expect(picker).toBeVisible();
  const metrics = await page.evaluate(() => {
    const canvas = document.querySelector('[aria-label="SBC visual canvas"]');
    const picker = document.querySelector(".chip-picker");
    const search = document.querySelector(".chip-picker__search");
    const list = document.querySelector(".chip-picker__list");
    const chipLine = document.querySelector(".chip-picker-link__path");
    const visibleConnectionLines = [...document.querySelectorAll(".react-flow__connection-path")].filter((path) => {
      const style = getComputedStyle(path);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0;
    }).length;
    const canvasRect = canvas?.getBoundingClientRect();
    const pickerRect = picker?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    return {
      visibleConnectionLines,
      canvas: canvasRect ? { right: canvasRect.right, bottom: canvasRect.bottom } : null,
      picker: pickerRect ? { width: pickerRect.width, right: pickerRect.right, bottom: pickerRect.bottom } : null,
      search: searchRect ? { width: searchRect.width, height: searchRect.height } : null,
      list: list ? { clientHeight: list.clientHeight, scrollHeight: list.scrollHeight } : null,
      chipLine: chipLine ? {
        visible: getComputedStyle(chipLine).display !== "none",
        dash: getComputedStyle(chipLine).strokeDasharray,
      } : null,
    };
  });

  expect(metrics.visibleConnectionLines).toBe(0);
  expect(metrics.chipLine).toMatchObject({ visible: true });
  expect(metrics.chipLine?.dash).not.toBe("none");
  expect(metrics.canvas).toBeTruthy();
  expect(metrics.picker).toBeTruthy();
  expect(metrics.search?.height ?? 0).toBeGreaterThan(24);
  expect(metrics.search?.width ?? 0).toBeGreaterThan(160);
  expect(metrics.list?.scrollHeight ?? 0).toBeGreaterThan(metrics.list?.clientHeight ?? 0);
  expect(metrics.picker!.right).toBeLessThanOrEqual(metrics.canvas!.right - 8);
  expect(metrics.picker!.bottom).toBeLessThanOrEqual(metrics.canvas!.bottom - 8);

  const beforeZoomPath = await page.locator(".chip-picker-link__path").getAttribute("d");
  const beforeZoomPickerWidth = metrics.picker!.width;
  const beforeZoomSearchWidth = metrics.search!.width;
  await page.locator(".react-flow__controls-zoomout").click();
  await page.waitForTimeout(180);
  const afterZoom = await page.evaluate(() => {
    const path = document.querySelector(".chip-picker-link__path");
    const handle = document.querySelector(
      '[data-testid="node-dns:main"] [data-port-type="dns-server"] .sbc-handle--source',
    );
    const picker = document.querySelector(".chip-picker");
    const search = document.querySelector(".chip-picker__search");
    const d = path?.getAttribute("d") ?? "";
    const start = d.match(/^M ([\d.-]+) ([\d.-]+)/);
    const matrix = path instanceof SVGGraphicsElement ? path.getScreenCTM() : null;
    const handleRect = handle?.getBoundingClientRect();
    const pickerRect = picker?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const lineStart = start && matrix
      ? new DOMPoint(Number(start[1]), Number(start[2])).matrixTransform(matrix)
      : null;
    return {
      d,
      pickerWidth: pickerRect?.width ?? 0,
      searchWidth: searchRect?.width ?? 0,
      lineStart: lineStart ? { x: lineStart.x, y: lineStart.y } : null,
      source: handleRect
        ? {
            x: handleRect.left + handleRect.width / 2,
            y: handleRect.top + handleRect.height / 2,
          }
        : null,
    };
  });
  expect(afterZoom.d).toBe(beforeZoomPath);
  expect(afterZoom.pickerWidth).toBeLessThan(beforeZoomPickerWidth);
  expect(afterZoom.searchWidth).toBeLessThan(beforeZoomSearchWidth);
  expect(afterZoom.lineStart).toBeTruthy();
  expect(afterZoom.source).toBeTruthy();
  expect(Math.abs(afterZoom.lineStart!.x - afterZoom.source!.x)).toBeLessThan(8);
  expect(Math.abs(afterZoom.lineStart!.y - afterZoom.source!.y)).toBeLessThan(8);
  await picker.getByRole("button", { name: "Local DNS", exact: true }).click();
  await expect(page.getByTestId("node-dns-server:local-dns")).toBeVisible();
});

test("desktop direct drop connects existing target without picker", async ({ page }) => {
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });

  // Start the drag, then MOVE (RF only marks compatible targets once the pointer moves) — that reveals
  // the compatible target port on `direct` (collapsed at rest). Then drop precisely onto it.
  await startPortDrag(page, "node-route:main", "outbound");
  const directNodeBox = await page.getByTestId("node-outbound:direct").boundingBox();
  if (!directNodeBox) throw new Error("missing direct node");
  await page.mouse.move(directNodeBox.x + directNodeBox.width / 2, directNodeBox.y + directNodeBox.height / 2, { steps: 8 });
  const targetPort = page.locator('[data-testid="node-outbound:direct"] [data-port-type="route"]');
  await expect(targetPort).toHaveClass(/is-compatible/);
  const targetBox = await targetPort.boundingBox();
  if (!targetBox) throw new Error("missing direct target port");
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 4 });
  await page.mouse.up();

  await expect(page.getByRole("dialog", { name: "Compatible nodes" })).toHaveCount(0);
  const config = await exportedConfig(page);
  expect(config.route.final).toBe("direct");
});

test("invalid drop cancels without mutation", async ({ page }) => {
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });
  const before = await exportedConfig(page);
  const canvasBox = await page.getByLabel("SBC visual canvas").boundingBox();
  if (!canvasBox) throw new Error("missing canvas");
  // An incompatible target port (direct's dns-detour) must NEVER become a drop target — under N1 it's an
  // unconnected port living in the hidden `.sbc-node__ports-extra` overlay and never marked compatible
  // during the drag, so an invalid edge can't be formed.
  const invalidPort = page.locator('[data-testid="node-outbound:direct"] [data-port-type="dns-detour"]');

  await startPortDrag(page, "node-route:main", "outbound");
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.38, { steps: 8 });
  expect(await invalidPort.evaluate((el) => Boolean(el.closest(".sbc-node__ports-extra")))).toBe(true);
  await expect(invalidPort).not.toHaveClass(/is-compatible/);
  await page.mouse.up();

  // Released on empty canvas → the create-picker may appear (never an invalid edge); dismiss it.
  const picker = page.getByRole("dialog", { name: "Compatible nodes" });
  if (await picker.count()) await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
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

// Reveal a hidden edge-remove control by moving the pointer onto the edge midpoint that sits beneath
// it (the button is pointer-events:none until hovered/selected — C2-7), then return its locator.
async function revealEdgeRemove(page: Page, name: string) {
  const button = page.getByRole("button", { name });
  await button.waitFor({ state: "attached" });
  // Fit the graph so the edge (and its midpoint button) is on-screen — the two nodes sit far apart and
  // the connected-only edge is perfectly horizontal (bbox height 0), so neither `.hover()` nor an
  // off-screen coordinate works. The button sits at the edge midpoint and is pointer-events:none until
  // revealed, so moving the cursor onto its own box falls through to the edge beneath → reveals it.
  await page.locator(".react-flow__controls-fitview").click();
  await page.waitForTimeout(220);
  const box = await button.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(button).toHaveCSS("pointer-events", "all");
  return button;
}

test("hidden edge-remove control cannot intercept canvas clicks until revealed (C2-7)", async ({ page }) => {
  await importInlineConfig(page, {
    route: { final: "direct" },
    outbounds: [{ type: "direct", tag: "direct" }],
  });

  const button = page.getByRole("button", { name: "Remove connection edge:route-final:direct" });
  // Hidden by default: invisible AND non-interactive, so it does not intercept clicks on the canvas.
  await expect(button).toHaveCSS("opacity", "0");
  await expect(button).toHaveCSS("pointer-events", "none");
  // Revealed once the edge under it is hovered.
  await revealEdgeRemove(page, "Remove connection edge:route-final:direct");
  await expect(button).toHaveCSS("opacity", "1");
});

test("connected edge remove button disconnects only canonical relation", async ({ page }) => {
  await importInlineConfig(page, {
    route: { final: "direct" },
    outbounds: [{ type: "direct", tag: "direct" }],
  });

  const button = await revealEdgeRemove(page, "Remove connection edge:route-final:direct");
  await button.click();

  const config = await exportedConfig(page);
  expect(config.route.final).toBeUndefined();
  expect(config.outbounds).toEqual([{ type: "direct", tag: "direct" }]);
  await expect(page.getByRole("button", { name: "Remove connection edge:route-final:direct" })).toHaveCount(0);
});

test("port '+' click opens the searchable picker and creates a connected downstream node (N2)", async ({ page }) => {
  // A bare route → its outbound/final port is unconnected, so it lives in the reveal overlay with a "+".
  await importInlineConfig(page, { route: {} });
  // Hover the node to reveal the overlay port, then click its "+".
  await page.getByTestId("node-route:main").hover();
  await page
    .locator('[data-testid="node-route:main"] [data-port-type="outbound"] button.sbc-port__add')
    .click();

  const picker = page.getByRole("dialog", { name: "Compatible nodes" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: /direct/i }).first().click();

  // The pick created a direct outbound and wired it as the route's final.
  const config = await exportedConfig(page);
  expect((config.outbounds ?? []).some((outbound: any) => outbound.type === "direct")).toBe(true);
  expect(config.route?.final).toBeTruthy();
  await expect(picker).toHaveCount(0);
});

test("plain-clicking a port handle never starts a sticky highlight (click-connect disabled)", async ({ page }) => {
  // Regression guard: with React Flow's connectOnClick default (true), a plain click on a source handle
  // started a sticky click-connection — it set pendingPort, lit every compatible port green
  // (is-compatible), and drew a pending connection line with no reliable way to clear it. With
  // click-connect disabled a plain click must be completely inert. Two compatible nodes (bare route +
  // direct outbound) so a real click-connect would have something to highlight.
  await importInlineConfig(page, { route: {}, outbounds: [{ type: "direct", tag: "direct" }] });

  await page.getByTestId("node-route:main").hover();
  const handle = page
    .locator('[data-testid="node-route:main"] [data-port-type="outbound"] .sbc-handle--source')
    .first();
  const box = await handle.boundingBox();
  if (!box) throw new Error("missing route source handle");
  // A click is mouse down+up in place (no move → not a drag).
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

  await expect(page.locator(".sbc-port.is-compatible")).toHaveCount(0);
  await expect(page.locator(".sbc-port.is-pending")).toHaveCount(0);
  await expect(page.locator(".react-flow__connection-path")).toHaveCount(0);
});
