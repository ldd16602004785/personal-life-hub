import { expect, test } from "@playwright/test";

test("creates a development project and does not re-arrange the same item", async ({ page }) => {
  await page.goto("/dev");
  await page.getByRole("button", { name: "创建第一个项目" }).click();
  await page.getByLabel("项目名称").fill("个人工作台");
  await page.getByLabel("项目说明").fill("开发本地数据与页面");
  await page.getByRole("button", { name: "保存项目" }).click();
  await expect(page.getByLabel("当前开发项目")).toHaveValue(/.+/);

  await page.getByRole("button", { name: "新增事项" }).click();
  await page.getByLabel("标题").fill("实现首页汇总");
  await page.getByLabel("类型").selectOption("feature");
  await page.getByLabel("优先级").selectOption("high");
  await page.getByRole("button", { name: "保存事项" }).click();
  await expect(page.getByText("实现首页汇总")).toBeVisible();

  await page.getByRole("button", { name: "安排", exact: true }).click();
  await expect(page.getByRole("button", { name: "已安排", exact: true })).toBeDisabled();
  await expect(page.getByText("保存没有完成")).toBeHidden();
  await page.goto("/today");
  await expect(
    page.locator(".today-row").filter({ hasText: "实现首页汇总" })
  ).toBeVisible();
  await page.goto("/dev");

  const milestonePanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "里程碑" })
  });
  await milestonePanel.getByRole("button", { name: "添加" }).click();
  await page.getByLabel("里程碑名称").fill("第一版验收");
  await page.getByRole("button", { name: "保存里程碑" }).click();
  await expect(milestonePanel.getByText("第一版验收")).toBeVisible();

  const timePanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "工时记录" })
  });
  await timePanel.getByRole("button", { name: "记录" }).click();
  await page.getByLabel("投入分钟").fill("90");
  await page.getByLabel("说明").fill("完成数据接口");
  await page.getByRole("button", { name: "保存工时" }).click();
  await expect(timePanel.getByText("1.5 小时")).toBeVisible();
});

test("creates a learning goal, stage, task and progress log", async ({ page }) => {
  await page.goto("/learning");
  await page.getByRole("button", { name: "创建第一个目标" }).click();
  await page.getByRole("textbox", { name: "学习目标", exact: true }).fill("掌握 TypeScript");
  await page.getByLabel("目标说明").fill("完成类型系统与项目实践");
  await page.getByLabel("分类").fill("技能");
  await page.getByRole("button", { name: "保存学习目标" }).click();
  await expect(page.getByRole("heading", { name: "掌握 TypeScript" })).toBeVisible();

  await page.getByRole("button", { name: "添加阶段" }).click();
  await page.getByLabel("阶段或章节名称").fill("基础语法");
  await page.getByRole("button", { name: "保存学习阶段" }).click();
  await expect(page.getByText("基础语法", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByRole("textbox", { name: "学习任务", exact: true }).fill("完成类型系统练习");
  await page.getByLabel("预计分钟").fill("45");
  await page.getByRole("button", { name: "保存学习任务" }).click();
  await expect(page.getByText("完成类型系统练习")).toBeVisible();

  await page.getByRole("button", { name: "记录学习" }).click();
  await page.getByLabel("学习分钟").fill("45");
  await page.getByLabel("学习后进度").fill("35");
  await page.getByLabel("学习内容与收获").fill("完成泛型练习");
  await page.getByRole("button", { name: "保存学习记录" }).click();
  await expect(page.getByText("35%").first()).toBeVisible();
  await expect(page.getByText("完成泛型练习")).toBeVisible();
});
