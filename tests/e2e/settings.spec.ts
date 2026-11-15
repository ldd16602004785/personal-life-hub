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

test("applies all four global font sizes and keeps the selection", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByLabel("界面字号").locator("option")).toHaveText([
    "小",
    "中",
    "大",
    "特大"
  ]);
  const before = await page.locator(".nav-item").first().evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize)
  );
  await page.getByLabel("界面字号").selectOption("large");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect
    .poll(() =>
      page.locator(".nav-item").first().evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize)
      )
    )
    .toBeGreaterThan(before);
  await page.reload();
  await expect(page.getByLabel("界面字号")).toHaveValue("large");

  await page.getByLabel("界面字号").selectOption("small");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.fontSize))
    .toBe("small");
});

test("reports an invalid backup with a specific error message", async ({ page }) => {
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles({
    name: "broken.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a backup")
  });
  await expect(
    page.locator(".toast").getByText("导入文件不是有效的备份压缩包")
  ).toBeVisible();
});

test("switches all home themes and applies night mode across the app", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByLabel("首页主题").locator("option")).toHaveText([
    "标准",
    "天气氛围",
    "Notion 笔记",
    "一二和布布"
  ]);

  await page.getByLabel("首页主题").selectOption("weather");
  await page.getByLabel("夜间模式").check();
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.homeTheme))
    .toBe("weather");
  expect(
    await page.evaluate(() => document.documentElement.style.colorScheme)
  ).toBe("dark");

  await page.goto("/");
  await expect(page.locator(".weather-home-hero")).toBeVisible();
  await page.reload();
  expect(
    await page.evaluate(() => document.documentElement.style.colorScheme)
  ).toBe("dark");

  await page.goto("/settings");
  await page.getByLabel("首页主题").selectOption("notion");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.homeTheme))
    .toBe("notion");
  await page.goto("/");
  await expect(page.locator(".notion-database")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "模块" })).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel("首页主题").selectOption("bubu");
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.homeTheme))
    .toBe("bubu");
  await page.goto("/");
  await expect(
    page.getByRole("img", { name: "一二和布布背着包一起散步" })
  ).toBeVisible();

  await page.goto("/settings");
  await page.getByLabel("首页主题").selectOption("standard");
  await page.getByLabel("夜间模式").uncheck();
  await page.getByRole("button", { name: "保存设置" }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.homeTheme))
    .toBe("standard");
});
