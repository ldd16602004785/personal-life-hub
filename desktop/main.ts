import path from "node:path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  shell
} from "electron";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../server/src/app";
import {
  resolveDesktopClientDir,
  resolveDesktopDataDir,
  type DesktopPathOptions
} from "./paths";

const projectRoot = path.resolve(__dirname, "..");
if (process.env.APP_USER_DATA_DIR) {
  app.setPath("userData", path.resolve(process.env.APP_USER_DATA_DIR));
}
const pathOptions: DesktopPathOptions = {
  isPackaged: app.isPackaged,
  execPath: process.execPath,
  appPath: app.getAppPath(),
  projectRoot,
  dataDirOverride: process.env.APP_DATA_DIR
};
const dataDir = resolveDesktopDataDir(pathOptions);
const clientDir = resolveDesktopClientDir(pathOptions);

let mainWindow: BrowserWindow | null = null;
let splashWindow: BrowserWindow | null = null;
let localService: FastifyInstance | null = null;
let closeStarted = false;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(startDesktopApp).catch(handleStartupFailure);
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", handleBeforeQuit);
}

async function startDesktopApp(): Promise<void> {
  Menu.setApplicationMenu(null);
  if (process.env.APP_DISABLE_SPLASH !== "1") {
    createSplashWindow();
  }
  registerDesktopIpc();

  session.defaultSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  );

  try {
    localService = await buildApp({
      dataDir,
      clientDir,
      autoBackup: true,
      logger: false
    });
    const url = await localService.listen({
      host: "127.0.0.1",
      port: 0
    });
    createMainWindow(url);
  } catch (error) {
    await handleStartupFailure(error);
  }
}

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 430,
    height: 270,
    frame: false,
    resizable: false,
    movable: true,
    show: false,
    backgroundColor: "#f6f3ea",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  const html = `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          color: #302d27;
          font-family: "Microsoft YaHei UI", system-ui, sans-serif;
          background:
            radial-gradient(circle at 82% 18%, rgba(228, 187, 99, .28), transparent 34%),
            linear-gradient(145deg, #fffdf8, #f1eadb);
        }
        main { width: 100%; padding: 36px; }
        .mark {
          width: 54px;
          height: 54px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          color: white;
          font-size: 27px;
          font-weight: 700;
          background: #302d27;
          box-shadow: 0 12px 30px rgba(48, 45, 39, .2);
        }
        h1 { margin: 22px 0 8px; font-size: 24px; letter-spacing: .04em; }
        p { margin: 0; color: #716b60; font-size: 14px; }
        .bar {
          width: 100%;
          height: 3px;
          margin-top: 28px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(48, 45, 39, .1);
        }
        .bar::after {
          content: "";
          display: block;
          width: 42%;
          height: 100%;
          border-radius: inherit;
          background: #9c7844;
          animation: load 1.2s ease-in-out infinite alternate;
        }
        @keyframes load {
          from { transform: translateX(-15%); }
          to { transform: translateX(155%); }
        }
      </style>
    </head>
    <body>
      <main>
        <div class="mark">今</div>
        <h1>个人工作生活</h1>
        <p>正在安全读取当前电脑上的数据…</p>
        <div class="bar"></div>
      </main>
    </body>
  </html>`;
  void splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
  );
  splashWindow.once("ready-to-show", () => splashWindow?.show());
}

function createMainWindow(url: string): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    title: "个人工作生活",
    backgroundColor: "#f6f3ea",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged
    }
  });

  const allowedOrigin = new URL(url).origin;
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, destination) => {
    if (new URL(destination).origin !== allowedOrigin) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  mainWindow.once("ready-to-show", () => {
    splashWindow?.close();
    splashWindow = null;
    mainWindow?.show();
    mainWindow?.focus();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  void mainWindow.loadURL(url);
}

function registerDesktopIpc(): void {
  ipcMain.handle("desktop:get-info", () => ({
    dataDir,
    version: app.getVersion()
  }));

  ipcMain.handle("desktop:open-data-folder", async () => {
    const message = await shell.openPath(dataDir);
    return message
      ? { ok: false, message }
      : { ok: true };
  });

  ipcMain.handle("desktop:quit", () => {
    app.quit();
    return { ok: true };
  });
}

function handleBeforeQuit(event: Electron.Event): void {
  if (closeStarted || !localService) return;
  event.preventDefault();
  closeStarted = true;
  const service = localService;
  localService = null;
  void service
    .close()
    .catch((error) => {
      console.error("关闭本地服务失败", error);
    })
    .finally(() => app.quit());
}

async function handleStartupFailure(error: unknown): Promise<void> {
  splashWindow?.close();
  splashWindow = null;
  mainWindow?.close();
  mainWindow = null;

  const message = error instanceof Error ? error.message : String(error);
  await dialog.showMessageBox({
    type: "error",
    title: "软件无法启动",
    message: "个人工作生活暂时无法启动",
    detail:
      `数据目录：${dataDir}\n\n` +
      "原有的数据文件不会被自动删除。请确认程序所在文件夹可以写入，然后重新打开软件。\n\n" +
      `错误信息：${message}`
  });
  await closeLocalService();
  app.exit(1);
}

async function closeLocalService(): Promise<void> {
  if (!localService) return;
  const service = localService;
  localService = null;
  await service.close();
}
