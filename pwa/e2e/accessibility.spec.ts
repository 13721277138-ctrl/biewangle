import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("accessibility: primary pages have no WCAG A/AA violations", async ({ page }) => {
  for (const route of ["/", "/templates", "/templates/new", "/plans", "/history", "/data", "/settings"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(
      results.violations,
      `${route}: ${results.violations.map((violation) => violation.id).join(", ")}`,
    ).toEqual([]);
  }
});

test("accessibility: keyboard focus is visible and reduced-motion disables transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator(".brand").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus-visible")).toBeVisible();
  const motion = await page.locator(".continue-card, .template-card").first().evaluate((node) => {
    const style = getComputedStyle(node);
    return { animationDuration: style.animationDuration, transitionDuration: style.transitionDuration };
  });
  const milliseconds = (value: string) =>
    value.endsWith("ms") ? Number.parseFloat(value) : Number.parseFloat(value) * 1000;
  expect(milliseconds(motion.animationDuration)).toBeLessThanOrEqual(0.011);
  expect(milliseconds(motion.transitionDuration)).toBeLessThanOrEqual(0.011);
});
