import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import AdmZip from "adm-zip";
import type { AppConfig } from "../config";
import { AppError } from "../api/errors";

export interface BackupInfo {
  filename: string;
  createdAt: string;
  size: number;
  reason: string;
}

interface BackupManifest {
  formatVersion: 1;
  schemaVersion: number;
  createdAt: string;
  reason: string;
  appVersion: string;
}

export async function createBackup(
  database: Database.Database,
  config: AppConfig,
  reason = "manual"
): Promise<BackupInfo> {
  fs.mkdirSync(config.backupsDir, { recursive: true });
  const createdAt = new Date().toISOString();
  const safeReason = reason.replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const filename = `personal-life-hub-${createdAt.replace(/[:.]/g, "-")}-${safeReason}.zip`;
  const destination = path.join(config.backupsDir, filename);
  const workingDir = fs.mkdtempSync(path.join(config.backupsDir, ".working-"));
  const snapshotPath = path.join(workingDir, "app.db");

  try {
    await database.backup(snapshotPath);
    const schema = database
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number };
    const manifest: BackupManifest = {
      formatVersion: 1,
      schemaVersion: schema.version,
      createdAt,
      reason,
      appVersion: "2.0.0"
    };
    const zip = new AdmZip();
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2)));
    zip.addLocalFile(snapshotPath, "", "app.db");
    if (fs.existsSync(config.attachmentsDir)) {
      zip.addLocalFolder(config.attachmentsDir, "attachments");
    }
    zip.writeZip(destination);

    return {
      filename,
      createdAt,
      size: fs.statSync(destination).size,
      reason
    };
  } finally {
    fs.rmSync(workingDir, { recursive: true, force: true });
  }
}

export function listBackups(config: AppConfig): BackupInfo[] {
  if (!fs.existsSync(config.backupsDir)) return [];

  return fs
    .readdirSync(config.backupsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".zip"))
    .map((entry) => {
      const fullPath = path.join(config.backupsDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        filename: entry.name,
        createdAt: stat.mtime.toISOString(),
        size: stat.size,
        reason:
          entry.name.match(
            /^personal-life-hub-.+-(daily|manual|pre-restore|pre-import|pre-clear)\.zip$/
          )
            ?.[1] ?? "unknown"
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function findBackup(config: AppConfig, filename: string): string {
  if (!/^[a-zA-Z0-9._-]+\.zip$/.test(filename)) {
    throw new AppError(400, "INVALID_BACKUP_NAME", "备份文件名无效");
  }
  const target = path.join(config.backupsDir, filename);
  if (path.dirname(target) !== config.backupsDir || !fs.existsSync(target)) {
    throw new AppError(404, "BACKUP_NOT_FOUND", "备份文件不存在");
  }
  return target;
}

export async function maybeCreateDailyBackup(
  database: Database.Database,
  config: AppConfig
): Promise<BackupInfo | null> {
  const latest = listBackups(config)[0];
  if (latest && Date.now() - new Date(latest.createdAt).getTime() < 24 * 60 * 60 * 1000) {
    return null;
  }
  return createBackup(database, config, "daily");
}

export function applyBackupRetention(config: AppConfig, retention: number): void {
  const backups = listBackups(config).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const backup of backups.slice(Math.max(1, retention))) {
    fs.rmSync(path.join(config.backupsDir, backup.filename), { force: true });
  }
}

export async function restoreBackupPackage(
  zipPath: string,
  config: AppConfig
): Promise<void> {
  const stageDir = fs.mkdtempSync(path.join(config.dataDir, ".restore-stage-"));
  const rollbackDir = fs.mkdtempSync(path.join(config.dataDir, ".restore-rollback-"));
  const stagedAttachments = path.join(stageDir, "attachments");
  const currentAttachmentsBackup = path.join(rollbackDir, "attachments");
  const currentDatabaseBackup = path.join(rollbackDir, "app.db");
  let movedDatabase = false;
  let movedAttachments = false;

  try {
    try {
      const zip = new AdmZip(zipPath);
      const unsafeEntry = zip
        .getEntries()
        .find((entry) => {
          const normalized = entry.entryName.replace(/\\/g, "/");
          return normalized.startsWith("/") || normalized.split("/").includes("..");
        });
      if (unsafeEntry) {
        throw new AppError(400, "INVALID_BACKUP", "备份包含不安全的文件路径");
      }
      zip.extractAllTo(stageDir, true);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        400,
        "INVALID_BACKUP",
        "备份文件无效，请选择有效的 .zip 备份包"
      );
    }
    validateExtractedBackup(stageDir);

    if (fs.existsSync(config.databasePath)) {
      fs.renameSync(config.databasePath, currentDatabaseBackup);
      movedDatabase = true;
    }
    removeSqliteSidecars(config.databasePath);

    if (fs.existsSync(config.attachmentsDir)) {
      fs.renameSync(config.attachmentsDir, currentAttachmentsBackup);
      movedAttachments = true;
    }

    fs.copyFileSync(path.join(stageDir, "app.db"), config.databasePath);
    fs.mkdirSync(config.attachmentsDir, { recursive: true });
    if (fs.existsSync(stagedAttachments)) {
      fs.cpSync(stagedAttachments, config.attachmentsDir, { recursive: true, force: true });
    }
  } catch (error) {
    fs.rmSync(config.databasePath, { force: true });
    removeSqliteSidecars(config.databasePath);
    if (movedDatabase && fs.existsSync(currentDatabaseBackup)) {
      fs.copyFileSync(currentDatabaseBackup, config.databasePath);
    }
    fs.rmSync(config.attachmentsDir, { recursive: true, force: true });
    if (movedAttachments && fs.existsSync(currentAttachmentsBackup)) {
      fs.cpSync(currentAttachmentsBackup, config.attachmentsDir, {
        recursive: true,
        force: true
      });
    }

    if (error instanceof AppError) throw error;
    throw new AppError(400, "RESTORE_FAILED", "备份恢复失败，当前数据未被覆盖");
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.rmSync(rollbackDir, { recursive: true, force: true });
  }
}

function validateExtractedBackup(stageDir: string): void {
  const manifestPath = path.join(stageDir, "manifest.json");
  const databasePath = path.join(stageDir, "app.db");
  if (!fs.existsSync(manifestPath) || !fs.existsSync(databasePath)) {
    throw new AppError(400, "INVALID_BACKUP", "备份缺少必要文件");
  }

  let manifest: Partial<BackupManifest>;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Partial<BackupManifest>;
  } catch {
    throw new AppError(400, "INVALID_BACKUP", "备份清单无法读取");
  }

  if (manifest.formatVersion !== 1 || typeof manifest.schemaVersion !== "number") {
    throw new AppError(400, "UNSUPPORTED_BACKUP", "备份格式或版本不受支持");
  }

  let database: Database.Database | undefined;
  try {
    database = new Database(databasePath, { readonly: true });
    const check = database.pragma("quick_check", { simple: true });
    const migration = database
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number };
    if (check !== "ok" || migration.version !== manifest.schemaVersion) {
      throw new Error("invalid database");
    }
  } catch {
    throw new AppError(400, "INVALID_BACKUP", "备份中的数据库损坏或版本不匹配");
  } finally {
    database?.close();
  }
}

export function importZipBufferToTemporaryFile(
  buffer: Buffer,
  config: AppConfig
): { path: string; cleanup: () => void } {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new AppError(400, "INVALID_BACKUP", "导入文件不是有效的备份压缩包");
  }
  const target = path.join(config.dataDir, `.import-${crypto.randomUUID()}.zip`);
  fs.writeFileSync(target, buffer);
  return {
    path: target,
    cleanup: () => fs.rmSync(target, { force: true })
  };
}

function removeSqliteSidecars(databasePath: string): void {
  fs.rmSync(`${databasePath}-wal`, { force: true });
  fs.rmSync(`${databasePath}-shm`, { force: true });
}
