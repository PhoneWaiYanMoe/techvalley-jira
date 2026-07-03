import { z } from "zod";

// FR-020: Create Project
export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// FR-023: Update Project
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
});

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// FR-026: Archive Project
export const archiveProjectSchema = z.object({
  archived: z.boolean(),
});

export type ArchiveProjectInput = z.infer<typeof archiveProjectSchema>;

// FR-027: Favorite Project
export const favoriteProjectSchema = z.object({
  favorite: z.boolean(),
});

export type FavoriteProjectInput = z.infer<typeof favoriteProjectSchema>;
