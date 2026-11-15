import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  dayPlanCreateSchema,
  dayPlanUpdateSchema,
  moduleSourceSchema
} from "../../../shared/schemas/day-plan";
import { AppError } from "./errors";
import { listSourceItems, resolveSource } from "../services/source-items";

interface DayPlanRow {
  id: string;
  title: string;
  date: string;
  startTime: string | null;
  durationMinutes: number | null;
  priority: string;
  sourceType: string;
  sourceModule: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export function registerDayPlanRoutes(app: FastifyInstance): void {
  app.get("/api/day-plans", async (request) => {
    const query = request.query as { date?: string };
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(400, "INVALID_DATE", "日期格式无效");
    }
    const plans = listDayPlans(app, date);
    return {
      date,
      plans,
      progress: calculateProgress(plans)
    };
  });

  app.get("/api/day-plans/sources", async () => ({
    items: listSourceItems(app.localDatabase)
  }));

  app.post("/api/day-plans", async (request, reply) => {
    const parsed = dayPlanCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_DAY_PLAN", "今日计划内容无效");
    }
    const input = parsed.data;
    const source = input.sourceModule && input.sourceId
      ? resolveSource(app.localDatabase, input.sourceModule, input.sourceId)
      : null;
    if (input.sourceModule && !source) {
      throw new AppError(404, "SOURCE_NOT_FOUND", "来源记录不存在");
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const title = source?.title ?? input.title!;
    try {
      app.localDatabase
        .prepare(
          `INSERT INTO day_plans
           (id, title, date, start_time, duration_minutes, priority, source_type,
            source_module, source_id, source_title, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
        )
        .run(
          id,
          title,
          input.date,
          input.startTime ?? null,
          input.durationMinutes ?? null,
          input.priority,
          source ? "module" : "custom",
          source?.module ?? null,
          source?.id ?? null,
          source?.title ?? null,
          input.notes,
          now,
          now
        );
    } catch (error) {
      if (String(error).includes("UNIQUE constraint failed")) {
        throw new AppError(409, "ALREADY_SCHEDULED", "该事项已经安排在今天");
      }
      throw error;
    }

    return reply.status(201).send(findDayPlan(app, id));
  });

  app.patch("/api/day-plans/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findDayPlan(app, id);
    if (!current) throw new AppError(404, "DAY_PLAN_NOT_FOUND", "今日计划不存在");
    const parsed = dayPlanUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, "INVALID_DAY_PLAN", "今日计划修改内容无效");
    }
    const value = parsed.data;
    app.localDatabase
      .prepare(
        `UPDATE day_plans SET
          start_time = ?, duration_minutes = ?, priority = ?, status = ?, notes = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        value.startTime === undefined ? current.startTime : value.startTime,
        value.durationMinutes === undefined
          ? current.durationMinutes
          : value.durationMinutes,
        value.priority ?? current.priority,
        value.status ?? current.status,
        value.notes ?? current.notes,
        new Date().toISOString(),
        id
      );
    return findDayPlan(app, id);
  });

  app.delete("/api/day-plans/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM day_plans WHERE id = ?").run(id);
    if (result.changes === 0) {
      throw new AppError(404, "DAY_PLAN_NOT_FOUND", "今日计划不存在");
    }
    return { ok: true };
  });
}

function listDayPlans(app: FastifyInstance, date: string): DayPlanRow[] {
  const rows = app.localDatabase
    .prepare(
      `SELECT id, title, date, start_time AS startTime,
        duration_minutes AS durationMinutes, priority,
        source_type AS sourceType, source_module AS sourceModule,
        source_id AS sourceId, source_title AS sourceTitle, status, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM day_plans WHERE date = ?
       ORDER BY coalesce(start_time, '99:99'), created_at`
    )
    .all(date) as DayPlanRow[];

  return rows.map((row) => enrichSource(app, row));
}

function findDayPlan(app: FastifyInstance, id: string): DayPlanRow | null {
  const row = app.localDatabase
    .prepare(
      `SELECT id, title, date, start_time AS startTime,
        duration_minutes AS durationMinutes, priority,
        source_type AS sourceType, source_module AS sourceModule,
        source_id AS sourceId, source_title AS sourceTitle, status, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM day_plans WHERE id = ?`
    )
    .get(id) as DayPlanRow | undefined;
  return row ? enrichSource(app, row) : null;
}

function enrichSource(app: FastifyInstance, row: DayPlanRow): DayPlanRow & {
  sourceExists: boolean;
} {
  if (row.sourceType !== "module" || !row.sourceModule || !row.sourceId) {
    return { ...row, sourceExists: true };
  }
  const module = moduleSourceSchema.safeParse(row.sourceModule);
  const source = module.success
    ? resolveSource(app.localDatabase, module.data, row.sourceId)
    : null;
  return {
    ...row,
    title: source?.title ?? row.sourceTitle ?? row.title,
    sourceExists: Boolean(source)
  };
}

function calculateProgress(plans: DayPlanRow[]) {
  const active = plans.filter((plan) => plan.status !== "cancelled");
  const completed = active.filter((plan) => plan.status === "completed").length;
  return {
    completed,
    total: active.length,
    percent: active.length === 0 ? 0 : Math.round((completed / active.length) * 100)
  };
}
