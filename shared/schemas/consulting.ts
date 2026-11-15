import { z } from "zod";

const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();
const nullableDateTime = z.string().nullable().optional();

export const consultingClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactNotes: z.string().max(5000).default(""),
  direction: z.string().max(200).default(""),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  archived: z.boolean().default(false)
});

export const consultingProjectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  goal: z.string().max(5000).default(""),
  status: z.enum(["intake", "active", "paused", "completed"]).default("active"),
  startDate: nullableDate,
  nextSessionAt: nullableDateTime,
  feeStatus: z
    .enum(["unquoted", "pending", "partial", "paid", "not_required"])
    .default("unquoted")
});

export const consultingSessionSchema = z.object({
  projectId: z.string().min(1),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  method: z.string().max(100).default(""),
  topics: z.string().max(5000).default(""),
  conclusions: z.string().max(5000).default(""),
  notes: z.string().max(10000).default("")
});

export const consultingActionSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  owner: z.string().max(100).default(""),
  dueDate: nullableDate,
  completed: z.boolean().default(false)
});
