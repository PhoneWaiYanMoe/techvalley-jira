import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/utils/errors";

export type UserTeam = {
  teamId: string;
  teamName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

// Returns the first team the user belongs to. Used as a stopgap until
// Dev A builds full team management (FR-010..019). If the user has no
// team membership, returns null.
export async function getUserTeams(userId: string): Promise<UserTeam[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_members")
    .select("team_id, role, teams!inner(id, name, deleted_at)")
    .eq("user_id", userId)
    .is("teams.deleted_at", null);

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to fetch team memberships");
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const team = row.teams as { id: string; name: string };
    return {
      teamId: row.team_id as string,
      teamName: team.name,
      role: row.role as "OWNER" | "ADMIN" | "MEMBER",
    };
  });
}

// Returns the user's first team, or throws 404 if they have none.
export async function getUserFirstTeam(userId: string): Promise<UserTeam> {
  const teams = await getUserTeams(userId);
  if (teams.length === 0) {
    throw new ApiError(404, "NO_TEAM", "You must belong to a team to manage projects");
  }
  return teams[0];
}

// Checks if a user is a member of a specific team. Throws 404 if not
// (FR-070: never leak existence across teams).
export async function requireTeamMembership(
  userId: string,
  teamId: string,
): Promise<"OWNER" | "ADMIN" | "MEMBER"> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_members")
    .select("role")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (error) {
    throw new ApiError(500, "DB_ERROR", "Failed to check team membership");
  }
  if (!data) {
    throw new ApiError(404, "NOT_FOUND", "Team not found");
  }
  return data.role as "OWNER" | "ADMIN" | "MEMBER";
}
