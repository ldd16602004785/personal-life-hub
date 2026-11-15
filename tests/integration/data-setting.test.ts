import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestAppContext } from "../helpers/test-app";
import { listBackups } from "../../server/src/services/backup";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

function headers(token: string) {
  return { host: "127.0.0.1:4317", "x-app-token": token };
}

describe("data status, settings and clearing", () => {
  it("reports local file and backup status", async () => {
    context = await createTestApp();
    const status = await context.app.inject({
      method: "GET",
      url: "/api/data/status",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(status.json()).toMatchObject({
      ready: true,
      dataDir: context.dataDir,
      databaseSize: expect.any(Number),
      attachmentSize: 0,
      backupCount: 0
    });
  });

  it("persists preferences and applies the backup retention setting", async () => {
    context = await createTestApp();
    const response = await context.app.inject({
      method: "PUT",
      url: "/api/settings",
      headers: headers(context.token),
      payload: {
        weekStartsOn: "0",
        defaultPage: "/today",
        backupRetention: 7,
        waterTargetMl: 2500,
        fontSize: "large",
        homeTheme: "notion",
        nightMode: true
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      weekStartsOn: "0",
      defaultPage: "/today",
      backupRetention: "7",
      waterTargetMl: "2500",
      fontSize: "large",
      homeTheme: "notion",
      nightMode: "true"
    });
  });

  it("creates a safety backup before clearing data and attachments", async () => {
    context = await createTestApp();
    await context.app.inject({
      method: "POST",
      url: "/api/memos",
      headers: headers(context.token),
      payload: { content: "清空前需要备份" }
    });
    fs.writeFileSync(`${context.dataDir}/attachments/photo.txt`, "photo");

    const clear = await context.app.inject({
      method: "POST",
      url: "/api/data/clear",
      headers: headers(context.token)
    });
    const memos = await context.app.inject({
      method: "GET",
      url: "/api/memos",
      headers: { host: "127.0.0.1:4317" }
    });
    const settings = await appSettings(context);

    expect(clear.statusCode).toBe(200);
    expect(clear.json().safetyBackup).toContain("pre-clear");
    expect(memos.json().memos).toEqual([]);
    expect(settings.defaultPage).toBe("/");
    expect(fs.readdirSync(`${context.dataDir}/attachments`)).toEqual([]);
    expect(listBackups(context.app.appConfig).some((backup) => backup.reason === "pre-clear")).toBe(
      true
    );
  });
});

async function appSettings(context: TestAppContext) {
  const response = await context.app.inject({
    method: "GET",
    url: "/api/settings",
    headers: { host: "127.0.0.1:4317" }
  });
  return response.json() as Record<string, string>;
}
