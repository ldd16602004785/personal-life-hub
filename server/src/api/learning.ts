import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  learningGoalSchema,
  learningLogSchema,
  learningStageSchema,
  learningTaskSchema
} from "../../../shared/schemas/learning";
import { AppError } from "./errors";

export function registerLearningRoutes(app: FastifyInstance): void {
  app.get("/api/learning", async () => getLearningBundle(app));

  app.post("/api/learning/goals", async (request, reply) => {
    const parsed = learningGoalSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_GOAL", "学习目标无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO learning_goals
         (id, title, description, category, status, start_date, target_date, progress, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.title,
        parsed.data.description,
        parsed.data.category,
        parsed.data.status,
        parsed.data.startDate ?? null,
        parsed.data.targetDate ?? null,
        parsed.data.progress,
        now,
        now
      );
    return reply.status(201).send(findGoal(app, id));
  });

  app.patch("/api/learning/goals/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findGoal(app, id);
    if (!current) throw new AppError(404, "LEARNING_GOAL_NOT_FOUND", "学习目标不存在");
    const parsed = learningGoalSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_GOAL", "学习目标无效");
    app.localDatabase
      .prepare(
        `UPDATE learning_goals SET title = ?, description = ?, category = ?,
          status = ?, start_date = ?, target_date = ?, progress = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        parsed.data.title,
        parsed.data.description,
        parsed.data.category,
        parsed.data.status,
        parsed.data.startDate ?? null,
        parsed.data.targetDate ?? null,
        parsed.data.progress,
        new Date().toISOString(),
        id
      );
    return findGoal(app, id);
  });

  app.delete("/api/learning/goals/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM learning_goals WHERE id = ?")
      .run(id);
    if (result.changes === 0) {
      throw new AppError(404, "LEARNING_GOAL_NOT_FOUND", "学习目标不存在");
    }
    return { ok: true };
  });

  app.post("/api/learning/stages", async (request, reply) => {
    const parsed = learningStageSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_STAGE", "学习阶段无效");
    ensureGoal(app, parsed.data.goalId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO learning_stages
         (id, goal_id, title, status, position, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.goalId,
        parsed.data.title,
        parsed.data.status,
        parsed.data.position,
        parsed.data.notes,
        now,
        now
      );
    return reply.status(201).send(findStage(app, id));
  });

  app.patch("/api/learning/stages/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findStage(app, id);
    if (!current) throw new AppError(404, "LEARNING_STAGE_NOT_FOUND", "学习阶段不存在");
    const parsed = learningStageSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_STAGE", "学习阶段无效");
    app.localDatabase
      .prepare(
        `UPDATE learning_stages SET title = ?, status = ?, position = ?,
          notes = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.title,
        parsed.data.status,
        parsed.data.position,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return findStage(app, id);
  });

  app.delete("/api/learning/stages/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM learning_stages WHERE id = ?")
      .run(id);
    if (result.changes === 0) {
      throw new AppError(404, "LEARNING_STAGE_NOT_FOUND", "学习阶段不存在");
    }
    return { ok: true };
  });

  app.post("/api/learning/tasks", async (request, reply) => {
    const parsed = learningTaskSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_TASK", "学习任务无效");
    ensureGoal(app, parsed.data.goalId);
    ensureStageBelongsToGoal(app, parsed.data.stageId ?? null, parsed.data.goalId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO learning_tasks
         (id, goal_id, stage_id, title, plan_date, status, estimated_minutes, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.goalId,
        parsed.data.stageId ?? null,
        parsed.data.title,
        parsed.data.planDate ?? null,
        parsed.data.status,
        parsed.data.estimatedMinutes ?? null,
        parsed.data.notes,
        now,
        now
      );
    return reply.status(201).send(findTask(app, id));
  });

  app.patch("/api/learning/tasks/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findTask(app, id);
    if (!current) throw new AppError(404, "LEARNING_TASK_NOT_FOUND", "学习任务不存在");
    const parsed = learningTaskSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_TASK", "学习任务无效");
    ensureStageBelongsToGoal(app, parsed.data.stageId ?? null, parsed.data.goalId);
    app.localDatabase
      .prepare(
        `UPDATE learning_tasks SET stage_id = ?, title = ?, plan_date = ?,
          status = ?, estimated_minutes = ?, notes = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.stageId ?? null,
        parsed.data.title,
        parsed.data.planDate ?? null,
        parsed.data.status,
        parsed.data.estimatedMinutes ?? null,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return findTask(app, id);
  });

  app.delete("/api/learning/tasks/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM learning_tasks WHERE id = ?")
      .run(id);
    if (result.changes === 0) {
      throw new AppError(404, "LEARNING_TASK_NOT_FOUND", "学习任务不存在");
    }
    return { ok: true };
  });

  app.post("/api/learning/logs", async (request, reply) => {
    const parsed = learningLogSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_LEARNING_LOG", "学习记录无效");
    ensureGoal(app, parsed.data.goalId);
    if (parsed.data.taskId) ensureTaskBelongsToGoal(app, parsed.data.taskId, parsed.data.goalId);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `INSERT INTO learning_logs
           (id, goal_id, task_id, study_date, duration_minutes, content, progress_after, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          parsed.data.goalId,
          parsed.data.taskId ?? null,
          parsed.data.studyDate,
          parsed.data.durationMinutes,
          parsed.data.content,
          parsed.data.progressAfter ?? null,
          now
        );
      if (parsed.data.progressAfter !== undefined && parsed.data.progressAfter !== null) {
        app.localDatabase
          .prepare(
            `UPDATE learning_goals SET progress = ?,
              status = CASE WHEN ? = 100 THEN 'completed' ELSE status END,
              updated_at = ? WHERE id = ?`
          )
          .run(parsed.data.progressAfter, parsed.data.progressAfter, now, parsed.data.goalId);
      }
    })();
    return reply.status(201).send(findLearningLog(app, id));
  });

  app.delete("/api/learning/logs/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM learning_logs WHERE id = ?")
      .run(id);
    if (result.changes === 0) {
      throw new AppError(404, "LEARNING_LOG_NOT_FOUND", "学习记录不存在");
    }
    return { ok: true };
  });
}

function getLearningBundle(app: FastifyInstance) {
  const goals = app.localDatabase
    .prepare(
      `SELECT id, title, description, category, status,
        start_date AS startDate, target_date AS targetDate, progress,
        created_at AS createdAt, updated_at AS updatedAt
       FROM learning_goals ORDER BY status, updated_at DESC`
    )
    .all();
  const stages = app.localDatabase
    .prepare(
      `SELECT id, goal_id AS goalId, title, status, position, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM learning_stages ORDER BY position, created_at`
    )
    .all();
  const tasks = app.localDatabase
    .prepare(
      `SELECT id, goal_id AS goalId, stage_id AS stageId, title,
        plan_date AS planDate, status, estimated_minutes AS estimatedMinutes,
        notes, created_at AS createdAt, updated_at AS updatedAt
       FROM learning_tasks ORDER BY coalesce(plan_date, '9999-12-31'), created_at`
    )
    .all();
  const logs = app.localDatabase
    .prepare(
      `SELECT id, goal_id AS goalId, task_id AS taskId, study_date AS studyDate,
        duration_minutes AS durationMinutes, content, progress_after AS progressAfter,
        created_at AS createdAt
       FROM learning_logs ORDER BY study_date DESC, created_at DESC`
    )
    .all();
  return { goals, stages, tasks, logs };
}

function ensureGoal(app: FastifyInstance, id: string): void {
  if (!app.localDatabase.prepare("SELECT id FROM learning_goals WHERE id = ?").get(id)) {
    throw new AppError(404, "LEARNING_GOAL_NOT_FOUND", "学习目标不存在");
  }
}

function ensureStageBelongsToGoal(
  app: FastifyInstance,
  stageId: string | null,
  goalId: string
): void {
  if (!stageId) return;
  const row = app.localDatabase
    .prepare("SELECT goal_id AS goalId FROM learning_stages WHERE id = ?")
    .get(stageId) as { goalId: string } | undefined;
  if (!row || row.goalId !== goalId) {
    throw new AppError(400, "INVALID_LEARNING_STAGE", "学习阶段不属于当前学习目标");
  }
}

function ensureTaskBelongsToGoal(
  app: FastifyInstance,
  taskId: string,
  goalId: string
): void {
  const row = app.localDatabase
    .prepare("SELECT goal_id AS goalId FROM learning_tasks WHERE id = ?")
    .get(taskId) as { goalId: string } | undefined;
  if (!row || row.goalId !== goalId) {
    throw new AppError(400, "INVALID_LEARNING_TASK", "学习任务不属于当前学习目标");
  }
}

function findGoal(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, title, description, category, status,
          start_date AS startDate, target_date AS targetDate, progress,
          created_at AS createdAt, updated_at AS updatedAt
         FROM learning_goals WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function findStage(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, goal_id AS goalId, title, status, position, notes,
          created_at AS createdAt, updated_at AS updatedAt
         FROM learning_stages WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function findTask(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, goal_id AS goalId, stage_id AS stageId, title,
          plan_date AS planDate, status, estimated_minutes AS estimatedMinutes,
          notes, created_at AS createdAt, updated_at AS updatedAt
         FROM learning_tasks WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function findLearningLog(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, goal_id AS goalId, task_id AS taskId, study_date AS studyDate,
          duration_minutes AS durationMinutes, content, progress_after AS progressAfter,
          created_at AS createdAt
         FROM learning_logs WHERE id = ?`
      )
      .get(id) ?? null
  );
}
