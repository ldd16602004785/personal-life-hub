# 个人工作生活

仅在本机 Windows 中使用的个人工作生活应用。当前版本 `2.2.0` 提供独立桌面窗口，不需要安装 Node.js、打开终端或手动启动浏览器。

正式数据保存在程序旁边的 `data` 目录中，不依赖浏览器存储、云服务或外部网络。不同电脑上的数据彼此独立。

## 发给其他人使用

发布压缩包：

```text
release\个人工作生活-Windows-v2.2.0.zip
```

使用步骤：

1. 将完整压缩包解压到桌面、文档或其他可写目录。
2. 双击 `个人工作生活.exe`。
3. 第一次启动阅读欢迎说明，然后点击“开始使用”。

不要只发送 EXE。EXE 不包含个人数据，也可能缺少内部运行组件；应将整个压缩包发给她。

当前版本没有商业代码签名证书。部分 Windows 电脑第一次运行时会显示“Windows 已保护你的电脑”，确认文件来源可信后可以点击“更多信息 → 仍要运行”。详细说明位于 `使用说明.txt`。

## 数据位置

桌面版数据位于程序文件夹：

```text
个人工作生活\
  data\
    app.db
    attachments\
    backups\
  resources\
  个人工作生活.exe
  使用说明.txt
```

- `app.db` 保存正式业务数据。
- `attachments\` 保存关怀对象照片。
- `backups\` 保存自动、手动和危险操作前的备份。
- 移动软件时必须移动整个文件夹，不能只移动 EXE。
- 重新发送新版本时，应保留原来的 `data` 目录。

旧的浏览器开发方式仍将数据保存在：

```text
%LOCALAPPDATA%\PersonalLifeHub\
```

## Windows 打包

安装依赖后执行：

```powershell
npm ci
npm run desktop:package
```

输出：

```text
release\win-unpacked\
release\个人工作生活-Windows-v2.2.0\
release\个人工作生活-Windows-v2.2.0.zip
```

`desktop:package` 会构建前端、服务端和 Electron 主进程，再生成包含空白 `data` 目录和使用说明的便携发布包。

## 开发与启动

```powershell
npm install
npm run desktop:dev
```

如果需要继续使用浏览器开发模式：

```powershell
npm run dev
```

项目根目录的 `start.cmd` 会优先启动已经打包的桌面版；没有打包文件时会自动执行桌面版打包。从项目目录启动时，数据写入被 Git 忽略的 `personal-life-hub-data`，不会污染发布包。

## 测试

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:desktop
npm run test:e2e
npm run test:desktop:packaged
npm run verify:all
```

- `test`：单元和接口测试。
- `test:desktop`：Electron 桌面窗口、单实例、安全退出和重启持久化。
- `test:e2e`：完整浏览器业务流程。
- `test:desktop:packaged`：从最终发布 EXE 启动的冒烟测试。
- `verify:all`：从头运行全部测试、重新打包并验证最终 EXE。

自动化测试全部使用独立临时数据目录，不读写正式数据。

## 数据异常处理

如果数据库无法读取，应用不会自动覆盖原文件。先复制整个 `data` 文件夹留档，再从 `data\backups` 中选择最近的备份恢复。

详细需求见 `prd.md`，历史开发计划见 `development-plan.md`，版本验收结果见 `acceptance-report.md`。
