import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { memoInputSchema, memoUpdateSchema } from "../../../shared/schemas/memo";
import { AppError } from "./errors";
import { localDateString } from "../services/dates";

interface MemoRow {
  id: string;
  content: string;
  completed: number;
  createdAt: string;
  updatedAt: string;
}

export function registerMemoRoutes(app: FastifyInstance): void {
  app.get("/api/memos", async () => ({
    memos: listMemos(app)
  }));

  app.post("/api/memos", async (request, reply) => {
    const parsed = memoInputSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MEMO", "备忘内容不能为空");

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare("INSERT INTO memos (id, content, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run(id, parsed.data.content, now, now);
    return reply.status(201).send(findMemo(app, id));
  });

  app.patch("/api/memos/:id", async (request) => {
    const { id } = request.params as { id: string };
    const memo = findMemo(app, id);
    if (!memo) throw new AppError(404, "MEMO_NOT_FOUND", "备忘不存在");

    const parsed = memoUpdateSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_MEMO", "备忘修改内容无效");

    const content = parsed.data.content ?? memo.content;
    const completed = parsed.data.completed === undefined ? memo.completed : parsed.data.completed;
    app.localDatabase
      .prepare(
        "UPDATE memos SET content = ?, completed = ?, updated_at = ? WHERE id = ?"
      )
      .run(content, completed ? 1 : 0, new Date().toISOString(), id);
    return findMemo(app, id);
  });

  app.delete("/api/memos/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!findMemo(app, id)) throw new AppError(404, "MEMO_NOT_FOUND", "备忘不存在");
    app.localDatabase.prepare("DELETE FROM memos WHERE id = ?").run(id);
    return { ok: true };
  });

  app.post("/api/memos/:id/convert-to-day", async (request) => {
    const { id } = request.params as { id: string };
    const memo = findMemo(app, id);
    if (!memo) throw new AppError(404, "MEMO_NOT_FOUND", "备忘不存在");

    const now = new Date().toISOString();
    const dayPlanId = crypto.randomUUID();
    app.localDatabase.transaction(() => {
      app.localDatabase
        .prepare(
          `INSERT INTO day_plans
           (id, title, date, priority, source_type, status, notes, created_at, updated_at)
           VALUES (?, ?, ?, 'medium', 'custom', 'pending', '', ?, ?)`
        )
        .run(dayPlanId, memo.content, localDateString(), now, now);
      app.localDatabase.prepare("DELETE FROM memos WHERE id = ?").run(id);
    })();

    return {
      ok: true,
      dayPlanId
    };
  });
}

function listMemos(app: FastifyInstance): MemoRow[] {
  return app.localDatabase
    .prepare(
      `SELECT id, content, completed,
        created_at AS createdAt, updated_at AS updatedAt
       FROM memos ORDER BY completed ASC, updated_at DESC`
    )
    .all() as MemoRow[];
}

function findMemo(app: FastifyInstance, id: string): MemoRow | null {
  return (
    (app.localDatabase
      .prepare(
        `SELECT id, content, completed,
          created_at AS createdAt, updated_at AS updatedAt
         FROM memos WHERE id = ?`
      )
      .get(id) as MemoRow | undefined) ?? null
  );
}
