import { expect, test } from "@playwright/test";

test("offline cold start resumes the durable run from IndexedDB and precache", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始 日常出门" }).click();
  await page.getByRole("button", { name: "确认 手机" }).click();
  await expect(page.getByRole("button", { name: "确认 手机" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "确认 手机" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByRole("heading", { name: "日常出门" })).toBeVisible();
    await expect(page.getByRole("button", { name: "确认 手机" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("每步自动保存")).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
