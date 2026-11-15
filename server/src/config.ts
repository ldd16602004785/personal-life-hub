import os from "node:os";
import path from "node:path";

export interface AppConfig {
  port: number;
  dataDir: string;
  databasePath: string;
  attachmentsDir: string;
  backupsDir: string;
}

export function getDataDir(configuredDir?: string): string {
  if (configuredDir) return path.resolve(configuredDir);
  if (process.env.APP_DATA_DIR) return path.resolve(process.env.APP_DATA_DIR);

  const localAppData =
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
  return path.join(localAppData, "PersonalLifeHub");
}

export function createConfig(options: { dataDir?: string; port?: number } = {}): AppConfig {
  const dataDir = getDataDir(options.dataDir);
  return {
    port: options.port ?? Number(process.env.PORT ?? 4317),
    dataDir,
    databasePath: path.join(dataDir, "app.db"),
    attachmentsDir: path.join(dataDir, "attachments"),
    backupsDir: path.join(dataDir, "backups")
  };
}
