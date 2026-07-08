import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #6366f1");

// FR-053: Custom status (column). name 1-30, color optional hex, position optional.
export const createStatusSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name must be 30 characters or less"),
  color: hexColor.optional(),
  position: z.number().optional(),
});

export type CreateStatusInput = z.infer<typeof createStatusSchema>;

// FR-053/054: edit name/color/position (FR-053) and WIP limit (FR-054).
// wipLimit: 1-50 or null (unlimited).
export const updateStatusSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  color: hexColor.nullable().optional(),
  position: z.number().optional(),
  wipLimit: z
    .number()
    .int()
    .min(1, "WIP limit must be at least 1")
    .max(50, "WIP limit must be 50 or less")
    .nullable()
    .optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
