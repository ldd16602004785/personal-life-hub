import { z } from "zod";

export const mealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);

export const mealPlanSchema = z.object({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: mealTypeSchema,
  foods: z.string().trim().min(1).max(3000),
  plannedTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(3000).default("")
});

export const mealLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: mealTypeSchema,
  foods: z.string().trim().min(1).max(3000),
  eatenAt: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  feelings: z.string().max(3000).default("")
});

export const waterLogSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountMl: z.number().int().min(1).max(10000).default(250)
});

export const shoppingItemSchema = z.object({
  name: z.string().trim().min(1).max(300),
  category: z.string().max(100).default(""),
  purchased: z.boolean().default(false)
});
