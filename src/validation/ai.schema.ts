import { z } from "zod";

// FR-043: auto-label recommendation input (issue not yet created, so title/desc
// come from the create form rather than a stored issue).
export const autoLabelSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(5000).optional(),
});

export type AutoLabelInput = z.infer<typeof autoLabelSchema>;

// FR-044: duplicate detection compares a candidate title against existing issues.
export const duplicateCheckSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
});

export type DuplicateCheckInput = z.infer<typeof duplicateCheckSchema>;
