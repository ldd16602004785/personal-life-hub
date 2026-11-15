# 个人工作生活中枢

仅在本机 Windows 桌面浏览器中使用的个人工作生活应用。正式数据保存在独立本地文件中，不依赖浏览器存储、云服务或外部网络。

当前版本：`2.1.1`。全部界面支持标准、天气氛围、Notion 笔记和“一二和布布”四种主题，并提供全应用手动夜间模式。

## 首次使用

需要 Node.js 24 或兼容版本。

```powershell
npm ci
npm run build
```

此后双击 `start.cmd` 即可启动本地服务并打开浏览器。关闭浏览器不会删除数据。

## 数据位置

默认目录：

```text
%LOCALAPPDATA%\PersonalLifeHub\
  app.db
  attachments\
  backups\
```

- `app.db` 是 SQLite 本地数据库。
- `attachments\` 保存关怀对象的本地照片。
- `backups\` 保存每日、手动和危险操作前的完整备份。
- 清除浏览器缓存、清除站点数据或换浏览器不会删除以上文件。

如需换电脑，复制整个 `PersonalLifeHub` 目录，或在“数据与设置”中下载备份后导入。

## 日常开发

```powershell
npm install
npm run dev
```

前端开发地址由 Vite 输出，API 默认地址为 `http://127.0.0.1:4317`。

## 测试

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

端到端测试使用独立临时数据目录，不会读写真实个人数据。

## 数据异常处理

如果本地数据库无法读取，应用不会自动覆盖原文件。先复制 `%LOCALAPPDATA%\PersonalLifeHub\app.db` 留档，再从 `backups\` 中选择最近的备份恢复；必要时将损坏的 `app.db` 改名后重新启动。

详细需求见 `prd.md`，开发阶段见 `development-plan.md`。
