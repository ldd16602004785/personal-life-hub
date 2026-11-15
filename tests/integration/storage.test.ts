import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestAppContext } from "../helpers/test-app";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

describe("local storage initialization", () => {
  it("creates the local database, attachment and backup directories", async () => {
    context = await createTestApp();

    expect(fs.existsSync(path.join(context.dataDir, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(context.dataDir, "attachments"))).toBe(true);
    expect(fs.existsSync(path.join(context.dataDir, "backups"))).toBe(true);
  });

  it("returns a writable health state and schema migration record", async () => {
    context = await createTestApp();
    const response = await context.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "127.0.0.1:4317" }
    });
    const migrations = context.app.localDatabase
      .prepare("SELECT version, name FROM schema_migrations")
      .all();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true,
      databaseReady: true,
      attachmentDirectoryReady: true,
      writable: true
    });
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(migrations).toEqual([
      { version: 1, name: "initial_schema" },
      { version: 2, name: "learning_plan_module" }
    ]);
  });

  it("updates settings only with the local operation token", async () => {
    context = await createTestApp();

    const denied = await context.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: { host: "127.0.0.1:4317" },
      payload: { weekStartsOn: "0" }
    });
    const accepted = await context.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { weekStartsOn: "0", backupRetention: 20 }
    });

    expect(denied.statusCode).toBe(403);
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json()).toMatchObject({
      weekStartsOn: "0",
      backupRetention: "20"
    });
  });

  it("rejects requests addressed to a non-local host", async () => {
    context = await createTestApp();
    const response = await context.app.inject({
      method: "GET",
      url: "/api/health",
      headers: { host: "192.168.1.20:4317" }
    });

    expect(response.statusCode).toBe(403);
  });
});
