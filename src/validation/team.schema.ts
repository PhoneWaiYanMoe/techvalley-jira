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

// FR-018
export const changeRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

// FR-013
export const createInviteSchema = z.object({
  email: z.email().max(255),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
