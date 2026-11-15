import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestAppContext } from "../helpers/test-app";
import {
  applyBackupRetention,
  createBackup,
  listBackups
} from "../../server/src/services/backup";
import { saveAttachment } from "../../server/src/services/attachments";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

describe("local backup and restore", () => {
  it("creates a complete backup package with a manifest and database", async () => {
    context = await createTestApp();
    fs.writeFileSync(path.join(context.dataDir, "attachments", "note.txt"), "attachment");

    const info = await createBackup(
      context.app.localDatabase,
      context.app.appConfig,
      "manual"
    );
    const backupPath = path.join(context.dataDir, "backups", info.filename);
    const zip = new AdmZip(backupPath);
    const entries = zip.getEntries().map((entry) => entry.entryName);

    expect(fs.existsSync(backupPath)).toBe(true);
    expect(entries).toContain("manifest.json");
    expect(entries).toContain("app.db");
    expect(entries).toContain("attachments/note.txt");
  });

  it("restores settings and creates a safety backup before overwriting", async () => {
    context = await createTestApp();
    const originalBackup = await createBackup(
      context.app.localDatabase,
      context.app.appConfig,
      "manual"
    );

    await context.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { weekStartsOn: "0" }
    });

    const response = await context.app.inject({
      method: "POST",
      url: "/api/backups/restore",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { filename: originalBackup.filename }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      ok: true
    });
    expect(response.json().safetyBackup).toContain("pre-restore");
    expect(
      context.app.localDatabase
        .prepare("SELECT value FROM settings WHERE key = 'weekStartsOn'")
        .pluck()
        .get()
    ).toBe("1");
    const reopened = await context.app.inject({
      method: "GET",
      url: "/api/bootstrap",
      headers: { host: "127.0.0.1:4317" }
    });
    const afterRestore = await context.app.inject({
      method: "POST",
      url: "/api/memos",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { content: "恢复后仍可写入" }
    });
    expect(reopened.statusCode, reopened.body).toBe(200);
    expect(afterRestore.statusCode).toBe(201);
  });

  it("rejects a corrupt backup without replacing current data", async () => {
    context = await createTestApp();
    const corruptPath = path.join(context.dataDir, "backups", "corrupt.zip");
    fs.writeFileSync(corruptPath, Buffer.from("not a zip"));

    const response = await context.app.inject({
      method: "POST",
      url: "/api/backups/restore",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { filename: "corrupt.zip" }
    });

    expect(response.statusCode).toBe(400);
    expect(
      context.app.localDatabase
        .prepare("SELECT value FROM settings WHERE key = 'weekStartsOn'")
        .pluck()
        .get()
    ).toBe("1");
  });

  it("removes old backups according to the retention setting", async () => {
    context = await createTestApp();
    for (let index = 0; index < 3; index += 1) {
      await createBackup(context.app.localDatabase, context.app.appConfig, `manual-${index}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    applyBackupRetention(context.app.appConfig, 2);

    expect(listBackups(context.app.appConfig)).toHaveLength(2);
  });

  it("creates an automatic backup on startup when none exists", async () => {
    context = await createTestApp({ autoBackup: true });

    expect(listBackups(context.app.appConfig)).toHaveLength(1);
    expect(listBackups(context.app.appConfig)[0].reason).toBe("daily");
    expect(listBackups(context.app.appConfig)[0].filename).toContain("daily");
  });

  it("imports a multipart backup and restores the saved state", async () => {
    context = await createTestApp();
    const original = await createBackup(
      context.app.localDatabase,
      context.app.appConfig,
      "manual"
    );
    const zipBytes = fs.readFileSync(
      path.join(context.dataDir, "backups", original.filename)
    );

    await context.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { weekStartsOn: "0" }
    });

    const boundary = "----personal-life-hub-test";
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="file"; filename="backup.zip"\r\n' +
          "Content-Type: application/zip\r\n\r\n"
      ),
      zipBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/backups/import",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token,
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload: body
    });

    expect(response.statusCode).toBe(200);
    expect(
      context.app.localDatabase
        .prepare("SELECT value FROM settings WHERE key = 'weekStartsOn'")
        .pluck()
        .get()
    ).toBe("1");
  });

  it("restores local photo attachments together with the database", async () => {
    context = await createTestApp();
    const attachment = saveAttachment(context.app.appConfig, {
      buffer: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00
      ]),
      originalName: "memory.png",
      mediaType: "image/png"
    });
    const backup = await createBackup(
      context.app.localDatabase,
      context.app.appConfig,
      "manual"
    );
    fs.rmSync(path.join(context.dataDir, "attachments", attachment.relativePath));

    const response = await context.app.inject({
      method: "POST",
      url: "/api/backups/restore",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { filename: backup.filename }
    });

    expect(response.statusCode).toBe(200);
    expect(
      fs.existsSync(path.join(context.dataDir, "attachments", attachment.relativePath))
    ).toBe(true);
  });

  it("rejects backup archives that try to write outside the restore directory", async () => {
    context = await createTestApp();
    const malicious = new AdmZip();
    malicious.addFile(
      "manifest.json",
      Buffer.from(
        JSON.stringify({
          formatVersion: 1,
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          reason: "malicious",
          appVersion: "1.0.0"
        })
      )
    );
    malicious.addFile("app.db", Buffer.from("placeholder"));
    malicious.addFile("../escape.txt", Buffer.from("escape"));
    malicious.writeZip(path.join(context.dataDir, "backups", "malicious.zip"));

    const response = await context.app.inject({
      method: "POST",
      url: "/api/backups/restore",
      headers: {
        host: "127.0.0.1:4317",
        "x-app-token": context.token
      },
      payload: { filename: "malicious.zip" }
    });

    expect(response.statusCode).toBe(400);
    expect(fs.existsSync(path.join(context.dataDir, "escape.txt"))).toBe(false);
  });
});
