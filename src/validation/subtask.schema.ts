import { z } from "zod";

// FR-039-2: Subtask — title 1-200.
export const createSubtaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
});

export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>;

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().int().optional(),
});

export type UpdateSubtaskInput = z.infer<typeof updateSubtaskSchema>;
