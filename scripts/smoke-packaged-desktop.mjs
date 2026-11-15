import assert from "node:assert/strict";
import console from "node:console";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { _electron as electron, expect } from "@playwright/test";

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const executablePath = path.join(
  root,
  "release",
  `个人工作生活-Windows-v${packageJson.version}`,
  "个人工作生活.exe"
);
const releaseRoot = path.dirname(executablePath);
const zipPath = path.join(
  root,
  "release",
  `个人工作生活-Windows-v${packageJson.version}.zip`
);

assert.ok(
  fs.existsSync(executablePath),
  `没有找到打包后的 EXE：${executablePath}`
);
assert.ok(fs.existsSync(zipPath), `没有找到发布压缩包：${zipPath}`);
assert.ok(
  fs.existsSync(path.join(releaseRoot, "使用说明.txt")),
  "发布包缺少使用说明"
);
assert.ok(
  fs.existsSync(path.join(releaseRoot, "data", "attachments")),
  "发布包缺少空白附件目录"
);
assert.ok(
  fs.existsSync(path.join(releaseRoot, "data", "backups")),
  "发布包缺少空白备份目录"
);
assert.ok(
  fs.existsSync(path.join(releaseRoot, "resources", "app.asar")),
  "发布包缺少 ASAR 应用资源"
);

const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "personal-life-hub-packaged-")
);
const dataDir = path.join(temporaryRoot, "data");
let desktop;

try {
  desktop = await electron.launch({
    executablePath,
    env: {
      ...process.env,
      APP_DATA_DIR: dataDir,
      APP_USER_DATA_DIR: path.join(temporaryRoot, "user-data"),
      APP_DISABLE_SPLASH: "1"
    }
  });

  const page = await desktop.firstWindow();
  await expect(page).toHaveTitle(/个人工作生活/);
  await expect(page.getByText("欢迎使用个人工作生活")).toBeVisible();
  await page.getByRole("button", { name: "开始使用" }).click();
  await expect(page.getByText("本地文件已连接")).toBeVisible();

  await page.getByRole("link", { name: "数据与设置" }).click();
  await expect(page.getByRole("heading", { name: "桌面版" })).toBeVisible();
  await expect(page.getByText(new RegExp(`v${escapeRegExp(packageJson.version)}`))).toBeVisible();
  await expect(page.getByRole("button", { name: "打开数据文件夹" })).toBeVisible();
  await expect(page.getByRole("button", { name: "退出软件" })).toBeVisible();

  assert.ok(fs.existsSync(path.join(dataDir, "app.db")), "没有创建本地数据库");
  assert.ok(fs.existsSync(path.join(dataDir, "attachments")), "没有创建附件目录");
  assert.ok(fs.existsSync(path.join(dataDir, "backups")), "没有创建备份目录");
  assert.equal(
    fs.existsSync(path.join(releaseRoot, "data", "app.db")),
    false,
    "测试不应向发布包写入正式数据"
  );

  const closed = desktop.waitForEvent("close");
  await desktop.evaluate(({ app }) => app.quit());
  await closed;
  desktop = undefined;

  console.log(`打包程序冒烟测试通过：${executablePath}`);
} finally {
  await desktop?.close().catch(() => undefined);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
