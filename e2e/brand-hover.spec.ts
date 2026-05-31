import { expect, test } from "@playwright/test";

// The brand toggle highlight (#292B2D) must appear ONLY while hovering the clickable [logo·sbcv·chevron]
// region — not the global `button:hover` color, and not persistently while the menu is open.
// Two bugs this guards:
//  1. The global `button:hover:not(:disabled){background:#171d24}` (specificity 0,2,1) overrode
//     `.brand:hover{#292B2D}` (0,2,0), so hovering the toggle settled on the wrong dark color.
//  2. `.brand--open` kept the toggle highlighted even when the pointer was elsewhere (read as "hovering
//     other parts of the bar highlights the toggle").
// `toHaveCSS` auto-retries, so it waits out the 120ms background transition.

const HIGHLIGHT = "rgb(41, 43, 45)"; // #292B2D
const TRANSPARENT = "rgba(0, 0, 0, 0)";

test("brand toggle highlights with #292B2D only while hovering the toggle region", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const brand = page.locator(".brand");
  const toggle = page.getByTestId("brand-menu-toggle");
  const tagline = page.getByText("sing-box configuration visualizer", { exact: true });

  // Rest: no highlight.
  await page.mouse.move(5, 5);
  await expect(brand).toHaveCSS("background-color", TRANSPARENT);

  // Hover the toggle → the intended #292B2D (NOT the global button-hover #171d24).
  await toggle.hover();
  await expect(brand).toHaveCSS("background-color", HIGHLIGHT);

  // Hover the non-clickable tagline → toggle is NOT highlighted.
  await tagline.hover();
  await expect(brand).toHaveCSS("background-color", TRANSPARENT);

  // Open the menu, then move the pointer away → the toggle does not stay highlighted when not hovered.
  // NOTE: here the assertion target (TRANSPARENT) equals the *start* of the hover-release transition, so
  // `toHaveCSS` would greedily match the opening transient frame and pass even with the bug present. Wait
  // out the 120ms transition and read the SETTLED background once, so a regressed `.brand--open` fill
  // (which holds the toggle at #292B2D) is actually caught.
  await toggle.click();
  await expect(page.getByRole("menu", { name: /sbcv\.app menu/i })).toBeVisible();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(220);
  const openAwayBg = await brand.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(openAwayBg).toBe(TRANSPARENT);
});
