import { expect, test } from "@playwright/test";

const pages = [
  ["首页", "/"],
  ["今日计划", "/today"],
  ["关怀对象", "/care"],
  ["开发工作", "/dev"],
  ["咨询工作", "/consulting"],
  ["健身计划", "/fitness"],
  ["饮食计划", "/diet"],
  ["游戏娱乐", "/entertainment"],
  ["数据与设置", "/settings"]
] as const;

test("navigates all nine pages without a full reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("本地文件已连接")).toBeVisible();

  for (const [label, route] of pages) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route === "/" ? "/$" : `${route}$`}`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("opens quick capture with every first-version destination", async ({ page }) => {
  await page.goto("/fitness");
  await page.getByRole("button", { name: "快速记录" }).click();
  await expect(page.getByRole("dialog", { name: "快速记录" })).toBeVisible();

  const select = page.getByLabel("记录模块");
  const expected = [
    "快速备忘",
    "今日计划",
    "关怀对象",
    "开发工作",
    "咨询工作",
    "健身计划",
    "饮食计划",
    "游戏娱乐"
  ];
  await expect(select.locator("option")).toHaveText(expected);
  await select.selectOption("care");
  await expect(page.getByLabel("快速记录内容")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "快速记录" })).toBeHidden();
});
