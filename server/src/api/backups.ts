import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import {
  applyBackupRetention,
  createBackup,
  findBackup,
  importZipBufferToTemporaryFile,
  listBackups,
  restoreBackupPackage
} from "../services/backup";
import { initializeStorage } from "../db/database";
import { AppError } from "./errors";

export function registerBackupRoutes(app: FastifyInstance): void {
  app.get("/api/backups", async () => ({
    backups: listBackups(app.appConfig)
  }));

  app.post("/api/backups", async () => {
    const backup = await createBackup(
      app.localDatabase,
      app.appConfig,
      "manual"
    );
    applyBackupRetention(app.appConfig, getRetention(app));
    return backup;
  });

  app.get("/api/backups/:filename/download", async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const backupPath = findBackup(app.appConfig, filename);
    return reply
      .type("application/zip")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(fs.createReadStream(backupPath));
  });

  app.post("/api/backups/restore", async (request) => {
    const body = request.body as { filename?: string };
    if (!body?.filename) {
      throw new AppError(400, "BACKUP_REQUIRED", "请选择要恢复的备份");
    }
    const backupPath = findBackup(app.appConfig, body.filename);
    return restoreFromFile(app, backupPath, "restore");
  });

  app.post("/api/backups/import", async (request) => {
    const file = await request.file();
    if (!file) {
      throw new AppError(400, "BACKUP_REQUIRED", "请选择备份文件");
    }
    const buffer = await file.toBuffer();
    const imported = importZipBufferToTemporaryFile(buffer, app.appConfig);
    try {
      return await restoreFromFile(app, imported.path, "import");
    } finally {
      imported.cleanup();
    }
  });

  app.delete("/api/backups/:filename", async (request) => {
    const { filename } = request.params as { filename: string };
    const backupPath = findBackup(app.appConfig, filename);
    fs.rmSync(backupPath, { force: true });
    return { ok: true };
  });
}

async function restoreFromFile(
  app: FastifyInstance,
  backupPath: string,
  reason: "restore" | "import"
): Promise<{ ok: true; safetyBackup: string }> {
  const safetyBackup = await createBackup(
    app.localDatabase,
    app.appConfig,
    `pre-${reason}`
  );
  app.localDatabase.close();

  try {
    await restoreBackupPackage(backupPath, app.appConfig);
    app.localDatabase = initializeStorage(app.appConfig);
    applyBackupRetention(app.appConfig, getRetention(app));
    return { ok: true, safetyBackup: safetyBackup.filename };
  } catch (error) {
    if (!app.localDatabase.open) {
      app.localDatabase = initializeStorage(app.appConfig);
    }
    throw error;
  }
}

function getRetention(app: FastifyInstance): number {
  const row = app.localDatabase
    .prepare("SELECT value FROM settings WHERE key = 'backupRetention'")
    .get() as { value: string } | undefined;
  return Math.max(1, Number(row?.value ?? 30));
}
