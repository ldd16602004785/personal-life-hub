import { z } from "zod";

const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const learningGoalSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).default(""),
  category: z.string().max(100).default(""),
  status: z.enum(["planning", "active", "paused", "completed"]).default("active"),
  startDate: nullableDate,
  targetDate: nullableDate,
  progress: z.number().int().min(0).max(100).default(0)
});

export const learningStageSchema = z.object({
  goalId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  status: z.enum(["planning", "in_progress", "completed"]).default("planning"),
  position: z.number().int().min(0).max(10000).default(0),
  notes: z.string().max(3000).default("")
});

export const learningTaskSchema = z.object({
  goalId: z.string().min(1),
  stageId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300),
  planDate: nullableDate,
  status: z.enum(["todo", "in_progress", "completed"]).default("todo"),
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  notes: z.string().max(5000).default("")
});

export const learningLogSchema = z.object({
  goalId: z.string().min(1),
  taskId: z.string().nullable().optional(),
  studyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(1).max(1440),
  content: z.string().max(10000).default(""),
  progressAfter: z.number().int().min(0).max(100).nullable().optional()
});
