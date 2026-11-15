import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  mealLogSchema,
  mealPlanSchema,
  shoppingItemSchema,
  waterLogSchema
} from "../../../shared/schemas/diet";
import { AppError } from "./errors";
import { localDateString } from "../services/dates";

export function registerDietRoutes(app: FastifyInstance): void {
  app.get("/api/diet", async (request) => {
    const query = request.query as { date?: string };
    const date = query.date ?? localDateString();
    return getDietBundle(app, date);
  });

  app.post("/api/diet/meal-plans", async (request, reply) => {
    const parsed = mealPlanSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MEAL_PLAN", "餐食计划无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO meal_plans
         (id, plan_date, meal_type, foods, planned_time, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, parsed.data.planDate, parsed.data.mealType, parsed.data.foods, parsed.data.plannedTime ?? null, parsed.data.notes, now, now);
    return reply.status(201).send(rowById(app, "meal_plans", id));
  });

  app.patch("/api/diet/meal-plans/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!rowById(app, "meal_plans", id)) throw new AppError(404, "MEAL_PLAN_NOT_FOUND", "餐食计划不存在");
    const parsed = mealPlanSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MEAL_PLAN", "餐食计划无效");
    app.localDatabase
      .prepare(
        `UPDATE meal_plans SET plan_date = ?, meal_type = ?, foods = ?,
          planned_time = ?, notes = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.planDate,
        parsed.data.mealType,
        parsed.data.foods,
        parsed.data.plannedTime ?? null,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return rowById(app, "meal_plans", id);
  });

  app.delete("/api/diet/meal-plans/:id", async (request) => {
    return deleteById(app, "meal_plans", (request.params as { id: string }).id, "膳食计划");
  });

  app.post("/api/diet/meal-logs", async (request, reply) => {
    const parsed = mealLogSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MEAL_LOG", "用餐记录无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO meal_logs
         (id, log_date, meal_type, foods, eaten_at, feelings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, parsed.data.logDate, parsed.data.mealType, parsed.data.foods, parsed.data.eatenAt ?? null, parsed.data.feelings, now, now);
    return reply.status(201).send(rowById(app, "meal_logs", id));
  });

  app.patch("/api/diet/meal-logs/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!rowById(app, "meal_logs", id)) throw new AppError(404, "MEAL_LOG_NOT_FOUND", "用餐记录不存在");
    const parsed = mealLogSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MEAL_LOG", "用餐记录无效");
    app.localDatabase
      .prepare(
        `UPDATE meal_logs SET log_date = ?, meal_type = ?, foods = ?,
          eaten_at = ?, feelings = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.logDate,
        parsed.data.mealType,
        parsed.data.foods,
        parsed.data.eatenAt ?? null,
        parsed.data.feelings,
        new Date().toISOString(),
        id
      );
    return rowById(app, "meal_logs", id);
  });

  app.delete("/api/diet/meal-logs/:id", async (request) => {
    return deleteById(app, "meal_logs", (request.params as { id: string }).id, "用餐记录");
  });

  app.post("/api/diet/water", async (request, reply) => {
    const parsed = waterLogSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_WATER", "饮水记录无效");
    const id = crypto.randomUUID();
    app.localDatabase
      .prepare(
        "INSERT INTO water_logs (id, log_date, amount_ml, logged_at) VALUES (?, ?, ?, ?)"
      )
      .run(id, parsed.data.logDate, parsed.data.amountMl, new Date().toISOString());
    return reply.status(201).send({ id, ...parsed.data });
  });

  app.delete("/api/diet/water/:id", async (request) => {
    return deleteById(app, "water_logs", (request.params as { id: string }).id, "饮水记录");
  });

  app.post("/api/diet/shopping", async (request, reply) => {
    const parsed = shoppingItemSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_SHOPPING_ITEM", "采购项无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO shopping_items (id, name, category, purchased, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, parsed.data.name, parsed.data.category, parsed.data.purchased ? 1 : 0, now, now);
    return reply.status(201).send(findShopping(app, id));
  });

  app.patch("/api/diet/shopping/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findShopping(app, id);
    if (!current) throw new AppError(404, "SHOPPING_NOT_FOUND", "采购项不存在");
    const body = request.body as Record<string, unknown>;
    const parsed = shoppingItemSchema.safeParse({
      ...current,
      ...body,
      purchased: Boolean(body.purchased ?? (current as { purchased: number }).purchased)
    });
    if (!parsed.success) throw new AppError(400, "INVALID_SHOPPING_ITEM", "采购项无效");
    app.localDatabase
      .prepare(
        "UPDATE shopping_items SET name = ?, category = ?, purchased = ?, updated_at = ? WHERE id = ?"
      )
      .run(
        parsed.data.name,
        parsed.data.category,
        parsed.data.purchased ? 1 : 0,
        new Date().toISOString(),
        id
      );
    return findShopping(app, id);
  });

  app.delete("/api/diet/shopping/:id", async (request) => {
    return deleteById(app, "shopping_items", (request.params as { id: string }).id, "采购项");
  });

  app.post("/api/diet/shopping/from-meals", async (request, reply) => {
    const body = request.body as { date?: string };
    const date = body?.date ?? localDateString();
    const meals = app.localDatabase
      .prepare("SELECT foods FROM meal_plans WHERE plan_date = ?")
      .all(date) as Array<{ foods: string }>;
    const words = new Set(
      meals
        .flatMap((meal) => meal.foods.split(/[、,，;；\s]+/))
        .map((word) => word.trim())
        .filter(Boolean)
    );
    const insert = app.localDatabase.prepare(
      `INSERT INTO shopping_items (id, name, category, purchased, created_at, updated_at)
       VALUES (?, ?, '', 0, ?, ?)`
    );
    const now = new Date().toISOString();
    app.localDatabase.transaction(() => {
      for (const word of words) {
        const exists = app.localDatabase
          .prepare("SELECT id FROM shopping_items WHERE name = ? AND purchased = 0")
          .get(word);
        if (!exists) insert.run(crypto.randomUUID(), word, now, now);
      }
    })();
    return reply.status(201).send({ added: words.size });
  });
}

function getDietBundle(app: FastifyInstance, date: string) {
  const mealPlans = app.localDatabase
    .prepare(
      `SELECT id, plan_date AS planDate, meal_type AS mealType, foods,
        planned_time AS plannedTime, notes FROM meal_plans WHERE plan_date = ?`
    )
    .all(date);
  const mealLogs = app.localDatabase
    .prepare(
      `SELECT id, log_date AS logDate, meal_type AS mealType, foods,
        eaten_at AS eatenAt, feelings FROM meal_logs WHERE log_date = ?`
    )
    .all(date);
  const waterLogs = app.localDatabase
    .prepare(
      "SELECT id, log_date AS logDate, amount_ml AS amountMl, logged_at AS loggedAt FROM water_logs WHERE log_date = ?"
    )
    .all(date);
  const shopping = app.localDatabase
    .prepare(
      "SELECT id, name, category, purchased FROM shopping_items ORDER BY purchased, created_at DESC"
    )
    .all();
  const recentMeals = app.localDatabase
    .prepare(
      `SELECT foods, meal_type AS mealType, MAX(log_date) AS lastDate
       FROM meal_logs GROUP BY foods, meal_type ORDER BY lastDate DESC LIMIT 6`
    )
    .all();
  return {
    date,
    mealPlans,
    mealLogs,
    waterLogs,
    waterTotal: (waterLogs as Array<{ amountMl: number }>).reduce(
      (sum, item) => sum + item.amountMl,
      0
    ),
    shopping,
    recentMeals
  };
}

function rowById(app: FastifyInstance, table: string, id: string) {
  if (table === "meal_plans") {
    return app.localDatabase
      .prepare(
        `SELECT id, plan_date AS planDate, meal_type AS mealType, foods,
          planned_time AS plannedTime, notes FROM meal_plans WHERE id = ?`
      )
      .get(id);
  }
  return app.localDatabase
    .prepare(
      `SELECT id, log_date AS logDate, meal_type AS mealType, foods,
        eaten_at AS eatenAt, feelings FROM meal_logs WHERE id = ?`
    )
    .get(id);
}

function findShopping(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare("SELECT id, name, category, purchased FROM shopping_items WHERE id = ?")
      .get(id) ?? null
  );
}

function deleteById(app: FastifyInstance, table: string, id: string, label: string) {
  const result = app.localDatabase.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (result.changes === 0) throw new AppError(404, "NOT_FOUND", `${label}不存在`);
  return { ok: true };
}
