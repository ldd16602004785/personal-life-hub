import { z } from "zod";

export const careProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  relationshipStage: z.string().max(100).default(""),
  relationshipStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  intro: z.string().max(2000).default("")
});

export const careDateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["birthday", "anniversary", "first_meet", "other"]).default("anniversary"),
  repeatsYearly: z.boolean().default(true),
  leadDays: z.number().int().min(0).max(365).default(7),
  notes: z.string().max(3000).default("")
});

export const careStorySchema = z.object({
  happenedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  location: z.string().max(300).default(""),
  tag: z.string().max(50).default("")
});

export const carePreferenceSchema = z.object({
  groupName: z.enum(["like", "dislike", "gift", "other"]),
  content: z.string().trim().min(1).max(300),
  notes: z.string().max(1000).default("")
});

export const careWishSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["wish", "gift", "date", "other"]).default("wish"),
  status: z.enum(["idea", "planning", "completed"]).default("idea"),
  budget: z.number().int("预算必须填写整数元").nonnegative().nullable().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(3000).default("")
});
