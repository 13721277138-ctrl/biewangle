import { expect, test } from "@playwright/test";

test("full v1: personal template, private run note, truthful history, backup and restore", async ({
  page,
}) => {
  await page.goto("./templates/new");
  await page.getByLabel("模板名称").fill("晨间出门");
  await page.getByLabel("检查项（每行一项）").fill("钥匙\n耳机\n水杯");
  await page.getByRole("button", { name: "保存个人模板" }).click();
  const personalCard = page.getByTestId("personal-template-card");
  await expect(personalCard).toContainText("晨间出门");

  await personalCard.getByRole("button", { name: "开始 晨间出门" }).click();
  await expect(page.getByRole("heading", { name: "晨间出门" })).toBeVisible();
  await page.getByText("备注与本次排序").first().click();
  await page.locator(".run-item-tools textarea").first().fill("这条备注不应默认外发");
  await page.getByRole("button", { name: "保存备注" }).first().click();
  await page.getByRole("button", { name: "确认 钥匙" }).click();
  await page.getByRole("button", { name: "完成检查" }).click();
  await page.getByRole("button", { name: "结束并保留" }).click();
  await expect(page.getByRole("heading", { name: "本次检查已结束" })).toBeVisible();
  await page.getByRole("link", { name: "查看本次事实" }).click();
  await expect(page.getByRole("heading", { name: "关闭事件" })).toBeVisible();

  await page.getByRole("link", { name: "分享预览" }).click();
  await expect(page.getByTestId("share-preview")).not.toContainText(
    "这条备注不应默认外发",
  );
  await expect(page.getByText(/默认不包含本次备注/)).toBeVisible();

  await page.goto("./data");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载完整备份" }).click();
  const backup = await downloadPromise;
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();

  await page.getByLabel("输入“全部重置”确认").fill("全部重置");
  await page.getByRole("button", { name: "执行全部重置" }).click();
  await expect(page.getByText(/已重置当前设备数据/)).toBeVisible();
  await page.goto("./templates");
  await expect(page.getByText("晨间出门", { exact: true })).toHaveCount(0);

  await page.goto("./data");
  await page.getByLabel("选择备份文件").setInputFiles(backupPath!);
  await expect(page.getByText("文件已通过校验，尚未恢复")).toBeVisible();
  await page.getByRole("button", { name: "确认整体恢复" }).click();
  await expect(page.getByText("恢复完成，已替换当前本地数据。" )).toBeVisible();
  await page.goto("./templates");
  await expect(page.getByTestId("personal-template-card")).toContainText("晨间出门");
});
