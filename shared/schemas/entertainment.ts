import { z } from "zod";

export const entertainmentItemSchema = z.object({
  mediaType: z.enum(["game", "film", "book", "other"]),
  name: z.string().trim().min(1).max(300),
  status: z.enum(["wishlist", "active", "completed", "paused"]).default("wishlist"),
  progress: z.number().int().min(0).max(100).default(0),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  finishDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(5000).default("")
});

export const entertainmentLogSchema = z.object({
  itemId: z.string().min(1),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.number().int().min(1).max(1440),
  progress: z.number().int().min(0).max(100).nullable().optional(),
  notes: z.string().max(3000).default("")
});
