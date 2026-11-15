import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestAppContext } from "../helpers/test-app";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

function headers(token: string) {
  return {
    host: "127.0.0.1:4317",
    "x-app-token": token
  };
}

describe("memos and today plan", () => {
  it("creates, completes and converts a memo into today's plan", async () => {
    context = await createTestApp();
    const created = await context.app.inject({
      method: "POST",
      url: "/api/memos",
      headers: headers(context.token),
      payload: { content: "给纪念日准备小惊喜" }
    });
    expect(created.statusCode).toBe(201);
    const memo = created.json() as { id: string };

    const completed = await context.app.inject({
      method: "PATCH",
      url: `/api/memos/${memo.id}`,
      headers: headers(context.token),
      payload: { completed: true }
    });
    expect(completed.json()).toMatchObject({ completed: 1 });

    const converted = await context.app.inject({
      method: "POST",
      url: `/api/memos/${memo.id}/convert-to-day`,
      headers: headers(context.token)
    });
    expect(converted.statusCode).toBe(200);

    const plans = await context.app.inject({
      method: "GET",
      url: `/api/day-plans?date=${new Date().toISOString().slice(0, 10)}`,
      headers: { host: "127.0.0.1:4317" }
    });
    expect(plans.json().plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "给纪念日准备小惊喜", status: "pending" })
      ])
    );
  });

  it("uses the latest source title while retaining a separate execution state", async () => {
    context = await createTestApp();
    const projectId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const now = new Date().toISOString();
    context.app.localDatabase
      .prepare(
        "INSERT INTO dev_projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(projectId, "测试项目", now, now);
    context.app.localDatabase
      .prepare(
        `INSERT INTO dev_items
         (id, project_id, title, type, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, 'feature', 'medium', 'todo', ?, ?)`
      )
      .run(itemId, projectId, "旧标题", now, now);

    const created = await context.app.inject({
      method: "POST",
      url: "/api/day-plans",
      headers: headers(context.token),
      payload: {
        date: new Date().toISOString().slice(0, 10),
        sourceModule: "dev",
        sourceId: itemId
      }
    });
    expect(created.statusCode).toBe(201);

    context.app.localDatabase
      .prepare("UPDATE dev_items SET title = ? WHERE id = ?")
      .run("新标题", itemId);

    const plans = await context.app.inject({
      method: "GET",
      url: `/api/day-plans?date=${new Date().toISOString().slice(0, 10)}`,
      headers: { host: "127.0.0.1:4317" }
    });
    const plan = plans.json().plans[0];
    expect(plan).toMatchObject({
      title: "新标题",
      sourceExists: true,
      status: "pending"
    });
    expect(
      context.app.localDatabase
        .prepare("SELECT status FROM dev_items WHERE id = ?")
        .pluck()
        .get(itemId)
    ).toBe("todo");
  });

  it("prevents duplicate source references on the same day", async () => {
    context = await createTestApp();
    const now = new Date().toISOString();
    const wishId = crypto.randomUUID();
    context.app.localDatabase
      .prepare(
        "INSERT INTO care_wishes (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(wishId, "一起看日落", now, now);

    const payload = {
      date: new Date().toISOString().slice(0, 10),
      sourceModule: "care",
      sourceId: wishId
    };
    const first = await context.app.inject({
      method: "POST",
      url: "/api/day-plans",
      headers: headers(context.token),
      payload
    });
    const duplicate = await context.app.inject({
      method: "POST",
      url: "/api/day-plans",
      headers: headers(context.token),
      payload
    });

    expect(first.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
  });

  it("excludes cancelled plans from progress", async () => {
    context = await createTestApp();
    const date = new Date().toISOString().slice(0, 10);
    const ids: string[] = [];
    for (const [index, status] of ["completed", "pending", "cancelled"].entries()) {
      const id = crypto.randomUUID();
      ids.push(id);
      context.app.localDatabase
        .prepare(
          `INSERT INTO day_plans
           (id, title, date, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(id, `计划${index}`, date, status, new Date().toISOString(), new Date().toISOString());
    }

    const response = await context.app.inject({
      method: "GET",
      url: `/api/day-plans?date=${date}`,
      headers: { host: "127.0.0.1:4317" }
    });

    expect(response.json().progress).toEqual({
      completed: 1,
      total: 2,
      percent: 50
    });
  });

  it("keeps a title snapshot and marks a deleted source while preserving the today plan", async () => {
    context = await createTestApp();
    const now = new Date().toISOString();
    const projectId = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    context.app.localDatabase
      .prepare(
        "INSERT INTO dev_projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(projectId, "来源项目", now, now);
    context.app.localDatabase
      .prepare(
        "INSERT INTO dev_items (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(itemId, projectId, "会被删除的来源", now, now);
    const created = await context.app.inject({
      method: "POST",
      url: "/api/day-plans",
      headers: headers(context.token),
      payload: {
        date: new Date().toISOString().slice(0, 10),
        sourceModule: "dev",
        sourceId: itemId
      }
    });
    expect(created.statusCode).toBe(201);

    const deleted = await context.app.inject({
      method: "DELETE",
      url: `/api/dev/items/${itemId}`,
      headers: headers(context.token)
    });
    const plans = await context.app.inject({
      method: "GET",
      url: `/api/day-plans?date=${new Date().toISOString().slice(0, 10)}`,
      headers: { host: "127.0.0.1:4317" }
    });

    expect(deleted.statusCode).toBe(200);
    expect(plans.json().plans[0]).toMatchObject({
      title: "会被删除的来源",
      sourceExists: false
    });
  });
});
