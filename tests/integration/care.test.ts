import crypto from "node:crypto";
import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestAppContext } from "../helpers/test-app";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

function headers(token: string) {
  return { host: "127.0.0.1:4317", "x-app-token": token };
}

describe("care module", () => {
  it("maintains profile, annual dates, preferences and wishes", async () => {
    context = await createTestApp();
    const profile = await context.app.inject({
      method: "PUT",
      url: "/api/care/profile",
      headers: headers(context.token),
      payload: {
        name: "小满",
        relationshipStage: "恋爱中",
        relationshipStart: "2024-12-02",
        intro: "喜欢散步"
      }
    });
    const date = await context.app.inject({
      method: "POST",
      url: "/api/care/dates",
      headers: headers(context.token),
      payload: {
        name: "在一起纪念日",
        date: "2024-12-02",
        type: "anniversary",
        repeatsYearly: true,
        leadDays: 30,
        notes: ""
      }
    });
    const preference = await context.app.inject({
      method: "POST",
      url: "/api/care/preferences",
      headers: headers(context.token),
      payload: { groupName: "like", content: "桂花", notes: "" }
    });
    const wish = await context.app.inject({
      method: "POST",
      url: "/api/care/wishes",
      headers: headers(context.token),
      payload: {
        title: "一起看日落",
        type: "wish",
        status: "idea",
        notes: ""
      }
    });

    expect(profile.statusCode).toBe(200);
    expect(date.statusCode).toBe(201);
    expect(date.json()).toMatchObject({ repeatsYearly: true });
    expect(date.json().days).toBeTypeOf("number");
    expect(preference.statusCode).toBe(201);
    expect(wish.statusCode).toBe(201);
  });

  it("stores a photo locally and keeps it after reading the care bundle", async () => {
    context = await createTestApp();
    const created = await context.app.inject({
      method: "POST",
      url: "/api/care/stories",
      headers: headers(context.token),
      payload: {
        happenedOn: "2026-11-12",
        title: "一起做晚饭",
        content: "盐放多了一点。",
        location: "家里",
        tag: "日常"
      }
    });
    const story = created.json() as { id: string };
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00
    ]);
    const boundary = "----care-photo-test";
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          'Content-Disposition: form-data; name="file"; filename="story.png"\r\n' +
          "Content-Type: image/png\r\n\r\n"
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const uploaded = await context.app.inject({
      method: "POST",
      url: `/api/care/stories/${story.id}/photo`,
      headers: {
        ...headers(context.token),
        "content-type": `multipart/form-data; boundary=${boundary}`
      },
      payload: body
    });
    const bundle = await context.app.inject({
      method: "GET",
      url: "/api/care",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json().photoUrl).toContain(`/api/care/stories/${story.id}/photo?v=`);
    expect(bundle.json().stories[0].photoUrl).toContain(
      `/api/care/stories/${story.id}/photo?v=`
    );
    expect(fs.readdirSync(`${context.dataDir}/attachments`)).toHaveLength(1);
  });

  it("turns a care wish into a source item available to today's plan", async () => {
    context = await createTestApp();
    const wishId = crypto.randomUUID();
    const now = new Date().toISOString();
    context.app.localDatabase
      .prepare(
        "INSERT INTO care_wishes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(wishId, "准备纪念日惊喜", now, now);
    const sources = await context.app.inject({
      method: "GET",
      url: "/api/day-plans/sources",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(sources.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: "care",
          id: wishId,
          title: "准备纪念日惊喜"
        })
      ])
    );
  });

  it("rejects a decimal wish budget because budgets must be whole yuan", async () => {
    context = await createTestApp();
    const response = await context.app.inject({
      method: "POST",
      url: "/api/care/wishes",
      headers: headers(context.token),
      payload: {
        title: "一起看日落",
        type: "wish",
        status: "idea",
        budget: 199.5,
        notes: ""
      }
    });

    expect(response.statusCode).toBe(400);
  });
});
