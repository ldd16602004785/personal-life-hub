import fs from "node:fs";
import Database from "better-sqlite3";
import type { AppConfig } from "../config";
import { runMigrations } from "./migrations";

export function initializeStorage(config: AppConfig): Database.Database {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.attachmentsDir, { recursive: true });
  fs.mkdirSync(config.backupsDir, { recursive: true });

  let database: Database.Database | undefined;
  try {
    database = new Database(config.databasePath);
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    database.pragma("busy_timeout = 5000");
    runMigrations(database);
    seedSettings(database);
    const integrity = database.pragma("quick_check", { simple: true });
    if (integrity !== "ok") {
      throw new Error(`数据库完整性检查失败：${String(integrity)}`);
    }
    return database;
  } catch (error) {
    try {
      database?.close();
    } catch {
      // Preserve the original startup error.
    }
    throw new Error(
      `无法读取本地数据文件：${config.databasePath}。原文件未被删除。` +
        `请先复制 app.db 留作排查，再从 ${config.backupsDir} 中的备份恢复，` +
        `或重命名损坏文件后重新启动。原因：${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

function seedSettings(database: Database.Database): void {
  const now = new Date().toISOString();
  const defaults: Record<string, string> = {
    weekStartsOn: "1",
    defaultPage: "/",
    backupRetention: "30",
    waterTargetMl: "2000",
    fontSize: "small",
    uiTheme: "standard",
    nightMode: "false",
    desktopWelcomeSeen: "false"
  };

  const insert = database.prepare(
    "INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"
  );

  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value, now);
  }
}

export function getSettings(database: Database.Database): Record<string, string> {
  return Object.fromEntries(
    database
      .prepare("SELECT key, value FROM settings ORDER BY key")
      .all()
      .map((row) => {
        const value = row as { key: string; value: string };
        return [value.key, value.value];
      })
  );
}
