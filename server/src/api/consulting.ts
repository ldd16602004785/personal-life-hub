import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  consultingActionSchema,
  consultingClientSchema,
  consultingProjectSchema,
  consultingSessionSchema
} from "../../../shared/schemas/consulting";
import { AppError } from "./errors";

export function registerConsultingRoutes(app: FastifyInstance): void {
  app.get("/api/consulting", async () => getConsultingBundle(app));

  app.post("/api/consulting/clients", async (request, reply) => {
    const parsed = consultingClientSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CLIENT", "客户资料无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO consulting_clients
         (id, name, contact_notes, direction, status, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.name,
        parsed.data.contactNotes,
        parsed.data.direction,
        parsed.data.status,
        parsed.data.archived ? 1 : 0,
        now,
        now
      );
    return reply.status(201).send(findClient(app, id));
  });

  app.patch("/api/consulting/clients/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findClient(app, id);
    if (!current) throw new AppError(404, "CLIENT_NOT_FOUND", "客户不存在");
    const body = request.body as Record<string, unknown>;
    const parsed = consultingClientSchema.safeParse({
      ...current,
      ...body,
      archived: Boolean(body.archived ?? (current as { archived: number }).archived)
    });
    if (!parsed.success) throw new AppError(400, "INVALID_CLIENT", "客户资料无效");
    app.localDatabase
      .prepare(
        `UPDATE consulting_clients SET name = ?, contact_notes = ?, direction = ?,
          status = ?, archived = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.name,
        parsed.data.contactNotes,
        parsed.data.direction,
        parsed.data.status,
        parsed.data.archived ? 1 : 0,
        new Date().toISOString(),
        id
      );
    return findClient(app, id);
  });

  app.delete("/api/consulting/clients/:id", async (request) => {
    const { id } = request.params as { id: string };
    const counts = app.localDatabase
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM consulting_projects WHERE client_id = ?) AS projects,
          (SELECT COUNT(*) FROM consulting_sessions s JOIN consulting_projects p ON p.id = s.project_id WHERE p.client_id = ?) AS sessions,
          (SELECT COUNT(*) FROM consulting_actions a JOIN consulting_projects p ON p.id = a.project_id WHERE p.client_id = ?) AS actions`
      )
      .get(id, id, id);
    const result = app.localDatabase
      .prepare("DELETE FROM consulting_clients WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "CLIENT_NOT_FOUND", "客户不存在");
    return { ok: true, removed: counts };
  });

  app.post("/api/consulting/projects", async (request, reply) => {
    const parsed = consultingProjectSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CONSULT_PROJECT", "咨询项目无效");
    ensureClient(app, parsed.data.clientId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO consulting_projects
         (id, client_id, name, goal, status, start_date, next_session_at, fee_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.clientId,
        parsed.data.name,
        parsed.data.goal,
        parsed.data.status,
        parsed.data.startDate ?? null,
        parsed.data.nextSessionAt ?? null,
        parsed.data.feeStatus,
        now,
        now
      );
    return reply.status(201).send(findConsultProject(app, id));
  });

  app.patch("/api/consulting/projects/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findConsultProject(app, id);
    if (!current) throw new AppError(404, "CONSULT_PROJECT_NOT_FOUND", "咨询项目不存在");
    const parsed = consultingProjectSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_CONSULT_PROJECT", "咨询项目无效");
    app.localDatabase
      .prepare(
        `UPDATE consulting_projects SET client_id = ?, name = ?, goal = ?, status = ?,
          start_date = ?, next_session_at = ?, fee_status = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.clientId,
        parsed.data.name,
        parsed.data.goal,
        parsed.data.status,
        parsed.data.startDate ?? null,
        parsed.data.nextSessionAt ?? null,
        parsed.data.feeStatus,
        new Date().toISOString(),
        id
      );
    return findConsultProject(app, id);
  });

  app.delete("/api/consulting/projects/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM consulting_projects WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "CONSULT_PROJECT_NOT_FOUND", "咨询项目不存在");
    return { ok: true };
  });

  app.post("/api/consulting/sessions", async (request, reply) => {
    const parsed = consultingSessionSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_SESSION", "咨询记录无效");
    ensureConsultProject(app, parsed.data.projectId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO consulting_sessions
         (id, project_id, session_date, duration_minutes, method, topics, conclusions, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.projectId,
        parsed.data.sessionDate,
        parsed.data.durationMinutes ?? null,
        parsed.data.method,
        parsed.data.topics,
        parsed.data.conclusions,
        parsed.data.notes,
        now,
        now
      );
    return reply.status(201).send(findSession(app, id));
  });

  app.patch("/api/consulting/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findSession(app, id);
    if (!current) throw new AppError(404, "SESSION_NOT_FOUND", "咨询记录不存在");
    const parsed = consultingSessionSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_SESSION", "咨询记录无效");
    app.localDatabase
      .prepare(
        `UPDATE consulting_sessions SET project_id = ?, session_date = ?,
          duration_minutes = ?, method = ?, topics = ?, conclusions = ?, notes = ?,
          updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.projectId,
        parsed.data.sessionDate,
        parsed.data.durationMinutes ?? null,
        parsed.data.method,
        parsed.data.topics,
        parsed.data.conclusions,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return findSession(app, id);
  });

  app.delete("/api/consulting/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM consulting_sessions WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "SESSION_NOT_FOUND", "咨询记录不存在");
    return { ok: true };
  });

  app.post("/api/consulting/actions", async (request, reply) => {
    const parsed = consultingActionSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_ACTION", "行动项无效");
    ensureConsultProject(app, parsed.data.projectId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO consulting_actions
         (id, project_id, title, owner, due_date, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.projectId,
        parsed.data.title,
        parsed.data.owner,
        parsed.data.dueDate ?? null,
        parsed.data.completed ? 1 : 0,
        now,
        now
      );
    return reply.status(201).send(findAction(app, id));
  });

  app.patch("/api/consulting/actions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findAction(app, id);
    if (!current) throw new AppError(404, "ACTION_NOT_FOUND", "行动项不存在");
    const body = request.body as Record<string, unknown>;
    const parsed = consultingActionSchema.safeParse({
      ...current,
      ...body,
      completed: Boolean(body.completed ?? (current as { completed: number }).completed)
    });
    if (!parsed.success) throw new AppError(400, "INVALID_ACTION", "行动项无效");
    app.localDatabase
      .prepare(
        `UPDATE consulting_actions SET title = ?, owner = ?, due_date = ?,
          completed = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.title,
        parsed.data.owner,
        parsed.data.dueDate ?? null,
        parsed.data.completed ? 1 : 0,
        new Date().toISOString(),
        id
      );
    return findAction(app, id);
  });

  app.delete("/api/consulting/actions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM consulting_actions WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "ACTION_NOT_FOUND", "行动项不存在");
    return { ok: true };
  });
}

function getConsultingBundle(app: FastifyInstance) {
  const clients = app.localDatabase
    .prepare(
      `SELECT id, name, contact_notes AS contactNotes, direction, status, archived,
        created_at AS createdAt, updated_at AS updatedAt FROM consulting_clients
       ORDER BY archived, updated_at DESC`
    )
    .all();
  const projects = app.localDatabase
    .prepare(
      `SELECT id, client_id AS clientId, name, goal, status, start_date AS startDate,
        next_session_at AS nextSessionAt, fee_status AS feeStatus,
        created_at AS createdAt, updated_at AS updatedAt
       FROM consulting_projects ORDER BY updated_at DESC`
    )
    .all();
  const sessions = app.localDatabase
    .prepare(
      `SELECT id, project_id AS projectId, session_date AS sessionDate,
        duration_minutes AS durationMinutes, method, topics, conclusions, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM consulting_sessions ORDER BY session_date DESC, created_at DESC`
    )
    .all();
  const actions = app.localDatabase
    .prepare(
      `SELECT id, project_id AS projectId, title, owner, due_date AS dueDate,
        completed, created_at AS createdAt, updated_at AS updatedAt
       FROM consulting_actions ORDER BY completed, coalesce(due_date, '9999-12-31'), created_at DESC`
    )
    .all();
  return { clients, projects, sessions, actions };
}

function ensureClient(app: FastifyInstance, id: string): void {
  if (!app.localDatabase.prepare("SELECT id FROM consulting_clients WHERE id = ?").get(id)) {
    throw new AppError(404, "CLIENT_NOT_FOUND", "客户不存在");
  }
}

function ensureConsultProject(app: FastifyInstance, id: string): void {
  if (!app.localDatabase.prepare("SELECT id FROM consulting_projects WHERE id = ?").get(id)) {
    throw new AppError(404, "CONSULT_PROJECT_NOT_FOUND", "咨询项目不存在");
  }
}

function findClient(app: FastifyInstance, id: string) {
  return app.localDatabase.prepare(
    `SELECT id, name, contact_notes AS contactNotes, direction, status, archived,
      created_at AS createdAt, updated_at AS updatedAt FROM consulting_clients WHERE id = ?`
  ).get(id) ?? null;
}

function findConsultProject(app: FastifyInstance, id: string) {
  return app.localDatabase.prepare(
    `SELECT id, client_id AS clientId, name, goal, status, start_date AS startDate,
      next_session_at AS nextSessionAt, fee_status AS feeStatus,
      created_at AS createdAt, updated_at AS updatedAt
     FROM consulting_projects WHERE id = ?`
  ).get(id) ?? null;
}

function findSession(app: FastifyInstance, id: string) {
  return app.localDatabase.prepare(
    `SELECT id, project_id AS projectId, session_date AS sessionDate,
      duration_minutes AS durationMinutes, method, topics, conclusions, notes,
      created_at AS createdAt, updated_at AS updatedAt
     FROM consulting_sessions WHERE id = ?`
  ).get(id) ?? null;
}

function findAction(app: FastifyInstance, id: string) {
  return app.localDatabase.prepare(
    `SELECT id, project_id AS projectId, title, owner, due_date AS dueDate,
      completed, created_at AS createdAt, updated_at AS updatedAt
     FROM consulting_actions WHERE id = ?`
  ).get(id) ?? null;
}
