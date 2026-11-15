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

describe("development and learning modules", () => {
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

  it("links learning goals, stages, daily tasks and progress logs", async () => {
    context = await createTestApp();
    const goalResponse = await context.app.inject({
      method: "POST",
      url: "/api/learning/goals",
      headers: headers(context.token),
      payload: {
        title: "掌握 TypeScript",
        description: "完成基础与项目实践",
        category: "技能",
        status: "active",
        progress: 0
      }
    });
    const goal = goalResponse.json() as { id: string };
    const stageResponse = await context.app.inject({
      method: "POST",
      url: "/api/learning/stages",
      headers: headers(context.token),
      payload: {
        goalId: goal.id,
        title: "基础语法",
        status: "in_progress",
        position: 1,
        notes: ""
      }
    });
    const stage = stageResponse.json() as { id: string };
    const taskResponse = await context.app.inject({
      method: "POST",
      url: "/api/learning/tasks",
      headers: headers(context.token),
      payload: {
        goalId: goal.id,
        stageId: stage.id,
        title: "完成类型系统练习",
        planDate: new Date().toISOString().slice(0, 10),
        status: "todo",
        estimatedMinutes: 45,
        notes: ""
      }
    });
    const task = taskResponse.json() as { id: string };
    const logResponse = await context.app.inject({
      method: "POST",
      url: "/api/learning/logs",
      headers: headers(context.token),
      payload: {
        goalId: goal.id,
        taskId: task.id,
        studyDate: new Date().toISOString().slice(0, 10),
        durationMinutes: 45,
        content: "完成泛型练习",
        progressAfter: 35
      }
    });
    const bundle = await context.app.inject({
      method: "GET",
      url: "/api/learning",
      headers: { host: "127.0.0.1:4317" }
    });
    const dashboard = await context.app.inject({
      method: "GET",
      url: "/api/dashboard",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(goalResponse.statusCode).toBe(201);
    expect(stageResponse.statusCode).toBe(201);
    expect(taskResponse.statusCode).toBe(201);
    expect(logResponse.statusCode).toBe(201);
    expect(bundle.json()).toMatchObject({
      goals: [expect.objectContaining({ title: "掌握 TypeScript", progress: 35 })],
      stages: [expect.objectContaining({ title: "基础语法" })],
      tasks: [expect.objectContaining({ title: "完成类型系统练习" })],
      logs: [expect.objectContaining({ durationMinutes: 45, progressAfter: 35 })]
    });
    expect(dashboard.json().modules.learning).toMatchObject({
      activeGoals: 1,
      pendingTasks: 1,
      weekMinutes: 45,
      nextTask: {
        title: "完成类型系统练习",
        goalTitle: "掌握 TypeScript"
      }
    });
  });

  it("publishes learning tasks as today-plan sources", async () => {
    context = await createTestApp();
    const now = new Date().toISOString();
    const goalId = "learning-goal-test";
    const taskId = "learning-task-test";
    context.app.localDatabase
      .prepare(
        "INSERT INTO learning_goals (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(goalId, "测试学习目标", now, now);
    context.app.localDatabase
      .prepare(
        "INSERT INTO learning_tasks (id, goal_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(taskId, goalId, "阅读一章", now, now);

    const sources = await context.app.inject({
      method: "GET",
      url: "/api/day-plans/sources",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(sources.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          module: "learning",
          id: taskId,
          title: "阅读一章"
        })
      ])
    );
  });
});
