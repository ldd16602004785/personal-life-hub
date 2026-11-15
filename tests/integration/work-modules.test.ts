import crypto from "node:crypto";
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

describe("development and consulting modules", () => {
  it("maintains dev projects, items, milestones and work logs", async () => {
    context = await createTestApp();
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/dev/projects",
      headers: headers(context.token),
      payload: { name: "本地工作台", description: "开发项目", status: "active" }
    });
    const project = projectResponse.json() as { id: string };
    const itemResponse = await context.app.inject({
      method: "POST",
      url: "/api/dev/items",
      headers: headers(context.token),
      payload: {
        projectId: project.id,
        title: "实现首页汇总",
        type: "feature",
        priority: "high",
        status: "in_progress"
      }
    });
    const item = itemResponse.json() as { id: string };
    const milestone = await context.app.inject({
      method: "POST",
      url: "/api/dev/milestones",
      headers: headers(context.token),
      payload: {
        projectId: project.id,
        name: "第一版验收",
        targetDate: "2026-11-30"
      }
    });
    const time = await context.app.inject({
      method: "POST",
      url: "/api/dev/time-entries",
      headers: headers(context.token),
      payload: {
        projectId: project.id,
        itemId: item.id,
        workDate: new Date().toISOString().slice(0, 10),
        durationMinutes: 90,
        notes: "完成数据接口"
      }
    });
    const bundle = await context.app.inject({
      method: "GET",
      url: "/api/dev",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(projectResponse.statusCode).toBe(201);
    expect(itemResponse.statusCode).toBe(201);
    expect(milestone.statusCode).toBe(201);
    expect(time.statusCode).toBe(201);
    expect(bundle.json()).toMatchObject({
      projects: [expect.objectContaining({ name: "本地工作台", itemCount: 1 })],
      items: [expect.objectContaining({ title: "实现首页汇总" })],
      milestones: [expect.objectContaining({ name: "第一版验收" })],
      timeEntries: [expect.objectContaining({ durationMinutes: 90 })]
    });
  });

  it("keeps consulting clients, projects, sessions and follow-up actions linked", async () => {
    context = await createTestApp();
    const clientResponse = await context.app.inject({
      method: "POST",
      url: "/api/consulting/clients",
      headers: headers(context.token),
      payload: {
        name: "林先生",
        contactNotes: "周末联系",
        direction: "产品咨询",
        status: "active"
      }
    });
    const client = clientResponse.json() as { id: string };
    const projectResponse = await context.app.inject({
      method: "POST",
      url: "/api/consulting/projects",
      headers: headers(context.token),
      payload: {
        clientId: client.id,
        name: "产品方向复盘",
        goal: "确认下一阶段方向",
        status: "active",
        nextSessionAt: "2026-11-20T15:00",
        feeStatus: "pending"
      }
    });
    const project = projectResponse.json() as { id: string };
    const session = await context.app.inject({
      method: "POST",
      url: "/api/consulting/sessions",
      headers: headers(context.token),
      payload: {
        projectId: project.id,
        sessionDate: "2026-11-20",
        durationMinutes: 60,
        method: "线上",
        topics: "产品方向",
        conclusions: "确定测试方案"
      }
    });
    const action = await context.app.inject({
      method: "POST",
      url: "/api/consulting/actions",
      headers: headers(context.token),
      payload: {
        projectId: project.id,
        title: "发送测试方案",
        owner: "我",
        dueDate: "2026-11-18"
      }
    });
    const bundle = await context.app.inject({
      method: "GET",
      url: "/api/consulting",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(clientResponse.statusCode).toBe(201);
    expect(projectResponse.statusCode).toBe(201);
    expect(session.statusCode).toBe(201);
    expect(action.statusCode).toBe(201);
    expect(bundle.json()).toMatchObject({
      clients: [expect.objectContaining({ name: "林先生" })],
      projects: [expect.objectContaining({ name: "产品方向复盘", feeStatus: "pending" })],
      sessions: [expect.objectContaining({ topics: "产品方向" })],
      actions: [expect.objectContaining({ title: "发送测试方案" })]
    });
  });

  it("publishes consulting actions as today-plan sources", async () => {
    context = await createTestApp();
    const clientId = crypto.randomUUID();
    const projectId = crypto.randomUUID();
    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    context.app.localDatabase
      .prepare(
        "INSERT INTO consulting_clients (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(clientId, "测试客户", now, now);
    context.app.localDatabase
      .prepare(
        "INSERT INTO consulting_projects (id, client_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(projectId, clientId, "测试项目", now, now);
    context.app.localDatabase
      .prepare(
        "INSERT INTO consulting_actions (id, project_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(actionId, projectId, "发送会议材料", now, now);

    const sources = await context.app.inject({
      method: "GET",
      url: "/api/day-plans/sources",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(sources.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: "consulting",
          id: actionId,
          title: "发送会议材料"
        })
      ])
    );
  });
});
