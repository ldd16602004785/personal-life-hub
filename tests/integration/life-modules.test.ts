import { afterEach, describe, expect, it } from "vitest";
import { localDateString } from "../../server/src/services/dates";
import { createTestApp, type TestAppContext } from "../helpers/test-app";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

function headers(token: string) {
  return { host: "127.0.0.1:4317", "x-app-token": token };
}

describe("fitness, diet and entertainment modules", () => {
  it("creates a workout template, starts a session and stores actual exercise data", async () => {
    context = await createTestApp();
    const templateResponse = await context.app.inject({
      method: "POST",
      url: "/api/fitness/templates",
      headers: headers(context.token),
      payload: {
        name: "下肢力量",
        weekday: 3,
        bodyPart: "下肢",
        durationMinutes: 50,
        exercises: [
          { name: "杠铃深蹲", targetSets: 4, targetReps: 8, targetWeight: 60, notes: "" },
          { name: "罗马尼亚硬拉", targetSets: 4, targetReps: 10, targetWeight: 50, notes: "" }
        ]
      }
    });
    const template = templateResponse.json();
    const sessionResponse = await context.app.inject({
      method: "POST",
      url: "/api/fitness/sessions",
      headers: headers(context.token),
      payload: { templateId: template.id, sessionDate: localDateString() }
    });
    const session = sessionResponse.json();
    const updated = await context.app.inject({
      method: "PATCH",
      url: `/api/fitness/sessions/${session.id}`,
      headers: headers(context.token),
      payload: {
        status: "completed",
        feelNotes: "状态稳定",
        exercises: [
          {
            id: session.exercises[0].id,
            actualSets: 4,
            actualReps: 8,
            actualWeight: 62.5,
            completed: true
          }
        ]
      }
    });

    expect(templateResponse.statusCode).toBe(201);
    expect(template.exercises).toHaveLength(2);
    expect(session.exercises).toHaveLength(2);
    expect(updated.json()).toMatchObject({
      status: "completed",
      feelNotes: "状态稳定",
      exercises: expect.arrayContaining([
        expect.objectContaining({ name: "杠铃深蹲", actualWeight: 62.5, completed: 1 })
      ])
    });
  });

  it("stores meal plans, actual meals, water and generated shopping candidates", async () => {
    context = await createTestApp();
    const date = localDateString();
    const plan = await context.app.inject({
      method: "POST",
      url: "/api/diet/meal-plans",
      headers: headers(context.token),
      payload: {
        planDate: date,
        mealType: "dinner",
        foods: "鸡胸肉、米饭、西兰花",
        plannedTime: "18:30",
        notes: ""
      }
    });
    const log = await context.app.inject({
      method: "POST",
      url: "/api/diet/meal-logs",
      headers: headers(context.token),
      payload: {
        logDate: date,
        mealType: "lunch",
        foods: "牛肉和土豆",
        eatenAt: "12:20",
        feelings: "八分饱"
      }
    });
    const water = await context.app.inject({
      method: "POST",
      url: "/api/diet/water",
      headers: headers(context.token),
      payload: { logDate: date, amountMl: 250 }
    });
    const generated = await context.app.inject({
      method: "POST",
      url: "/api/diet/shopping/from-meals",
      headers: headers(context.token),
      payload: { date }
    });
    const bundle = await context.app.inject({
      method: "GET",
      url: `/api/diet?date=${date}`,
      headers: { host: "127.0.0.1:4317" }
    });

    expect(plan.statusCode).toBe(201);
    expect(log.statusCode).toBe(201);
    expect(water.statusCode).toBe(201);
    expect(generated.json().added).toBe(3);
    expect(bundle.json()).toMatchObject({
      waterTotal: 250,
      mealPlans: [expect.objectContaining({ foods: "鸡胸肉、米饭、西兰花" })],
      mealLogs: [expect.objectContaining({ feelings: "八分饱" })],
      shopping: expect.arrayContaining([expect.objectContaining({ name: "鸡胸肉" })])
    });
  });

  it("tracks entertainment progress and logged duration", async () => {
    context = await createTestApp();
    const itemResponse = await context.app.inject({
      method: "POST",
      url: "/api/entertainment/items",
      headers: headers(context.token),
      payload: {
        mediaType: "game",
        name: "测试游戏",
        status: "active",
        progress: 30,
        notes: "继续推进主线"
      }
    });
    const item = itemResponse.json();
    const log = await context.app.inject({
      method: "POST",
      url: "/api/entertainment/logs",
      headers: headers(context.token),
      payload: {
        itemId: item.id,
        logDate: localDateString(),
        durationMinutes: 90,
        progress: 62,
        notes: "推进一章"
      }
    });
    const bundle = await context.app.inject({
      method: "GET",
      url: "/api/entertainment",
      headers: { host: "127.0.0.1:4317" }
    });

    expect(itemResponse.statusCode).toBe(201);
    expect(log.statusCode).toBe(201);
    expect(bundle.json()).toMatchObject({
      items: [expect.objectContaining({ name: "测试游戏", progress: 62 })],
      logs: [expect.objectContaining({ durationMinutes: 90 })]
    });
  });
});
