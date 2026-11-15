import { z } from "zod";

export const fitnessExerciseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  targetSets: z.number().int().min(1).max(100).nullable().optional(),
  targetReps: z.number().int().min(1).max(1000).nullable().optional(),
  targetWeight: z.number().min(0).max(10000).nullable().optional(),
  notes: z.string().max(1000).default("")
});

export const fitnessTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  weekday: z.number().int().min(1).max(7).nullable().optional(),
  bodyPart: z.string().max(200).default(""),
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  exercises: z.array(fitnessExerciseSchema).default([])
});

export const fitnessSessionStartSchema = z.object({
  templateId: z.string().min(1),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const fitnessSessionUpdateSchema = z.object({
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  feelNotes: z.string().max(5000).optional(),
  status: z.enum(["in_progress", "completed"]).optional(),
  exercises: z
    .array(
      z.object({
        id: z.string().min(1),
        actualSets: z.number().int().min(0).max(100).nullable().optional(),
        actualReps: z.number().int().min(0).max(1000).nullable().optional(),
        actualWeight: z.number().min(0).max(10000).nullable().optional(),
        completed: z.boolean(),
        notes: z.string().max(1000).optional()
      })
    )
    .optional()
});

export const bodyMetricSchema = z.object({
  measuredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().min(1).max(1000).nullable().optional(),
  waistCm: z.number().min(1).max(1000).nullable().optional(),
  chestCm: z.number().min(1).max(1000).nullable().optional(),
  hipsCm: z.number().min(1).max(1000).nullable().optional(),
  notes: z.string().max(3000).default("")
});
