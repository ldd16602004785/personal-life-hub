import { z } from "zod";

export const moduleSourceSchema = z.enum([
  "care",
  "dev",
  "consulting",
  "fitness",
  "diet",
  "entertainment"
]);

export const dayPlanCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/)
      .nullable()
      .optional(),
    durationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    notes: z.string().max(5000).default(""),
    sourceModule: moduleSourceSchema.optional(),
    sourceId: z.string().min(1).optional()
  })
  .refine(
    (value) =>
      Boolean(value.title?.trim()) ||
      Boolean(value.sourceModule && value.sourceId),
    "临时事项需要标题"
  )
  .refine(
    (value) =>
      (!value.sourceModule && !value.sourceId) ||
      Boolean(value.sourceModule && value.sourceId),
    "模块事项必须同时提供来源模块和来源记录"
  );

export const dayPlanUpdateSchema = z.object({
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  durationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  notes: z.string().max(5000).optional()
});

export type DayPlanCreate = z.infer<typeof dayPlanCreateSchema>;
