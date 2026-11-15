import { expect, test } from "@playwright/test";

test("data remains after clearing browser storage and opening a fresh browser context", async ({
  browser,
  page
}) => {
  const content = `跨浏览器上下文保留-${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "快速记录" }).click();
  await page.getByLabel("快速记录内容").fill(content);
  await page.getByRole("button", { name: "保存记录" }).click();
  await expect(page.getByText(content)).toBeVisible();

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.getByText(content)).toBeVisible();

  const freshContext = await browser.newContext();
  const freshPage = await freshContext.newPage();
  await freshPage.goto("http://127.0.0.1:4320/");
  await expect(freshPage.getByText(content)).toBeVisible();
  await freshContext.close();
});

test("all runtime requests stay inside the local application origin", async ({ page }) => {
  const externalRequests: string[] = [];
  const runtimeErrors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith("http") && url.hostname !== "127.0.0.1") {
      externalRequests.push(request.url());
    }
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });

  for (const route of ["/", "/care", "/dev", "/learning", "/fitness", "/diet", "/entertainment", "/settings"]) {
    await page.goto(`http://127.0.0.1:4320${route}`);
    await expect(page.locator("main")).toBeVisible();
  }

  expect(externalRequests).toEqual([]);
  expect(runtimeErrors).toEqual([]);
});

test("the application remains usable at the minimum desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "快速记录" })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth);
});
