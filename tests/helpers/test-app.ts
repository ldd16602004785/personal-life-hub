import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/src/app";

export interface TestAppContext {
  app: FastifyInstance;
  dataDir: string;
  token: string;
  cleanup: () => Promise<void>;
}

export async function createTestApp(
  options: { autoBackup?: boolean } = {}
): Promise<TestAppContext> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "personal-life-hub-test-"));
  const app = await buildApp({
    dataDir,
    port: 4317,
    autoBackup: options.autoBackup ?? false
  });
  const bootstrap = await app.inject({
    method: "GET",
    url: "/api/bootstrap",
    headers: { host: "127.0.0.1:4317" }
  });

  const { token } = bootstrap.json() as { token: string };

  return {
    app,
    dataDir,
    token,
    cleanup: async () => {
      await app.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  };
}
