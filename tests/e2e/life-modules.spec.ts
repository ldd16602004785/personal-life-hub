import { expect, test } from "@playwright/test";

test("creates a workout template, starts it and records actual training", async ({ page }) => {
  await page.goto("/fitness");
  await page.getByRole("button", { name: "新建训练" }).click();
  await page.getByLabel("训练名称").fill("下肢力量");
  await page.getByLabel("训练部位").fill("下肢");
  await page.getByLabel("动作 1 名称").fill("杠铃深蹲");
  await page.getByLabel("动作 1 组数").fill("4");
  await page.getByLabel("动作 1 次数").fill("8");
  await page.getByLabel("动作 1 重量").fill("60");
  await page.getByRole("button", { name: "保存训练模板" }).click();
  await expect(page.getByText("下肢力量", { exact: true }).first()).toBeVisible();

  await page.locator(".template-row").filter({ hasText: "下肢力量" }).getByRole("button", { name: "开始" }).click();
  await expect(page.getByText("最近一次训练")).toBeVisible();
  await page.getByLabel("杠铃深蹲实际组数").fill("4");
  await page.getByLabel("杠铃深蹲实际次数").fill("8");
  await page.getByLabel("杠铃深蹲实际重量").fill("62.5");
  await page.getByRole("button", { name: "完成杠铃深蹲" }).click();
  await page.getByRole("button", { name: "完成训练" }).click();
  await expect(page.getByText("已完成").first()).toBeVisible();

  const metricPanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "身体记录" })
  });
  await metricPanel.getByRole("button", { name: "记录", exact: true }).click();
  await page.getByLabel("体重（kg）").fill("70.8");
  await page.getByRole("button", { name: "保存身体记录" }).click();
  await expect(metricPanel.getByText("70.8 kg")).toBeVisible();
});

test("records meals, water and shopping", async ({ page }) => {
  await page.goto("/diet");
  const breakfast = page.locator(".meal-card").filter({ hasText: "早餐" });
  await breakfast.getByRole("button", { name: "添加计划" }).click();
  await page.getByLabel("计划吃什么").fill("燕麦、鸡蛋、牛奶");
  await page.getByRole("button", { name: "保存餐食计划" }).click();
  await expect(page.getByText("计划：燕麦、鸡蛋、牛奶")).toBeVisible();

  await breakfast.getByRole("button", { name: "记录实际" }).click();
  await page.getByLabel("实际吃了什么").fill("燕麦和鸡蛋");
  await page.getByLabel("感受").fill("状态不错");
  await page.getByRole("button", { name: "保存用餐记录" }).click();
  await expect(page.getByText("实际：燕麦和鸡蛋")).toBeVisible();

  await page.getByRole("button", { name: "记录 250 ml" }).click();
  await expect(page.getByText("250 / 2000 ml")).toBeVisible();

  await page.getByRole("button", { name: "添加" }).last().click();
  await page.getByLabel("采购内容").fill("香蕉");
  await page.getByRole("button", { name: "添加到采购清单" }).click();
  await expect(page.getByText("香蕉", { exact: true })).toBeVisible();
});

test("tracks entertainment status, duration and progress", async ({ page }) => {
  await page.goto("/entertainment");
  await page.getByRole("button", { name: "添加项目" }).click();
  await page.getByLabel("类型").selectOption("game");
  await page.getByLabel("名称").fill("测试游戏");
  await page.getByLabel("当前进度").fill("30");
  await page.getByLabel("状态").selectOption("active");
  await page.getByRole("button", { name: "保存娱乐项目" }).click();
  await expect(page.getByText("测试游戏", { exact: true })).toBeVisible();

  const card = page.locator(".media-card").filter({ hasText: "测试游戏" });
  await card.getByRole("button", { name: "记录" }).click();
  await page.getByLabel("时长（分钟）").fill("90");
  await page.getByLabel("记录后进度").fill("62");
  await page.getByLabel("本次感受").fill("推进了一章");
  await page.getByRole("button", { name: "保存体验记录" }).click();
  await expect(card.getByText("62% ·").first()).toBeVisible();

  await page.reload();
  await expect(card.getByText("测试游戏", { exact: true })).toBeVisible();
  await expect(card.getByText("62% ·", { exact: false })).toBeVisible();
});
