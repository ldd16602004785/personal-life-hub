import { z } from "zod";

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const devProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(""),
  status: z.enum(["planning", "active", "paused", "completed"]).default("active"),
  startDate: dateOrNull,
  dueDate: dateOrNull,
  archived: z.boolean().default(false)
});

export const devItemSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(300),
  type: z.enum(["feature", "bug", "improvement", "note", "other"]).default("feature"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  status: z
    .enum(["todo", "in_progress", "review", "completed", "cancelled"])
    .default("todo"),
  dueDate: dateOrNull,
  description: z.string().max(10000).default("")
});

export const devMilestoneSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean().default(false)
});

export const devTimeEntrySchema = z.object({
  projectId: z.string().min(1),
  itemId: z.string().nullable().optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(1).max(1440),
  notes: z.string().max(3000).default("")
});
