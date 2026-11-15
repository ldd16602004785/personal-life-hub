import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { getSettings } from "../db/database";
import { AppError } from "./errors";
import { applyBackupRetention } from "../services/backup";

const settingsSchema = z.object({
  weekStartsOn: z.enum(["0", "1"]).optional(),
  defaultPage: z
    .enum([
      "/",
      "/today",
      "/care",
      "/dev",
      "/learning",
      "/fitness",
      "/diet",
      "/entertainment",
      "/settings"
    ])
    .optional(),
  backupRetention: z.coerce.number().int().min(1).max(365).optional(),
  waterTargetMl: z.coerce.number().int().min(100).max(10000).optional(),
  fontSize: z.enum(["small", "medium", "large", "xlarge"]).optional(),
  uiTheme: z.enum(["standard", "weather", "notion", "bubu"]).optional(),
  nightMode: z.boolean().optional(),
  desktopWelcomeSeen: z.enum(["true", "false"]).optional()
});

export function registerSettingsRoutes(app: FastifyInstance): void {
  app.get("/api/settings", async () => getSettings(app.localDatabase));

  app.put("/api/settings", async (request) => {
    const parsed = settingsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_SETTINGS", "设置内容无效");
    }

    const now = new Date().toISOString();
    const update = app.localDatabase.prepare(
      "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) " +
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
    );

    app.localDatabase.transaction(() => {
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) update.run(key, String(value), now);
      }
    })();

    if (parsed.data.backupRetention !== undefined) {
      applyBackupRetention(app.appConfig, parsed.data.backupRetention);
    }

    return getSettings(app.localDatabase);
  });
}
