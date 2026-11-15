import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { applyBackupRetention, createBackup, listBackups } from "../services/backup";

const businessTables = [
  "memos",
  "day_plans",
  "care_profile",
  "care_dates",
  "care_stories",
  "care_preferences",
  "care_wishes",
  "dev_projects",
  "dev_milestones",
  "dev_items",
  "dev_time_entries",
  "consulting_clients",
  "consulting_projects",
  "consulting_sessions",
  "consulting_actions",
  "learning_goals",
  "learning_stages",
  "learning_tasks",
  "learning_logs",
  "fitness_templates",
  "fitness_template_exercises",
  "fitness_sessions",
  "fitness_session_exercises",
  "body_metrics",
  "meal_plans",
  "meal_logs",
  "water_logs",
  "shopping_items",
  "entertainment_items",
  "entertainment_logs"
];

export function registerDataRoutes(app: FastifyInstance): void {
  app.get("/api/data/status", async () => {
    const databaseSize = fs.existsSync(app.appConfig.databasePath)
      ? fs.statSync(app.appConfig.databasePath).size
      : 0;
    const backups = listBackups(app.appConfig);
    return {
      ready: app.localDatabase.open,
      dataDir: app.appConfig.dataDir,
      databasePath: app.appConfig.databasePath,
      databaseSize,
      attachmentSize: directorySize(app.appConfig.attachmentsDir),
      backupCount: backups.length,
      lastDatabaseWrite: fs.existsSync(app.appConfig.databasePath)
        ? fs.statSync(app.appConfig.databasePath).mtime.toISOString()
        : null
    };
  });

  app.post("/api/data/clear", async () => {
    const safetyBackup = await createBackup(
      app.localDatabase,
      app.appConfig,
      "pre-clear"
    );

    app.localDatabase.transaction(() => {
      for (const table of businessTables) {
        app.localDatabase.prepare(`DELETE FROM ${table}`).run();
      }
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
      const update = app.localDatabase.prepare(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
      );
      for (const [key, value] of Object.entries(defaults)) update.run(key, value, now);
    })();

    fs.rmSync(app.appConfig.attachmentsDir, { recursive: true, force: true });
    fs.mkdirSync(app.appConfig.attachmentsDir, { recursive: true });
    applyBackupRetention(app.appConfig, getRetention(app));

    return {
      ok: true,
      safetyBackup: safetyBackup.filename
    };
  });
}

function directorySize(directory: string): number {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((sum, entry) => {
    const target = path.join(directory, entry.name);
    return sum + (entry.isDirectory() ? directorySize(target) : fs.statSync(target).size);
  }, 0);
}

function getRetention(app: FastifyInstance): number {
  const row = app.localDatabase
    .prepare("SELECT value FROM settings WHERE key = 'backupRetention'")
    .get() as { value: string } | undefined;
  return Math.max(1, Number(row?.value ?? 30));
}
