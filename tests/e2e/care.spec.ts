import { expect, test } from "@playwright/test";

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00
]);

test("creates care profile, anniversary and photo story", async ({ page }) => {
  await page.goto("/care");
  await page.getByRole("button", { name: "添加对象资料" }).first().click();
  await page.getByLabel("称呼").fill("小满");
  await page.getByLabel("关系阶段").fill("恋爱中");
  await page.getByLabel("关系开始日期").fill("2024-12-02");
  await page.getByLabel("简短介绍").fill("喜欢散步和热可可");
  await page.getByRole("button", { name: "保存资料" }).click();
  await expect(page.getByText("小满", { exact: true })).toBeVisible();

  const datePanel = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "重要日子" })
  });
  await datePanel.getByRole("button", { name: "添加" }).click();
  await page.getByLabel("日期名称").fill("在一起纪念日");
  await page.getByLabel("日期", { exact: true }).fill("2024-12-02");
  await page.getByLabel("提前关注天数").fill("30");
  await page.getByRole("button", { name: "保存日期" }).click();
  await expect(
    datePanel.getByText("在一起纪念日", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "记录趣事" }).click();
  await page.getByLabel("标题").fill("第一次一起做晚饭");
  await page.getByLabel("发生了什么").fill("盐放多了一点，但下次还想一起做。");
  await page.getByLabel("地点").fill("家里");
  await page.getByLabel("场景标签").fill("日常");
  await page.getByLabel("照片（可选）").setInputFiles({
    name: "dinner.png",
    mimeType: "image/png",
    buffer: pngBytes
  });
  await page.getByRole("button", { name: "保存趣事" }).click();
  await expect(page.getByText("第一次一起做晚饭")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "趣事照片：第一次一起做晚饭" })
  ).toBeVisible();

  await page.reload();
  await expect(page.getByText("第一次一起做晚饭")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "趣事照片：第一次一起做晚饭" })
  ).toBeVisible();
});
