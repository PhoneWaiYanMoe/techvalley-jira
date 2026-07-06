import { z } from "zod";

// FR-010 / FR-011
export const createTeamSchema = z.object({
  name: z.string().min(1).max(50),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(50),
});

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
