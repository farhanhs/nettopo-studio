import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const screenshotDir = "docs/dev測試紀錄/screenshots";

async function enterDemo(page: import("@playwright/test").Page) {
  await page.goto("/");
  const demoButton = page.getByRole("button", { name: "進入本機 Demo" });
  await expect(demoButton).toBeVisible();
  await demoButton.click();
  await expect(page.locator(".flow-link-overlay")).toBeVisible();
  await expect(page.locator(".flow-link-overlay g.flow-link").first()).toBeVisible();
}

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("QA_UIX_001 browser evidence: rendered routing overlay exposes resolved wired and wireless classes", async ({ page }) => {
  await enterDemo(page);

  const overlay = page.locator(".flow-link-overlay");
  const resolvedWired = overlay.locator('g.flow-link.orthogonal.resolved[data-route-kind="orthogonal"][data-route-status="resolved"]');
  await expect(resolvedWired.first()).toBeVisible();

  const firstPath = await resolvedWired.first().locator("path.visible-line").getAttribute("d");
  expect(firstPath ?? "").toContain("L");
  expect(firstPath ?? "").not.toMatch(/^M\s+[-\d.]+\s+[-\d.]+\s+L\s+[-\d.]+\s+[-\d.]+$/);

  const wireless = overlay.locator('g.flow-link.wireless.resolved[data-route-kind="wireless"][data-route-status="resolved"]');
  const wirelessCount = await wireless.count();
  if (wirelessCount > 0) {
    await expect(wireless.first()).toBeVisible();
    await expect(wireless.first().locator("path.visible-line")).toHaveCSS("stroke-dasharray", /8px, 6px|8 6/);
  }

  await page.screenshot({
    path: `${screenshotDir}/qa-uix-001-routing-overlay.png`,
    fullPage: true,
  });
});

test("QA_UIX_001 browser evidence: selecting a link makes the stroke visibly stronger", async ({ page }) => {
  await enterDemo(page);

  await page.getByRole("button", { name: "連線" }).click();
  await page.locator(".link-row").first().click();

  const link = page.locator(".flow-link-overlay g.flow-link.selected").first();
  await expect(link).toHaveClass(/selected/);
  await expect(link.locator("path.visible-line")).toHaveCSS("stroke-width", "5.4px");
  await expect(link.locator("path.selection-line")).toHaveCount(1);
  await expect(link.locator("path.selection-line")).toHaveCSS("stroke-width", "11px");
  await expect(link.locator("path.hit-line")).toHaveCSS("stroke-width", "22px");

  await page.screenshot({
    path: `${screenshotDir}/qa-uix-001-selected-link.png`,
    fullPage: true,
  });
});
