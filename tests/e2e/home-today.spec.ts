import { expect, test } from "@playwright/test";

test("creates a memo, converts it to today's plan, and completes the plan", async ({
  page
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "快速记录" }).click();
  await page.getByLabel("快速记录内容").fill("晚上整理本周工作记录");
  await page.getByLabel("快速记录补充说明").fill("检查里程碑与工时");
  await page.getByRole("button", { name: "保存记录" }).click();

  await expect(page.getByText("记录已保存到本地")).toBeVisible();
  await expect(page.getByText("晚上整理本周工作记录")).toBeVisible();

  await page.getByRole("button", { name: "转为今日" }).last().click();
  await expect(page.getByText("已转为今日计划")).toBeVisible();
  await page.getByRole("link", { name: "今日计划", exact: true }).click();

  await expect(page.getByText("晚上整理本周工作记录")).toBeVisible();
  await page
    .locator(".today-row")
    .filter({ hasText: "晚上整理本周工作记录" })
    .getByRole("button", { name: "完成计划" })
    .click();
  await expect(
    page.getByRole("progressbar", { name: "今日计划完成度" })
  ).toHaveAttribute("aria-valuenow", "100");
});

test("adds a custom plan with time and survives a browser reload", async ({ page }) => {
  await page.goto("/today");
  const title = `下午复盘-${Date.now()}`;
  await page.getByLabel("添加今日事项").fill(title);
  await page.getByLabel("开始时间").fill("15:30");
  await page.getByRole("button", { name: "加入今天" }).click();

  await expect(page.getByText(title)).toBeVisible();
  await page.reload();
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText("15:30")).toBeVisible();
});

test("edits a memo and keeps the edited text after reload", async ({ page }) => {
  await page.goto("/");
  const original = `备忘编辑源-${Date.now()}`;
  const edited = `${original}-已修改`;
  await page.getByLabel("新增快速备忘").fill(original);
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.getByText(original, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: original, exact: true }).click();
  await page.getByLabel("编辑备忘内容").fill(edited);
  await page.getByRole("button", { name: "保存修改" }).click();
  await expect(page.getByText(edited, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(edited, { exact: true })).toBeVisible();
});
