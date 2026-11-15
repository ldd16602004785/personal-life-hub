import crypto from "node:crypto";
import fs from "node:fs";
import type { FastifyInstance } from "fastify";
import {
  careDateSchema,
  carePreferenceSchema,
  careProfileSchema,
  careStorySchema,
  careWishSchema
} from "../../../shared/schemas/care";
import { AppError } from "./errors";
import { daysUntil, nextOccurrence } from "../services/dates";
import {
  deleteAttachment,
  resolveAttachment,
  saveAttachment
} from "../services/attachments";

interface CareStoryRow {
  id: string;
  happenedOn: string;
  title: string;
  content: string;
  location: string;
  tag: string;
  photoPath: string | null;
  photoOriginalName: string | null;
  photoMediaType: string | null;
  photoSize: number | null;
  createdAt: string;
  updatedAt: string;
  photoUrl?: string | null;
}

export function registerCareRoutes(app: FastifyInstance): void {
  app.get("/api/care", async () => getCareBundle(app));

  app.put("/api/care/profile", async (request) => {
    const parsed = careProfileSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CARE_PROFILE", "对象资料无效");
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO care_profile
         (id, name, relationship_stage, relationship_start, intro, updated_at)
         VALUES ('current', ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           relationship_stage = excluded.relationship_stage,
           relationship_start = excluded.relationship_start,
           intro = excluded.intro,
           updated_at = excluded.updated_at`
      )
      .run(
        parsed.data.name,
        parsed.data.relationshipStage,
        parsed.data.relationshipStart ?? null,
        parsed.data.intro,
        now
      );
    return getCareBundle(app).profile;
  });

  app.post("/api/care/dates", async (request, reply) => {
    const parsed = careDateSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CARE_DATE", "重要日期内容无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO care_dates
         (id, name, date, type, repeats_yearly, lead_days, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.name,
        parsed.data.date,
        parsed.data.type,
        parsed.data.repeatsYearly ? 1 : 0,
        parsed.data.leadDays,
        parsed.data.notes,
        now,
        now
      );
    return reply.status(201).send(findCareDate(app, id));
  });

  app.patch("/api/care/dates/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!findCareDate(app, id)) throw new AppError(404, "CARE_DATE_NOT_FOUND", "重要日期不存在");
    const parsed = careDateSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CARE_DATE", "重要日期内容无效");
    app.localDatabase
      .prepare(
        `UPDATE care_dates SET name = ?, date = ?, type = ?, repeats_yearly = ?,
          lead_days = ?, notes = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.name,
        parsed.data.date,
        parsed.data.type,
        parsed.data.repeatsYearly ? 1 : 0,
        parsed.data.leadDays,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return findCareDate(app, id);
  });

  app.delete("/api/care/dates/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM care_dates WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "CARE_DATE_NOT_FOUND", "重要日期不存在");
    return { ok: true };
  });

  app.post("/api/care/stories", async (request, reply) => {
    const parsed = careStorySchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CARE_STORY", "趣事内容无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO care_stories
         (id, happened_on, title, content, location, tag, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.happenedOn,
        parsed.data.title,
        parsed.data.content,
        parsed.data.location,
        parsed.data.tag,
        now,
        now
      );
    return reply.status(201).send(findCareStory(app, id));
  });

  app.patch("/api/care/stories/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!findCareStory(app, id)) throw new AppError(404, "CARE_STORY_NOT_FOUND", "趣事不存在");
    const parsed = careStorySchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_CARE_STORY", "趣事内容无效");
    app.localDatabase
      .prepare(
        `UPDATE care_stories SET happened_on = ?, title = ?, content = ?,
          location = ?, tag = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.happenedOn,
        parsed.data.title,
        parsed.data.content,
        parsed.data.location,
        parsed.data.tag,
        new Date().toISOString(),
        id
      );
    return findCareStory(app, id);
  });

  app.post("/api/care/stories/:id/photo", async (request) => {
    const { id } = request.params as { id: string };
    const story = findCareStory(app, id);
    if (!story) throw new AppError(404, "CARE_STORY_NOT_FOUND", "趣事不存在");
    const file = await request.file();
    if (!file) throw new AppError(400, "PHOTO_REQUIRED", "请选择照片");
    const stored = saveAttachment(app.appConfig, {
      buffer: await file.toBuffer(),
      originalName: file.filename,
      mediaType: file.mimetype
    });
    if (story.photoPath) deleteAttachment(app.appConfig, story.photoPath);
    app.localDatabase
      .prepare(
        `UPDATE care_stories SET photo_path = ?, photo_original_name = ?,
          photo_media_type = ?, photo_size = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        stored.relativePath,
        stored.originalName,
        stored.mediaType,
        stored.size,
        new Date().toISOString(),
        id
      );
    return findCareStory(app, id);
  });

  app.get("/api/care/stories/:id/photo", async (request, reply) => {
    const { id } = request.params as { id: string };
    const story = findCareStory(app, id);
    if (!story?.photoPath) throw new AppError(404, "PHOTO_NOT_FOUND", "照片不存在");
    return reply
      .type(story.photoMediaType ?? "application/octet-stream")
      .header("Cache-Control", "private, max-age=3600")
      .send(createReadStreamFor(app, story.photoPath));
  });

  app.delete("/api/care/stories/:id", async (request) => {
    const { id } = request.params as { id: string };
    const query = request.query as { deletePhoto?: string };
    const story = findCareStory(app, id);
    if (!story) throw new AppError(404, "CARE_STORY_NOT_FOUND", "趣事不存在");
    if (story.photoPath && query.deletePhoto === "true") {
      deleteAttachment(app.appConfig, story.photoPath);
    }
    app.localDatabase.prepare("DELETE FROM care_stories WHERE id = ?").run(id);
    return { ok: true };
  });

  app.post("/api/care/preferences", async (request, reply) => {
    const parsed = carePreferenceSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_PREFERENCE", "偏好内容无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO care_preferences
         (id, group_name, content, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, parsed.data.groupName, parsed.data.content, parsed.data.notes, now, now);
    return reply.status(201).send({ id, ...parsed.data });
  });

  app.delete("/api/care/preferences/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase
      .prepare("DELETE FROM care_preferences WHERE id = ?")
      .run(id);
    if (result.changes === 0) throw new AppError(404, "PREFERENCE_NOT_FOUND", "偏好不存在");
    return { ok: true };
  });

  app.post("/api/care/wishes", async (request, reply) => {
    const parsed = careWishSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_WISH", "小心愿内容无效");
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    app.localDatabase
      .prepare(
        `INSERT INTO care_wishes
         (id, title, type, status, budget, target_date, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        parsed.data.title,
        parsed.data.type,
        parsed.data.status,
        parsed.data.budget ?? null,
        parsed.data.targetDate ?? null,
        parsed.data.notes,
        now,
        now
      );
    return reply.status(201).send(findWish(app, id));
  });

  app.patch("/api/care/wishes/:id", async (request) => {
    const { id } = request.params as { id: string };
    if (!findWish(app, id)) throw new AppError(404, "WISH_NOT_FOUND", "小心愿不存在");
    const parsed = careWishSchema.safeParse(request.body);
    if (!parsed.success) throw new AppError(400, "INVALID_WISH", "小心愿内容无效");
    app.localDatabase
      .prepare(
        `UPDATE care_wishes SET title = ?, type = ?, status = ?, budget = ?,
          target_date = ?, notes = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        parsed.data.title,
        parsed.data.type,
        parsed.data.status,
        parsed.data.budget ?? null,
        parsed.data.targetDate ?? null,
        parsed.data.notes,
        new Date().toISOString(),
        id
      );
    return findWish(app, id);
  });

  app.delete("/api/care/wishes/:id", async (request) => {
    const { id } = request.params as { id: string };
    const result = app.localDatabase.prepare("DELETE FROM care_wishes WHERE id = ?").run(id);
    if (result.changes === 0) throw new AppError(404, "WISH_NOT_FOUND", "小心愿不存在");
    return { ok: true };
  });
}

function getCareBundle(app: FastifyInstance) {
  const profile = app.localDatabase
    .prepare(
      `SELECT id, name, relationship_stage AS relationshipStage,
        relationship_start AS relationshipStart, intro, updated_at AS updatedAt
       FROM care_profile WHERE id = 'current'`
    )
    .get() ?? {
    id: "current",
    name: "",
    relationshipStage: "",
    relationshipStart: null,
    intro: "",
    updatedAt: null
  };
  const dates = (
    app.localDatabase
      .prepare(
        `SELECT id, name, date, type, repeats_yearly AS repeatsYearly,
          lead_days AS leadDays, notes, created_at AS createdAt, updated_at AS updatedAt
         FROM care_dates ORDER BY date`
      )
      .all() as Array<Record<string, unknown>>
  )
    .map((row) => enrichDate(row))
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
  const stories = (
    app.localDatabase
      .prepare(
        `SELECT id, happened_on AS happenedOn, title, content, location, tag,
          photo_path AS photoPath, photo_original_name AS photoOriginalName,
          photo_media_type AS photoMediaType, photo_size AS photoSize,
          created_at AS createdAt, updated_at AS updatedAt
         FROM care_stories ORDER BY happened_on DESC, created_at DESC`
      )
      .all() as CareStoryRow[]
  ).map((story) => ({
    ...story,
    photoUrl: storyPhotoUrl(story)
  }));
  const preferences = app.localDatabase
    .prepare(
      `SELECT id, group_name AS groupName, content, notes,
        created_at AS createdAt, updated_at AS updatedAt
       FROM care_preferences ORDER BY group_name, created_at`
    )
    .all();
  const wishes = (
    app.localDatabase
      .prepare(
        `SELECT id, title, type, status, budget, target_date AS targetDate,
          notes, created_at AS createdAt, updated_at AS updatedAt
         FROM care_wishes ORDER BY status, created_at DESC`
      )
      .all() as Array<Record<string, unknown>>
  ).map((wish) => ({ ...wish, targetDate: wish.targetDate ?? null }));
  const nextDate = dates[0] ?? null;

  return {
    profile,
    dates,
    stories,
    preferences,
    wishes,
    overview: {
      nextDate,
      storyCount: stories.length,
      dateCount: dates.length
    }
  };
}

function enrichDate(row: Record<string, unknown>) {
  const next = nextOccurrence(String(row.date), Boolean(row.repeatsYearly));
  return {
    ...row,
    repeatsYearly: Boolean(row.repeatsYearly),
    nextDate: next,
    days: next ? daysUntil(next) : null,
    attention: next ? daysUntil(next) <= Number(row.leadDays) : false
  };
}

function findCareDate(app: FastifyInstance, id: string) {
  const row = app.localDatabase
    .prepare(
      `SELECT id, name, date, type, repeats_yearly AS repeatsYearly,
        lead_days AS leadDays, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM care_dates WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? enrichDate(row) : null;
}

function findCareStory(app: FastifyInstance, id: string): CareStoryRow | null {
  const row = app.localDatabase
    .prepare(
      `SELECT id, happened_on AS happenedOn, title, content, location, tag,
        photo_path AS photoPath, photo_original_name AS photoOriginalName,
        photo_media_type AS photoMediaType, photo_size AS photoSize,
        created_at AS createdAt, updated_at AS updatedAt
       FROM care_stories WHERE id = ?`
    )
    .get(id) as CareStoryRow | undefined;
  return row
    ? {
        ...row,
        photoUrl: storyPhotoUrl(row)
      }
    : null;
}

function storyPhotoUrl(story: {
  id: unknown;
  photoPath: unknown;
  updatedAt?: unknown;
}): string | null {
  if (!story.photoPath) return null;
  return `/api/care/stories/${String(story.id)}/photo?v=${encodeURIComponent(
    String(story.updatedAt ?? story.photoPath)
  )}`;
}

function findWish(app: FastifyInstance, id: string) {
  return (
    app.localDatabase
      .prepare(
        `SELECT id, title, type, status, budget, target_date AS targetDate,
          notes, created_at AS createdAt, updated_at AS updatedAt
         FROM care_wishes WHERE id = ?`
      )
      .get(id) ?? null
  );
}

function createReadStreamFor(app: FastifyInstance, relativePath: string) {
  const absolutePath = resolveAttachment(app.appConfig, relativePath);
  return fs.createReadStream(absolutePath);
}
