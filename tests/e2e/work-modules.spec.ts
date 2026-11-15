import { expect, test } from "@playwright/test";

test("creates a development project with item, milestone and work log", async ({ page }) => {
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

  await page.reload();
  await expect(page.getByText("实现首页汇总")).toBeVisible();
  await expect(milestonePanel.getByText("第一版验收")).toBeVisible();
});

test("creates a consulting client, project, session and action", async ({ page }) => {
  await page.goto("/consulting");
  await page.getByRole("button", { name: "添加第一个客户" }).click();
  await page.getByLabel("称呼").fill("林先生");
  await page.getByLabel("咨询方向").fill("产品咨询");
  await page.getByRole("button", { name: "保存客户" }).click();
  await expect(
    page.locator(".client-panel").getByRole("button", { name: /林先生/ })
  ).toBeVisible();

  await page.getByRole("button", { name: "新建项目" }).click();
  await page.getByLabel("项目名称").fill("产品方向复盘");
  await page.getByLabel("目标或问题").fill("确认下一阶段方向");
  await page.getByRole("button", { name: "保存咨询项目" }).click();
  await expect(page.getByRole("heading", { name: "产品方向复盘" })).toBeVisible();

  const sessionPanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "咨询记录" })
  });
  await sessionPanel.getByRole("button", { name: "记录" }).click();
  await page.getByLabel("议题").fill("产品方向讨论");
  await page.getByLabel("结论").fill("确定下一阶段测试方案");
  await page.getByRole("button", { name: "保存咨询记录" }).click();
  await expect(page.getByText("产品方向讨论")).toBeVisible();

  const actionPanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "行动项" })
  });
  await actionPanel.getByRole("button", { name: "添加" }).click();
  await page.getByRole("textbox", { name: "行动项", exact: true }).fill("发送会议材料");
  await page.getByLabel("负责人").fill("我");
  await page.getByRole("button", { name: "保存行动项" }).click();
  await expect(page.getByText("发送会议材料")).toBeVisible();

  await page.reload();
  await expect(page.getByText("产品方向讨论")).toBeVisible();
  await expect(page.getByText("发送会议材料")).toBeVisible();
});
