import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  entertainmentItemSchema,
  entertainmentLogSchema
} from "../../../shared/schemas/entertainment";
import { AppError } from "./errors";

export function registerEntertainmentRoutes(app: FastifyInstance): void {
  app.get("/api/entertainment", async () => getEntertainmentBundle(app));

  app.post("/api/entertainment/items", async (request, reply) => {
    const parsed = entertainmentItemSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_ENTERTAINMENT_ITEM", "娱乐项目无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO entertainment_items
         (id, media_type, name, status, progress, start_date, finish_date, rating, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.mediaType,
        parsed.data.name,
        parsed.data.status,
        parsed.data.progress,
        parsed.data.startDate ?? null,
        parsed.data.finishDate ?? null,
        parsed.data.rating ?? null,
        parsed.data.notes,
        now,
        now
      );
    return reply.status(201).send(findItem(app, id));
  });

  app.patch("/api/entertainment/items/:id", async (request) => {
    const { id } = request.params as { id: string };
    const current = findItem(app, id);
    if (!current) throw new AppError(404, "ENTERTAINMENT_ITEM_NOT_FOUND", "娱乐项目不存在");
    const parsed = entertainmentItemSchema.safeParse({ ...current, ...(request.body as object) });
    if (!parsed.success) throw new AppError(400, "INVALID_ENTERTAINMENT_ITEM", "娱乐项目无效");
    app.localDatabase
      .prepare(
        `UPDATE entertainment_items SET media_type = ?, name = ?, status = ?,
          progress = ?, start_date = ?, finish_date = ?, rating = ?, notes = ?,
          updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.mediaType,
        parsed.data.name,
        parsed.data.status,
        parsed.data.progress,
        parsed.data.startDate ?? null,
        parsed.data.finishDate ?? null,
        parsed.data.rating ?? null,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return findItem(app, id);
  });

  app.delete("/api/entertainment/items/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM entertainment_items WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "ENTERTAINMENT_ITEM_NOT_FOUND", "娱乐项目不存在");
    return { ok: true };
  });

  app.post("/api/entertainment/logs", async (request, reply) => {
    const parsed = entertainmentLogSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_ENTERTAINMENT_LOG", "娱乐记录无效");
    if (!findItem(app, parsed.data.itemId)) {
      throw new AppError(404, "ENTERTAINMENT_ITEM_NOT_FOUND", "娱乐项目不存在");
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `INSERT INTO entertainment_logs
           (id, item_id, log_date, duration_minutes, progress, notes, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          parsed.data.itemId,
          parsed.data.logDate,
          parsed.data.durationMinutes,
          parsed.data.progress ?? null,
          parsed.data.notes,
          now
        );
      if (parsed.data.progress !== undefined && parsed.data.progress !== null) {
        app.localDatabase
          .prepare(
            `UPDATE entertainment_items SET progress = ?,
              status = CASE WHEN ? = 100 THEN 'completed' ELSE status END,
              updated_at = ? WHERE id = ?`
          )
          .run(parsed.data.progress, parsed.data.progress, now, parsed.data.itemId);
      }
    })();
    return reply.status(201).send(
      app.localDatabase
        .prepare(
          `SELECT id, item_id AS itemId, log_date AS logDate,
            duration_minutes AS durationMinutes, progress, notes, created_at AS createdAt
           FROM entertainment_logs WHERE id = ?`
        )
        .get(id)
    );
  });

  app.delete("/api/entertainment/logs/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM entertainment_logs WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "ENTERTAINMENT_LOG_NOT_FOUND", "娱乐记录不存在");
    return { ok: true };
  });
}

function getEntertainmentBundle(app: FastifyInstance) {
  const items = app.localDatabase
    .prepare(
      `SELECT id, media_type AS mediaType, name, status, progress,
        start_date AS startDate, finish_date AS finishDate, rating, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM entertainment_items ORDER BY updated_at DESC`
    )
    .all();
  const logs = app.localDatabase
    .prepare(
      `SELECT id, item_id AS itemId, log_date AS logDate,
        duration_minutes AS durationMinutes, progress, notes, created_at AS createdAt
       FROM entertainment_logs ORDER BY log_date DESC, created_at DESC`
    )
    .all();
  return { items, logs };
}

function findItem(app: FastifyInstance, id: string) {
  return app.localDatabase
    .prepare(
      `SELECT id, media_type AS mediaType, name, status, progress,
        start_date AS startDate, finish_date AS finishDate, rating, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM entertainment_items WHERE id = ?`
    )
    .get(id) ?? null;
}
