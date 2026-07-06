import { z } from "zod";

const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be in YYYY-MM-DD format");

const priority = z.enum(["HIGH", "MEDIUM", "LOW"]);

// FR-030: Create Issue (labelIds arrives with FR-038 on Day 4)
export const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(5000, "Description must be 5000 characters or less").optional(),
  assigneeUserId: z.string().uuid("Invalid assignee").optional(),
  dueDate: dueDate.optional(),
  priority: priority.optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

// FR-032: Update Issue — all fields optional; null clears nullable fields
export const updateIssueSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: dueDate.nullable().optional(),
  priority: priority.optional(),
  statusId: z.string().uuid().optional(),
});

export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
