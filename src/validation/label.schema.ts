import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex code like #6366f1");

// FR-038: Label — name 1-30, color required hex.
export const createLabelSchema = z.object({
  name: z.string().min(1, "Name is required").max(30, "Name must be 30 characters or less"),
  color: hexColor,
});

export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(30).optional(),
  color: hexColor.optional(),
});

export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;
