import { expect, test } from "@playwright/test";

test("saves preferences and restores data from a manual local backup", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("个人数据文件独立保存在当前电脑")).toBeVisible();

  await page.getByLabel("保留最近备份数").fill("12");
  await page.getByLabel("每日饮水目标（ml）").fill("2500");
  await page.getByLabel("默认启动页面").selectOption("/today");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect(page.getByText("设置已保存")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/today$/);
  await page.goto("/settings");
  await page.getByLabel("默认启动页面").selectOption("/");
  await page.getByRole("button", { name: "保存设置" }).click();

  await page.goto("/");
  await page.getByRole("button", { name: "快速记录" }).click();
  await page.getByLabel("快速记录内容").fill("备份恢复验证事项");
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(page.getByText("备份恢复验证事项")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "立即备份" }).click();
  await expect(page.getByText("手动备份").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "删除备忘：备份恢复验证事项" }).click();
  await expect(page.getByText("备份恢复验证事项")).toBeHidden();

  await page.goto("/settings");
  const manualBackup = page.locator(".backup-row").filter({ hasText: "手动备份" }).first();
  await manualBackup.getByRole("button", { name: "恢复" }).click();
  await page.getByRole("button", { name: "恢复备份" }).click();
  await expect(page.getByText("备份已恢复")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("备份恢复验证事项")).toBeVisible();
});

test("requires the exact confirmation phrase before clearing all data", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "清空全部数据" }).click();
  const confirm = page.getByRole("button", { name: "确认清空" });
  await expect(confirm).toBeDisabled();
  await page.getByLabel("清空确认文字").fill("清空全部数据");
  await expect(confirm).toBeEnabled();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("button", { name: "确认清空" })).toBeHidden();
});
