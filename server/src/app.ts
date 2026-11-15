import Fastify, { type FastifyInstance } from "fastify";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { createConfig, type AppConfig } from "./config";
import { initializeStorage, getSettings } from "./db/database";
import { registerErrorHandler } from "./api/errors";
import { registerSettingsRoutes } from "./api/settings";
import { registerBackupRoutes } from "./api/backups";
import { registerMemoRoutes } from "./api/memos";
import { registerDayPlanRoutes } from "./api/day-plans";
import { registerDashboardRoutes } from "./api/dashboard";
import { registerCareRoutes } from "./api/care";
import { registerDevRoutes } from "./api/dev";
import { registerFitnessRoutes } from "./api/fitness";
import { registerDietRoutes } from "./api/diet";
import { registerEntertainmentRoutes } from "./api/entertainment";
import { registerDataRoutes } from "./api/data";
import { registerLearningRoutes } from "./api/learning";
import { maybeCreateDailyBackup } from "./services/backup";

export async function buildApp(
  options: {
    logger?: boolean;
    dataDir?: string;
    port?: number;
    autoBackup?: boolean;
  } = {}
): Promise<FastifyInstance> {
  const config = createConfig(options);
  const database = initializeStorage(config);
  const app = Fastify({
    logger: options.logger ?? false
  });
  const appToken = crypto.randomBytes(32).toString("hex");

  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 100 * 1024 * 1024
    }
  });

  if (options.autoBackup !== false) {
    await maybeCreateDailyBackup(database, config);
  }

  app.decorate("localDatabase", database);
  app.decorate("appConfig", config);
  app.decorate("appToken", appToken);

  app.addHook("onRequest", async (request, reply) => {
    const host = request.headers.host?.split(":")[0];
    if (host !== "127.0.0.1" && host !== "localhost") {
      return reply.status(403).send({
        error: "INVALID_HOST",
        message: "仅允许从本机访问"
      });
    }

    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (isMutation && request.url.startsWith("/api/")) {
      if (request.headers["x-app-token"] !== appToken) {
        return reply.status(403).send({
          error: "INVALID_LOCAL_TOKEN",
          message: "本地操作令牌无效，请重新打开应用"
        });
      }
    }
  });

  app.addHook("onSend", async (_request, reply) => {
    reply.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
    );
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Frame-Options", "DENY");
  });

  app.addHook("onClose", async () => {
    app.localDatabase.close();
  });

  registerErrorHandler(app);

  app.get("/api/health", async () => {
    const writable = canWrite(config.dataDir);
    return {
      ok: writable,
      app: "personal-life-hub",
      databaseReady: app.localDatabase.open,
      attachmentDirectoryReady: fs.existsSync(config.attachmentsDir),
      writable,
      timestamp: new Date().toISOString()
    };
  });

  app.get("/api/bootstrap", async () => ({
    token: appToken,
    settings: getSettings(app.localDatabase),
    dataStatus: {
      ready: app.localDatabase.open,
      location: config.dataDir
    }
  }));

  registerSettingsRoutes(app);
  registerBackupRoutes(app);
  registerMemoRoutes(app);
  registerDayPlanRoutes(app);
  registerDashboardRoutes(app);
  registerCareRoutes(app);
  registerDevRoutes(app);
  registerLearningRoutes(app);
  registerFitnessRoutes(app);
  registerDietRoutes(app);
  registerEntertainmentRoutes(app);
  registerDataRoutes(app);

  const clientDir = path.resolve(process.cwd(), "dist", "client");
  if (fs.existsSync(path.join(clientDir, "index.html"))) {
    await app.register(fastifyStatic, {
      root: clientDir,
      prefix: "/"
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api/")) {
        return reply.sendFile("index.html");
      }
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: "请求的资源不存在"
      });
    });
  }

  return app;
}

function canWrite(directory: string): boolean {
  const probe = `${directory}/.write-probe-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    localDatabase: import("better-sqlite3").Database;
    appConfig: AppConfig;
    appToken: string;
  }
}
