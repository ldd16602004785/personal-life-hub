import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  bodyMetricSchema,
  fitnessSessionStartSchema,
  fitnessSessionUpdateSchema,
  fitnessTemplateSchema
} from "../../../shared/schemas/fitness";
import { AppError } from "./errors";

interface FitnessExerciseRow {
  id: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  notes: string;
}

interface FitnessTemplateRow {
  id: string;
  name: string;
  weekday: number | null;
  bodyPart: string;
  durationMinutes: number | null;
  exercises: FitnessExerciseRow[];
}

interface FitnessSessionRow {
  id: string;
  templateId: string | null;
  sessionDate: string;
  durationMinutes: number | null;
  feelNotes: string;
  status: string;
  exercises: Array<{ id: string; name: string; completed: number }>;
}

export function registerFitnessRoutes(app: FastifyInstance): void {
  app.get("/api/fitness", async () => getFitnessBundle(app));

  app.post("/api/fitness/templates", async (request, reply) => {
    const parsed = fitnessTemplateSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_TEMPLATE", "训练计划无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `INSERT INTO fitness_templates
           (id, name, weekday, body_part, duration_minutes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          parsed.data.name,
          parsed.data.weekday ?? null,
          parsed.data.bodyPart,
          parsed.data.durationMinutes ?? null,
          now,
          now
        );
      insertExercises(app, id, parsed.data.exercises);
    })();
    return reply.status(201).send(findTemplate(app, id));
  });

  app.patch("/api/fitness/templates/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!findTemplate(app, id)) throw new AppError(404, "TEMPLATE_NOT_FOUND", "训练计划不存在");
    const parsed = fitnessTemplateSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_TEMPLATE", "训练计划无效");
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `UPDATE fitness_templates SET name = ?, weekday = ?, body_part = ?,
            duration_minutes = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          parsed.data.name,
          parsed.data.weekday ?? null,
          parsed.data.bodyPart,
          parsed.data.durationMinutes ?? null,
          new Date().toISOString(),
          id
        );
      app.localDatabase
        .prepare("DELETE FROM fitness_template_exercises WHERE template_id = ?")
        .run(id);
      insertExercises(app, id, parsed.data.exercises);
    })();
    return findTemplate(app, id);
  });

  app.delete("/api/fitness/templates/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM fitness_templates WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "TEMPLATE_NOT_FOUND", "训练计划不存在");
    return { ok: true };
  });

  app.post("/api/fitness/sessions", async (request, reply) => {
    const parsed = fitnessSessionStartSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_SESSION", "开始训练参数无效");
    const template = findTemplate(app, parsed.data.templateId);
    if (!template) throw new AppError(404, "TEMPLATE_NOT_FOUND", "训练计划不存在");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `INSERT INTO fitness_sessions
           (id, template_id, session_date, duration_minutes, feel_notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, '', 'in_progress', ?, ?)`
        )
        .run(
          id,
          template.id,
          parsed.data.sessionDate,
          template.durationMinutes ?? null,
          now,
          now
        );
      const exercises = template.exercises;
      const insert = app.localDatabase.prepare(
        `INSERT INTO fitness_session_exercises
         (id, session_id, source_exercise_id, name, target_sets, target_reps,
          target_weight, actual_sets, actual_reps, actual_weight, completed, notes, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, ?, ?)`
      );
      exercises.forEach((exercise, index) =>
        insert.run(
          crypto.randomUUID(),
          id,
          exercise.id,
          exercise.name,
          exercise.targetSets,
          exercise.targetReps,
          exercise.targetWeight,
          exercise.notes,
          index
        )
      );
    })();
    return reply.status(201).send(findSession(app, id));
  });

  app.patch("/api/fitness/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findSession(app, id);
    if (!current) throw new AppError(404, "SESSION_NOT_FOUND", "训练记录不存在");
    const parsed = fitnessSessionUpdateSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_SESSION_UPDATE", "训练记录无效");
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `UPDATE fitness_sessions SET duration_minutes = ?, feel_notes = ?,
            status = ?, updated_at = ? WHERE id = ?`
        )
        .run(
          parsed.data.durationMinutes === undefined
            ? current.durationMinutes
            : parsed.data.durationMinutes,
          parsed.data.feelNotes ?? current.feelNotes,
          parsed.data.status ?? current.status,
          new Date().toISOString(),
          id
        );
      const update = app.localDatabase.prepare(
        `UPDATE fitness_session_exercises SET actual_sets = ?, actual_reps = ?,
          actual_weight = ?, completed = ?, notes = ? WHERE id = ? AND session_id = ?`
      );
      for (const exercise of parsed.data.exercises ?? []) {
        update.run(
          exercise.actualSets ?? null,
          exercise.actualReps ?? null,
          exercise.actualWeight ?? null,
          exercise.completed ? 1 : 0,
          exercise.notes ?? "",
          exercise.id,
          id
        );
      }
    })();
    return findSession(app, id);
  });

  app.delete("/api/fitness/sessions/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM fitness_sessions WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "SESSION_NOT_FOUND", "训练记录不存在");
    return { ok: true };
  });

  app.post("/api/fitness/metrics", async (request, reply) => {
    const parsed = bodyMetricSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_BODY_METRIC", "身体记录无效");
    const id = crypto.randomUUID();
    app.localDatabase
      .prepare(
        `INSERT INTO body_metrics
         (id, measured_on, weight_kg, waist_cm, chest_cm, hips_cm, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.measuredOn,
        parsed.data.weightKg ?? null,
        parsed.data.waistCm ?? null,
        parsed.data.chestCm ?? null,
        parsed.data.hipsCm ?? null,
        parsed.data.notes,
        new Date().toISOString()
      );
    return reply.status(201).send(
      app.localDatabase
        .prepare(
          `SELECT id, measured_on AS measuredOn, weight_kg AS weightKg,
            waist_cm AS waistCm, chest_cm AS chestCm, hips_cm AS hipsCm, notes
           FROM body_metrics WHERE id = ?`
        )
        .get(id)
    );
  });

  app.delete("/api/fitness/metrics/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM body_metrics WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "BODY_METRIC_NOT_FOUND", "身体记录不存在");
    return { ok: true };
  });
}

function insertExercises(
  app: FastifyInstance,
  templateId: string,
  exercises: Array<{
    name: string;
    targetSets?: number | null;
    targetReps?: number | null;
    targetWeight?: number | null;
    notes: string;
  }>
): void {
  const insert = app.localDatabase.prepare(
    `INSERT INTO fitness_template_exercises
     (id, template_id, name, target_sets, target_reps, target_weight, notes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  exercises.forEach((exercise, index) =>
    insert.run(
      crypto.randomUUID(),
      templateId,
      exercise.name,
      exercise.targetSets ?? null,
      exercise.targetReps ?? null,
      exercise.targetWeight ?? null,
      exercise.notes,
      index
    )
  );
}

function getFitnessBundle(app: FastifyInstance) {
  const templates = app.localDatabase
    .prepare(
      `SELECT id, name, weekday, body_part AS bodyPart,
        duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
       FROM fitness_templates ORDER BY coalesce(weekday, 8), created_at`
    )
    .all() as Array<Record<string, unknown>>;
  const exercises = app.localDatabase
    .prepare(
      `SELECT id, template_id AS templateId, name, target_sets AS targetSets,
        target_reps AS targetReps, target_weight AS targetWeight, notes, sort_order AS sortOrder
       FROM fitness_template_exercises ORDER BY sort_order`
    )
    .all() as Array<Record<string, unknown>>;
  const sessions = app.localDatabase
    .prepare(
      `SELECT id, template_id AS templateId, session_date AS sessionDate,
        duration_minutes AS durationMinutes, feel_notes AS feelNotes, status,
        created_at AS createdAt, updated_at AS updatedAt
       FROM fitness_sessions ORDER BY session_date DESC, created_at DESC`
    )
    .all() as Array<Record<string, unknown>>;
  const sessionExercises = app.localDatabase
    .prepare(
      `SELECT id, session_id AS sessionId, source_exercise_id AS sourceExerciseId,
        name, target_sets AS targetSets, target_reps AS targetReps,
        target_weight AS targetWeight, actual_sets AS actualSets,
        actual_reps AS actualReps, actual_weight AS actualWeight, completed, notes, sort_order AS sortOrder
       FROM fitness_session_exercises ORDER BY sort_order`
    )
    .all() as Array<Record<string, unknown>>;
  const metrics = app.localDatabase
    .prepare(
      `SELECT id, measured_on AS measuredOn, weight_kg AS weightKg,
        waist_cm AS waistCm, chest_cm AS chestCm, hips_cm AS hipsCm, notes
       FROM body_metrics ORDER BY measured_on DESC`
    )
    .all() as Array<Record<string, unknown>>;
  return {
    templates: templates.map((template) => ({
      ...template,
      exercises: exercises.filter(
        (exercise) => (exercise as { templateId: string }).templateId === template.id
      )
    })),
    sessions: sessions.map((session) => ({
      ...session,
      exercises: sessionExercises.filter(
        (exercise) => (exercise as { sessionId: string }).sessionId === session.id
      )
    })),
    metrics
  };
}

function findTemplate(app: FastifyInstance, id: string): FitnessTemplateRow | null {
  const template = app.localDatabase
    .prepare(
      `SELECT id, name, weekday, body_part AS bodyPart,
        duration_minutes AS durationMinutes, created_at AS createdAt, updated_at AS updatedAt
       FROM fitness_templates WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!template) return null;
  return {
    ...(template as Omit<FitnessTemplateRow, "exercises">),
    exercises: app.localDatabase
      .prepare(
        `SELECT id, template_id AS templateId, name, target_sets AS targetSets,
          target_reps AS targetReps, target_weight AS targetWeight, notes, sort_order AS sortOrder
         FROM fitness_template_exercises WHERE template_id = ? ORDER BY sort_order`
      )
      .all(id) as FitnessExerciseRow[]
  };
}

function findSession(app: FastifyInstance, id: string): FitnessSessionRow | null {
  const session = app.localDatabase
    .prepare(
      `SELECT id, template_id AS templateId, session_date AS sessionDate,
        duration_minutes AS durationMinutes, feel_notes AS feelNotes, status,
        created_at AS createdAt, updated_at AS updatedAt
       FROM fitness_sessions WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!session) return null;
  return {
    ...(session as Omit<FitnessSessionRow, "exercises">),
    exercises: app.localDatabase
      .prepare(
        `SELECT id, session_id AS sessionId, source_exercise_id AS sourceExerciseId,
          name, target_sets AS targetSets, target_reps AS targetReps,
          target_weight AS targetWeight, actual_sets AS actualSets,
          actual_reps AS actualReps, actual_weight AS actualWeight, completed, notes,
          sort_order AS sortOrder
         FROM fitness_session_exercises WHERE session_id = ? ORDER BY sort_order`
      )
      .all(id) as FitnessSessionRow["exercises"]
  };
}
