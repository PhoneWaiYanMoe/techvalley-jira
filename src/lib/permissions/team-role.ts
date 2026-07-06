import type { TeamRole } from "@/types/api";

// FR-017: OWNER > ADMIN > MEMBER. Small shared helpers so role comparisons
// read the same way everywhere (team.service.ts, future project/issue guards).
export function isOwnerOrAdmin(role: TeamRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function isOwner(role: TeamRole): boolean {
  return role === "OWNER";
}
