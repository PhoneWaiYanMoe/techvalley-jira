import { z } from "zod";

// FR-060 / FR-062: Comment content — 1-1000 characters.
export const createCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be 1000 characters or less"),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be 1000 characters or less"),
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
