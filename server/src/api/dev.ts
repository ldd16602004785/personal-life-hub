import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  devItemSchema,
  devMilestoneSchema,
  devProjectSchema,
  devTimeEntrySchema
} from "../../../shared/schemas/dev";
import { AppError } from "./errors";

export function registerDevRoutes(app: FastifyInstance): void {
  app.get("/api/dev", async () => getDevBundle(app));

  app.post("/api/dev/projects", async (request, reply) => {
    const parsed = devProjectSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_DEV_PROJECT", "项目内容无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO dev_projects
         (id, name, description, status, start_date, due_date, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.name,
        parsed.data.description,
        parsed.data.status,
        parsed.data.startDate ?? null,
        parsed.data.dueDate ?? null,
        parsed.data.archived ? 1 : 0,
        now,
        now
      );
    return reply.status(201).send(findDevProject(app, id));
  });

  app.patch("/api/dev/projects/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findDevProject(app, id);
    if (!current) throw new AppError(404, "DEV_PROJECT_NOT_FOUND", "开发项目不存在");
    const body = request.body as Record<string, unknown>;
    const parsed = devProjectSchema.safeParse({
      ...current,
      ...body,
      archived: Boolean(body.archived ?? (current as { archived: number }).archived)
    });
    if (!parsed.success) throw new AppError(400, "INVALID_DEV_PROJECT", "项目内容无效");
    app.localDatabase
      .prepare(
        `UPDATE dev_projects SET name = ?, description = ?, status = ?,
          start_date = ?, due_date = ?, archived = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.name,
        parsed.data.description,
        parsed.data.status,
        parsed.data.startDate ?? null,
        parsed.data.dueDate ?? null,
        parsed.data.archived ? 1 : 0,
        new Date().toISOString(),
        id
      );
    return findDevProject(app, id);
  });

  app.delete("/api/dev/projects/:id", async (request) => {
    const { id } = request.params as { id: string };
    const counts = app.localDatabase
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM dev_items WHERE project_id = ?) AS items,
          (SELECT COUNT(*) FROM dev_milestones WHERE project_id = ?) AS milestones,
          (SELECT COUNT(*) FROM dev_time_entries WHERE project_id = ?) AS timeEntries`
      )
      .get(id, id, id) as { items: number; milestones: number; timeEntries: number };
    const result = app.localDatabase.prepare("DELETE FROM dev_projects WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "DEV_PROJECT_NOT_FOUND", "开发项目不存在");
    return { ok: true, removed: counts };
  });

  app.post("/api/dev/items", async (request, reply) => {
    const parsed = devItemSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_DEV_ITEM", "开发事项内容无效");
    ensureProject(app, parsed.data.projectId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO dev_items
         (id, project_id, title, type, priority, status, due_date, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.projectId,
        parsed.data.title,
        parsed.data.type,
        parsed.data.priority,
        parsed.data.status,
        parsed.data.dueDate ?? null,
        parsed.data.description,
        now,
        now
      );
    return reply.status(201).send(findDevItem(app, id));
  });

  app.patch("/api/dev/items/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findDevItem(app, id);
    if (!current) throw new AppError(404, "DEV_ITEM_NOT_FOUND", "开发事项不存在");
    const parsed = devItemSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_DEV_ITEM", "开发事项内容无效");
    ensureProject(app, parsed.data.projectId);
    app.localDatabase
      .prepare(
        `UPDATE dev_items SET project_id = ?, title = ?, type = ?, priority = ?,
          status = ?, due_date = ?, description = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.projectId,
        parsed.data.title,
        parsed.data.type,
        parsed.data.priority,
        parsed.data.status,
        parsed.data.dueDate ?? null,
        parsed.data.description,
        new Date().toISOString(),
        id
      );
    return findDevItem(app, id);
  });

  app.delete("/api/dev/items/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM dev_items WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "DEV_ITEM_NOT_FOUND", "开发事项不存在");
    return { ok: true };
  });

  app.post("/api/dev/milestones", async (request, reply) => {
    const parsed = devMilestoneSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MILESTONE", "里程碑内容无效");
    ensureProject(app, parsed.data.projectId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO dev_milestones
         (id, project_id, name, target_date, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.projectId,
        parsed.data.name,
        parsed.data.targetDate,
        parsed.data.completed ? 1 : 0,
        now,
        now
      );
    return reply.status(201).send(findMilestone(app, id));
  });

  app.patch("/api/dev/milestones/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findMilestone(app, id);
    if (!current) throw new AppError(404, "MILESTONE_NOT_FOUND", "里程碑不存在");
    const body = request.body as Record<string, unknown>;
    const parsed = devMilestoneSchema.safeParse({
      ...current,
      ...body,
      completed: Boolean(body.completed ?? (current as { completed: number }).completed)
    });
    if (!parsed.success) throw new AppError(400, "INVALID_MILESTONE", "里程碑内容无效");
    app.localDatabase
      .prepare(
        "UPDATE dev_milestones SET name = ?, target_date = ?, completed = ?, updated_at = ? WHERE id = ?"
      )
      .run(
        parsed.data.name,
        parsed.data.targetDate,
        parsed.data.completed ? 1 : 0,
        new Date().toISOString(),
        id
      );
    return findMilestone(app, id);
  });

  app.delete("/api/dev/milestones/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM dev_milestones WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "MILESTONE_NOT_FOUND", "里程碑不存在");
    return { ok: true };
  });

  app.post("/api/dev/time-entries", async (request, reply) => {
    const parsed = devTimeEntrySchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_TIME_ENTRY", "工时记录无效");
    ensureProject(app, parsed.data.projectId);
    const id = crypto.randomUUID();
    app.localDatabase
      .prepare(
        `INSERT INTO dev_time_entries
         (id, project_id, item_id, work_date, duration_minutes, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.projectId,
        parsed.data.itemId ?? null,
        parsed.data.workDate,
        parsed.data.durationMinutes,
        parsed.data.notes,
        new Date().toISOString()
      );
    return reply.status(201).send(findTimeEntry(app, id));
  });

  app.delete("/api/dev/time-entries/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM dev_time_entries WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "TIME_ENTRY_NOT_FOUND", "工时记录不存在");
    return { ok: true };
  });
}

function getDevBundle(app: FastifyInstance) {
  const projects = app.localDatabase
    .prepare(
      `SELECT p.id, p.name, p.description, p.status, p.start_date AS startDate,
        p.due_date AS dueDate, p.archived, p.created_at AS createdAt, p.updated_at AS updatedAt,
        (SELECT COUNT(*) FROM dev_items i WHERE i.project_id = p.id) AS itemCount,
        (SELECT COUNT(*) FROM dev_items i WHERE i.project_id = p.id AND i.status = 'completed') AS completedCount,
        (SELECT coalesce(SUM(duration_minutes), 0) FROM dev_time_entries t WHERE t.project_id = p.id) AS totalMinutes,
        (SELECT name FROM dev_milestones m WHERE m.project_id = p.id AND m.completed = 0 ORDER BY m.target_date LIMIT 1) AS nextMilestone
       FROM dev_projects p ORDER BY p.archived, p.updated_at DESC`
    )
    .all();
  const items = app.localDatabase
    .prepare(
      `SELECT id, project_id AS projectId, title, type, priority, status,
        due_date AS dueDate, description, created_at AS createdAt, updated_at AS updatedAt
       FROM dev_items ORDER BY created_at DESC`
    )
    .all();
  const milestones = app.localDatabase
    .prepare(
      `SELECT id, project_id AS projectId, name, target_date AS targetDate,
        completed, created_at AS createdAt, updated_at AS updatedAt
       FROM dev_milestones ORDER BY target_date`
    )
    .all();
  const timeEntries = app.localDatabase
    .prepare(
      `SELECT id, project_id AS projectId, item_id AS itemId,
        work_date AS workDate, duration_minutes AS durationMinutes, notes, created_at AS createdAt
       FROM dev_time_entries ORDER BY work_date DESC, created_at DESC`
    )
    .all();
  return { projects, items, milestones, timeEntries };
}

function ensureProject(app: FastifyInstance, id: string): void {
  const row = app.localDatabase.prepare("SELECT id FROM dev_projects WHERE id = ?").get(id);
  if (!row) throw new AppError(404, "DEV_PROJECT_NOT_FOUND", "开发项目不存在");
}

function findDevProject(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, name, description, status, start_date AS startDate,
          due_date AS dueDate, archived, created_at AS createdAt, updated_at AS updatedAt
         FROM dev_projects WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function findDevItem(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, project_id AS projectId, title, type, priority, status,
          due_date AS dueDate, description, created_at AS createdAt, updated_at AS updatedAt
         FROM dev_items WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function findMilestone(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, project_id AS projectId, name, target_date AS targetDate,
          completed, created_at AS createdAt, updated_at AS updatedAt
         FROM dev_milestones WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function findTimeEntry(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, project_id AS projectId, item_id AS itemId,
          work_date AS workDate, duration_minutes AS durationMinutes, notes, created_at AS createdAt
         FROM dev_time_entries WHERE id = ?`
      )
      .get(id) ?? null
  );
}
