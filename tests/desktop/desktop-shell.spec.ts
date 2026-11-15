import path from "node:path";
import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { createTemporaryRoot, launchTestDesktop } from "./desktop-helpers";

test("starts as a desktop window and creates local data", async () => {
  const temporaryRoot = createTemporaryRoot("personal-life-hub-desktop-");
  const { desktop, dataDir } = await launchTestDesktop({ temporaryRoot });

  try {
    const page = await desktop.firstWindow();
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await expect(page).toHaveTitle(/个人工作生活/);
    await expect(page.getByText("欢迎使用个人工作生活")).toBeVisible();
    await page.getByRole("button", { name: "开始使用" }).click();
    await expect(page.getByText("欢迎使用个人工作生活")).toBeHidden();
    await expect(page.getByRole("link", { name: "首页" })).toBeVisible();
    await expect(page.getByText("今日计划", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("本地文件已连接")).toBeVisible();
    expect(fs.existsSync(path.join(dataDir, "app.db"))).toBe(true);
    expect(
      fs.readdirSync(path.join(dataDir, "backups")).some((file) => file.endsWith(".zip"))
    ).toBe(true);
    const applicationUrl = new URL(page.url());
    expect(applicationUrl.hostname).toBe("127.0.0.1");
    expect(applicationUrl.port).not.toBe("4317");
    expect(
      requests.every((value) => {
        const url = new URL(value);
        return (
          (url.protocol === "http:" && url.hostname === "127.0.0.1") ||
          url.protocol === "data:" ||
          url.protocol === "blob:"
        );
      })
    ).toBe(true);

    const closed = desktop.waitForEvent("close");
    await desktop.evaluate(({ app }) => app.quit());
    await closed;

    const secondRun = await launchTestDesktop({ temporaryRoot, dataDir });
    try {
      const secondPage = await secondRun.desktop.firstWindow();
      await expect(secondPage.getByText("欢迎使用个人工作生活")).toBeHidden();
      await secondPage.getByRole("link", { name: "数据与设置" }).click();
      await expect(secondPage.getByRole("heading", { name: "桌面版" })).toBeVisible();
      await expect(secondPage.getByRole("button", { name: "打开数据文件夹" })).toBeVisible();
      await expect(secondPage.getByRole("button", { name: "退出软件" })).toBeVisible();
      await expect(secondPage.getByText(/v2\.2\.0/)).toBeVisible();
    } finally {
      await secondRun.desktop.close();
    }
  } finally {
    await desktop.close().catch(() => undefined);
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("reuses the existing desktop instance", async () => {
  const temporaryRoot = createTemporaryRoot("personal-life-hub-single-instance-");
  const firstRun = await launchTestDesktop({ temporaryRoot });
  let secondRun:
    | Awaited<ReturnType<typeof launchTestDesktop>>
    | undefined;
  let secondLaunchError: unknown;

  try {
    const firstPage = await firstRun.desktop.firstWindow();
    await firstPage.getByRole("button", { name: "开始使用" }).click();

    try {
      secondRun = await launchTestDesktop({ temporaryRoot });
    } catch (error) {
      secondLaunchError = error;
    }
    if (secondRun) {
      await expect
        .poll(() => secondRun!.desktop.windows().length, { timeout: 3_000 })
        .toBe(0);
    } else {
      expect(secondLaunchError).toBeDefined();
    }

    await expect(firstPage.getByRole("link", { name: "首页" })).toBeVisible();
    expect(firstRun.desktop.windows()).toHaveLength(1);
  } finally {
    if (secondRun) {
      await secondRun.desktop.close().catch(() => undefined);
    }
    await firstRun.desktop.close().catch(() => undefined);
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("quits safely from the desktop settings controls", async () => {
  const temporaryRoot = createTemporaryRoot("personal-life-hub-quit-");
  const { desktop, dataDir } = await launchTestDesktop({ temporaryRoot });

  try {
    const page = await desktop.firstWindow();
    await page.getByRole("button", { name: "开始使用" }).click();
    await page.getByRole("link", { name: "数据与设置" }).click();
    await page.getByRole("button", { name: "退出软件" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const closed = desktop.waitForEvent("close");
    await dialog.getByRole("button", { name: "退出软件" }).click();
    await closed;
    expect(fs.existsSync(path.join(dataDir, "app.db"))).toBe(true);
  } finally {
    await desktop.close().catch(() => undefined);
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("keeps records after the desktop app closes and opens again", async () => {
  const temporaryRoot = createTemporaryRoot("personal-life-hub-restart-");
  let firstRun:
    | Awaited<ReturnType<typeof launchTestDesktop>>
    | undefined;

  try {
    firstRun = await launchTestDesktop({ temporaryRoot });
    const firstPage = await firstRun.desktop.firstWindow();
    await firstPage.getByRole("button", { name: "开始使用" }).click();
    await firstPage.getByRole("button", { name: "快速记录" }).click();
    await firstPage.getByLabel("快速记录内容").fill("桌面版重启后仍在");
    await firstPage.getByRole("button", { name: "保存记录" }).click();
    await expect(firstPage.getByText("桌面版重启后仍在")).toBeVisible();
    const closed = firstRun.desktop.waitForEvent("close");
    await firstRun.desktop.evaluate(({ app }) => app.quit());
    await closed;
    firstRun = undefined;

    const secondRun = await launchTestDesktop({
      temporaryRoot,
      dataDir: firstRunDataDir(temporaryRoot)
    });
    try {
      const secondPage = await secondRun.desktop.firstWindow();
      await expect(secondPage.getByText("桌面版重启后仍在")).toBeVisible();
    } finally {
      await secondRun.desktop.close();
    }
  } finally {
    if (firstRun) {
      await firstRun.desktop.close().catch(() => undefined);
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

function firstRunDataDir(temporaryRoot: string): string {
  return path.join(temporaryRoot, "data");
}
