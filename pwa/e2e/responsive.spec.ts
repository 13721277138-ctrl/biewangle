import { expect, test } from "@playwright/test";

const mobileViewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

for (const viewport of mobileViewports) {
  test(`responsive: ${viewport.width}px has no overflow and touch navigation remains reachable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const route of ["./", "./templates", "./templates/new", "./data"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
    }
    await expect(page.locator(".bottom-nav")).toBeVisible();
    const targets = await page.locator(".bottom-nav a").evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().height)),
    );
    expect(targets.every((height) => height >= 44)).toBe(true);
  });
}

test("responsive: desktop exposes management columns instead of stretching the phone layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [route, selector] of [
    ["./templates", ".management-layout"],
    ["./templates/new", ".editor-layout"],
    ["./data", ".data-management-layout"],
  ] as const) {
    await page.goto(route);
    const columns = await page.locator(selector).evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length,
    );
    expect(columns).toBeGreaterThanOrEqual(2);
  }
  await expect(page.locator(".desktop-sidebar")).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeHidden();
});
