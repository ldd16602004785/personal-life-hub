import { z } from "zod";

export const memoInputSchema = z.object({
  content: z.string().trim().min(1, "备忘内容不能为空").max(2000)
});

export const memoUpdateSchema = z
  .object({
    content: z.string().trim().min(1).max(2000).optional(),
    completed: z.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "至少修改一个字段");

export type MemoInput = z.infer<typeof memoInputSchema>;
