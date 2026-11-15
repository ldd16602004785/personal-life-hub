import fs from "node:fs";
import path from "node:path";
import console from "node:console";
import process from "node:process";
import AdmZip from "adm-zip";

const root = process.cwd();
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);
const releaseRoot = path.join(root, "release");
const unpackedDir = path.join(releaseRoot, "win-unpacked");
const packageName = `个人工作生活-Windows-v${packageJson.version}`;
const packageDir = path.join(releaseRoot, packageName);
const zipPath = path.join(releaseRoot, `${packageName}.zip`);
const executablePath = path.join(unpackedDir, "个人工作生活.exe");

if (!fs.existsSync(executablePath)) {
  throw new Error(`没有找到打包后的程序：${executablePath}`);
}

assertInside(releaseRoot, packageDir);
assertInside(releaseRoot, zipPath);

fs.rmSync(packageDir, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.cpSync(unpackedDir, packageDir, { recursive: true });

fs.mkdirSync(path.join(packageDir, "data", "attachments"), { recursive: true });
fs.mkdirSync(path.join(packageDir, "data", "backups"), { recursive: true });
fs.copyFileSync(
  path.join(root, "desktop", "使用说明.txt"),
  path.join(packageDir, "使用说明.txt")
);

const zip = new AdmZip();
zip.addLocalFolder(packageDir, packageName);
zip.writeZip(zipPath);

const size = fs.statSync(zipPath).size;
console.log(`发布文件夹：${packageDir}`);
console.log(`发布压缩包：${zipPath}（${(size / 1024 / 1024).toFixed(1)} MB）`);

function assertInside(parent, target) {
  const relative = path.relative(parent, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`拒绝写入发布目录以外的位置：${target}`);
  }
}
