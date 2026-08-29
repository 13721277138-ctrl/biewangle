import { expect, test } from "@playwright/test";

test("vertical slice: direct start, three states, temporary item, truthful close", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("别忘了 · 安心检查");
  await expect(
    page.getByRole("heading", { name: "今天，有什么要确认的？" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "开始 日常出门" }).click();
  await expect(page).toHaveURL(/\/runs\/run\./);
  await page.getByRole("button", { name: "确认 手机" }).click();
  await expect(page.getByRole("button", { name: "确认 手机" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "本次不需要 雨伞" }).click();
  await expect(
    page.getByRole("button", { name: "本次不需要 雨伞" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("临时项目").fill("门窗复查");
  await page.getByRole("button", { name: "加入本次" }).click();
  await expect(page.getByText("门窗复查", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "完成检查" }).click();
  await expect(page.getByText(/仍有\d+项未确认/)).toBeVisible();
  await page.getByRole("button", { name: "结束并保留" }).click();
  await expect(
    page.getByRole("button", { name: "确认仍然结束" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认仍然结束" }).click();
  await expect(
    page.getByRole("heading", { name: "本次检查已结束" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "查看历史" }).click();
  await expect(page.getByRole("heading", { name: "检查历史" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "日常出门" })).toBeVisible();
  await expect(page.getByText(/\d+ 项未确认 · \d+ 项关键/)).toBeVisible();
});
