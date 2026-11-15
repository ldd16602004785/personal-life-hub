import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../../server/src/app";

let app: FastifyInstance | undefined;
let dataDir = "";

afterEach(async () => {
  await app?.close();
  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });
  app = undefined;
  dataDir = "";
});

async function bootstrapToken(instance: FastifyInstance): Promise<string> {
  const response = await instance.inject({
    method: "GET",
    url: "/api/bootstrap",
    headers: { host: "127.0.0.1:4317" }
  });
  return (response.json() as { token: string }).token;
}

describe("local file persistence across restarts", () => {
  it("reopens the same data after the local service stops and starts", async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "personal-life-persistence-"));
    app = await buildApp({ dataDir, autoBackup: false });
    let token = await bootstrapToken(app);
    await app.inject({
      method: "POST",
      url: "/api/memos",
      headers: { host: "127.0.0.1:4317", "x-app-token": token },
      payload: { content: "跨进程重启后仍应存在" }
    });
    await app.inject({
      method: "POST",
      url: "/api/care/dates",
      headers: { host: "127.0.0.1:4317", "x-app-token": token },
      payload: {
        name: "长期纪念日",
        date: "2020-12-02",
        type: "anniversary",
        repeatsYearly: true,
        leadDays: 30,
        notes: ""
      }
    });
    await app.close();

    app = await buildApp({ dataDir, autoBackup: false });
    token = await bootstrapToken(app);
    const memos = await app.inject({
      method: "GET",
      url: "/api/memos",
      headers: { host: "127.0.0.1:4317" }
    });
    const care = await app.inject({
      method: "GET",
      url: "/api/care",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(memos.json().memos[0].content).toBe("跨进程重启后仍应存在");
    expect(care.json().dates[0].name).toBe("长期纪念日");
    expect(token).toHaveLength(64);
  });

  it("does not overwrite an unreadable local database and returns recovery guidance", async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "personal-life-corrupt-"));
    const corruptBytes = Buffer.from("this is not a sqlite database");
    fs.writeFileSync(path.join(dataDir, "app.db"), corruptBytes);

    await expect(
      buildApp({ dataDir, autoBackup: false })
    ).rejects.toThrow(/原文件未被删除.*备份恢复/);
    expect(fs.readFileSync(path.join(dataDir, "app.db"))).toEqual(corruptBytes);
  });
});
